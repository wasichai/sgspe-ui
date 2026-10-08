import type { UseQueryResult } from '@tanstack/react-query'
import { Alert, Button } from '@wasichai/ui'
import { Info, Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { correlacionDe, useMensajeDeError } from './errores'

// los estados comunes de design-system.md §6.5: carga, error con su código de correlación y reintento, vacío, campo
// restringido y cifra no disponible (nunca vacío ni cero, RQ-DSH-032)

export function Cargando({ etiqueta }: { etiqueta?: string }) {
  const { t } = useTranslation(NS)
  return (
    <p role="status" aria-busy="true" className="py-6 text-sm text-sg-text-muted">
      {etiqueta ?? t('comun.cargando')}
    </p>
  )
}

export function ErrorDeCarga({ error, alReintentar }: { error: unknown; alReintentar?: () => void }) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  const correlacion = correlacionDe(error)
  return (
    <Alert tone="danger" title={t('comun.errorDeCarga')}>
      <p>{mensaje(error)}</p>
      {correlacion ? <p className="font-sg-mono text-sg-caption">{t('comun.correlacion', { id: correlacion })}</p> : null}
      {alReintentar ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={alReintentar}>
          {t('comun.reintentar')}
        </Button>
      ) : null}
    </Alert>
  )
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-sg-lg border border-dashed border-sg-border p-8 text-center">
      <p className="text-sg-h3 font-semibold text-sg-text">{titulo}</p>
      {children ? <div className="mt-2 text-sm text-sg-text-secondary">{children}</div> : null}
    </div>
  )
}

// la carga, el error y los datos de una consulta de TanStack Query
export function Consulta<T>({ consulta, children }: { consulta: UseQueryResult<T>; children: (datos: T) => ReactNode }) {
  if (consulta.isPending) return <Cargando />
  if (consulta.isError) return <ErrorDeCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
  return <>{children(consulta.data)}</>
}

export function Restringido() {
  const { t } = useTranslation(NS)
  return (
    <span className="inline-flex items-center gap-1 text-sg-text-muted" title={t('comun.restringidoAyuda')}>
      <Lock aria-hidden className="size-3.5" />
      {t('comun.restringido')}
    </span>
  )
}

// una cifra que no se muestra dice por qué (unavailableReason, plan 2.2): sin permiso sobre un campo o un objeto, candado
// y "No disponible"; si el indicador se calcula para un solo proyecto, pide elegirlo
export function NoDisponible({ motivo }: { motivo?: string | null }) {
  const { t } = useTranslation(NS)
  const ayuda = motivo ? t(`comun.noDisponiblePorMotivo.${motivo}`, { defaultValue: t('comun.noDisponibleAyuda') }) : t('comun.noDisponibleAyuda')
  const unProyecto = motivo === 'SINGLE_PROJECT_REQUIRED'
  return (
    <span className="inline-flex items-center gap-1 text-sg-text-muted" title={ayuda}>
      {unProyecto ? <Info aria-hidden className="size-3.5" /> : <Lock aria-hidden className="size-3.5" />}
      {unProyecto ? t('comun.eligeUnProyecto') : t('comun.noDisponible')}
    </span>
  )
}
