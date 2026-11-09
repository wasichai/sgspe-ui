import type { UseQueryResult } from '@tanstack/react-query'
import { ApiError } from '@wasichai/core'
import { Alert, Button, cn, Th } from '@wasichai/ui'
import { CircleHelp, Info, Lock, RotateCw } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { codigoDelError } from '../datos/http'
import { NS } from '../i18n'
import { correlacionDe, useMensajeDeError } from './errores'

// los estados comunes de design-system.md §6.5: carga, error con su código de correlación y reintento, vacío, campo
// restringido y cifra no disponible (nunca vacío ni cero, RQ-DSH-032)

// compacto: en línea (un <span>) y como texto, para usarlo dentro de una tarjeta pequeña o de un párrafo, como el rótulo que
// carga de RegistroVinculado. sin compacto, el esqueleto de design-system.md §5.3 y §6.5, el único patrón de carga de una zona
// de resultados: la forma real de una tabla (la cabecera y unas filas con el código, el título, los metadatos, el chip y la
// cifra en barras surface-sunken de 12 px, 9 px la del código, radio 3), sin brillo ni animación, y «Cargando…» a la vista y
// en role="status"
const FILAS_DEL_ESQUELETO = ['w-3/4', 'w-2/3', 'w-4/5', 'w-3/5']
const BARRA = 'rounded-sg-sm bg-sg-surface-sunken'

