import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { useAuth } from '@wasichai/core'
import { Alert, Button, cn, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { CLASE_DE_TONO } from '../componentes/apariencias'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { ChipsDeFiltro, useParametrosDeLista, VistasGuardadas } from '../componentes/Lista'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { rutaDeFicha } from '../datos/fichas'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyecto, useProyectos } from '../contexto/proyectos'
import { atributo, texto, useTodosSinTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { NivelDeRiesgo } from './NivelDeRiesgo'
import { nivelDePuntaje, TONO_DE_NIVEL, umbralesDe } from './niveles'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { Persona } from '../componentes/Persona'

// S38 y S39 · registro y matriz de riesgos (screens.md §9): qué riesgos hay, de qué nivel y cuáles piden revisión. la misma página
// con alcance global (columna Proyecto) o de un proyecto (ASM-076). la API genérica no filtra por estado ni por situación, así que,
// como la lista de compromisos, se leen los riesgos del alcance con tope (avisa si recorta) y las vistas y la celda elegida se arman
// aquí. el mapa de calor 5 × 5 cuenta los riesgos por sus valores vigentes (probabilidad e impacto, derivados de la última revisión
// no residual); uno sin revisión no entra al mapa y se cuenta aparte. elegir una celda filtra la tabla. «Identificar riesgo» crea
// el riesgo en identified con motivo (social_risk es requiresReason); ?nuevo=1 lo abre, y ?origin_incident= lo crea desde un
// incidente
const VISTAS = ['registro', 'revision', 'mios', 'cerrados'] as const
const ESCALA = [1, 2, 3, 4, 5] as const
const CAMPOS_DEL_ALTA = [
  'code',
  'title',
  'risk_source',
  'category',
  'impact_type',
  'impact_nature',
  'owner_user_id',
  'owner_user_email',
  'review_every_days',
  'locality',
  'community'
]

const cerrado = (r: Registro) => r.state === 'closed'

const NIVELES_ALTOS = ['ALTO', 'CRITICO']

export function enVista(vista: string, r: Registro, usuario: string | undefined): boolean {
  switch (vista) {
    case 'revision':
      return !cerrado(r) && ['POR REVISAR', 'REVISION VENCIDA'].includes(texto(r, 'review_status'))
    case 'mios':
      return !cerrado(r) && atributo(r, 'owner_user_id') === usuario
    case 'cerrados':
      return cerrado(r)
    default:
      return !cerrado(r)
  }
}

// la celda P-I de un riesgo con valores vigentes; sin ellos, null (sin evaluar)
export function celdaDe(r: Registro): string | null {
  const p = Number(atributo(r, 'probability'))
  const i = Number(atributo(r, 'impact'))
  return Number.isInteger(p) && Number.isInteger(i) && p >= 1 && p <= 5 && i >= 1 && i <= 5 ? `${p}-${i}` : null
}

// las páginas de riesgos que no son el registro: en «Más» del encabezado; fuera de un proyecto solo existen las reglas del tenant
const MAS_EN_PROYECTO = ['warnings', 'incidents', 'mentions', 'signals', 'impacts', 'rules'] as const
const MAS_GLOBAL = ['rules'] as const

export function RiesgosPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const lista = useParametrosDeLista('registro')
  const telefono = useEsTelefono()
  const [busqueda, fijar] = useSearchParams()
  // todos los riesgos del alcance, sin tope: la matriz de calor cuenta cada celda con el conjunto entero (D10 de la revisión de UX)
  const riesgos = useTodosSinTope('social_risk', { project: proyecto, sort: 'code', dir: 'asc' })
  const registroDelProyecto = useProyecto(proyecto)
  const proyectos = useProyectos()
  const umbrales = umbralesDe(registroDelProyecto.data)
  const celda = lista.filtro('cell')
  // ?level=alto: los de nivel alto o crítico, como «Riesgos altos» (KPI-RSK-01) del resumen y del tablero (revisión de UX, etapa 6)
  const soloAltos = lista.filtro('level') === 'alto'
  const enLaVista = (riesgos.data ?? []).filter((r) => enVista(lista.vista, r, user?.id) && (!soloAltos || NIVELES_ALTOS.includes(texto(r, 'risk_level'))))
  const filtrados = celda ? enLaVista.filter((r) => celdaDe(r) === celda) : enLaVista
  const sinEvaluar = enLaVista.filter((r) => celdaDe(r) === null).length
  const crea = proyecto !== undefined && escribe && can('social_risk', 'CREATE')
  const nuevo = busqueda.get('nuevo') === '1'
  const incidente = busqueda.get('origin_incident')
  const abrirAlta = (abrir: boolean) => {
    const siguiente = new URLSearchParams(busqueda)
    if (abrir) siguiente.set('nuevo', '1')
    else {
      siguiente.delete('nuevo')
      siguiente.delete('origin_incident')
    }
    fijar(siguiente, { replace: true })
  }
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
  const nombreDelProyecto = (id: string) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      {/* la sección aterriza en el registro y la matriz (decisión 7 de la revisión de UX): el tablero es una vista más, y las
          demás páginas de riesgos van en «Más» */}
      <EncabezadoDePagina
        titulo={t('riesgos.titulo')}
        conteo={riesgos.data ? t('riesgos.conteo', { count: filtrados.length }) : undefined}
        primaria={
          proyecto ? (
            crea ? (
              <Button size="sm" onClick={() => abrirAlta(true)}>
                {t('riesgos.identificar')}
              </Button>
            ) : undefined
          ) : (
            <BotonCrear objeto="social_risk" etiqueta={t('riesgos.identificar')} resto="risks?nuevo=1" />
          )
        }
        vistas={<VistasDelModulo modulo="risks" actual="lista" />}
        mas={(proyecto ? MAS_EN_PROYECTO : MAS_GLOBAL).map((resto) => (
          <Link key={resto} to={`${base}/risks/${resto}`} className="rounded-sg-sm px-2.5 py-1.5 text-sm hover:bg-sg-surface-hover">
            {t(`riesgos.mas.${resto}`)}
          </Link>
        ))}
      />
      <VistasGuardadas
        vistas={VISTAS.map((v) => ({
          id: v,
          etiqueta: t(`riesgos.vistas.${v}`),
          conteo: riesgos.data ? riesgos.data.filter((r) => enVista(v, r, user?.id)).length : null
        }))}
        actual={lista.vista}
        alCambiar={(vista) => lista.cambiar({ view: vista, cell: null })}
      />
      <ChipsDeFiltro
        chips={soloAltos ? [{ clave: 'level', etiqueta: t('riesgos.filtroAltos') }] : []}
        alQuitar={(clave) => lista.cambiar({ [clave]: null })}
        alLimpiar={() => lista.cambiar({ level: null })}
      />
      {riesgos.isPending ? (
        <Cargando />
      ) : riesgos.isError && !riesgos.data ? (
        <FalloDeLectura error={riesgos.error} alReintentar={() => void riesgos.refetch()} />
      ) : (
        <div className="grid gap-4 min-[105rem]:grid-cols-[360px_minmax(0,1fr)]">
          <section
            aria-label={t('riesgos.mapa.titulo')}
            className="w-full max-w-md space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 min-[105rem]:max-w-none"
          >
            <h2 className="text-sg-h3 font-semibold">{t('riesgos.mapa.titulo')}</h2>
            <MapaDeCalor riesgos={enLaVista} umbrales={umbrales} elegida={celda} alElegir={(c) => lista.cambiar({ cell: c })} />
            <p className="text-sm text-sg-text-secondary">{t('riesgos.mapa.sinEvaluar', { n: numeroPe(sinEvaluar) })}</p>
            {celda ? (
              <button type="button" className="text-sm text-sg-primary-text underline" onClick={() => lista.cambiar({ cell: null })}>
                {t('riesgos.mapa.quitar')}
              </button>
            ) : null}
          </section>
          {filtrados.length === 0 ? (
            <Vacio titulo={t('riesgos.vacio')} />
          ) : telefono ? (
            <ListaEnTarjetas
              etiqueta={t('riesgos.tabla')}
              tarjetas={filtrados.map((r) => ({
                id: r.id,
                titulo: (
                  <EnlaceDeRegistro
                    codigo={texto(r, 'code')}
                    titulo={texto(r, 'title')}
                    ruta={rutaDeFicha('social_risk', r)}
                    desde={t('riesgos.titulo')}
                    previa={{ objeto: 'social_risk', id: r.id }}
                  />
                ),
                estado: (
                  <>
                    <NivelDeRiesgo valor={atributo(r, 'risk_level')} />
                    <EstadoChip objeto="social_risk" estado={r.state} />
                  </>
                ),
                plazo: (
                  <>
                    <SituacionDePlazo valor={atributo(r, 'review_status')} revision />
                    {texto(r, 'next_review_date') ? <Dia valor={texto(r, 'next_review_date')} /> : null}
                  </>
                ),
                proyecto: proyecto ? undefined : nombreDelProyecto(texto(r, 'project'))
              }))}
            />
          ) : (
            <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
              <Table aria-label={t('riesgos.tabla')}>
                <thead>
                  <tr>
                    <Th scope="col">{t('riesgos.columnas.riesgo')}</Th>
                    {proyecto ? null : <Th scope="col">{t('riesgos.columnas.proyecto')}</Th>}
                    <Th scope="col">{t('riesgos.columnas.categoria')}</Th>
                    <Th scope="col">{t('riesgos.columnas.puntaje')}</Th>
                    <Th scope="col">{t('riesgos.columnas.nivel')}</Th>
                    <Th scope="col">{t('riesgos.columnas.estado')}</Th>
                    <Th scope="col">{t('riesgos.columnas.revision')}</Th>
                    <Th scope="col">{t('riesgos.columnas.responsable')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r) => (
                    <tr key={r.id}>
                      <Td className="min-w-64 text-sm">
                        <EnlaceDeRegistro
                          codigo={texto(r, 'code')}
                          titulo={texto(r, 'title')}
                          ruta={rutaDeFicha('social_risk', r)}
                          desde={t('riesgos.titulo')}
                          previa={{ objeto: 'social_risk', id: r.id }}
                        />
                      </Td>
                      {proyecto ? null : <Td className="text-sm">{nombreDelProyecto(texto(r, 'project'))}</Td>}
                      <Td className="text-sm">{opcion(r, 'category') || '—'}</Td>
                      <Td className="text-sm tabular-nums">
                        {celdaDe(r) && texto(r, 'score') ? `${texto(r, 'probability')} × ${texto(r, 'impact')} = ${texto(r, 'score')}` : '—'}
                      </Td>
                      <Td>
                        <NivelDeRiesgo valor={atributo(r, 'risk_level')} />
                      </Td>
                      <Td>
                        <EstadoChip objeto="social_risk" estado={r.state} />
                      </Td>
                      <Td className="space-x-1 text-sm">
                        <SituacionDePlazo valor={atributo(r, 'review_status')} revision />
                        {texto(r, 'next_review_date') ? <Dia valor={texto(r, 'next_review_date')} /> : null}
                      </Td>
                      <Td className="text-sm">
                        <Persona correo={texto(r, 'owner_user_email')} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      )}
      {crea ? <AltaDeRiesgo proyecto={proyecto} incidente={incidente} abierto={nuevo} alCerrar={() => abrirAlta(false)} /> : null}
    </section>
  )
}

// el mapa de calor (S39): filas de probabilidad (5 arriba) y columnas de impacto; cada celda dice cuántos riesgos tiene y su nivel
// con texto, y es un botón que filtra la tabla
function MapaDeCalor({
  riesgos,
  umbrales,
  elegida,
  alElegir
}: {
  riesgos: Registro[]
  umbrales: ReturnType<typeof umbralesDe>
  elegida: string
  alElegir: (celda: string) => void
}) {
  const { t } = useTranslation(NS)
  const conteo = new Map<string, number>()
  for (const r of riesgos) {
    const c = celdaDe(r)
    if (c) conteo.set(c, (conteo.get(c) ?? 0) + 1)
  }
  return (
    <table className="w-full table-fixed border-separate border-spacing-1 text-center text-sg-caption">
      <caption className="sr-only">{t('riesgos.mapa.leyenda')}</caption>
      <thead>
        <tr>
          <th scope="col" className="font-normal text-sg-text-muted">
            {t('riesgos.mapa.pi')}
          </th>
          {ESCALA.map((i) => (
            <th key={i} scope="col" className="font-normal text-sg-text-muted">
              {t('riesgos.mapa.impacto', { n: i })}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...ESCALA].reverse().map((p) => (
          <tr key={p}>
            <th scope="row" className="font-normal text-sg-text-muted">
              {t('riesgos.mapa.probabilidad', { n: p })}
            </th>
            {ESCALA.map((i) => {
              const clave = `${p}-${i}`
              const n = conteo.get(clave) ?? 0
              const nivel = nivelDePuntaje(p * i, umbrales)
              return (
                <td key={i}>
                  <button
                    type="button"
                    aria-pressed={elegida === clave}
                    aria-label={t('riesgos.mapa.celda', { p, i, count: n, nivel: t(`tableroRiesgos.niveles.${nivel}`) })}
                    onClick={() => alElegir(clave)}
                    className={cn(
                      'h-12 w-full rounded-sg-sm',
                      CLASE_DE_TONO[TONO_DE_NIVEL[nivel]],
                      elegida === clave && 'outline-2 outline-offset-1 outline-sg-focus'
                    )}
                  >
                    <span className="block text-sm font-semibold tabular-nums">{numeroPe(n)}</span>
                    <span className="block text-sg-caption">{t(`tableroRiesgos.niveles.${nivel}`)}</span>
                  </button>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// el alta de un riesgo con su motivo: el formulario de la metadata con el proyecto (y el incidente de origen) fijos
function AltaDeRiesgo({ proyecto, incidente, abierto, alCerrar }: { proyecto: string; incidente: string | null; abierto: boolean; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const [motivo, setMotivo] = useState('')
  const fijos = useMemo(() => (incidente ? { project: proyecto, origin_incident: incidente } : { project: proyecto }), [proyecto, incidente])
  const cerrar = () => {
    setMotivo('')
    alCerrar()
  }
  return (
    <Drawer titulo={t('riesgos.identificar')} descripcion={t('riesgos.alta.descripcion')} abierto={abierto} alCerrar={cerrar}>
      {incidente ? <Alert tone="notice">{t('riesgos.alta.desdeIncidente')}</Alert> : null}
      <Campo etiqueta={t('comun.motivoObligatorio')} ayuda={t('riesgos.alta.motivoAyuda')}>
        {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
      </Campo>
      <p className="text-sg-caption text-sg-text-muted">{t('riesgos.alta.cadencia')}</p>
      {abierto ? (
        <FormularioDeRegistro
          objeto="social_risk"
          fijos={fijos}
          campos={CAMPOS_DEL_ALTA}
          motivo={motivo.trim() || undefined}
          alGuardar={cerrar}
          alCancelar={cerrar}
        />
      ) : null}
    </Drawer>
  )
}
