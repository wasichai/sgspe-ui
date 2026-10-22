import { EnlaceConRastro } from '../contexto/Rastro'
import { useQueryClient } from '@tanstack/react-query'
import { useAvailableTransitions } from '@wasichai/workflow'
import { Alert, Button, cn } from '@wasichai/ui'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { BarraDelTope } from '../compromisos/BarraDelTope'
import { Dia } from '../componentes/Dia'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, esIlegible, NoEsDeSusProyectos, Reservado, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useParametrosDeLista, VistasGuardadas } from '../componentes/Lista'
import { montoPe } from '../componentes/Monto'
import { CLASE_DE_TIPO, FUENTE_DE_APROBACIONES, FUENTE_DE_PLAZOS, FUENTE_DE_RIESGOS, sinBandeja, useAvisos, type Aviso } from '../datos/avisos'
import { diasEntre, hoyEnLima } from '../datos/fechas'
import { destinoDeAviso, rutaParaAbrir } from '../datos/fichas'
import { atributo, texto, useRegistro, useTodosConTope, type Registro } from '../datos/registros'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { enSolicitud, monedaDe, totalDeItems } from '../datos/inversion'
import { AntesDeAprobar } from '../inversion/AntesDeAprobar'
import { useTransicionesOfrecidas } from '../transiciones/BotonesDeTransicion'
import { fechaYHoraPe, NS } from '../i18n'
import { useComprobacion } from '../transiciones/api'
import { useTextoDeAviso } from '../transiciones/avisos'
import { opcion } from '../datos/opciones'

