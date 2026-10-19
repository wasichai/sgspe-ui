import { useWasichaiConfig } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { ChevronDown, MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { texto, useRegistro } from '../datos/registros'
import { NS } from '../i18n'

// las piezas de página de la revisión de UX (etapa 0, design-system.md §6.1 y §6.4): un ancho único para todas las
// pantallas, un encabezado con el mismo orden y peso en todas, y el título del documento con la pantalla y el proyecto (D7)

// el ancho único de las pantallas; «lectura», más angosto, solo para textos largos (un acta, un entregable)
export function ContenedorDePagina({ variante = 'pagina', className, children }: { variante?: 'pagina' | 'lectura'; className?: string; children: ReactNode }) {
  return (
    <div data-ancho={variante} className={cn('mx-auto space-y-4', variante === 'lectura' ? 'max-w-3xl' : 'max-w-[1440px]', className)}>
      {children}
    </div>
  )
}

// «Título · Proyecto · SGSPE»: el historial, las pestañas del navegador y los marcadores dicen dónde se estaba (D7). el proyecto
// es el de la ruta (/projects/:projectId/…), leído de la caché que ya llenó ProyectoLayout. varias capas lo piden a la vez y
// los efectos de los hijos corren antes que los del padre: gana la de mayor prioridad (el shell, 0, con la sección; el
// proyecto, 1, con su pestaña; la pantalla, 2) y, entre iguales, la última. al salir la capa, vuelve la siguiente
export type PrioridadDeTitulo = 0 | 1 | 2
const PILA: { id: number; titulo: string; vista: string; prioridad: PrioridadDeTitulo }[] = []
let siguienteId = 0
// el nombre de la vista actual (el título de la capa que gana, sin el proyecto ni la aplicación): el paso que un enlace suma
// al rastro (revisión de UX, etapa 6). quien lo usa se vuelve a dibujar cuando cambia
let vistaActual = ''
const oyentes = new Set<() => void>()

function aplicar(appName: string | undefined) {
  const mejor = PILA.reduce<(typeof PILA)[number] | undefined>((a, b) => (!a || b.prioridad >= a.prioridad ? b : a), undefined)
  document.title = mejor ? mejor.titulo : (appName ?? '')
  const vista = mejor?.vista ?? ''
  if (vista === vistaActual) return
  vistaActual = vista
  for (const oyente of oyentes) oyente()
}

export function useVistaActual(): string {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    () => vistaActual
  )
}

export function useTituloDeDocumento(titulo: string, prioridad: PrioridadDeTitulo = 2) {
  const { appName } = useWasichaiConfig()
  const { projectId } = useParams()
  const proyecto = useRegistro('project', projectId)
  const nombre = proyecto.data ? texto(proyecto.data, 'name') : ''
  const id = useRef(0)
  if (id.current === 0) id.current = ++siguienteId
  useEffect(() => {
    const entrada = { id: id.current, titulo: [titulo, nombre, appName].filter(Boolean).join(' · '), vista: titulo, prioridad }
    const i = PILA.findIndex((e) => e.id === entrada.id)
    if (i >= 0) PILA[i] = entrada
    else PILA.push(entrada)
    aplicar(appName)
  }, [titulo, nombre, appName, prioridad])
  useEffect(
    () => () => {
      const i = PILA.findIndex((e) => e.id === id.current)
      if (i >= 0) PILA.splice(i, 1)
      aplicar(appName)
    },
    [appName]
  )
}

export interface PropsDeEncabezado {
  titulo: string
  // tipo y código de un registro («Compromiso · COM-2026-031»)
  antetitulo?: ReactNode
  // estado, plazo, prioridad
  chips?: ReactNode
  descripcion?: ReactNode
  // cuántos hay con el alcance actual
  conteo?: ReactNode
  // una sola acción primaria; las secundarias con menos peso; las demás, en «Más acciones»
  primaria?: ReactNode
  secundarias?: ReactNode
  mas?: ReactNode
  // «Lista · Tablero» del módulo (VistasDelModulo): va primero entre las acciones
  vistas?: ReactNode
  // si el título visible no basta para el documento (el código de una ficha)
  tituloDelDocumento?: string
}

export function EncabezadoDePagina({
  titulo,
  antetitulo,
  chips,
  descripcion,
  conteo,
  primaria,
  secundarias,
  mas,
  vistas,
  tituloDelDocumento
}: PropsDeEncabezado) {
  useTituloDeDocumento(tituloDelDocumento ?? titulo)
  const acciones = primaria || secundarias || mas || vistas
  return (
    // un div y no un <header>: dentro de main no es la barra superior, y así nada lo confunde con ella (el banner de la página)
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        {antetitulo ? <p className="font-sg-mono text-sg-caption text-sg-text-muted">{antetitulo}</p> : null}
        <h1 className="text-sg-h1 font-semibold">{titulo}</h1>
        {chips ? <div className="flex flex-wrap items-center gap-2 text-sm">{chips}</div> : null}
        {descripcion ? <p className="text-sm text-sg-text-secondary">{descripcion}</p> : null}
        {conteo ? <p className="text-sm text-sg-text-muted">{conteo}</p> : null}
      </div>
      {acciones ? (
        <div className="flex flex-wrap items-center gap-2">
          {vistas}
          {secundarias}
          {mas ? <MasAcciones>{mas}</MasAcciones> : null}
          {primaria}
        </div>
      ) : null}
    </div>
  )
}

// un desplegable sencillo (botón con aria-expanded y un grupo): Escape o un clic fuera lo cierran y el foco vuelve al botón
// el menú de acciones del encabezado: «Más» (solo el ícono) o, con etiqueta, un botón con su texto («Crear relacionado»)
export function MasAcciones({ children, etiqueta }: { children: ReactNode; etiqueta?: string }) {
  const { t } = useTranslation(NS)
  const nombre = etiqueta ?? t('paginas.mas')
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  const alTeclear = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    setAbierto(false)
    boton.current?.focus()
  }
  return (
    <div ref={raiz} className="relative" onKeyDown={alTeclear}>
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        aria-label={etiqueta ? undefined : nombre}
        title={etiqueta ? undefined : nombre}
        onClick={() => setAbierto((a) => !a)}
        className="flex h-8 items-center justify-center gap-1 rounded-sg-md border border-sg-border px-2 text-sm text-sg-text-secondary hover:bg-sg-surface-hover"
      >
        {etiqueta ? (
          <>
            {etiqueta}
            <ChevronDown aria-hidden className="size-4" />
          </>
        ) : (
          <MoreHorizontal aria-hidden className="size-4" />
        )}
      </button>
      {abierto ? (
        <div
          id={id}
          role="group"
          aria-label={nombre}
          className="absolute top-full right-0 z-30 mt-1 flex min-w-48 flex-col items-stretch gap-1 rounded-sg-md border border-sg-border bg-sg-surface p-1 shadow-sg-md"
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
