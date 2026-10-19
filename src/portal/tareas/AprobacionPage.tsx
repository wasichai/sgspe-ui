import { Alert, Button, Textarea } from '@wasichai/ui'
import { useAvailableTransitions } from '@wasichai/workflow'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, NoEsDeSusProyectos } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { sinBandeja } from '../datos/avisos'
import { montoPe } from '../componentes/Monto'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { atributo, texto, useRegistro, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useAplicarTransicion, useComprobacion } from '../transiciones/api'
import { useTextoDeAviso } from '../transiciones/avisos'
import { APROBACIONES_DE, rutaDeDecision, useAprobacionesPendientes } from './AprobacionesPage'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { Persona } from '../componentes/Persona'

// S31 · aprobación de compromiso (/tasks/approvals/commitment/:recordId; screens.md §7, flujo 8): la bandeja a la izquierda,
// el compromiso con su origen y la decisión con motivo obligatorio (commitment es requiresReason); a la derecha, las reglas de
// la transición elegida con transition-checks (D1 a D7: la segregación, el nivel superior y el tope dicen por qué no se puede).
// las decisiones son las transiciones que GET …/transitions devuelve permitidas para el rol en pending_approval: approve,
// approve_senior, return_to_draft y cancel_pending_approval. quien decide no edita el compromiso (`u` de APPROVER). la ruta
// lleva el objeto y el registro porque una aprobación no es una tarea (decisión del plan): ux-architecture.md decía :taskId
const DECISIONES = ['approve', 'approve_senior', 'return_to_draft', 'cancel_pending_approval']

export function AprobacionPage() {
  const { recordId = '' } = useParams()
  const compromiso = useRegistro('commitment', recordId)
  // la clave por registro: pasar por la bandeja a otro compromiso ya leído monta otra decisión, sin el motivo ni la elección
  // del anterior (revisión de la Tarea 14, importante 1)
  // un 404 es un registro que no existe o que no es de sus proyectos (alcance por proyecto, spec 4.4 §3.6): no se distingue
  return (
    <Consulta consulta={compromiso} noExiste={<NoEsDeSusProyectos />}>
      {(c) => <Decision key={c.id} compromiso={c} />}
    </Consulta>
  )
}

