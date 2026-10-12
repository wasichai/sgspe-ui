import { useAuth } from '@wasichai/core'
import { Button, cn, Table, Tabs, Td, Th } from '@wasichai/ui'
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { useProyecto } from '../contexto/proyectos'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { idDeElemento, useCapas, type Encuadre, type EstadoDeCapa } from '../mapa/api'
import { avisoDelMapa } from '../mapa/avisos'
import { CAPAS, capa, dibujoDe } from '../mapa/capas'
import { ControlDeCapas } from '../mapa/ControlDeCapas'
import { Mapa } from '../mapa/Mapa'
import { aUtm, zonaDe } from '../mapa/utm'
import { importaA } from '../territorio/importacion'

// S09 · mapa del proyecto (screens.md §3, flujo 16): las dieciséis capas básicas por grupo, capturar PNG, importar, la
// barra de coordenadas en el CRS de trabajo y la tabla sincronizada: elegir en el mapa o en la tabla fija ?selected=. un
// miembro de un área (LYR-13) elige el lugar que dibuja, y una localidad o una comunidad elegida ofrece abrir su ficha
const IDS = CAPAS.map((c) => c.id)
const FICHA: Record<string, string> = { community: 'communities', locality: 'localities' }
const PREDIOS = ['LYR-14', 'LYR-15']

type EscuchaDelCursor = (punto: [number, number] | null) => void

// la barra de coordenadas en el CRS de trabajo: guarda el cursor aquí para que el puntero no repinte la página
function Coordenadas({ crs, escucha }: { crs: string; escucha: RefObject<EscuchaDelCursor | null> }) {
  const { t } = useTranslation(NS)
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  useEffect(() => {
    escucha.current = setCursor
    return () => {
      escucha.current = null
    }
  }, [escucha])
  const zona = zonaDe(crs)
  return (
    <p className="font-sg-mono text-sg-caption text-sg-text-muted" aria-live="off">
      {cursor
        ? zona
          ? t('mapa.coordenadas', {
              este: Math.round(aUtm(cursor[0], cursor[1], zona).este),
              norte: Math.round(aUtm(cursor[0], cursor[1], zona).norte),
              crs
            })
          : t('mapa.coordenadasGeo', { lon: cursor[0].toFixed(5), lat: cursor[1].toFixed(5) })
        : ' '}
    </p>
  )
}

