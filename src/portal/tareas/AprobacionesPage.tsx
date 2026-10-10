import { useAvailableTransitions } from '@wasichai/workflow'
import { Alert, cn, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { Cargando, esIlegible, Reservado, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useParametrosDeLista, VistasGuardadas } from '../componentes/Lista'
import { montoPe } from '../componentes/Monto'
import { CLASE_DE_TIPO, FUENTE_DE_APROBACIONES, FUENTE_DE_PLAZOS, FUENTE_DE_RIESGOS, sinBandeja, useAvisos, type Aviso } from '../datos/avisos'
import { diasEntre, hoyEnLima } from '../datos/fechas'
import { destinoDeAviso, rutaParaAbrir } from '../datos/fichas'
import { atributo, texto, useRegistro } from '../datos/registros'
import { fechaYHoraPe, NS } from '../i18n'
import { useComprobacion } from '../transiciones/api'
import { useTextoDeAviso } from '../transiciones/avisos'

// S48 · aprobaciones y escalamientos (screens.md §11): las aprobaciones son transiciones, no objetos (domain-model.md §6.13).
// «Por aprobar» sale de los avisos approval_pending de wasichai-notifications (fuente sgspe.approvals, ACTION, con su enlace
// RECORD) que llegaron a quien mira por su asignación (ASM-070): la API genérica no filtra por estado, y el aviso ya trae a
// quién le toca decidir. «¿Puede decidir?» pregunta GET …/transitions y transition-checks por la aprobación de su rol (D4,
// D5, D7 dicen por qué no). «Escalamientos» son los avisos de plazo (sgspe.deadlines). la decisión de un compromiso se toma
// en S31 (/tasks/approvals/commitment/:recordId); las de otros objetos, en su ficha
// approve_direct no está: sale de draft, y los avisos de aprobación existen solo en pending_approval (ApprovalNotices los
// resuelve al salir de ese estado), así que nunca llega a esta bandeja ni a las decisiones de S31
// desde F4, la queja ALTA o CRITICA que resuelve quien aprueba (resolve_high_severity, decisión 8): su aviso llega con la misma
// fuente y la decisión se toma en la ficha de la queja (S36)
export const APROBACIONES_DE: Readonly<Record<string, readonly string[]>> = {
  commitment: ['approve', 'approve_senior'],
  project: ['approve'],
  engagement: ['approve_minutes'],
  grievance: ['resolve_high_severity']
}
// los avisos que son escalamientos: los de plazo (QCS, compromisos, tareas, la revisión vencida de un riesgo y el aviso genérico de
// una QCS confidencial, sin enlace) y los de un riesgo que sube de nivel
const DE_ESCALAMIENTO: readonly string[] = [FUENTE_DE_PLAZOS, FUENTE_DE_RIESGOS]
const TOPE = 200

// los avisos ACTION de aprobación pendiente con su registro: lo que «Por aprobar» y la bandeja de S31 listan
export function useAprobacionesPendientes() {
  const avisos = useAvisos({ kind: 'ACTION', size: TOPE })
  const pendientes = (avisos.data?.content ?? []).filter(
    (a) => a.source === FUENTE_DE_APROBACIONES && a.link?.type === 'RECORD' && a.link.object && a.link.recordId
  )
  return { avisos, pendientes, truncado: (avisos.data?.totalPages ?? 1) > 1 }
}

export const rutaDeDecision = (aviso: Aviso): string | null =>
  aviso.link?.object === 'commitment' && aviso.link.recordId ? `/tasks/approvals/commitment/${encodeURIComponent(aviso.link.recordId)}` : null

export function AprobacionesPage() {
  const { t } = useTranslation(NS)
  const lista = useParametrosDeLista('porAprobar')
  // S31 vuelve aquí tras decidir: se confirma la decisión
  const hecha = (useLocation().state as { hecha?: boolean } | null)?.hecha === true
  const { avisos, pendientes, truncado } = useAprobacionesPendientes()
  const plazos = useAvisos({ size: TOPE }, lista.vista === 'escalamientos')
  const escalamientos = (plazos.data?.content ?? []).filter((a) => DE_ESCALAMIENTO.includes(a.source) && a.kind !== 'INFO')
  // los escalamientos se filtran de los primeros 200 avisos de cualquier fuente: si hay más, se dice
  const plazosTruncados = (plazos.data?.totalPages ?? 1) > 1
  if (avisos.isError && !avisos.data && sinBandeja(avisos.error)) {
    return (
      <section className="mx-auto max-w-[1200px] space-y-4">
        <h1 className="text-sg-h1 font-semibold">{t('aprobaciones.titulo')}</h1>
        <Alert tone="notice">{t('aprobaciones.sinModulo')}</Alert>
      </section>
    )
  }
  return (
    <section className="mx-auto max-w-[1200px] space-y-4">
      <h1 className="text-sg-h1 font-semibold">{t('aprobaciones.titulo')}</h1>
      <p className="text-sm text-sg-text-secondary">{t('aprobaciones.ayuda')}</p>
      {hecha ? (
        <p role="status" className="text-sm text-sg-success">
          {t('aprobaciones.decision.hecha')}
        </p>
      ) : null}
      <VistasGuardadas
        vistas={(['porAprobar', 'escalamientos'] as const).map((v) => ({ id: v, etiqueta: t(`aprobaciones.vistas.${v}`) }))}
        actual={lista.vista}
        alCambiar={(vista) => lista.cambiar({ view: vista })}
      />
      {lista.vista === 'escalamientos' ? (
        plazos.isPending ? (
          <Cargando />
        ) : plazos.isError && !plazos.data ? (
          <FalloDeLectura error={plazos.error} alReintentar={() => void plazos.refetch()} />
        ) : (
          <>
            {plazosTruncados ? <Alert tone="warning">{t('aprobaciones.truncadoEscalamientos')}</Alert> : null}
            {escalamientos.length === 0 ? (
              <Vacio titulo={t('aprobaciones.vaciaEscalamientos')} />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {escalamientos.map((a) => {
                  const destino = destinoDeAviso(a.link)
                  return (
                    <li
                      key={a.id}
                      className={cn('space-y-1 rounded-sg-lg border border-l-4 border-sg-border bg-sg-surface p-3 text-sm', CLASE_DE_TIPO[a.kind])}
                    >
                      <h2 className="font-medium">{a.title}</h2>
                      {a.body ? <p>{a.body}</p> : null}
                      <p className="text-sg-caption text-sg-text-muted">{fechaYHoraPe(new Date(a.publishAt))}</p>
                      {destino ? (
                        <Link to={destino} className="text-sg-primary-text underline">
                          {t('aprobaciones.ver')}
                        </Link>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )
      ) : avisos.isPending ? (
        <Cargando />
      ) : avisos.isError && !avisos.data ? (
        <FalloDeLectura error={avisos.error} alReintentar={() => void avisos.refetch()} />
      ) : pendientes.length === 0 ? (
        <Vacio titulo={t('aprobaciones.vacia')} />
      ) : (
        <>
          {truncado ? <Alert tone="warning">{t('aprobaciones.truncado')}</Alert> : null}
          <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
            <Table aria-label={t('aprobaciones.vistas.porAprobar')}>
              <thead>
                <tr>
                  {(['registro', 'que', 'monto', 'espera', 'puede', 'accion'] as const).map((c) => (
                    <Th key={c} scope="col">
                      {t(`aprobaciones.columnas.${c}`)}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendientes.map((a) => (
                  <FilaDeAprobacion key={a.id} aviso={a} />
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </section>
  )
}

function FilaDeAprobacion({ aviso }: { aviso: Aviso }) {
  const { t } = useTranslation(NS)
  const objeto = aviso.link?.object ?? ''
  const id = aviso.link?.recordId ?? ''
  const registro = useRegistro(objeto, id)
  const espera = diasEntre(aviso.publishAt, hoyEnLima())
  const decision = rutaDeDecision(aviso)
  // un 404 es un registro que la cuenta no lee: de un proyecto en que no está asignada (ADR-0029), una QCS confidencial (§9.6) o uno
  // borrado, sin distinguir. la fila no dice qué es ni de qué trata, y no ofrece una ficha que solo repetiría «Registro reservado».
  // una relectura con 404 sobre una fila ya leída la conserva entera, sin mezclar lo leído con lo reservado
  const reservada = !registro.data && esIlegible(registro.error)
  return (
    <tr>
      <Td className="text-sm">
        {registro.isPending ? (
          <Cargando compacto />
        ) : registro.data ? (
          [texto(registro.data, 'code'), texto(registro.data, 'title') || texto(registro.data, 'name') || texto(registro.data, 'category')]
            .filter(Boolean)
            .join(' · ')
        ) : reservada ? (
          <Reservado />
        ) : (
          <FalloDeLectura error={registro.error} alReintentar={() => void registro.refetch()} />
        )}
      </Td>
      <Td className="text-sm">{reservada ? '—' : t(`aprobaciones.objetos.${objeto}`, { defaultValue: aviso.title })}</Td>
      <Td className="text-sm tabular-nums">
        {registro.data && objeto === 'commitment' ? montoPe(atributo(registro.data, 'amount'), atributo(registro.data, 'currency')) : '—'}
      </Td>
      <Td className="text-sm">{espera === null || espera <= 0 ? t('aprobaciones.hoy') : t('aprobaciones.dias', { n: espera })}</Td>
      <Td className="text-sm">{registro.data ? <PuedeDecidir objeto={objeto} id={id} /> : '—'}</Td>
      <Td className="text-sm">
        {reservada ? (
          '—'
        ) : (
          <Link to={decision ?? rutaParaAbrir(objeto, id)} className="text-sg-primary-text underline">
            {decision ? t('aprobaciones.revisar') : t('aprobaciones.ver')}
          </Link>
        )}
      </Td>
    </tr>
  )
}

// si quien mira puede decidir: tiene una transición de aprobación disponible y sus reglas no la bloquean. la razón se dice
// siempre (screens.md S48): un bloqueo trae el mensaje de su regla (D4 segregación, D5 nivel superior, D7 tope)
function PuedeDecidir({ objeto, id }: { objeto: string; id: string }) {
  const { t } = useTranslation(NS)
  const transiciones = useAvailableTransitions(objeto, id)
  if (transiciones.isPending) return <>{t('aprobaciones.comprobando')}</>
  if (transiciones.isError) return <FalloDeLectura error={transiciones.error} alReintentar={() => void transiciones.refetch()} />
  const candidatas = transiciones.data.filter((x) => x.allowed && (APROBACIONES_DE[objeto] ?? []).includes(x.name)).map((x) => x.name)
  if (candidatas.length === 0) return <>{t('aprobaciones.sinTransicion')}</>
  return <Comprobar objeto={objeto} id={id} candidatas={candidatas} />
}

// prueba en orden las aprobaciones que su rol tiene (quien es APPROVER y PROJECT_MANAGER tiene approve y approve_senior):
// «Sí» si alguna pasa; si todas se bloquean, el primer bloqueo de la primera
function Comprobar({ objeto, id, candidatas, razon }: { objeto: string; id: string; candidatas: string[]; razon?: string }) {
  const { t } = useTranslation(NS)
  const [primera, ...resto] = candidatas
  const comprobacion = useComprobacion(objeto, id, primera)
  const textoDe = useTextoDeAviso(objeto)
  if (comprobacion.isPending) return <>{t('aprobaciones.comprobando')}</>
  if (comprobacion.isError) return <FalloDeLectura error={comprobacion.error} alReintentar={() => void comprobacion.refetch()} />
  const bloqueo = comprobacion.data.blocking[0]
  if (!bloqueo) return <>{t('aprobaciones.si')}</>
  const motivo = razon ?? textoDe(bloqueo, { name: primera, label: '' }).texto ?? t('transiciones.reglaSinTexto')
  return resto.length > 0 ? <Comprobar objeto={objeto} id={id} candidatas={resto} razon={motivo} /> : <>{t('aprobaciones.noPuede', { razon: motivo })}</>
}