function Decision({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const navegar = useNavigate()
  const proyecto = texto(compromiso, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const transiciones = useAvailableTransitions('commitment', compromiso.id)
  const opciones = (transiciones.data ?? []).filter((x) => x.allowed && DECISIONES.includes(x.name))
  const [elegida, setElegida] = useState<string | null>(null)
  // la elegida vale solo si el registro la ofrece; sin elección, la aprobación de su rol (S31: «Aprobar» es la acción
  // principal), nunca la primera que liste el servidor (return_to_draft va antes en commitment.json); sin aprobación, nada
  const decision =
    (elegida && opciones.some((x) => x.name === elegida) ? elegida : null) ??
    opciones.find((x) => (APROBACIONES_DE.commitment ?? []).includes(x.name))?.name ??
    null
  const comprobacion = useComprobacion('commitment', compromiso.id, decision)
  // cada regla con su texto, nunca el mensaje del servidor con los nombres de la API (humo F4, D3)
  const textoDe = useTextoDeAviso('commitment')
  const transicionDecidida = opciones.find((x) => x.name === decision)
  const aplicar = useAplicarTransicion('commitment')
  const releer = useReleer()
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const origen = useRegistro('engagement', atributo<string>(compromiso, 'origin_engagement'))
  const campana = useRegistro('exploration_campaign', atributo<string>(compromiso, 'exploration_campaign'))
  const bloqueado = (comprobacion.data?.blocking.length ?? 0) > 0 || comprobacion.data?.allowed === false
  const confirmar = () => {
    setIntentado(true)
    if (!decision || !motivo.trim() || bloqueado || !comprobacion.isSuccess) return
    aplicar.mutate(
      { registro: compromiso, transicion: decision, motivo: motivo.trim() },
      { onSuccess: () => navegar('/tasks/approvals', { state: { hecha: true } }) }
    )
  }
  return (
    <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
      <Bandeja actual={compromiso.id} />
      <article className="space-y-4">
        <Link to="/tasks/approvals" className="text-sm text-sg-primary-text underline">
          {t('aprobaciones.decision.volver')}
        </Link>
        <h1 className="text-sg-h1 font-semibold">{t('aprobaciones.decision.titulo')}</h1>
        <section aria-label={t('aprobaciones.decision.resumen')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-sg-mono">{texto(compromiso, 'code')}</span>
            <EstadoChip objeto="commitment" estado={compromiso.state} />
          </div>
          <h2 className="text-sg-h2 font-semibold">{texto(compromiso, 'title')}</h2>
          <p className="whitespace-pre-line">{texto(compromiso, 'description')}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-sg-text-muted">{t('aprobaciones.decision.monto')}</dt>
              <dd className="tabular-nums">{montoPe(atributo(compromiso, 'amount'), atributo(compromiso, 'currency'))}</dd>
            </div>
            <div>
              <dt className="text-sg-text-muted">{t('aprobaciones.decision.campana')}</dt>
              <dd>
                {campana.data ? (
                  texto(campana.data, 'name')
                ) : !atributo(compromiso, 'exploration_campaign') ? (
                  '—'
                ) : campana.isError ? (
                  <FalloDeLectura error={campana.error} alReintentar={() => void campana.refetch()} />
                ) : (
                  '…'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sg-text-muted">{t('aprobaciones.decision.responsable')}</dt>
              <dd>
                <Persona correo={texto(compromiso, 'owner_user_email')} />
              </dd>
            </div>
            <div>
              <dt className="text-sg-text-muted">{t('aprobaciones.decision.vence')}</dt>
              <dd>
                <Dia valor={texto(compromiso, 'due_date')} />
              </dd>
            </div>
          </dl>
          <div>
            {t('aprobaciones.decision.origen')}:{' '}
            {origen.data ? (
              <Link
                to={`/projects/${encodeURIComponent(proyecto)}/engagements/${encodeURIComponent(origen.data.id)}`}
                className="text-sg-primary-text underline"
              >
                {texto(origen.data, 'title')} · {opcion(origen.data, 'engagement_type')}
              </Link>
            ) : !atributo(compromiso, 'origin_engagement') ? (
              t('aprobaciones.decision.sinOrigen')
            ) : origen.isError ? (
              <FalloDeLectura error={origen.error} alReintentar={() => void origen.refetch()} />
            ) : (
              '…'
            )}
          </div>
          <Link to={`/projects/${encodeURIComponent(proyecto)}/commitments/${encodeURIComponent(compromiso.id)}`} className="text-sg-primary-text underline">
            {t('aprobaciones.decision.abrirFicha')}
          </Link>
        </section>
        <section aria-label={t('aprobaciones.decision.decidir')} className="space-y-3">
          <h2 className="text-sg-h3 font-semibold">{t('aprobaciones.decision.decidir')}</h2>
          {!escribe ? (
            <Alert tone="notice">{t('aprobaciones.decision.soloLectura')}</Alert>
          ) : transiciones.isPending ? (
            <Cargando compacto />
          ) : transiciones.isError ? (
            <FalloDeLectura error={transiciones.error} alReintentar={() => void transiciones.refetch()} />
          ) : opciones.length === 0 ? (
            <p className="text-sm text-sg-text-muted">{t('aprobaciones.decision.sinDecisiones')}</p>
          ) : (
            <>
              <fieldset className="space-y-1">
                <legend className="sr-only">{t('aprobaciones.decision.decidir')}</legend>
                {opciones.map((x) => (
                  <label key={x.name} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="decision"
                      checked={decision === x.name}
                      onChange={() => {
                        setElegida(x.name)
                        aplicar.reset()
                      }}
                    />
                    {x.label}
                  </label>
                ))}
              </fieldset>
              <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && !motivo.trim() ? t('comun.motivoFalta') : undefined}>
                {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
              </Campo>
              {aplicar.isError ? (
                <AvisoDeConflicto
                  error={aplicar.error}
                  releer={() =>
                    releer(
                      ['record', 'commitment', compromiso.id],
                      ['transitions', 'commitment', compromiso.id],
                      ['transition-check', 'commitment', compromiso.id]
                    )
                  }
                  alRecargar={() => aplicar.reset()}
                />
              ) : null}
              <div className="flex gap-2">
                <Button onClick={confirmar} disabled={aplicar.isPending || bloqueado || !comprobacion.isSuccess} aria-busy={aplicar.isPending}>
                  {aplicar.isPending ? t('aprobaciones.decision.confirmando') : t('aprobaciones.decision.confirmar')}
                </Button>
                <Button variant="secondary" onClick={() => navegar('/tasks/approvals')}>
                  {t('aprobaciones.decision.despues')}
                </Button>
              </div>
            </>
          )}
        </section>
      </article>
      <aside aria-label={t('aprobaciones.decision.reglas')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
        <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('aprobaciones.decision.reglas')}</h2>
        {!decision ? null : comprobacion.isPending ? (
          <p className="text-sg-text-muted">{t('transiciones.comprobando')}</p>
        ) : comprobacion.isError ? (
          <FalloDeLectura error={comprobacion.error} alReintentar={() => void comprobacion.refetch()} />
        ) : (
          <>
            {comprobacion.data.blocking.map((b) => (
              <Alert key={`${b.code}-${b.field ?? ''}`} tone="danger" title={t('transiciones.bloqueo')}>
                {textoDe(b, transicionDecidida).texto ?? t('transiciones.reglaSinTexto')}
              </Alert>
            ))}
            {comprobacion.data.warnings.map((w) => (
              <Alert key={`${w.code}-${w.field ?? ''}`} tone="warning" title={t('transiciones.advertencia')}>
                {textoDe(w, transicionDecidida).texto ?? t('transiciones.reglaSinTexto')}
              </Alert>
            ))}
            {!bloqueado && comprobacion.data.warnings.length === 0 ? <p className="text-sg-success">{t('transiciones.sinBloqueos')}</p> : null}
            {comprobacion.data.allowed === false && comprobacion.data.blocking.length === 0 ? (
              <Alert tone="danger">{t('transiciones.noPermitido')}</Alert>
            ) : null}
          </>
        )}
      </aside>
    </div>
  )
}

// la bandeja de S31: las demás aprobaciones pendientes, con la actual marcada
function Bandeja({ actual }: { actual: string }) {
  const { t } = useTranslation(NS)
  const { avisos, pendientes } = useAprobacionesPendientes()
  return (
    <nav aria-label={t('aprobaciones.vistas.porAprobar')} className="space-y-2 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('aprobaciones.vistas.porAprobar')}</h2>
      {avisos.isPending ? (
        <Cargando compacto />
      ) : avisos.isError && !avisos.data ? (
        // sin el módulo de avisos (404/403) no hay bandeja; cualquier otro fallo se dice, nunca una bandeja vacía
        sinBandeja(avisos.error) ? null : (
          <FalloDeLectura error={avisos.error} alReintentar={() => void avisos.refetch()} />
        )
      ) : (
        <ul className="space-y-1">
          {pendientes.map((a) => {
            const ruta = rutaDeDecision(a)
            return (
              <li key={a.id}>
                {ruta ? (
                  <Link
                    to={ruta}
                    aria-current={a.link?.recordId === actual ? 'page' : undefined}
                    className="block rounded-sg-sm px-2 py-1 hover:bg-sg-surface-hover aria-[current=page]:bg-sg-primary-soft"
                  >
                    {a.title}
                  </Link>
                ) : (
                  <span className="block px-2 py-1">{a.title}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}
