import { Button } from '@wasichai/ui'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { indiceDeFicha, leerOrigen, type EstadoDeNavegacion } from '../contexto/Origen'
import type { Paso } from '../contexto/Rastro'
import { NS, numeroPe } from '../i18n'

// lo que un elemento enfocado hace con una letra: escribirla (un campo, un editor) o atenderla él mismo (un diálogo, un menú,
// una lista de opciones). ahí J y K no navegan
const ATIENDE_LAS_TECLAS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="dialog"], [role="alertdialog"], dialog'

function teclaParaLaFicha(e: KeyboardEvent): 'siguiente' | 'anterior' | null {
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return null
  const tecla = e.key.toLowerCase()
  if (tecla !== 'j' && tecla !== 'k') return null
  const objetivo = e.target instanceof Element ? e.target : null
  if (objetivo && (objetivo.closest(ATIENDE_LAS_TECLAS) || (objetivo instanceof HTMLElement && objetivo.isContentEditable))) return null
  // un diálogo abierto, aunque el foco haya quedado fuera de él
  if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], dialog[open]')) return null
  return tecla === 'j' ? 'siguiente' : 'anterior'
}

// «‹ Volver a <lista> (N)», «Anterior» y «Siguiente» sobre el antetítulo de una ficha (flujo F-C del rediseño de UX,
// 02-arquitectura-de-informacion §5): solo si la ficha se abrió desde una lista, un aviso, la búsqueda o una tarea, que dejan
// su origen en el estado del historial (contexto/Origen.tsx). «Volver» lleva a la lista con sus filtros y deja el rastro como
// estaba al salir de ella; «Anterior» y «Siguiente» (K y J) recorren las fichas visibles de su página y conservan el origen y el
// rastro. la ficha nueva se monta de nuevo (PorRuta), así que nada de lo abierto pasa de un registro a otro
export function NavegacionDeOrigen() {
  const { t } = useTranslation(NS)
  const { pathname, search, state } = useLocation()
  const navegar = useNavigate()
  const origen = leerOrigen(state)
  const rastro = (state as EstadoDeNavegacion | null)?.rastro
  const fichas = origen?.fichas ?? []
  const indice = indiceDeFicha(fichas, pathname, search)
  const conVecinos = indice >= 0 && fichas.length > 1
  const anterior = conVecinos && indice > 0 ? fichas[indice - 1] : null
  const siguiente = conVecinos && indice < fichas.length - 1 ? fichas[indice + 1] : null
  const ir = (ruta: string | null) => {
    if (ruta) navegar(ruta, { state })
  }
  useEffect(() => {
    if (!conVecinos) return
    const alTeclear = (e: KeyboardEvent) => {
      const accion = teclaParaLaFicha(e)
      if (!accion) return
      e.preventDefault()
      const destino = accion === 'siguiente' ? siguiente : anterior
      if (destino) navegar(destino, { state })
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [conVecinos, anterior, siguiente, navegar, state])
  if (!origen) return null
  // volver deja el rastro como estaba en la lista: sin el paso que la nombra ni los que siguen
  const pasos: Paso[] = Array.isArray(rastro) ? rastro : []
  const hasta = pasos.map((p) => p.ruta).lastIndexOf(origen.ruta)
  const volver =
    origen.total === null
      ? t('contexto.origen.volver', { lista: origen.etiqueta })
      : t('contexto.origen.volverConConteo', { lista: origen.etiqueta, n: numeroPe(origen.total) })
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Link
        to={origen.ruta}
        state={{ rastro: hasta >= 0 ? pasos.slice(0, hasta) : pasos }}
        className="inline-flex items-center gap-1 text-sg-caption font-medium text-sg-primary-text no-underline hover:underline focus-visible:underline"
      >
        <span aria-hidden>‹</span>
        {volver}
      </Link>
      {conVecinos ? (
        <div role="group" aria-label={t('contexto.origen.enLaLista', { lista: origen.etiqueta })} className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={!anterior}
            aria-keyshortcuts="K"
            title={`${t('contexto.origen.anterior')} (K)`}
            onClick={() => ir(anterior)}
          >
            <ChevronUp aria-hidden className="size-4" />
            {t('contexto.origen.anterior')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!siguiente}
            aria-keyshortcuts="J"
            title={`${t('contexto.origen.siguiente')} (J)`}
            onClick={() => ir(siguiente)}
          >
            <ChevronDown aria-hidden className="size-4" />
            {t('contexto.origen.siguiente')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
