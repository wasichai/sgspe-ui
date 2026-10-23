import { useQueries } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Dialog, DialogContent, DialogTitle, cn } from '@wasichai/ui'
import { Search } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { useNombreDelGrupo } from '../componentes/NombreDeActor'
import { useVistaActual } from '../componentes/Pagina'
import type { EstadoDeNavegacion } from '../contexto/Origen'
import { useSiguientePaso } from '../contexto/Rastro'
import { rutaDeFicha } from '../datos/fichas'
import { usePedir } from '../datos/http'
import { consulta, texto, type Pagina, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// la búsqueda global (ux-architecture.md §7.3): se abre con ⌘K o Ctrl K desde cualquier pantalla, o con su botón de la barra
// superior. busca con ?q= de la API genérica en cada objeto que la cuenta puede leer (nunca en lo que no), cinco por categoría,
// y agrupa los resultados con su conteo. ↑ ↓ se mueven, Enter abre la ficha, Esc cierra
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
        onClick={() => setAbierta(true)}
        className="flex h-8 items-center gap-2 rounded-sg-md border border-sg-border px-2 text-sm text-sg-text-secondary hover:bg-sg-surface-hover"
      >
        <Search aria-hidden className="size-4" />
        <span className="hidden md:inline">{t('busqueda.boton')}</span>
        <kbd className="hidden rounded-sg-xs border border-sg-border px-1 font-sg-mono text-sg-caption lg:inline">{t('busqueda.atajo')}</kbd>
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
  const [termino, setTermino] = useState('')
  const [activo, setActivo] = useState(0)
  const buscado = useTerminoConEspera(termino.trim())
  const legibles = useMemo(() => CATEGORIAS.filter((c) => can(c, 'READ')), [can])
  const consultas = useQueries({
    queries: legibles.map((objeto) => ({
      queryKey: ['busqueda', objeto, buscado],
      queryFn: () => pedir<Pagina>(`/objects/${objeto}/records?${consulta({ q: buscado, size: POR_CATEGORIA })}`),
      enabled: buscado.length >= 2,
      staleTime: 30_000
    }))
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
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            onKeyDown={alTeclear}
            placeholder={t('busqueda.placeholder')}
            className="w-full bg-transparent py-1 text-sg-body text-sg-text outline-none"
          />
        </div>
        {termino.trim().length < 2 ? (
          <p className="text-sm text-sg-text-muted">{t('busqueda.minimo')}</p>
        ) : cargando && resultados.length === 0 ? (
          <p role="status" className="text-sm text-sg-text-muted">
            {t('comun.cargando')}
          </p>
        ) : resultados.length === 0 ? (
          <p className="text-sm text-sg-text-muted">{t('busqueda.sinResultados', { termino: buscado })}</p>
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

// un grupo de interés no tiene título propio: se nombra por su actor
function Resultado({ objeto, registro }: { objeto: Categoria; registro: Registro }) {
  if (objeto === 'stakeholder') return <NombreDeGrupo registro={registro} />
  return <>{rotuloDe(registro) || registro.id}</>
}

function NombreDeGrupo({ registro }: { registro: Registro }) {
  return <>{useNombreDelGrupo(registro)}</>
}
