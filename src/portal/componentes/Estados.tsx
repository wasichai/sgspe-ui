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

// el botón de ayuda y el motivo que despliega: el motivo está siempre en el DOM (oculto a la vista) con el id que otros
// elementos referencian por aria-describedby. el botón mide al menos 24 px (WCAG 2.5.8) y tiene su propio foco visible
function AyudaDelMotivo({ id, motivo }: { id: string; motivo: string }) {
  const { t } = useTranslation(NS)
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={t('comun.porQue')}
        aria-expanded={abierto}
        aria-describedby={id}
        className="inline-flex size-6 items-center justify-center rounded-sg-sm hover:text-sg-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-focus"
        onClick={() => setAbierto(!abierto)}
      >
        <CircleHelp aria-hidden className="size-3.5" />
      </button>
      <span id={id} className={abierto ? 'text-sg-caption' : 'sr-only'}>
        {motivo}
      </span>
    </>
  )
}

// el motivo de un dato que no se muestra: el atributo title no lo lee un teclado ni un teléfono. el motivo está siempre en el
// DOM (oculto a la vista) y enlazado con aria-describedby, y un botón de ayuda lo despliega a la vista.
// en una celda de tabla, describedPor es el id de la explicación única del encabezado de la columna (ExplicacionDeColumna):
// la celda no lleva botón (una parada de tabulador por fila) y el motivo se lee una sola vez
function ConMotivo({ icono, etiqueta, motivo, describedPor }: { icono: ReactNode; etiqueta: string; motivo: string; describedPor?: string }) {
  const id = useId()
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sg-text-muted">
      {icono}
      <span title={motivo} aria-describedby={describedPor ?? id}>
        {etiqueta}
      </span>
      {describedPor ? null : <AyudaDelMotivo id={id} motivo={motivo} />}
    </span>
  )
}

export function Restringido({ describedPor }: { describedPor?: string }) {
  const { t } = useTranslation(NS)
  return (
    <ConMotivo
      icono={<Lock aria-hidden className="size-3.5" />}
      etiqueta={t('comun.restringido')}
      motivo={t('comun.restringidoAyuda')}
      describedPor={describedPor}
    />
  )
}

// la explicación única de una columna con celdas restringidas o no disponibles: va en el encabezado, con el id que las celdas
// (Restringido o NoDisponible con describedPor) referencian. con soloLectores no lleva botón: el motivo queda en el DOM para
// los lectores de pantalla y la vista se queda con el candado y la etiqueta de cada celda (cuando no se sabe de antemano si
// alguna celda se restringirá)
export function ExplicacionDeColumna({ id, tipo, soloLectores }: { id: string; tipo: 'restringido' | 'noDisponible'; soloLectores?: boolean }) {
  const { t } = useTranslation(NS)
  const motivo = t(tipo === 'restringido' ? 'comun.restringidoAyuda' : 'comun.noDisponibleAyuda')
  if (soloLectores) {
    return (
      <span id={id} className="sr-only">
        {motivo}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 font-normal text-sg-text-muted">
      <AyudaDelMotivo id={id} motivo={motivo} />
    </span>
  )
}

// un dato que no se muestra dice por qué (unavailableReason, plan 2.2): sin permiso sobre un campo o un objeto, candado
// y "No disponible"; si el indicador se calcula para un solo proyecto, pide elegirlo. sin motivo, el texto es neutro: sirve
// igual para una cifra que para una lista
export function NoDisponible({ motivo, describedPor, enLista }: { motivo?: string | null; describedPor?: string; enLista?: boolean }) {
  const { t } = useTranslation(NS)
  // en una lista o un registro, el motivo no habla de «cifra»: comun.noDisponibleEnLista lo dice sin esa palabra y, si no
  // tiene variante, vale el de la cifra
  const claves = motivo ? [...(enLista ? [`comun.noDisponibleEnLista.${motivo}`] : []), `comun.noDisponiblePorMotivo.${motivo}`] : []
  const ayuda = motivo ? t(claves, { defaultValue: t('comun.noDisponibleAyuda') }) : t('comun.noDisponibleAyuda')
  const unProyecto = motivo === 'SINGLE_PROJECT_REQUIRED'
  return (
    <ConMotivo
      icono={unProyecto ? <Info aria-hidden className="size-3.5" /> : <Lock aria-hidden className="size-3.5" />}
      etiqueta={unProyecto ? t('comun.eligeUnProyecto') : t('comun.noDisponible')}
      motivo={ayuda}
      describedPor={describedPor}
    />
  )
}
