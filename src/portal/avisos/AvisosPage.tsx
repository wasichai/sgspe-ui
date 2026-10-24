import { EncabezadoDePagina } from '../componentes/Pagina'
import { Alert, Button, cn, Pagination } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { ResultadoDeLista } from '../contexto/Origen'
import { EnlaceConRastro } from '../contexto/Rastro'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import {
  CLASE_DE_TIPO,
  FUENTES_DE_SGSPE,
  sinBandeja,
  TIPOS_DE_AVISO,
  useAccionDeAviso,
  useAvisos,
  useLeerTodos,
  useResumenDeAvisos,
  type Aviso,
  type EstadoDeBandeja,
  type TipoDeAviso
} from '../datos/avisos'
import { hoyEnLima } from '../datos/fechas'
import { destinoDeAviso } from '../datos/fichas'
import { fechaYHoraPe, NS } from '../i18n'
import { PreferenciasDeAvisos } from './PreferenciasDeAvisos'
import { FiltroDeLista } from '../componentes/FiltroDeLista'

// S04 · avisos (/notifications, screens.md §14): la bandeja de wasichai-notifications de la persona, con «Solo sin leer» y los
// pospuestos, por tipo; abrir un aviso lo marca leído y lleva a su registro; posponer lo esconde hasta mañana a las 8:00 de Lima;
// un ACTION de una fuente no se descarta (se va cuando el trabajo se hace). debajo, las preferencias de correo
const VISTAS: { id: string; estado: EstadoDeBandeja }[] = [
  { id: 'todos', estado: 'active' },
  { id: 'sinLeer', estado: 'unread' },
  { id: 'pospuestos', estado: 'snoozed' }
]
const POR_PAGINA = 25

// mañana a las 8:00 en Lima (UTC-5, sin horario de verano), como instante UTC
export function mananaALas8(ahora: Date = new Date()): string {
  const manana = new Date(`${hoyEnLima(ahora)}T12:00:00-05:00`)
  manana.setUTCDate(manana.getUTCDate() + 1)
  return new Date(`${manana.toISOString().slice(0, 10)}T08:00:00-05:00`).toISOString()
}

export function AvisosPage() {
  const { t } = useTranslation(NS)
  const lista = useParametrosDeLista('todos')
  const estado = VISTAS.find((v) => v.id === lista.vista)?.estado ?? 'active'
  const tipo = (lista.filtro('kind') || undefined) as TipoDeAviso | undefined
  const avisos = useAvisos({ state: estado, kind: tipo, page: lista.pagina, size: POR_PAGINA })
  const leerTodos = useLeerTodos()
  const mensaje = useMensajeDeError()
  // los conteos de las vistas salen del resumen de la bandeja (activos y sin leer, del tipo elegido o de todos); los pospuestos
  // no tienen conteo en el resumen
  const resumen = useResumenDeAvisos()
  const sumar = (campo: 'active' | 'unread') =>
    resumen.data ? (tipo ? [tipo] : TIPOS_DE_AVISO).reduce((total, k) => total + (resumen.data.kinds[k]?.[campo] ?? 0), 0) : null
  const conteos: Record<string, number | null> = { todos: sumar('active'), sinLeer: sumar('unread'), pospuestos: null }
  // el ancho único de las pantallas (revisión de UX, etapa 3): antes, centrado y angosto, distinto del resto
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        titulo={t('avisos.titulo')}
        secundarias={
          <Button size="sm" variant="secondary" disabled={leerTodos.isPending} aria-busy={leerTodos.isPending} onClick={() => leerTodos.mutate(tipo)}>
            {t('avisos.leerTodos')}
          </Button>
        }
      />
      {leerTodos.isError ? <Alert tone="danger">{mensaje(leerTodos.error)}</Alert> : null}
      {/* la barra de filtros (hallazgos U-18 y U-22, DD-03 y DD-04): las vistas en el selector, con su conteo, en lugar de una
          segunda fila de pestañas, y el tipo como filtro de la barra, de su ancho y no del de la pantalla, con su chip. ?view= y
          ?kind= son los mismos */}
      <BarraDeFiltros
        vista={
          <SelectorDeVista
            etiqueta={t('comun.vistas')}
            vistas={VISTAS.map((v) => ({ id: v.id, etiqueta: t(`avisos.filtros.${v.id}`), n: conteos[v.id] }))}
            actual={lista.vista}
            alElegir={(vista) => lista.cambiar({ view: vista })}
          />
        }
        frecuentes={
          <FiltroDeLista
            etiqueta={t('avisos.tipo')}
            value={tipo ?? ''}
            onChange={(e) => lista.cambiar({ kind: e.target.value })}
            opciones={TIPOS_DE_AVISO.map((k) => ({ valor: k, etiqueta: t(`avisos.tipos.${k}`) }))}
          />
        }
        aplicados={
          tipo ? [{ clave: 'kind', etiqueta: `${t('avisos.tipo')}: ${t(`avisos.tipos.${tipo}`)}`, alQuitar: () => lista.cambiar({ kind: null }) }] : []
        }
        alLimpiar={() => lista.cambiar({ kind: null })}
      />
      {avisos.isPending ? (
        <Cargando />
      ) : avisos.isError && !avisos.data ? (
        sinBandeja(avisos.error) ? (
          <Vacio titulo={t('avisos.vacio')} />
        ) : (
          <FalloDeLectura error={avisos.error} alReintentar={() => void avisos.refetch()} />
        )
      ) : avisos.data.content.length === 0 ? (
        // un tipo elegido se quita desde el vacío (rediseño de UX, 2026-10-20)
        tipo ? (
          <VacioDeLista conFiltros alLimpiar={() => lista.cambiar({ kind: null })} />
        ) : (
          <Vacio titulo={lista.vista === 'todos' ? t('avisos.vacio') : t('avisos.vacioFiltrado')} />
        )
      ) : (
        <>
          {/* la bandeja es un resultado (flujo F-C): el registro de un aviso ofrece volver a ella y pasar al del siguiente */}
          <ResultadoDeLista total={avisos.data.totalElements ?? null}>
            <ul className="space-y-2">
              {avisos.data.content.map((a) => (
                <AvisoDeLaBandeja key={a.id} aviso={a} />
              ))}
            </ul>
          </ResultadoDeLista>
          {avisos.data.totalPages && avisos.data.totalPages > 1 ? (
            <Pagination
              page={avisos.data.page}
              totalPages={avisos.data.totalPages}
              totalElements={avisos.data.totalElements ?? 0}
              onPage={(p) => lista.cambiar({ page: String(p) })}
            />
          ) : null}
        </>
      )}
      <PreferenciasDeAvisos />
    </section>
  )
}

