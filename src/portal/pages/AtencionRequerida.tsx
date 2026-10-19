import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Cargando } from '../componentes/Estados'
import { ListaPlegable } from '../componentes/ListaPlegable'
import { FUENTE_DE_APROBACIONES, type Aviso } from '../datos/avisos'
import { destinoDeAviso, rutaDeFicha } from '../datos/fichas'
import { texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { rutaDeDecision, useAprobacionesPendientes } from '../tareas/AprobacionesPage'
import { useSuTrabajo } from './SuTrabajo'

// «Atención requerida», lo primero del inicio (S02, revisión de UX, etapa 2): lo vencido y lo por vencer a su cargo (tareas,
// compromisos y QCS de useSuTrabajo, por deadline_status), lo que espera su decisión (los avisos de aprobación, como S48) y los
// demás avisos ACTION sin leer, cada uno con enlace a su registro. sin la bandeja de avisos, sigue con lo que tiene a su cargo
interface Elemento {
  clave: string
  rotulo: string
  ruta: string | null
}

export function AtencionRequerida() {
  const { t } = useTranslation(NS)
  const trabajo = useSuTrabajo()
  const { avisos, pendientes } = useAprobacionesPendientes()
  const deRegistro = (objeto: string, r: Registro): Elemento => {
    const nombre = objeto === 'task' ? texto(r, 'title') : [texto(r, 'code'), objeto === 'commitment' ? texto(r, 'title') : ''].filter(Boolean).join(' · ')
    return { clave: `${objeto}-${r.id}`, rotulo: `${t(`miDia.tipos.${objeto}`)} · ${nombre || r.id}`, ruta: rutaDeFicha(objeto, r) }
  }
  const aCargo = [
    ...trabajo.abiertas.map((r) => ({ objeto: 'task', r })),
    ...trabajo.aCargo.map((r) => ({ objeto: 'commitment', r })),
    ...trabajo.qcs.map(({ objeto, registro }) => ({ objeto, r: registro }))
  ]
  const con = (situacion: string) => aCargo.filter(({ r }) => texto(r, 'deadline_status') === situacion).map(({ objeto, r }) => deRegistro(objeto, r))
  const vencidos = con('VENCIDO')
  const porVencer = con('POR VENCER')
  const deAviso = (a: Aviso, ruta: string | null): Elemento => ({ clave: a.id, rotulo: a.title, ruta })
  const decisiones = pendientes.map((a) => deAviso(a, rutaDeDecision(a) ?? destinoDeAviso(a.link)))
  const otros = (avisos.data?.content ?? [])
    .filter((a) => a.kind === 'ACTION' && !a.read && a.source !== FUENTE_DE_APROBACIONES)
    .map((a) => deAviso(a, destinoDeAviso(a.link)))
  if (!trabajo.lee && !avisos.data) return null
  const cargando = trabajo.cargando || avisos.isPending
  const nada = !cargando && vencidos.length + porVencer.length + decisiones.length + otros.length === 0
  const lista = (elementos: Elemento[]) =>
    elementos.map((e) => ({
      clave: e.clave,
      contenido: e.ruta ? (
        <Link to={e.ruta} className="text-sg-primary-text underline">
          {e.rotulo}
        </Link>
      ) : (
        e.rotulo
      )
    }))
  return (
    <section aria-labelledby="atencion-requerida" className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-5">
      <h2 id="atencion-requerida" className="text-sg-h3 font-semibold">
        {t('miDia.atencion.titulo')}
      </h2>
      {cargando ? <Cargando compacto /> : null}
      {nada ? <p className="text-sm text-sg-text-muted">{t('miDia.atencion.nada')}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ListaPlegable titulo={t('miDia.atencion.vencidos', { count: vencidos.length })} elementos={lista(vencidos)} />
        <ListaPlegable titulo={t('miDia.atencion.porVencer', { count: porVencer.length })} elementos={lista(porVencer)} />
        <ListaPlegable titulo={t('miDia.atencion.decisiones', { count: decisiones.length })} elementos={lista(decisiones)} />
        <ListaPlegable titulo={t('miDia.atencion.avisos', { count: otros.length })} elementos={lista(otros)} />
      </div>
    </section>
  )
}
