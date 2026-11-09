import { useAuth } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { atributo } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useLeeTodosLosProyectos, useMisProyectos, useProyectos } from './proyectos'
import { conBusquedaQueSeConserva, rutaEquivalente } from './rutas'

// el selector de proyecto de la barra superior (ux-architecture.md §7.1): el alcance global o un proyecto. lista los proyectos
// que la cuenta lee, ya acotados por el servidor a sus asignaciones vigentes (alcance por proyecto, ADR-0029); los de la persona
// van primero. quien lee todos los proyectos (useLeeTodosLosProyectos, ADMIN incluido) ve el alcance global como «Todos los
// proyectos», y los demás como «Todos mis proyectos»; es el valor por defecto. sin proyectos que leer ni la acción, dice que no
// tiene asignaciones en lugar de un selector que solo lleva a listas vacías (spec 4.4 §3.12). elegir otro alcance monta la misma
// página con ese alcance (ASM-076). sin READ sobre project no se dibuja. en la cabecera se ve desde md (design-system.md §5.2):
// con el alcance global, un botón de contorno blanco; con un proyecto, blanco con el código en Plex Mono y el nombre desde lg.
// «siempre» es el del panel del menú, el único en el teléfono, donde la banda de contexto dice el alcance (D2 de la revisión
// de UX).
// en Territorio el selector es el lente del mapa (A24 de la segunda pasada de UX, recuperado en la tercera; ux-architecture.md
// §6.1: el territorio es del tenant y el proyecto es el lente con que se mira): lee y escribe ?project= sin salir de la pantalla,
// y sin proyecto dice «Todo el territorio». la pantalla no tiene su propio «Proyecto del mapa»: hay un solo control de proyecto
export const esTerritorio = (pathname: string) => /^\/territory(\/|$)/.test(pathname)

// el proyecto que la barra muestra: el del alcance o, en Territorio, el del lente
export function useProyectoDeLaBarra(): string {
  const { scope } = useContextFilters()
  const { pathname } = useLocation()
  const [busqueda] = useSearchParams()
  if (esTerritorio(pathname)) return busqueda.get('project') ?? ''
  return scope.kind === 'project' ? scope.projectId : ''
}

export function SelectorDeProyecto({ siempre = false }: { siempre?: boolean }) {
  const { can } = useAuth()
  return can('project', 'READ') ? <Selector siempre={siempre} /> : null
}

// la etiqueta de una opción es «CÓDIGO · Nombre»
const codigoDe = (etiqueta: string) => etiqueta.split(' · ')[0]
const nombreDe = (etiqueta: string) => etiqueta.split(' · ').slice(1).join(' · ')

// sin tildes ni mayúsculas, para buscar «Qorí» como «qori»
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