export function MapaDelProyectoPage() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { can } = useAuth()
  const proyecto = useProyecto(projectId)
  const [busqueda, fijar] = useSearchParams()
  const [encendidas, setEncendidas] = useState(() => new Set(CAPAS.filter((c) => c.inicial).map((c) => c.id)))
  const [encuadre, setEncuadre] = useState<Encuadre | null>(null)
  // el cursor vive en <Coordenadas>: mover el puntero no vuelve a pintar la página, solo su línea
  const escuchaDelCursor = useRef<EscuchaDelCursor | null>(null)
  const alMoverCursor = useCallback((punto: [number, number] | null) => escuchaDelCursor.current?.(punto), [])
  const capturar = useRef<() => string | null>(() => null)
  const estados = useCapas([...encendidas], { project: projectId, bbox: encuadre })
  const [objetoElegido, seleccion = null] = busqueda.get('selected')?.split(':') ?? []
  const elegir = (objeto: string, id: string) => {
    const siguiente = new URLSearchParams(busqueda)
    siguiente.set('selected', `${objeto}:${id}`)
    fijar(siguiente, { replace: true })
  }
  const dibujadas = estados
    .filter((e) => e.datos)
    .map((e) => ({ id: e.id, datos: e.datos!, color: capa(e.id)!.color, ...dibujoDe(e.id), seleccionable: true, miembros: capa(e.id)!.miembros }))
  const aviso = avisoDelMapa(estados, encuadre !== null)
  // el elemento elegido (en una tabla o por la URL) no está dibujado: su capa está apagada o bloqueada, o cae fuera de la vista
  const cargando = estados.some((e) => e.cargando)
  const enElMapa = !!seleccion && dibujadas.some((d) => d.datos.features.some((e) => idDeElemento(e) === seleccion || e.properties.__targetId === seleccion))

  const descargar = () => {
    const png = capturar.current()
    if (!png) return
    const enlace = document.createElement('a')
    enlace.href = png
    enlace.download = `mapa-${texto(proyecto.data, 'code') || projectId}.png`
    enlace.click()
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h2 font-semibold">{t('mapa.mapaDelProyecto')}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={descargar}>
            {t('mapa.capturar')}
          </Button>
          {importaA(can, 'project_component') ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/territory/imports/new?project=${encodeURIComponent(projectId)}`}>{t('mapa.importar')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        <ControlDeCapas
          ids={IDS}
          encendidas={encendidas}
          estados={estados}
          alCambiar={(id, si) => {
            const siguiente = new Set(encendidas)
            if (si) siguiente.add(id)
            else siguiente.delete(id)
            setEncendidas(siguiente)
          }}
        />
        <div className="space-y-1">
          <Mapa
            etiqueta={t('mapa.mapaDelProyecto')}
            capas={dibujadas}
            seleccion={seleccion}
            alSeleccionar={(id, capaId, objeto) => elegir(objeto ?? capa(capaId)?.objeto ?? 'record', id)}
            alMoverVista={setEncuadre}
            alMoverCursor={alMoverCursor}
            alCapturar={(f) => (capturar.current = f)}
          />
          <Coordenadas crs={texto(proyecto.data, 'working_crs')} escucha={escuchaDelCursor} />
          {aviso ? (
            <p role="status" className="text-sm text-sg-text-muted">
              {t(`mapa.avisos.${aviso}`)}
            </p>
          ) : null}
          {seleccion && !cargando && !enElMapa ? (
            <p role="status" className="text-sm text-sg-text-muted">
              {t('mapa.fueraDeLaVista')}
            </p>
          ) : null}
          {seleccion && objetoElegido && FICHA[objetoElegido] ? (
            <p className="text-sm">
              {t('mapa.seleccion')}:{' '}
              <Link
                to={`/territory/${FICHA[objetoElegido]}/${encodeURIComponent(seleccion)}?project=${encodeURIComponent(projectId)}`}
                className="text-sg-primary-text underline"
              >
                {t('mapa.abrirFicha')}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
      <Tabs
        label={t('mapa.mapaDelProyecto')}
        tabs={[
          {
            id: 'componentes',
            label: t('mapa.tabla.componentes'),
            render: () => <Componentes proyecto={projectId} seleccion={seleccion} alElegir={(id) => elegir('project_component', id)} />
          },
          {
            id: 'areas',
            label: t('mapa.tabla.areas'),
            render: () => <Areas proyecto={projectId} seleccion={seleccion} alElegir={(id) => elegir('area_of_influence', id)} />
          },
          {
            id: 'predios',
            label: t('mapa.tabla.predios'),
            render: () => (
              <Predios
                encendidas={encendidas}
                estados={estados.filter((e) => PREDIOS.includes(e.id))}
                seleccion={seleccion}
                alElegir={(id) => elegir('land_parcel', id)}
              />
            )
          }
        ]}
      />
    </section>
  )
}

function Componentes({ proyecto, seleccion, alElegir }: { proyecto: string; seleccion: string | null; alElegir: (id: string) => void }) {
  const { t } = useTranslation(NS)
  // la versión vigente de cada componente: las reemplazadas se ven en su ficha (gis.md §2.4, RQ-GIS-010)
  const componentes = useTodos('project_component', { project: proyecto, sort: 'code', dir: 'asc' })
  const vigentes = (componentes.data ?? []).filter((c) => atributo(c, 'superseded') !== true)
  return (
    <>
      <Table aria-label={t('mapa.tabla.componentes')}>
        <thead>
          <tr>
            {(['codigo', 'tipo', 'estado', 'version'] as const).map((c) => (
              <Th key={c} scope="col">
                {t(`mapa.columnas.${c}`)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vigentes.map((c) => (
            <tr
              key={c.id}
              aria-selected={c.id === seleccion}
              className={c.id === seleccion ? 'bg-sg-primary-soft' : 'cursor-pointer hover:bg-sg-surface-hover'}
              onClick={() => alElegir(c.id)}
            >
              <Td className="font-sg-mono text-sg-caption">
                <BotonDeFila alElegir={() => alElegir(c.id)}>{texto(c, 'code')}</BotonDeFila>
              </Td>
              <Td className="text-sm">{texto(c, 'component_type')}</Td>
              <Td className="text-sm">{texto(c, 'component_status')}</Td>
              <Td className="text-sm">{texto(c, 'version_number')}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {componentes.isSuccess && vigentes.length === 0 ? <p className="pt-2 text-sm text-sg-text-muted">{t('comun.vacio')}</p> : null}
    </>
  )
}

// el control que elige la fila con el teclado; el clic de la fila entera ya llama a alElegir, así que este no lo repite
function BotonDeFila({ alElegir, children }: { alElegir: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="font-sg-mono"
      onClick={(e) => {
        e.stopPropagation()
        alElegir()
      }}
    >
      {children}
    </button>
  )
}

function Areas({ proyecto, seleccion, alElegir }: { proyecto: string; seleccion: string | null; alElegir: (id: string) => void }) {
  const { t } = useTranslation(NS)
  const areas = useTodos('area_of_influence', { project: proyecto, sort: 'version_number', dir: 'desc' })
  return (
    <ul className="space-y-1 pt-2 text-sm">
      {(areas.data ?? []).map((a: Registro) => (
        <li
          key={a.id}
          aria-current={a.id === seleccion ? 'true' : undefined}
          className={cn('flex items-center gap-2', a.id === seleccion && 'bg-sg-primary-soft')}
        >
          <Link to={`/projects/${encodeURIComponent(proyecto)}/areas/${encodeURIComponent(a.id)}`} className="text-sg-primary-text underline">
            {texto(a, 'area_type')} · v{texto(a, 'version_number')}
          </Link>
          <EstadoChip objeto="area_of_influence" estado={a.state} />
          {atributo(a, 'calculated_area_ha') !== undefined && atributo(a, 'calculated_area_ha') !== null ? (
            <span className="text-sg-caption">{numeroPe(Number(atributo(a, 'calculated_area_ha')))} ha</span>
          ) : null}
          <button
            type="button"
            className="text-sg-caption underline"
            aria-label={`${t('mapa.verEnElMapa')}: ${texto(a, 'area_type')} v${texto(a, 'version_number')}`}
            onClick={() => alElegir(a.id)}
          >
            {t('mapa.verEnElMapa')}
          </button>
        </li>
      ))}
      {areas.isSuccess && areas.data.length === 0 ? <li className="text-sg-text-muted">{t('comun.vacio')}</li> : null}
    </ul>
  )
}

// los predios salen de las capas LYR-14 y LYR-15 del mapa: si una está apagada, bloqueada o recortada al tope, la tabla lo dice
function Predios({
  encendidas,
  estados,
  seleccion,
  alElegir
}: {
  encendidas: ReadonlySet<string>
  estados: EstadoDeCapa[]
  seleccion: string | null
  alElegir: (id: string) => void
}) {
  const { t } = useTranslation(NS)
  const elementos = estados.flatMap((e) => e.datos?.features ?? [])
  const notas = PREDIOS.flatMap((id) => {
    const nombre = t(`mapa.capasNombre.${id}`)
    const estado = estados.find((e) => e.id === id)
    if (!encendidas.has(id)) return [t('mapa.predios.apagada', { capa: nombre })]
    if (estado?.bloqueada) return [t('mapa.predios.bloqueada', { capa: nombre })]
    // al mover la vista, una recarga que falla conserva lo último que se leyó (mapa/api.ts): la tabla sí muestra predios, los de
    // la vista anterior
    if (estado?.error) return [t(estado.datos ? 'mapa.predios.conErrorConDatos' : 'mapa.predios.conError', { capa: nombre })]
    if (estado?.truncada) return [t('mapa.predios.truncada', { capa: nombre })]
    if (estado?.datos && estado.datos.features.length === 0) return [t('mapa.predios.sinPredios', { capa: nombre })]
    return []
  })
  return (
    <>
      <Table aria-label={t('mapa.tabla.predios')}>
        <thead>
          <tr>
            {(['codigo', 'tenencia', 'area'] as const).map((c) => (
              <Th key={c} scope="col">
                {t(`mapa.columnas.${c}`)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {elementos.map((e) => {
            const id = idDeElemento(e)
            return (
              <tr key={id} aria-selected={id === seleccion} className={id === seleccion ? 'bg-sg-primary-soft' : 'cursor-pointer'} onClick={() => alElegir(id)}>
                <Td className="font-sg-mono text-sg-caption">
                  <BotonDeFila alElegir={() => alElegir(id)}>{String(e.properties.code ?? t('mapa.predioSinCodigo'))}</BotonDeFila>
                </Td>
                <Td className="text-sm">{String(e.properties.tenure_type ?? '')}</Td>
                <Td className="text-sm">
                  {e.properties.calculated_area_ha === undefined || e.properties.calculated_area_ha === null
                    ? '—'
                    : numeroPe(Number(e.properties.calculated_area_ha))}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      {notas.map((nota) => (
        <p key={nota} role="status" className="pt-2 text-sm text-sg-text-muted">
          {nota}
        </p>
      ))}
    </>
  )
}
