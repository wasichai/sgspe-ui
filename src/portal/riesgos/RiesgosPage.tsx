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
import { useParametrosDeLista, VistasGuardadas } from '../componentes/Lista'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { nombreDeProyecto, useProyecto, useProyectos } from '../contexto/proyectos'
import { rutaDeFicha } from '../datos/fichas'
import { atributo, texto, useTodosConTope, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { NivelDeRiesgo } from './NivelDeRiesgo'
import { nivelDePuntaje, TONO_DE_NIVEL, umbralesDe } from './niveles'

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

export function RiesgosPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const lista = useParametrosDeLista('registro')
  const [busqueda, fijar] = useSearchParams()
  const riesgos = useTodosConTope('social_risk', { project: proyecto, sort: 'code', dir: 'asc' })
  const registroDelProyecto = useProyecto(proyecto)
  const proyectos = useProyectos()
  const umbrales = umbralesDe(registroDelProyecto.data)
  const celda = lista.filtro('cell')
  const enLaVista = (riesgos.data ?? []).filter((r) => enVista(lista.vista, r, user?.id))
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
  const nombreDelProyecto = (id: string) => {
    const p = proyectos.data?.find((x) => x.id === id)
    return p ? nombreDeProyecto(p) : '…'
  }
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('riesgos.titulo')}</h1>
        {crea ? <Button onClick={() => abrirAlta(true)}>{t('riesgos.identificar')}</Button> : null}
      </div>
      {!proyecto && can('social_risk', 'CREATE') ? <p className="text-sm text-sg-text-muted">{t('riesgos.eligeProyecto')}</p> : null}
      <VistasGuardadas
        vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`riesgos.vistas.${v}`) }))}
        actual={lista.vista}
        alCambiar={(vista) => lista.cambiar({ view: vista, cell: null })}
      />
      {riesgos.truncado ? <Alert tone="warning">{t('riesgos.truncado', { n: numeroPe(riesgos.data?.length ?? 0) })}</Alert> : null}
      {riesgos.isPending ? (
        <Cargando />
      ) : riesgos.isError && !riesgos.data ? (
        <FalloDeLectura error={riesgos.error} alReintentar={() => void riesgos.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <section aria-label={t('riesgos.mapa.titulo')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
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
                      <Td className="text-sm">
                        <Link to={rutaDeFicha('social_risk', r) ?? '#'} className="text-sg-primary-text underline">
                          {texto(r, 'code')} · {texto(r, 'title')}
                        </Link>
                      </Td>
                      {proyecto ? null : <Td className="text-sm">{nombreDelProyecto(texto(r, 'project'))}</Td>}
                      <Td className="text-sm">{texto(r, 'category') || '—'}</Td>
                      <Td className="text-sm tabular-nums">{celdaDe(r) ? `${texto(r, 'probability')} × ${texto(r, 'impact')} = ${texto(r, 'score')}` : '—'}</Td>
                      <Td>
                        <NivelDeRiesgo valor={atributo(r, 'risk_level')} />
                      </Td>
                      <Td>
                        <EstadoChip objeto="social_risk" estado={r.state} />
                      </Td>
                      <Td className="space-x-1 text-sm">
                        <SituacionDePlazo valor={atributo(r, 'review_status')} revision />
                        <span>{texto(r, 'next_review_date') ? diaPe(texto(r, 'next_review_date')) : ''}</span>
                      </Td>
                      <Td className="text-sm">{texto(r, 'owner_user_email') || '—'}</Td>
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
                    aria-label={t('riesgos.mapa.celda', { p, i, n, nivel })}
                    onClick={() => alElegir(clave)}
                    className={cn(
                      'h-12 w-full rounded-sg-sm',
                      CLASE_DE_TONO[TONO_DE_NIVEL[nivel]],
                      elegida === clave && 'outline-2 outline-offset-1 outline-sg-focus'
                    )}
                  >
                    <span className="block text-sm font-semibold tabular-nums">{numeroPe(n)}</span>
                    <span className="block text-[10px]">{nivel}</span>
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
