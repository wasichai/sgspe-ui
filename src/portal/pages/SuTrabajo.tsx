import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Cargando } from '../componentes/Estados'
import { ListaPlegable } from '../componentes/ListaPlegable'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { estaAbierta, OBJETOS_DE_QCS } from '../datos/atencion'
import { rutaDeFicha } from '../datos/fichas'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// el inicio de quien no ve la revisión ejecutiva (ASM-078): lo que tiene a su cargo, decidido por sus permisos y nunca por el
// nombre de su rol (RQ-SEC-005). sus tareas abiertas (assignee_user_id), los compromisos de los que es responsable y las QCS
// que atiende (owner_user_id); cada bloque solo si la cuenta lee su objeto, los vencidos primero y cinco a la vista
const TAREA_ABIERTA = ['open', 'in_progress', 'blocked']
const COMPROMISO_CERRADO = ['closed', 'cancelled', 'verified']
const vencidosPrimero = (a: Registro, b: Registro) => Number(texto(b, 'deadline_status') === 'VENCIDO') - Number(texto(a, 'deadline_status') === 'VENCIDO')

// lo que la persona tiene a su cargo, abierto y con los vencidos primero; lo comparten «Su trabajo» y «Atención requerida»
// (mismas consultas, misma caché). lee: si la cuenta lee alguno de los objetos
export function useSuTrabajo() {
  const { user, can } = useAuth()
  const yo = user?.id ?? ''
  const leeTareas = can('task', 'READ')
  const leeCompromisos = can('commitment', 'READ')
  const tareas = useTodos('task', { assignee_user_id: yo, sort: 'due_date', dir: 'asc' }, leeTareas && Boolean(yo))
  const compromisos = useTodos('commitment', { owner_user_id: yo, sort: 'due_date', dir: 'asc' }, leeCompromisos && Boolean(yo))
  const quejas = useTodos('grievance', { owner_user_id: yo }, can('grievance', 'READ') && Boolean(yo))
  const consultas = useTodos('inquiry', { owner_user_id: yo }, can('inquiry', 'READ') && Boolean(yo))
  const solicitudes = useTodos('stakeholder_request', { owner_user_id: yo }, can('stakeholder_request', 'READ') && Boolean(yo))
  const deQcs = [quejas, consultas, solicitudes]
    .map((consulta, i) => ({ objeto: OBJETOS_DE_QCS[i], consulta, lee: can(OBJETOS_DE_QCS[i], 'READ') }))
    .filter((q) => q.lee)
  const lee = leeTareas || leeCompromisos || deQcs.length > 0
  const cargando = (leeTareas && tareas.isPending) || (leeCompromisos && compromisos.isPending) || deQcs.some((q) => q.consulta.isPending)
  const abiertas = (tareas.data ?? []).filter((x) => TAREA_ABIERTA.includes(x.state ?? '')).sort(vencidosPrimero)
  const aCargo = (compromisos.data ?? []).filter((c) => !COMPROMISO_CERRADO.includes(c.state ?? '')).sort(vencidosPrimero)
  const qcs = deQcs.flatMap((q) =>
    (q.consulta.data ?? []).filter((r) => estaAbierta(q.objeto, r)).map((registro) => ({ objeto: q.objeto as string, registro }))
  )
  qcs.sort((a, b) => vencidosPrimero(a.registro, b.registro))
  return { lee, cargando, abiertas, aCargo, qcs }
}

export function SuTrabajo() {
  const { t } = useTranslation(NS)
  const { lee, cargando, abiertas, aCargo, qcs } = useSuTrabajo()
  if (!lee) return null
  const enlace = (objeto: string, registro: Registro, rotulo: string) => {
    const ruta = rutaDeFicha(objeto, registro)
    return (
      <span className="flex flex-wrap items-center gap-x-2">
        {ruta ? (
          <Link to={ruta} className="text-sg-primary-text underline">
            {rotulo}
          </Link>
        ) : (
          rotulo
        )}
        <SituacionDePlazo valor={atributo(registro, 'deadline_status')} />
      </span>
    )
  }
  const nada = !cargando && abiertas.length === 0 && aCargo.length === 0 && qcs.length === 0
  return (
    <section aria-labelledby="su-trabajo" className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-5">
      <h2 id="su-trabajo" className="text-sg-h3 font-semibold">
        {t('inicio.trabajo.titulo')}
      </h2>
      {cargando ? <Cargando compacto /> : null}
      {nada ? <p className="text-sm text-sg-text-muted">{t('inicio.trabajo.nada')}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <ListaPlegable
          titulo={t('inicio.trabajo.tareas', { count: abiertas.length })}
          elementos={abiertas.map((x) => ({ clave: x.id, contenido: enlace('task', x, texto(x, 'title') || x.id) }))}
        />
        <ListaPlegable
          titulo={t('inicio.trabajo.compromisos', { count: aCargo.length })}
          elementos={aCargo.map((c) => ({
            clave: c.id,
            contenido: enlace('commitment', c, [texto(c, 'code'), texto(c, 'title')].filter(Boolean).join(' · '))
          }))}
        />
        <ListaPlegable
          titulo={t('inicio.trabajo.qcs', { count: qcs.length })}
          elementos={qcs.map(({ objeto, registro }) => ({ clave: registro.id, contenido: enlace(objeto, registro, texto(registro, 'code') || registro.id) }))}
        />
      </div>
    </section>
  )
}
