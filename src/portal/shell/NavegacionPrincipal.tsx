import { cn } from '@wasichai/ui'
import { ChevronDown, LayoutDashboard } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { NS } from '../i18n'
import { useInsignias } from './insignias'
import { BLOQUES, useArbol, type ClaveDeBloque, type SeccionNav } from './navTree'
import { seccionDeRuta } from './seccionActual'

// la navegación principal de Civic Modern (ux-architecture.md §7.1, design-system.md §5.2): una barra horizontal bajo la
// cabecera, desde lg, con Inicio, un botón por bloque de BLOQUES que abre un desplegable con sus secciones y Administración a
// la derecha. las secciones son las que se le ofrecen a la cuenta (useArbol, los mismos permisos de siempre): un bloque sin
// secciones no se dibuja y uno con una sola es un enlace. el desplegable sigue el patrón «disclosure navigation» de WAI-ARIA
// (no un menú): clic, Enter, Espacio o flecha abajo lo abren; las flechas recorren sus secciones; Esc lo cierra y devuelve el
// foco al botón; un clic fuera, salir con Tab o elegir una sección también lo cierran. se marca el bloque de la sección de la
// ruta (seccionDeRuta: dentro de un proyecto, la del módulo abierto) con el borde inferior de 4 px
// el tamaño del texto va en la lista (text-sg-body dentro de cn() se confundiría con un color)
const ENTRADA = 'flex h-full items-center gap-1 border-y-4 border-transparent px-2 font-semibold whitespace-nowrap xl:gap-1.5 xl:px-3.5'
const REPOSO = 'text-sg-text hover:bg-sg-surface-hover'
const MARCADA = 'border-b-sg-primary font-bold text-sg-primary-text'

// el nombre de una sección en la barra y su nombre completo para title (DD-10: QCS se dice «Quejas y solicitudes»)
export function useNombreEnLaBarra(): (seccion: SeccionNav) => { nombre: string; completo: string } {
  const { t } = useTranslation(NS)
  return (seccion) => {
    const completo = t(`secciones.${seccion.clave}`)
    return { nombre: t(`seccionesEnLaBarra.${seccion.clave}`, { defaultValue: '' }) || completo, completo }
  }
}

export function NavegacionPrincipal({ className }: { className?: string }) {
  const { t } = useTranslation(NS)
  const secciones = useArbol()
  const { pathname } = useLocation()
  const actual = seccionDeRuta(pathname)
  const nombreDe = useNombreEnLaBarra()
  const [abierto, setAbierto] = useState<ClaveDeBloque | null>(null)
  const raiz = useRef<HTMLElement>(null)
  // otra ruta cierra el desplegable (se eligió una sección o se navegó por otro lado)
  useEffect(() => setAbierto(null), [pathname])
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(null)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  const bloques = BLOQUES.map((bloque) => ({ ...bloque, secciones: secciones.filter((s) => bloque.secciones.includes(s.clave)) })).filter(
    (bloque) => bloque.secciones.length > 0
  )
  const enlace = (seccion: SeccionNav, alFinal = false) => {
    const { nombre, completo } = nombreDe(seccion)
    const marcada = seccion.clave === actual
    return (
      <li key={seccion.clave} className={cn('h-full', alFinal && 'ml-auto')}>
        <Link
          to={seccion.to}
          title={nombre === completo ? undefined : completo}
          aria-current={marcada ? 'page' : undefined}
          className={cn(ENTRADA, marcada ? MARCADA : REPOSO)}
        >
          {nombre}
        </Link>
      </li>
    )
  }
  return (
    <nav ref={raiz} aria-label={t('shell.secciones')} className={cn('h-sg-nav shrink-0 border-b border-sg-border bg-sg-surface px-4 xl:px-8', className)}>
      {/* a 1024 px los cinco bloques y Administración caben en una fila con el texto de 13,5 px; desde xl, el de 15 */}
      <ul className="flex h-full items-stretch text-sg-body-sm xl:text-sg-body">
        {bloques.map((bloque) => {
          if (!bloque.clave || bloque.secciones.length === 1) return bloque.secciones.map((s) => enlace(s, s.clave === 'admin'))
          const clave = bloque.clave
          return (
            <Bloque
              key={clave}
              clave={clave}
              secciones={bloque.secciones}
              actual={actual}
              abierto={abierto === clave}
              alAlternar={(abrir) => setAbierto(abrir ? clave : null)}
            />
          )
        })}
      </ul>
    </nav>
  )
}

