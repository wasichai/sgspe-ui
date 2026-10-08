import type { UseQueryResult } from '@tanstack/react-query'
import { Alert, Button, cn } from '@wasichai/ui'
import { CircleHelp, Info, Lock } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { correlacionDe, useMensajeDeError } from './errores'

// los estados comunes de design-system.md §6.5: carga, error con su código de correlación y reintento, vacío, campo
// restringido y cifra no disponible (nunca vacío ni cero, RQ-DSH-032)

// compacto: sin el relleno vertical, para usarlo dentro de una tarjeta pequeña; el texto accesible es el mismo
export function Cargando({ etiqueta, compacto }: { etiqueta?: string; compacto?: boolean }) {
  const { t } = useTranslation(NS)
  return (
    <p role="status" aria-busy="true" className={cn('text-sm text-sg-text-muted', !compacto && 'py-6')}>
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

// el motivo de un dato que no se muestra: el atributo title no lo lee un teclado ni un teléfono. el motivo está siempre en el
// DOM (oculto a la vista) y enlazado con aria-describedby, y un botón de ayuda lo despliega a la vista
function ConMotivo({ icono, etiqueta, motivo }: { icono: ReactNode; etiqueta: string; motivo: string }) {
  const { t } = useTranslation(NS)
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sg-text-muted">
      {icono}
      <span title={motivo} aria-describedby={id}>
        {etiqueta}
      </span>
      <button
        type="button"
        aria-label={t('comun.porQue')}
        aria-expanded={abierto}
        aria-describedby={id}
        className="rounded-sg-sm p-0.5 hover:text-sg-text"
        onClick={() => setAbierto(!abierto)}
      >
        <CircleHelp aria-hidden className="size-3.5" />
      </button>
      <span id={id} className={abierto ? 'text-sg-caption' : 'sr-only'}>
        {motivo}
      </span>
    </span>
  )
}

export function Restringido() {
  const { t } = useTranslation(NS)
  return <ConMotivo icono={<Lock aria-hidden className="size-3.5" />} etiqueta={t('comun.restringido')} motivo={t('comun.restringidoAyuda')} />
}

// una cifra que no se muestra dice por qué (unavailableReason, plan 2.2): sin permiso sobre un campo o un objeto, candado
// y "No disponible"; si el indicador se calcula para un solo proyecto, pide elegirlo
export function NoDisponible({ motivo }: { motivo?: string | null }) {
  const { t } = useTranslation(NS)
  const ayuda = motivo ? t(`comun.noDisponiblePorMotivo.${motivo}`, { defaultValue: t('comun.noDisponibleAyuda') }) : t('comun.noDisponibleAyuda')
  const unProyecto = motivo === 'SINGLE_PROJECT_REQUIRED'
  return (
    <ConMotivo
      icono={unProyecto ? <Info aria-hidden className="size-3.5" /> : <Lock aria-hidden className="size-3.5" />}
      etiqueta={unProyecto ? t('comun.eligeUnProyecto') : t('comun.noDisponible')}
      motivo={ayuda}
    />
  )
}
