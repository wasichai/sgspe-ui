import { useQueries } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Dialog, DialogContent, DialogTitle, cn } from '@wasichai/ui'
import { Search } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { useNombreDelGrupo } from '../componentes/NombreDeActor'
import { useVistaActual } from '../componentes/Pagina'
import type { EstadoDeNavegacion } from '../contexto/Origen'
import { nombreDeProyecto, useProyectos } from '../contexto/proyectos'
import { useSiguientePaso } from '../contexto/Rastro'
import { rutaDeFicha } from '../datos/fichas'
import { usePedir } from '../datos/http'
import { consulta, texto, type Pagina, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useTeclaDeBusqueda } from '../shell/HojaDeAtajos'

// la búsqueda global (ux-architecture.md §7.3): se abre con ⌘K o Ctrl K desde cualquier pantalla, o con su botón de la barra
// superior. busca con ?q= de la API genérica en cada objeto que la cuenta puede leer (nunca en lo que no), cinco por categoría,
// y agrupa los resultados con su conteo. ↑ ↓ se mueven, Enter abre la ficha, Esc cierra.
// rediseño de UX (2026-10-20): cada resultado dice su proyecto y su estado, para reconocerlo antes de abrirlo; sin resultados dice
// cómo ampliar la búsqueda; la consulta se conserva en la sesión del navegador al cerrar y volver (solo lo escrito, nunca un
// resultado); y dentro de un proyecto busca primero en él, con «en todos sus proyectos» a un clic (ux-architecture.md §7.3)
const CATEGORIAS = [
  'project',
  'stakeholder',
  'engagement',
  'commitment',
  'grievance',
  'inquiry',
  'stakeholder_request',
  'social_risk',
  'social_program',
  'evidence',
  'locality',
  'community'
] as const
type Categoria = (typeof CATEGORIAS)[number]
const POR_CATEGORIA = 5
const ESPERA = 250
// los que pertenecen a un proyecto: dentro de uno, se buscan en él primero. el territorio es del tenant y un proyecto es él mismo
const CON_PROYECTO: ReadonlySet<Categoria> = new Set([
  'stakeholder',
  'engagement',
  'commitment',
  'grievance',
  'inquiry',
  'stakeholder_request',
  'social_risk',
  'social_program',
  'evidence'
])
const CLAVE_DE_LA_CONSULTA = 'sgspe.busqueda'

// lo escrito, en la sesión del navegador: sin almacenamiento (una ventana privada que lo bloquea) se empieza vacío
function leerConsulta(): string {
  try {
    return sessionStorage.getItem(CLAVE_DE_LA_CONSULTA) ?? ''
  } catch {
    return ''
  }
}
function guardarConsulta(termino: string) {
  try {
    sessionStorage.setItem(CLAVE_DE_LA_CONSULTA, termino)
  } catch {
    // sin almacenamiento, la próxima búsqueda empieza vacía
  }
}

// el rótulo de un resultado: el código y el título o el nombre que el objeto tenga
const rotuloDe = (registro: Registro): string =>
  [texto(registro, 'code'), texto(registro, 'title') || texto(registro, 'name') || texto(registro, 'description').slice(0, 80)].filter(Boolean).join(' · ')

function useTerminoConEspera(termino: string): string {
  const [estable, setEstable] = useState(termino)
  useEffect(() => {
    const plazo = setTimeout(() => setEstable(termino), ESPERA)
    return () => clearTimeout(plazo)
  }, [termino])
  return estable
}