function Bloque({
  clave,
  secciones,
  actual,
  abierto,
  alAlternar
}: {
  clave: ClaveDeBloque
  secciones: SeccionNav[]
  actual: string | null
  abierto: boolean
  alAlternar: (abrir: boolean) => void
}) {
  const { t } = useTranslation(NS)
  const nombreDe = useNombreEnLaBarra()
  const insignias = useInsignias()
  const id = useId()
  const boton = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  // a qué sección va el foco al abrir con el teclado: la primera o, con la flecha arriba, la última
  const [enfocar, setEnfocar] = useState<'primera' | 'ultima' | null>(null)
  const titulo = t(`shell.bloques.${clave}`)
  const abierta = secciones.find((s) => s.clave === actual)
  const enlaces = () => [...(lista.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])]
  useEffect(() => {
    if (!abierto || !enfocar) return
    const todos = enlaces()
    ;(enfocar === 'primera' ? todos[0] : todos.at(-1))?.focus()
    setEnfocar(null)
  }, [abierto, enfocar])
  const cerrar = () => {
    alAlternar(false)
    boton.current?.focus()
  }
  const alTeclearEnElBoton = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setEnfocar('primera')
      alAlternar(true)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setEnfocar('ultima')
      alAlternar(true)
    } else if (e.key === 'Escape' && abierto) {
      e.preventDefault()
      alAlternar(false)
    }
  }
  const alTeclearEnLaLista = (e: KeyboardEvent<HTMLUListElement>) => {
    const todos = enlaces()
    const i = todos.indexOf(document.activeElement as HTMLAnchorElement)
    const ir = (j: number) => {
      e.preventDefault()
      todos[(j + todos.length) % todos.length]?.focus()
    }
    if (e.key === 'ArrowDown') ir(i + 1)
    else if (e.key === 'ArrowUp') ir(i - 1)
    else if (e.key === 'Home') ir(0)
    else if (e.key === 'End') ir(todos.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      cerrar()
    }
  }
  return (
    <li
      className="relative h-full"
      onBlur={(e) => {
        // salir del bloque con Tab lo cierra
        if (abierto && !e.currentTarget.contains(e.relatedTarget as Node | null)) alAlternar(false)
      }}
    >
      <button
        ref={boton}
        id={`${id}-boton`}
        type="button"
        aria-expanded={abierto}
        aria-controls={`${id}-lista`}
        aria-current={abierta ? 'true' : undefined}
        aria-describedby={abierta ? `${id}-abierta` : undefined}
        onClick={() => alAlternar(!abierto)}
        onKeyDown={alTeclearEnElBoton}
        className={cn(ENTRADA, abierta ? MARCADA : REPOSO, abierto && 'bg-sg-surface-hover')}
      >
        {titulo}
        <ChevronDown aria-hidden className={cn('size-4 shrink-0 motion-safe:transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierta ? (
        <span id={`${id}-abierta`} hidden>
          {t('shell.bloqueActual', { bloque: titulo, seccion: nombreDe(abierta).completo })}
        </span>
      ) : null}
      <ul
        ref={lista}
        id={`${id}-lista`}
        aria-labelledby={`${id}-boton`}
        hidden={!abierto}
        onKeyDown={alTeclearEnLaLista}
        className="absolute top-full left-0 z-40 w-90 text-sg-body max-w-[calc(100vw-2rem)] rounded-sg-md border-2 border-sg-border-strong bg-sg-surface-raised py-2 shadow-sg-overlay"
      >
        <li aria-hidden className="px-4 pt-1 pb-2 text-sg-overline tracking-wide text-sg-text-secondary uppercase">
          {titulo}
        </li>
        {secciones.map((seccion) => {
          const Icono = seccion.icon ?? LayoutDashboard
          const { nombre, completo } = nombreDe(seccion)
          const marcada = seccion.clave === actual
          // la línea secundaria, solo con un dato que el shell ya lee: las tareas suyas vencidas o por vencer
          const pendientes = seccion.clave === 'tasks' && insignias.tareas ? t('shell.insignias.tareas', { count: insignias.tareas }) : ''
          return (
            <li key={seccion.clave}>
              <Link
                to={seccion.to}
                title={nombre === completo ? undefined : completo}
                aria-current={marcada ? 'page' : undefined}
                aria-describedby={pendientes ? `${id}-${seccion.clave}-linea` : undefined}
                onClick={() => alAlternar(false)}
                className={cn(
                  'flex items-start gap-3 border-l-4 px-4 py-2.5',
                  marcada ? 'border-sg-primary bg-sg-primary-soft font-bold text-sg-primary-text' : 'border-transparent text-sg-text hover:bg-sg-surface-hover'
                )}
              >
                <Icono aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold">{nombre}</span>
                  {pendientes ? (
                    <span aria-hidden className="block text-sg-body-sm font-normal text-sg-text-secondary">
                      {pendientes}
                    </span>
                  ) : null}
                </span>
              </Link>
              {pendientes ? (
                <span id={`${id}-${seccion.clave}-linea`} hidden>
                  {pendientes}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </li>
  )
}