export function Cargando({ etiqueta, compacto }: { etiqueta?: string; compacto?: boolean }) {
  const { t } = useTranslation(NS)
  const texto = etiqueta ?? t('comun.cargando')
  if (compacto)
    return (
      <span role="status" aria-busy="true" className="text-sm text-sg-text-muted">
        {texto}
      </span>
    )
  return (
    <div role="status" aria-busy="true" className="space-y-2">
      <p className="text-sg-body-sm text-sg-text-secondary">{texto}</p>
      <div aria-hidden className="overflow-hidden rounded-sg-md border border-sg-border bg-sg-surface">
        <div data-esqueleto-cabecera className="h-sg-table-head border-b-2 border-sg-border-strong bg-sg-surface-sunken" />
        {FILAS_DEL_ESQUELETO.map((ancho, i) => (
          <div key={i} data-esqueleto-fila className="flex items-center gap-4 border-b border-sg-border-subtle px-3 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div data-esqueleto className={cn(BARRA, 'h-2.25 w-16')} />
              <div data-esqueleto className={cn(BARRA, 'h-3', ancho)} />
              <div data-esqueleto className={cn(BARRA, 'h-3 w-1/3')} />
            </div>
            <div data-esqueleto className={cn(BARRA, 'hidden h-5 w-28 sm:block')} />
            <div data-esqueleto className={cn(BARRA, 'h-3 w-14')} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ErrorDeCarga({ error, alReintentar }: { error: unknown; alReintentar?: () => void }) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  const correlacion = correlacionDe(error)
  return (
    // la alerta de peligro de design-system.md §5.3 (la caja, el borde de 2 px y el ícono los pone la capa de componentes): qué
    // falló, el código de soporte en Plex Mono si el error lo trae (X-Correlation-Id) y «Reintentar»
    <Alert tone="danger" title={t('comun.errorDeCarga')}>
      <span className="block">{mensaje(error)}</span>
      {correlacion ? <span className="block font-sg-mono text-sg-caption">{t('comun.correlacion', { id: correlacion })}</span> : null}
      {alReintentar ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={alReintentar}>
          <RotateCw aria-hidden className="size-4" />
          {t('comun.reintentar')}
        </Button>
      ) : null}
    </Alert>
  )
}

// el vacío de design-system.md §5.3: un panel con relleno de 40 × 32 px, alineado a la izquierda, con el título, lo que sí hay
// y la acción que saca del vacío («Quitar los filtros», «Registrar…»)
export function Vacio({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children?: ReactNode }) {
  return (
    <div data-vacio className="space-y-2 rounded-sg-md border border-sg-border bg-sg-surface px-8 py-10 text-left">
      <p className="text-sg-h3 text-sg-text">{titulo}</p>
      {children ? <div className="max-w-prose text-sg-body text-sg-text-secondary">{children}</div> : null}
      {accion ? <div className="flex flex-wrap items-center gap-3 pt-2">{accion}</div> : null}
    </div>
  )
}

// la carga, el error y los datos de una consulta de TanStack Query. el error se dibuja solo sin datos: una relectura fallida
// (un «Recargar» tras un 412, la invalidación tras una transición) conserva los datos y no desmonta lo que está debajo,
// donde puede haber texto sin guardar; quien relee dice su propio fallo. un 403 es «no disponible», nunca un error. con
// noExiste, un 404 (el registro de una ficha que no existe) dibuja ese contenido y no un error con «Reintentar», que no sirve
export function Consulta<T>({ consulta, noExiste, children }: { consulta: UseQueryResult<T>; noExiste?: ReactNode; children: (datos: T) => ReactNode }) {
  if (consulta.isPending) return <Cargando />
  if (consulta.isError && consulta.data === undefined) {
    if (noExiste && consulta.error instanceof ApiError && consulta.error.status === 404) return <>{noExiste}</>
    return esProhibido(consulta.error) ? (
      <NoDisponible motivo={codigoDelError(consulta.error)} />
    ) : (
      <ErrorDeCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
    )
  }
  return <>{children(consulta.data as T)}</>
}

// un 403: la cuenta no lee eso (security.md §7.9), así que se dice «no disponible» y no un error que invite a reintentar
export const esProhibido = (error: unknown): boolean => error instanceof ApiError && error.status === 403

// un registro que la cuenta no lee responde 404, igual que uno que no existe: el alcance de lectura por proyecto (ADR-0029) y
// el de las QCS confidenciales (ADR-0028) lo ocultan así, y el portal no distingue «no existe» de «no es de sus proyectos»
// (spec 4.4 §3.6)
export const esIlegible = (error: unknown): boolean => error instanceof ApiError && error.status === 404

// lo que dibuja la ficha de un registro que responde 404 (el noExiste de Consulta): que no existe o no es de sus proyectos, sin
// distinguir y sin un «Reintentar» que no sirve
export function NoEsDeSusProyectos() {
  const { t } = useTranslation(NS)
  return <Alert tone="warning">{t('comun.errores.404')}</Alert>
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
        className="inline-flex size-6 items-center justify-center rounded-sg-sm hover:text-sg-text"
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

// femenina: el dato es una postura o una confianza («Restringida», como en S06)
export function Restringido({ describedPor, femenina = false }: { describedPor?: string; femenina?: boolean }) {
  const { t } = useTranslation(NS)
  return (
    <ConMotivo
      icono={<Lock aria-hidden className="size-3.5" />}
      etiqueta={t(femenina ? 'comun.restringida' : 'comun.restringido')}
      motivo={t('comun.restringidoAyuda')}
      describedPor={describedPor}
    />
  )
}

// el vínculo a un registro que quien mira no lee: de un proyecto en que no está asignado (ADR-0029), una QCS confidencial
// (ASM-095) o uno borrado. wasichai responde 404 por los tres y el portal no los distingue: «Registro reservado», sin enlace ni
// datos, con el motivo a mano
export function Reservado({ describedPor }: { describedPor?: string }) {
  const { t } = useTranslation(NS)
  return (
    <ConMotivo
      icono={<Lock aria-hidden className="size-3.5" />}
      etiqueta={t('comun.registroReservado')}
      motivo={t('comun.registroReservadoAyuda')}
      describedPor={describedPor}
    />
  )
}

// la explicación única de una columna con celdas restringidas o no disponibles: va en el encabezado (ThConExplicacion, que la
// deja fuera del nombre de la columna), con el id que las celdas
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

// el encabezado de una columna con explicación única: el nombre accesible es solo el de la columna (aria-labelledby al texto),
// sin el botón de ayuda ni el motivo, que las celdas leen por aria-describedby; así un lector de pantalla no anuncia
// «Postura, Por qué no se muestra, Su rol no puede leer este dato» en cada celda
export function ThConExplicacion({
  children,
  explicacion,
  tipo,
  soloLectores
}: {
  children: ReactNode
  explicacion: string
  tipo: 'restringido' | 'noDisponible'
  soloLectores?: boolean
}) {
  const nombre = useId()
  return (
    <Th scope="col" aria-labelledby={nombre}>
      <span id={nombre}>{children}</span>
      <ExplicacionDeColumna id={explicacion} tipo={tipo} soloLectores={soloLectores} />
    </Th>
  )
}

// un dato que no se muestra dice por qué (unavailableReason, plan 2.2): sin permiso sobre un campo o un objeto, candado
// y "No disponible"; si el indicador se calcula para un solo proyecto, pide elegirlo. sin motivo, el texto es neutro: sirve
// igual para una cifra que para una lista
export function NoDisponible({ motivo, describedPor, enLista }: { motivo?: string | null; describedPor?: string; enLista?: boolean }) {
  const { t } = useTranslation(NS)
  // en una lista o un registro, el motivo no habla de «cifra»: comun.noDisponibleEnLista lo dice sin esa palabra y, si no
  // tiene variante, vale el de la cifra; un motivo que es el código de una guarda (NOT_ASSIGNED…) se dice con comun.codigos,
  // el mismo texto que las demás pantallas, y uno sin texto cae en el neutro
  const claves = motivo ? [...(enLista ? [`comun.noDisponibleEnLista.${motivo}`] : []), `comun.noDisponiblePorMotivo.${motivo}`, `comun.codigos.${motivo}`] : []
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
