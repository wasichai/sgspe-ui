import { useAuth } from '@wasichai/core'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo, CONTROL, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useProyectos } from '../contexto/proyectos'
import { codigoDelError } from '../datos/http'
import { texto } from '../datos/registros'
import { NS } from '../i18n'
import { ErrorYBotonDeExportar, SelectorDeNivel, useExportacion } from '../reportes/exportacion'
import { useFormatosDeImportacion } from './consultas'
import {
  capaExportable,
  capasExportables,
  cuerpoDeExportacion,
  FORMATOS_DE_EXPORTACION,
  formatoDisponible,
  nombrePorDefecto,
  SOLO_LATLON,
  type Coordenadas,
  type FormatoDeExportacion
} from './exportacion'

// el diálogo de exportación geográfica (spec F6 §3.5 y §3.7, decisión 18 del plan 6.3): la capa fija el objeto, la geometría y sus
// filtros; solo se ofrecen las capas que la cuenta lee y exporta y, de cada una, los niveles que permite. fuera de INTERNO pide la
// lista de verificación. el servidor juzga de nuevo (DISCLOSURE_NOT_ALLOWED) y registra el export_log
export function DialogoDeExportacion({
  abierto,
  alCerrar,
  proyecto,
  capaInicial
}: {
  abierto: boolean
  alCerrar: () => void
  proyecto?: string
  capaInicial?: string
}) {
  const { t } = useTranslation(NS)
  return (
    <Drawer titulo={t('exportacionGeografica.titulo')} abierto={abierto} alCerrar={alCerrar}>
      {abierto ? <Formulario proyectoInicial={proyecto} capaInicial={capaInicial} /> : null}
    </Drawer>
  )
}

