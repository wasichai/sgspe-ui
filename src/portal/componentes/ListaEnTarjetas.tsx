import { useSyncExternalStore, type ReactNode } from 'react'
import { ResultadoDeLista } from '../contexto/Origen'

// las listas en el teléfono (revisión de UX, etapa 8): por debajo de sm, una tabla de trabajo se desplazaba en horizontal y su
// estado quedaba fuera de la pantalla. ahí la lista es de tarjetas con el título, el estado, el plazo y el proyecto; desde sm,
// la tabla de siempre. sin matchMedia (las pruebas), la tabla
const CONSULTA = '(max-width: 639.98px)'

// si la ventana cumple una consulta de medios, al día con sus cambios; sin matchMedia (las pruebas), no la cumple. la usan el
// teléfono de las listas, la columna opcional de las pantallas anchas y la vista previa acoplada desde xl
export function useCoincide(consulta: string): boolean {
  return useSyncExternalStore(
    (oyente) => {
      if (typeof window.matchMedia !== 'function') return () => undefined
      const medios = window.matchMedia(consulta)
      medios.addEventListener('change', oyente)
      return () => medios.removeEventListener('change', oyente)
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches
  )
}

export const useEsTelefono = (): boolean => useCoincide(CONSULTA)

export interface TarjetaDeLista {
  id: string
  // el enlace al registro (EnlaceDeRegistro)
  titulo: ReactNode
  estado?: ReactNode
  plazo?: ReactNode
  proyecto?: ReactNode
  // una línea más (el responsable, el monto)
  detalle?: ReactNode
}

// total: cuántos registros tiene el resultado entero, para el «Volver a <lista> (N)» de la ficha que se abra desde aquí
export function ListaEnTarjetas({ etiqueta, tarjetas, total }: { etiqueta: string; tarjetas: TarjetaDeLista[]; total?: number | null }) {
  return (
    <ResultadoDeLista total={total}>
      <ul aria-label={etiqueta} className="space-y-2">
        {tarjetas.map((t) => (
          <li key={t.id} className="space-y-1.5 rounded-sg-md border border-sg-border bg-sg-surface p-3 text-sg-table">
            {/* el título en 600 y sin subrayar (U-05): se subraya al pasar o con el foco */}
            <div className="min-w-0 font-semibold [&_a]:no-underline [&_a_span]:no-underline [&_a:focus-visible]:underline [&_a:hover]:underline">
              {t.titulo}
            </div>
            {t.estado || t.plazo ? (
              <div className="flex flex-wrap items-center gap-2">
                {t.estado}
                {t.plazo}
              </div>
            ) : null}
            {t.proyecto ? <div className="text-sg-caption text-sg-text-secondary">{t.proyecto}</div> : null}
            {t.detalle ? <div className="text-sg-caption text-sg-text-secondary">{t.detalle}</div> : null}
          </li>
        ))}
      </ul>
    </ResultadoDeLista>
  )
}