// un combobox con búsqueda (DD-09, APG «combobox with listbox popup»): el campo dice el alcance actual; al abrirlo (clic, flechas o
// al escribir) muestra «Todos mis proyectos» y los proyectos que coinciden con lo escrito, por código o nombre. las flechas mueven
// la opción activa (aria-activedescendant), Home y End van a los extremos, Enter elige, Escape y Tab cierran sin cambiar. elegir
// es lo mismo que el select de antes: la misma página con el otro alcance (ASM-076), salvo en Territorio, donde es el lente
function Selector({ siempre }: { siempre: boolean }) {
  const { t } = useTranslation(NS)
  const { pathname } = useLocation()
  const [busqueda, fijar] = useSearchParams()
  const navegar = useNavigate()
  const territorio = esTerritorio(pathname)
  const proyectos = useProyectos()
  const mios = useMisProyectos()
  const leeTodo = useLeeTodosLosProyectos()
  const id = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [activa, setActiva] = useState(0)
  const actual = useProyectoDeLaBarra()
  const lista = [...(proyectos.data ?? [])].sort((a, b) => Number(mios.has(b.id)) - Number(mios.has(a.id)))
  const opciones = [
    { id: '', etiqueta: territorio ? t('sig.todosLosLugares') : leeTodo ? t('contexto.todosLosProyectos') : t('contexto.todos') },
    ...lista.map((p) => ({ id: p.id, etiqueta: `${String(atributo(p, 'code') ?? '')} · ${String(atributo(p, 'name') ?? '')}` }))
  ]
  // «Todos» queda siempre a mano; los proyectos, si coinciden con lo escrito
  const filtrar = (texto: string) => {
    const q = normalizar(texto.trim())
    return q ? opciones.filter((o) => o.id === '' || normalizar(o.etiqueta).includes(q)) : opciones
  }
  const filtradas = filtrar(consulta)
  const sinCoincidencias = consulta.trim() !== '' && filtradas.length === 1
  const elegida = opciones.find((o) => o.id === actual)
  // un proyecto de la URL que todavía no está en la lista se nombra por su id, como el chip
  const etiquetaActual = elegida?.etiqueta ?? actual
  const idDeOpcion = (i: number) => `${id}-opcion-${i}`
  useEffect(() => {
    if (abierto) document.getElementById(`${id}-opcion-${activa}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [abierto, activa, id])
  if (proyectos.isSuccess && lista.length === 0 && !leeTodo)
    return <p className={cn('max-w-64 text-sm', siempre ? 'block text-sg-text-muted' : 'hidden text-sg-header-text md:block')}>{t('contexto.sinProyectos')}</p>

  const abrir = () => {
    if (abierto) return
    setConsulta('')
    setActiva(
      Math.max(
        0,
        opciones.findIndex((o) => o.id === actual)
      )
    )
    setAbierto(true)
  }
  const cerrar = () => {
    setAbierto(false)
    setConsulta('')
  }
  const elegir = (elegido: string) => {
    cerrar()
    if (elegido === actual) return
    if (!territorio) return navegar(conBusquedaQueSeConserva(pathname, rutaEquivalente(pathname, elegido || null), busqueda))
    const siguiente = new URLSearchParams(busqueda)
    if (elegido) siguiente.set('project', elegido)
    else siguiente.delete('project')
    fijar(siguiente)
  }
  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    const ultimo = filtradas.length - 1
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!abierto) return abrir()
      setActiva((a) => (e.key === 'ArrowDown' ? (a >= ultimo ? 0 : a + 1) : a <= 0 ? ultimo : a - 1))
    } else if (abierto && (e.key === 'Home' || e.key === 'End')) {
      e.preventDefault()
      setActiva(e.key === 'Home' ? 0 : ultimo)
    } else if (e.key === 'Enter' && abierto) {
      e.preventDefault()
      const opcion = filtradas[activa]
      if (opcion) elegir(opcion.id)
    } else if (e.key === 'Escape' && abierto) {
      e.preventDefault()
      cerrar()
    } else if (e.key === 'Tab') cerrar()
  }

  return (
    <div
      ref={raiz}
      className={cn('relative text-sm', siempre ? 'block w-full' : 'hidden shrink-0 md:block')}
      onBlur={(e) => {
        if (!raiz.current?.contains(e.relatedTarget as Node | null)) cerrar()
      }}
    >
      <input
        type="text"
        role="combobox"
        aria-label={t('contexto.proyecto')}
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-lista` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={abierto && filtradas[activa] ? idDeOpcion(activa) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={abierto ? consulta : etiquetaActual}
        placeholder={t('contexto.buscarProyecto')}
        onClick={abrir}
        onChange={(e) => {
          // al escribir, la activa es el primer proyecto que coincide
          setConsulta(e.target.value)
          setActiva(e.target.value.trim() && filtrar(e.target.value).length > 1 ? 1 : 0)
          setAbierto(true)
        }}
        onKeyDown={alTeclear}
        className={cn(
          'w-full truncate rounded-sg-md text-sg-text placeholder:text-sg-text-muted',
          siempre
            ? 'h-sg-field border-2 border-sg-border-control bg-sg-surface pr-8 pl-3 text-sg-body'
            : 'h-10 border-2 pr-9 pl-3 text-sg-body font-semibold md:w-40 lg:w-56 xl:w-64',
          !siempre &&
            (abierto
              ? 'border-sg-surface bg-sg-surface'
              : actual
                ? 'border-sg-surface bg-sg-surface text-transparent'
                : 'border-sg-header-text/55 bg-transparent text-sg-header-text')
        )}
      />
      {/* el proyecto elegido en la cabecera: el código en Plex Mono y el nombre (desde lg), dibujados sobre el campo cerrado; el
          valor del campo sigue siendo el que leen los lectores de pantalla */}
      {!siempre && !abierto && actual ? (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex max-w-full items-center gap-2 pr-9 pl-3 text-sg-primary-text">
          <span className="shrink-0 font-sg-mono text-sg-body-sm font-semibold">{elegida ? codigoDe(elegida.etiqueta) : actual}</span>
          <span className="hidden truncate text-sg-body font-semibold lg:inline">{elegida ? nombreDe(elegida.etiqueta) : ''}</span>
        </span>
      ) : null}
      <ChevronDown
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2',
          siempre || abierto ? 'text-sg-text-muted' : actual ? 'text-sg-primary-text' : 'text-sg-header-text'
        )}
      />
      {abierto ? (
        <div className="absolute top-full left-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-sg-md border-2 border-sg-border-strong bg-sg-surface-raised p-1 text-sg-text shadow-sg-overlay">
          <ul id={`${id}-lista`} role="listbox" aria-label={t('contexto.proyecto')} className="max-h-80 overflow-y-auto">
            {filtradas.map((o, i) => (
              <li
                key={o.id || 'todos'}
                id={idDeOpcion(i)}
                role="option"
                aria-selected={o.id === actual}
                // el foco se queda en el campo: el clic elige sin perderlo
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => setActiva(i)}
                onClick={() => elegir(o.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-sg-sm px-2 py-1.5',
                  i === activa && 'bg-sg-surface-hover',
                  o.id === actual ? 'font-medium text-sg-primary-text' : 'text-sg-text'
                )}
              >
                <Check aria-hidden className={cn('size-4 shrink-0', o.id !== actual && 'invisible')} />
                <span className="truncate">{o.etiqueta}</span>
              </li>
            ))}
          </ul>
          {sinCoincidencias ? <p className="px-2 py-1.5 text-sg-text-muted">{t('contexto.sinCoincidencias')}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