function Formulario({ proyectoInicial, capaInicial }: { proyectoInicial?: string; capaInicial?: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyectos = useProyectos()
  // la pista de los formatos de GDAL (hueco H3): sin respuesta, se ofrecen todos y decide el servidor (FORMAT_UNAVAILABLE)
  const formatos = useFormatosDeImportacion()
  const nombreDeRadios = useId()
  const capas = capasExportables(can)
  const [idDeCapa, setIdDeCapa] = useState(() => (capaExportable(capas, capaInicial) ?? capas[0])?.capa ?? '')
  const capa = capas.find((c) => c.capa === idDeCapa)
  const [objeto, setObjeto] = useState(capa?.objetos[0]?.objeto ?? '')
  const deObjeto = capa?.objetos.find((o) => o.objeto === objeto) ?? capa?.objetos[0]
  const [geometria, setGeometria] = useState(deObjeto?.geometrias[0] ?? '')
  const [formato, setFormato] = useState<FormatoDeExportacion>('geojson')
  const [coordenadas, setCoordenadas] = useState<Coordenadas>('LATLON')
  const [proyecto, setProyecto] = useState(proyectoInicial ?? '')
  const soloLatlon = SOLO_LATLON.has(formato)
  const coordenadasEfectivas: Coordenadas = soloLatlon ? 'LATLON' : coordenadas
  const cuerpo = (nivel: string) =>
    capa && deObjeto
      ? cuerpoDeExportacion({ capa, objeto: deObjeto.objeto, geometria, formato, coordenadas: coordenadasEfectivas, proyecto: proyecto || undefined, nivel })
      : null
  const exportacion = useExportacion({
    ruta: '/sgspe/territory/exports',
    nombre: () => nombrePorDefecto(deObjeto?.objeto ?? 'capa', exportacion.nivel, formato),
    aceptar: '*/*',
    // una exportación geográfica no crea registros de negocio: el servidor no usa Idempotency-Key (enmienda 12.3)
    conClave: false,
    filtros: () => cuerpo(exportacion.nivel)?.filters ?? {},
    extra: () => {
      const c = cuerpo(exportacion.nivel)
      return c ? { object: c.object, geometry: c.geometry, format: c.format, coordinates: c.coordinates } : {}
    }
  })
  if (!capa || !deObjeto) return <p className="text-sm text-sg-text-muted">{t('exportacionGeografica.sinCapas')}</p>
  // cualquier cambio del pedido quita el error del anterior
  const cambiar = (aplicar: () => void) => {
    aplicar()
    exportacion.reiniciar()
  }
  const elegirCapa = (id: string) => {
    const otra = capas.find((c) => c.capa === id)
    if (!otra) return
    setIdDeCapa(id)
    setObjeto(otra.objetos[0].objeto)
    setGeometria(otra.objetos[0].geometrias[0])
    // un nivel que la capa nueva no permite vuelve a INTERNO, con la lista de verificación de nuevo
    if (!(otra.niveles as string[]).includes(exportacion.nivel)) exportacion.cambiarNivel('INTERNO')
    exportacion.reiniciar()
  }
  const elegirObjeto = (valor: string) =>
    cambiar(() => {
      setObjeto(valor)
      setGeometria(capa.objetos.find((o) => o.objeto === valor)?.geometrias[0] ?? '')
    })
  const faltaProyecto = coordenadasEfectivas === 'UTM' && !proyecto
  const nombreDeCapa = (id: string) => (id === 'LYR-02' ? t('exportacionGeografica.localidadesYCiudades') : t(`mapa.capasNombre.${id}`))
  const listaDeFormatos = formatos.data?.formats
  // un 500 EXPORT_FAILED es un fallo de GDAL al escribir: se dice con su texto y el botón ofrece reintentar (enmienda 12.4)
  const fallo = exportacion.exportar.isError ? codigoDelError(exportacion.exportar.error) : null
  return (
    <div className="space-y-3 text-sm">
      <p className="text-sg-caption text-sg-text-muted">{t('exportacionGeografica.ayuda')}</p>
      <Campo etiqueta={t('exportacionGeografica.capa')} ayuda={idDeCapa === 'LYR-02' ? t('exportacionGeografica.localidadesEnteras') : undefined}>
        {(p) => (
          <SelectNativo
            {...p}
            vacio={false}
            value={idDeCapa}
            onChange={(e) => elegirCapa(e.target.value)}
            opciones={capas.map((c) => ({ valor: c.capa, etiqueta: nombreDeCapa(c.capa) }))}
          />
        )}
      </Campo>
      {capa.objetos.length > 1 ? (
        <Campo etiqueta={t('exportacionGeografica.objeto')}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              value={deObjeto.objeto}
              onChange={(e) => elegirObjeto(e.target.value)}
              opciones={capa.objetos.map((o) => ({ valor: o.objeto, etiqueta: t(`exportacionGeografica.objetos.${o.objeto}`, { defaultValue: o.objeto }) }))}
            />
          )}
        </Campo>
      ) : null}
      {deObjeto.geometrias.length > 1 ? (
        <Campo etiqueta={t('exportacionGeografica.geometria')}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              value={geometria}
              onChange={(e) => cambiar(() => setGeometria(e.target.value))}
              opciones={deObjeto.geometrias.map((g) => ({ valor: g, etiqueta: t(`exportacionGeografica.geometrias.${g}`) }))}
            />
          )}
        </Campo>
      ) : null}
      <Campo etiqueta={t('exportacionGeografica.formato')}>
        {(p) => (
          <select {...p} className={CONTROL} value={formato} onChange={(e) => cambiar(() => setFormato(e.target.value as FormatoDeExportacion))}>
            {FORMATOS_DE_EXPORTACION.map((f) => {
              const nombre = t(`exportacionGeografica.formatos.${f}`)
              const disponible = formatoDisponible(f, listaDeFormatos)
              return (
                <option key={f} value={f} disabled={!disponible}>
                  {disponible ? nombre : t('exportacionGeografica.formatoNoDisponible', { formato: nombre })}
                </option>
              )
            })}
          </select>
        )}
      </Campo>
      <fieldset className="space-y-1">
        <legend className="font-medium">{t('exportacionGeografica.coordenadas')}</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={nombreDeRadios}
            checked={coordenadasEfectivas === 'UTM'}
            disabled={soloLatlon}
            onChange={() => cambiar(() => setCoordenadas('UTM'))}
          />
          {t('exportacionGeografica.utm')}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name={nombreDeRadios} checked={coordenadasEfectivas === 'LATLON'} onChange={() => cambiar(() => setCoordenadas('LATLON'))} />
          {t('exportacionGeografica.latlon')}
        </label>
      </fieldset>
      <Campo etiqueta={t('exportacionGeografica.proyecto')} error={faltaProyecto ? t('exportacionGeografica.utmSinProyecto') : undefined}>
        {(p) => (
          <select {...p} className={CONTROL} value={proyecto} onChange={(e) => cambiar(() => setProyecto(e.target.value))}>
            <option value="">{t('exportacionGeografica.ninguno')}</option>
            {/* mientras la lista carga (o si falla), el proyecto de la pantalla sigue elegido */}
            {proyecto && !(proyectos.data ?? []).some((x) => x.id === proyecto) ? (
              <option value={proyecto}>{proyectos.isPending ? t('reportes.proyectosCargando') : t('reportes.proyectoDeLaPagina')}</option>
            ) : null}
            {(proyectos.data ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {texto(x, 'code')} · {texto(x, 'name')}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <SelectorDeNivel exportacion={exportacion} niveles={capa.niveles} descripciones="exportacionGeografica.niveles" />
      {/* en EXTERNO el servidor aplica el filtro fijo aunque no se pida: solo accesos, solo predios sin partida (spec §3.5) */}
      {exportacion.nivel === 'EXTERNO' && (deObjeto.objeto === 'project_component' || deObjeto.objeto === 'land_parcel') ? (
        <p className="text-sg-caption text-sg-text-muted">{t(`exportacionGeografica.filtroExterno.${deObjeto.objeto}`)}</p>
      ) : null}
      {exportacion.externo ? (
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={exportacion.checklist} onChange={(e) => exportacion.setChecklist(e.target.checked)} />
          {t('exportacionGeografica.checklist')}
        </label>
      ) : null}
      {exportacion.intentado && exportacion.externo && !exportacion.checklist ? (
        <p role="alert" className="text-sg-caption text-sg-danger">
          {t('reportes.checklistFalta')}
        </p>
      ) : null}
      {faltaProyecto ? null : (
        <ErrorYBotonDeExportar
          exportacion={exportacion}
          propios={() => ({ FORMAT_UNAVAILABLE: t('exportacionGeografica.formatoSinEscritor') })}
          etiqueta={fallo === 'EXPORT_FAILED' ? t('exportacionGeografica.reintentar') : t('exportacionGeografica.exportar')}
        />
      )}
    </div>
  )
}