// la fuente de un aviso de SGSPE (aprobaciones, plazos y, desde F4, riesgos y alertas) se nombra; las del módulo, «Otros avisos»
const fuenteDe = (aviso: Aviso) => (FUENTES_DE_SGSPE.includes(aviso.source) ? aviso.source : 'otra')

function AvisoDeLaBandeja({ aviso }: { aviso: Aviso }) {
  const { t } = useTranslation(NS)
  const accion = useAccionDeAviso()
  const mensaje = useMensajeDeError()
  const destino = destinoDeAviso(aviso.link)
  return (
    <li className={cn('space-y-1 rounded-sg-lg border border-l-4 border-sg-border bg-sg-surface p-3 text-sm', CLASE_DE_TIPO[aviso.kind])}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={cn('text-sm', !aviso.read && 'font-semibold')}>{aviso.title}</h2>
        <span className="text-sg-caption text-sg-text-muted">
          {t(`avisos.tipos.${aviso.kind}`)} · {t(`avisos.fuentes.${fuenteDe(aviso)}`)}
          {!aviso.read ? ` · ${t('avisos.sinLeer')}` : ''}
        </span>
      </div>
      {aviso.body ? <p className="whitespace-pre-line">{aviso.body}</p> : null}
      <p className="text-sg-caption text-sg-text-muted">
        {t('avisos.publicado', { fecha: fechaYHoraPe(new Date(aviso.publishAt)) })}
        {aviso.dueAt ? ` · ${t('avisos.vence', { fecha: fechaYHoraPe(new Date(aviso.dueAt)) })}` : ''}
        {aviso.overdue ? ` · ${t('avisos.vencido')}` : ''}
        {aviso.snoozedUntil ? ` · ${t('avisos.pospuesto', { fecha: fechaYHoraPe(new Date(aviso.snoozedUntil)) })}` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {destino ? (
          <EnlaceConRastro to={destino} onClick={() => !aviso.read && accion.mutate({ aviso, accion: 'read' })} className="text-sg-primary-text underline">
            {t('avisos.abrir')}
          </EnlaceConRastro>
        ) : (
          <span className="text-sg-caption text-sg-text-muted">{t('avisos.sinEnlace')}</span>
        )}
        {!aviso.read ? (
          <Button size="sm" variant="secondary" disabled={accion.isPending} onClick={() => accion.mutate({ aviso, accion: 'read' })}>
            {t('avisos.leer')}
          </Button>
        ) : null}
        {!aviso.snoozedUntil ? (
          <Button size="sm" variant="secondary" disabled={accion.isPending} onClick={() => accion.mutate({ aviso, accion: 'snooze', hasta: mananaALas8() })}>
            {t('avisos.posponer')}
          </Button>
        ) : null}
        {aviso.dismissible ? (
          <Button size="sm" variant="secondary" disabled={accion.isPending} onClick={() => accion.mutate({ aviso, accion: 'dismiss' })}>
            {t('avisos.descartar')}
          </Button>
        ) : (
          <span className="text-sg-caption text-sg-text-muted">{t('avisos.noDescartable')}</span>
        )}
      </div>
      {accion.isError ? <Alert tone="danger">{mensaje(accion.error)}</Alert> : null}
    </li>
  )
}