// S48 · aprobaciones y escalamientos (screens.md §11): las aprobaciones son transiciones, no objetos (domain-model.md §6.13).
// «Por aprobar» sale de los avisos approval_pending de wasichai-notifications (fuente sgspe.approvals, ACTION, con su enlace
// RECORD) que llegaron a quien mira por su asignación (ASM-070): la API genérica no filtra por estado, y el aviso ya trae a
// quién le toca decidir. «¿Puede decidir?» pregunta GET …/transitions y transition-checks por la aprobación de su rol (D4,
// D5, D7 dicen por qué no). «Escalamientos» son los avisos de plazo (sgspe.deadlines). la decisión de un compromiso se toma
// en S31 (/tasks/approvals/commitment/:recordId); las de otros objetos, en su ficha
// desde el rediseño de UX (P-05, flujo F-E), la lista va a la izquierda y lo elegido (?selected=objeto:id) a la derecha: un compromiso,
// un aporte y un programa se deciden ahí con el diálogo de transición, solo con las decisiones que el servidor permite; el aporte, con
// sus ítems, el tope de la campaña y «Antes de aprobar» a la vista. lo demás se decide en su ficha. en el teléfono, la lista o el
// detalle a pantalla completa, con «Volver»
// approve_direct de un compromiso no está: sale de draft, y sus avisos existen solo en pending_approval (ApprovalNotices los
// resuelve al salir de ese estado), así que nunca llega a esta bandeja ni a las decisiones de S31
// desde F5, el programa (approve, WF-G) y el aporte (approve y approve_direct, WF-P): el aviso del aporte llega al alta y vive
// mientras esté en requested (ApprovalNoticeListener lo resuelve al salir), así que approve_direct también se decide desde aquí
// desde F4, la queja ALTA o CRITICA que resuelve quien aprueba (resolve_high_severity, decisión 8): su aviso llega con la misma
// fuente y la decisión se toma en la ficha de la queja (S36)
export const APROBACIONES_DE: Readonly<Record<string, readonly string[]>> = {
  commitment: ['approve', 'approve_senior'],
  project: ['approve'],
  engagement: ['approve_minutes'],
  grievance: ['resolve_high_severity'],
  social_program: ['approve'],
  social_contribution: ['approve', 'approve_direct']
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

// la decisión de un compromiso se toma en S31; la de un programa (S43) y la de un aporte (S44), en su ficha, con sus reglas a la
// vista: «Revisar» lleva por /r/… (lee el registro como quien mira y salta a su ficha con el proyecto puesto)
const DECIDEN_EN_SU_FICHA: readonly string[] = ['social_program', 'social_contribution']
export const rutaDeDecision = (aviso: Aviso): string | null => {
  const objeto = aviso.link?.object
  const id = aviso.link?.recordId
  if (!objeto || !id) return null
  if (objeto === 'commitment') return `/tasks/approvals/commitment/${encodeURIComponent(id)}`
  return DECIDEN_EN_SU_FICHA.includes(objeto) ? rutaParaAbrir(objeto, id) : null
}

// el monto de lo que se decide, en su moneda: el de un compromiso y el total de un aporte (lo que se aprobará)
const MONTO_DE: Readonly<Record<string, string>> = { commitment: 'amount', social_contribution: 'total_amount' }

// las decisiones que se toman en el detalle de la bandeja, por objeto (las del estado pendiente de su workflow). la queja grave, el acta
// y la revisión de un proyecto piden datos que se completan en su ficha: el detalle lleva a ella
const DECISIONES_EN_LA_BANDEJA: Readonly<Record<string, readonly string[]>> = {
  commitment: ['approve', 'approve_senior', 'return_to_draft', 'cancel_pending_approval'],
  social_contribution: ['approve', 'approve_direct', 'reject'],
  social_program: ['approve', 'return_to_draft', 'cancel_pending_approval']
}
const SELECCION = 'selected'

// lo elegido en la URL (?selected=objeto:id, como en el mapa): solo un objeto que llega a esta bandeja
function useSeleccion() {
  const [busqueda, fijar] = useSearchParams()
  const [objeto = '', ...resto] = (busqueda.get(SELECCION) ?? '').split(':')
  const id = resto.join(':')
  const elegida = objeto in APROBACIONES_DE && id ? { objeto, id } : null
  const enlace = (o: string, i: string) => {
    const siguiente = new URLSearchParams(busqueda)
    siguiente.set(SELECCION, `${o}:${i}`)
    return `?${siguiente.toString()}`
  }
  const soltar = () => {
    const siguiente = new URLSearchParams(busqueda)
    siguiente.delete(SELECCION)
    fijar(siguiente)
  }
  return { elegida, enlace, soltar }
}

export function AprobacionesPage() {
  const { t } = useTranslation(NS)
  const lista = useParametrosDeLista('porAprobar')
  // S31 vuelve aquí tras decidir: se confirma la decisión
  const hecha = (useLocation().state as { hecha?: boolean } | null)?.hecha === true
  const { avisos, pendientes, truncado } = useAprobacionesPendientes()
  const { elegida, enlace, soltar } = useSeleccion()
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
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className={cn('space-y-1', elegida && lista.vista !== 'escalamientos' && 'hidden xl:block')}>
        <h1 className="text-sg-h1 font-semibold">{t('aprobaciones.titulo')}</h1>
        <p className="text-sg-body-sm text-sg-text-secondary">{t('aprobaciones.ayuda')}</p>
      </div>
      {hecha ? (
        <p role="status" className="text-sm text-sg-success">
          {t('aprobaciones.decision.hecha')}
        </p>
      ) : null}
      <div className={cn(elegida && lista.vista !== 'escalamientos' && 'hidden xl:block')}>
        <VistasGuardadas
          vistas={(['porAprobar', 'escalamientos'] as const).map((v) => ({ id: v, etiqueta: t(`aprobaciones.vistas.${v}`) }))}
          actual={lista.vista}
          alCambiar={(vista) => lista.cambiar({ view: vista })}
        />
      </div>
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
      ) : (
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className={cn('space-y-2', elegida && 'hidden xl:block')}>
            {avisos.isPending ? (
              <Cargando />
            ) : avisos.isError && !avisos.data ? (
              <FalloDeLectura error={avisos.error} alReintentar={() => void avisos.refetch()} />
            ) : pendientes.length === 0 ? (
              <Vacio titulo={t('aprobaciones.vacia')} />
            ) : (
              <>
                {truncado ? <Alert tone="warning">{t('aprobaciones.truncado')}</Alert> : null}
                <ul className="space-y-2" aria-label={t('aprobaciones.vistas.porAprobar')}>
                  {pendientes.map((a) => (
                    <TarjetaDeAprobacion
                      key={a.id}
                      aviso={a}
                      enlace={enlace(a.link?.object ?? '', a.link?.recordId ?? '')}
                      actual={elegida?.objeto === a.link?.object && elegida?.id === a.link?.recordId}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
          <section aria-label={t('aprobaciones.detalle.titulo')} className={cn('min-w-0', !elegida && 'hidden xl:block')}>
            {elegida ? (
              <div className="space-y-3">
                <Button variant="ghost" size="sm" className="xl:hidden" onClick={soltar}>
                  <span aria-hidden="true">←</span> {t('aprobaciones.detalle.volver')}
                </Button>
                <DetalleElegido key={`${elegida.objeto}:${elegida.id}`} objeto={elegida.objeto} id={elegida.id} />
              </div>
            ) : (
              <p className="rounded-sg-lg border border-dashed border-sg-border p-6 text-sg-body-sm text-sg-text-muted">{t('aprobaciones.detalle.elegir')}</p>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

// el nombre de lo que se decide: su código y su título, nombre o categoría
const nombreDe = (r: Registro): string => [texto(r, 'code'), texto(r, 'title') || texto(r, 'name') || opcion(r, 'category')].filter(Boolean).join(' · ')

// una aprobación de la lista: qué es, cuánto, cuánto espera y si quien mira puede decidir. el nombre la elige (?selected=) y toda la
// tarjeta responde al clic; el reintento de una lectura fallida queda encima del enlace
function TarjetaDeAprobacion({ aviso, enlace, actual }: { aviso: Aviso; enlace: string; actual: boolean }) {
  const { t } = useTranslation(NS)
  const objeto = aviso.link?.object ?? ''
  const id = aviso.link?.recordId ?? ''
  const registro = useRegistro(objeto, id)
  const espera = diasEntre(aviso.publishAt, hoyEnLima())
  // un 404 es un registro que la cuenta no lee: de un proyecto en que no está asignada (ADR-0029), una QCS confidencial (§9.6) o uno
  // borrado, sin distinguir. la tarjeta no dice qué es ni de qué trata, y no ofrece un detalle que solo repetiría «Registro reservado».
  // una relectura con 404 sobre una tarjeta ya leída la conserva entera, sin mezclar lo leído con lo reservado
  const reservada = !registro.data && esIlegible(registro.error)
  const monto = registro.data && MONTO_DE[objeto] ? montoPe(atributo(registro.data, MONTO_DE[objeto]), atributo(registro.data, 'currency')) : null
  const tiempo = espera === null || espera <= 0 ? t('aprobaciones.hoy') : t('aprobaciones.dias', { n: espera, count: espera })
  return (
    <li
      className={cn(
        'relative space-y-1 rounded-sg-lg border p-3',
        actual ? 'border-sg-primary bg-sg-primary-soft' : 'border-sg-border bg-sg-surface hover:bg-sg-surface-hover'
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sg-body font-medium">
          {registro.isPending ? (
            <Cargando compacto />
          ) : registro.data ? (
            <Link to={enlace} aria-current={actual ? 'true' : undefined} className="after:absolute after:inset-0 after:content-['']">
              {nombreDe(registro.data)}
            </Link>
          ) : reservada ? (
            <Reservado />
          ) : (
            <span className="relative z-10">
              <FalloDeLectura error={registro.error} alReintentar={() => void registro.refetch()} />
            </span>
          )}
        </span>
        {monto ? <span className="whitespace-nowrap tabular-nums">{monto}</span> : null}
      </div>
      {reservada ? null : <p className="text-sg-body-sm text-sg-text-secondary">{t(`aprobaciones.objetos.${objeto}`, { defaultValue: aviso.title })}</p>}
      <p className="text-sg-caption text-sg-text-muted">{t('aprobaciones.espera', { tiempo })}</p>
      {registro.data ? (
        <p className="relative z-10 text-sg-caption">
          {t('aprobaciones.puede')}{' '}
          <span>
            <PuedeDecidir objeto={objeto} id={id} />
          </span>
        </p>
      ) : null}
    </li>
  )
}

// el detalle de lo elegido: un 404 no dice si no existe o no es de sus proyectos
function DetalleElegido({ objeto, id }: { objeto: string; id: string }) {
  const registro = useRegistro(objeto, id)
  return (
    <Consulta consulta={registro} noExiste={<NoEsDeSusProyectos />}>
      {(r) => <Detalle objeto={objeto} registro={r} />}
    </Consulta>
  )
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sg-caption text-sg-text-muted">{termino}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}

function Detalle({ objeto, registro }: { objeto: string; registro: Registro }) {
  const { t } = useTranslation(NS)
  const cliente = useQueryClient()
  const proyecto = texto(registro, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const aporte = objeto === 'social_contribution'
  const solicitud = aporte && enSolicitud(registro)
  const decisiones = DECISIONES_EN_LA_BANDEJA[objeto]
  const [hecha, setHecha] = useState(false)
  const titulo = aporte
    ? t('aprobaciones.detalle.aporte', { codigo: texto(registro, 'code') })
    : texto(registro, 'title') || texto(registro, 'name') || nombreDe(registro)
  const descripcion = aporte
    ? [opcion(registro, 'contribution_type'), texto(registro, 'occasion'), texto(registro, 'declared_purpose')].filter(Boolean).join(' · ')
    : texto(registro, 'description')
  const completa = objeto === 'commitment' ? `/tasks/approvals/commitment/${encodeURIComponent(registro.id)}` : rutaParaAbrir(objeto, registro.id)
  return (
    <article className="space-y-4 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <header className="space-y-1">
        <p className="text-sg-caption text-sg-text-muted">
          {[t(`aprobaciones.objetos.${objeto}`, { defaultValue: '' }), aporte ? '' : texto(registro, 'code')].filter(Boolean).join(' · ')}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sg-h2 font-semibold">{titulo}</h2>
          <EstadoChip objeto={objeto} estado={registro.state} />
        </div>
        {descripcion ? <p className="whitespace-pre-line text-sg-body-sm text-sg-text-secondary">{descripcion}</p> : null}
      </header>
      {aporte ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ItemsYTope aporte={registro} />
          {solicitud ? <AntesDeAprobar aporte={registro} escribe={escribe} /> : null}
        </div>
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {objeto === 'commitment' ? (
            <>
              <Dato termino={t('aprobaciones.detalle.monto')}>{montoPe(atributo(registro, 'amount'), atributo(registro, 'currency'))}</Dato>
              <Dato termino={t('aprobaciones.detalle.vence')}>
                <Dia valor={texto(registro, 'due_date')} />
              </Dato>
            </>
          ) : objeto === 'social_program' ? (
            <Dato termino={t('aprobaciones.detalle.presupuesto')}>{montoPe(atributo(registro, 'total_budget'), monedaDe(registro))}</Dato>
          ) : null}
        </dl>
      )}
      <section aria-label={t('aprobaciones.detalle.decidir')} className="space-y-2 border-t border-sg-border pt-4">
        <h3 className="text-sg-h3 font-semibold">{t('aprobaciones.detalle.decidir')}</h3>
        {hecha ? (
          <p role="status" className="text-sm text-sg-success">
            {t('aprobaciones.decision.hecha')}
          </p>
        ) : null}
        {!decisiones ? (
          <>
            <p className="text-sm text-sg-text-muted">{t('aprobaciones.detalle.enSuFicha')}</p>
            <EnlaceConRastro to={rutaParaAbrir(objeto, registro.id)} className="text-sm text-sg-primary-text underline">
              {t('aprobaciones.detalle.decidirEnSuFicha')}
            </EnlaceConRastro>
          </>
        ) : !escribe ? (
          <Alert tone="notice">{t('aprobaciones.decision.soloLectura')}</Alert>
        ) : (
          <Decisiones
            objeto={objeto}
            registro={registro}
            solo={decisiones}
            alAplicar={() => {
              setHecha(true)
              // el aviso de la aprobación se resuelve al salir del estado pendiente: la bandeja se relee
              void cliente.invalidateQueries({ queryKey: ['notifications'] })
            }}
          />
        )}
      </section>
      {decisiones ? (
        <EnlaceConRastro to={completa} className="text-sm text-sg-primary-text underline">
          {t('aprobaciones.detalle.abrirFicha')}
        </EnlaceConRastro>
      ) : null}
    </article>
  )
}

// las decisiones que el servidor permite (GET …/transitions) entre las del estado pendiente, cada una con el diálogo de transición:
// motivo, reglas en seco, versión leída y el 412 con su aviso. las aprobaciones se comprueban antes y salen deshabilitadas si una
// regla las bloquea
function Decisiones({ objeto, registro, solo, alAplicar }: { objeto: string; registro: Registro; solo: readonly string[]; alAplicar: () => void }) {
  const { t } = useTranslation(NS)
  const transiciones = useAvailableTransitions(objeto, registro.id)
  const { primaria, otras, destructivas, dialogo } = useTransicionesOfrecidas({
    objeto,
    registro,
    solo,
    comprobarAntes: APROBACIONES_DE[objeto],
    proyecto: texto(registro, 'project'),
    alAplicar
  })
  if (transiciones.isPending) return <Cargando compacto />
  if (transiciones.isError) return <FalloDeLectura error={transiciones.error} alReintentar={() => void transiciones.refetch()} />
  const botones = [...(primaria ? [primaria] : []), ...otras, ...destructivas]
  return (
    <>
      {botones.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('aprobaciones.detalle.sinDecisiones')}</p>
      ) : (
        <div role="group" aria-label={t('transiciones.acciones')} className="flex flex-wrap justify-end gap-2">
          {botones.map((x) => x.nodo)}
        </div>
      )}
      {dialogo}
    </>
  )
}

// los ítems del aporte con el total que se aprobará (la suma exacta de line_amount en la moneda del aporte, como la juzga el servidor)
// y, mientras se decide, el tope de la campaña. solo lectura: los ítems se cambian en la ficha del aporte. con un monto ilegible o
// la lista cortada no hay total ni tope (dirían una cifra que no es)
function ItemsYTope({ aporte }: { aporte: Registro }) {
  const { t } = useTranslation(NS)
  const filtros = useMemo(() => ({ social_contribution: aporte.id }), [aporte.id])
  const items = useTodosConTope('contribution_item', filtros)
  const moneda = monedaDe(aporte)
  const solicitud = enSolicitud(aporte)
  const suma = totalDeItems(items.data ?? [], moneda)
  const total = suma.invalidos > 0 || items.truncado ? null : suma.total
  return (
    <div className="space-y-3 text-sm">
      <h3 className="font-semibold">{t('aprobaciones.detalle.items')}</h3>
      {items.isPending ? (
        <Cargando compacto />
      ) : !items.data ? (
        <FalloDeLectura error={items.error} alReintentar={() => void items.refetch()} />
      ) : items.data.length === 0 ? (
        <p className="text-sg-text-muted">{t('fichaAporte.items.vacio')}</p>
      ) : (
        <ul className="divide-y divide-sg-border-subtle">
          {items.data.map((i) => (
            <li key={i.id} className="flex items-baseline justify-between gap-2 py-1.5">
              <span>
                {texto(i, 'description')}
                <span className="block text-sg-caption text-sg-text-muted">
                  {[opcion(i, 'item_kind'), [texto(i, 'quantity'), texto(i, 'unit')].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="whitespace-nowrap tabular-nums">{montoPe(atributo(i, 'line_amount'), moneda)}</span>
            </li>
          ))}
        </ul>
      )}
      {items.data && total !== null ? (
        <p className="font-semibold tabular-nums">
          {t(solicitud ? 'fichaAporte.items.seAprobara' : 'fichaAporte.items.aprobado', { monto: montoPe(total, moneda) })}
        </p>
      ) : null}
      {suma.invalidos > 0 ? <Alert tone="warning">{t('fichaAporte.items.invalidos')}</Alert> : null}
      {items.truncado ? <Alert tone="warning">{t('fichaAporte.items.truncados')}</Alert> : null}
      {solicitud && texto(aporte, 'exploration_campaign') && items.data && total !== null ? (
        <div className="space-y-1">
          <h3 className="font-semibold">{t('aprobaciones.detalle.tope')}</h3>
          <TopeDeLaCampana aporte={aporte} total={total} />
        </div>
      ) : null}
    </div>
  )
}

// la campaña que la cuenta no lee no se dibuja (no se revela nada de ella)
function TopeDeLaCampana({ aporte, total }: { aporte: Registro; total: string }) {
  const campana = useRegistro('exploration_campaign', texto(aporte, 'exploration_campaign'))
  if (campana.isPending) return <Cargando compacto />
  if (campana.isError && !campana.data)
    return esIlegible(campana.error) ? null : <FalloDeLectura error={campana.error} alReintentar={() => void campana.refetch()} />
  return <BarraDelTope campana={campana.data} monto={total} moneda={monedaDe(aporte)} excluir={aporte.id} de="aporte" />
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
