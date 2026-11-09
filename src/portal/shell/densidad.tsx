import { useEffect, useId, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// la densidad compacta (ADR-0032, design-system.md §3.5): una preferencia de cada persona que vive en el navegador
// (sgspe.densidad, normal o compacta) y que tokens.css lee como data-density="compact" en <html>: filas, controles, campos,
// cabecera y navegación más bajos, nunca colores ni tipografía. el script de arranque de index.html la escribe antes de pintar;
// aquí se cambia y se mantiene. sin almacenamiento (ventana privada, datos bloqueados) la elección dura la visita, como las
// columnas de TablaPriorizada
export type Densidad = 'normal' | 'compacta'

const CLAVE = 'sgspe.densidad'
let enMemoria: Densidad | null = null
const oyentes = new Set<() => void>()

const interpretar = (crudo: string | null): Densidad => (crudo === 'compacta' ? 'compacta' : 'normal')

export function leerDensidad(): Densidad {
  try {
    return interpretar(localStorage.getItem(CLAVE))
  } catch {
    return enMemoria ?? 'normal'
  }
}

function aplicar(densidad: Densidad) {
  if (densidad === 'compacta') document.documentElement.dataset.density = 'compact'
  else delete document.documentElement.dataset.density
}

export function guardarDensidad(densidad: Densidad) {
  enMemoria = densidad
  try {
    localStorage.setItem(CLAVE, densidad)
  } catch {
    // queda en memoria
  }
  aplicar(densidad)
  oyentes.forEach((oyente) => oyente())
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  // otra pestaña del mismo navegador
  window.addEventListener('storage', oyente)
  return () => {
    oyentes.delete(oyente)
    window.removeEventListener('storage', oyente)
  }
}

export function useDensidad(): [Densidad, (densidad: Densidad) => void] {
  const densidad = useSyncExternalStore(suscribir, leerDensidad)
  // <html> sigue a lo guardado: al montar y cuando otra pestaña lo cambia
  useEffect(() => aplicar(densidad), [densidad])
  return [densidad, guardarDensidad]
}

const OPCIONES: readonly Densidad[] = ['normal', 'compacta']

// «Densidad: Normal · Compacta», un grupo de radio nativo (el anillo de foco de E y las flechas del navegador), en el menú de la
// cuenta y en el panel «Más» del teléfono
export function SelectorDeDensidad() {
  const { t } = useTranslation(NS)
  const [densidad, setDensidad] = useDensidad()
  const nombre = useId()
  return (
    <div role="radiogroup" aria-label={t('shell.densidad.titulo')} className="flex items-center gap-3">
      {OPCIONES.map((opcion) => (
        <label key={opcion} className="flex h-8 cursor-pointer items-center gap-1.5 text-sm text-sg-text">
          <input
            type="radio"
            name={nombre}
            value={opcion}
            checked={densidad === opcion}
            onChange={() => setDensidad(opcion)}
            className="size-4 accent-sg-primary"
          />
          {t(`shell.densidad.${opcion}`)}
        </label>
      ))}
    </div>
  )
}