export function BotonBuscar() {
  const { t } = useTranslation(NS)
  // ⌘K en Mac y Ctrl K en los demás (tercera pasada de UX, 4.7)
  const tecla = useTeclaDeBusqueda()
  const [abierta, setAbierta] = useState(false)
  useEffect(() => {
    const alPulsar = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAbierta((a) => !a)
      }
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [])
  return (
    <>
      <button
        type="button"
        aria-label={t('busqueda.boton')}
        onClick={() => setAbierta(true)}
        className="flex h-8 items-center gap-2 rounded-sg-md border border-sg-border px-2 text-sm text-sg-text-secondary hover:bg-sg-surface-hover"
      >
        <Search aria-hidden className="size-4" />
        <span className="hidden md:inline">{t('busqueda.boton')}</span>
        <kbd className="hidden rounded-sg-xs border border-sg-border px-1 font-sg-mono text-sg-caption lg:inline">{tecla}</kbd>
      </button>
      {abierta ? <DialogoDeBusqueda alCerrar={() => setAbierta(false)} /> : null}
    </>
  )
}

function DialogoDeBusqueda({ alCerrar }: { alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const pedir = usePedir()
  const navegar = useNavigate()
  const paso = useSiguientePaso()
  const vista = useVistaActual()
  const { pathname, search } = useLocation()
  const idLista = useId()
  const [termino, setTermino] = useState(leerConsulta)
  const [activo, setActivo] = useState(0)
  const { scope } = useContextFilters()
  const [enTodos, setEnTodos] = useState(false)
  const proyecto = scope.kind === 'project' && !enTodos ? scope.projectId : undefined
  const buscado = useTerminoConEspera(termino.trim())
  const legibles = useMemo(() => CATEGORIAS.filter((c) => can(c, 'READ')), [can])
  const consultas = useQueries({
    queries: legibles.map((objeto) => {
      const filtro = proyecto && CON_PROYECTO.has(objeto) ? proyecto : undefined
      return {
        queryKey: ['busqueda', objeto, buscado, filtro ?? ''],
        queryFn: () => pedir<Pagina>(`/objects/${objeto}/records?${consulta({ q: buscado, size: POR_CATEGORIA, project: filtro })}`),
        enabled: buscado.length >= 2,
        staleTime: 30_000
      }
    })
  })
  const grupos = legibles
    .map((objeto, i) => ({ objeto, pagina: consultas[i]?.data }))
    .filter((g): g is { objeto: Categoria; pagina: Pagina } => (g.pagina?.content.length ?? 0) > 0)
  const resultados = grupos.flatMap((g) => g.pagina.content.map((registro) => ({ objeto: g.objeto, registro })))
  const cargando = buscado.length >= 2 && consultas.some((c) => c.isPending)
  useEffect(() => setActivo(0), [buscado])
  const abrir = (i: number) => {
    const elegido = resultados[i]
    const ruta = elegido ? rutaDeFicha(elegido.objeto, elegido.registro) : null
    if (!ruta) return
    alCerrar()
    // la ficha ofrece volver a la pantalla desde la que se buscó (flujo F-C), sin «Anterior» ni «Siguiente» ni conteo
    const estado: EstadoDeNavegacion = {
      ...paso(undefined, ruta),
      ...(vista ? { origen: { ruta: pathname + search, etiqueta: vista, total: null, fichas: [] } } : {})
    }
    navegar(ruta, { state: estado })
  }
  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((a) => Math.min(a + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      abrir(activo)
    }
  }
  let indice = -1
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="top-24 max-w-2xl translate-y-0 gap-3">
        <DialogTitle className="sr-only">{t('busqueda.titulo')}</DialogTitle>
        <div className="flex items-center gap-2 border-b border-sg-border pb-2">
          <Search aria-hidden className="size-4 text-sg-text-muted" />
          <input
            role="combobox"
            aria-label={t('busqueda.titulo')}
            aria-expanded={resultados.length > 0}
            aria-controls={idLista}
            aria-activedescendant={resultados.length ? `${idLista}-${activo}` : undefined}
            autoFocus
            // al volver con una consulta, seleccionada: escribir la reemplaza
            onFocus={(e) => e.currentTarget.select()}
            value={termino}
            onChange={(e) => {
              setTermino(e.target.value)
              guardarConsulta(e.target.value)
            }}
            onKeyDown={alTeclear}
            placeholder={t('busqueda.placeholder')}
            className="w-full bg-transparent py-1 text-sg-body text-sg-text outline-none"
          />
        </div>
        {scope.kind === 'project' ? (
          <div role="radiogroup" aria-label={t('busqueda.alcance')} className="flex flex-wrap gap-4 text-sm text-sg-text-secondary">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="alcance-de-la-busqueda" checked={!enTodos} onChange={() => setEnTodos(false)} />
              {t('busqueda.enEsteProyecto')}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="alcance-de-la-busqueda" checked={enTodos} onChange={() => setEnTodos(true)} />
              {t('busqueda.enTodos')}
            </label>
          </div>
        ) : null}
        {termino.trim().length < 2 ? (
          <p className="text-sm text-sg-text-muted">{t('busqueda.minimo')}</p>
        ) : cargando && resultados.length === 0 ? (
          <p role="status" className="text-sm text-sg-text-muted">
            {t('comun.cargando')}
          </p>
        ) : resultados.length === 0 ? (
          <div className="space-y-1 text-sm">
            <p className="text-sg-text">{t('busqueda.sinResultados', { termino: buscado })}</p>
            <p className="text-sg-text-muted">{t(proyecto ? 'busqueda.sinResultadosEnProyecto' : 'busqueda.sinResultadosAyuda')}</p>
          </div>
        ) : (
          <div id={idLista} role="listbox" aria-label={t('busqueda.resultados')} className="max-h-[60vh] space-y-3 overflow-y-auto">
            {grupos.map((g) => (
              <div key={g.objeto} role="group" aria-label={t(`busqueda.categorias.${g.objeto}`)}>
                <p className="px-2 text-sg-overline font-semibold uppercase text-sg-text-muted">
                  {t(`busqueda.categorias.${g.objeto}`)} ({g.pagina.totalElements ?? g.pagina.content.length})
                </p>
                {g.pagina.content.map((registro) => {
                  indice += 1
                  const i = indice
                  return (
                    <div
                      key={registro.id}
                      id={`${idLista}-${i}`}
                      role="option"
                      aria-selected={i === activo}
                      onMouseEnter={() => setActivo(i)}
                      onClick={() => abrir(i)}
                      className={cn('cursor-pointer rounded-sg-sm px-2 py-1.5 text-sm', i === activo && 'bg-sg-primary-soft text-sg-primary-text')}
                    >
                      <Resultado objeto={g.objeto} registro={registro} />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// un grupo de interés no tiene título propio: se nombra por su actor. debajo, su proyecto y su estado
function Resultado({ objeto, registro }: { objeto: Categoria; registro: Registro }) {
  return (
    <span className="flex flex-col">
      <span>{objeto === 'stakeholder' ? <NombreDeGrupo registro={registro} /> : rotuloDe(registro) || registro.id}</span>
      <ContextoDelResultado objeto={objeto} registro={registro} />
    </span>
  )
}

// el proyecto (de la lista que ya lee el selector de proyecto) y la etiqueta del estado; lo que no se sabe no se dice
function ContextoDelResultado({ objeto, registro }: { objeto: Categoria; registro: Registro }) {
  const proyectos = useProyectos()
  const estados = useEtiquetasDeEstado(objeto)
  const id = CON_PROYECTO.has(objeto) ? texto(registro, 'project') : ''
  const proyecto = id ? nombreDeProyecto(proyectos.data?.find((p) => p.id === id)) : ''
  const estado = registro.state ? estados[registro.state] : ''
  if (!proyecto && !estado) return null
  return (
    <span className="flex flex-wrap gap-x-2 text-sg-caption text-sg-text-muted">
      {proyecto ? <span>{proyecto}</span> : null}
      {estado ? <span>{estado}</span> : null}
    </span>
  )
}

function NombreDeGrupo({ registro }: { registro: Registro }) {
  return <>{useNombreDelGrupo(registro)}</>
}
