import { useSyncExternalStore, type ReactNode } from 'react'

// las listas en el teléfono (revisión de UX, etapa 8): por debajo de sm, una tabla de trabajo se desplazaba en horizontal y su
// estado quedaba fuera de la pantalla. ahí la lista es de tarjetas con el título, el estado, el plazo y el proyecto; desde sm,
// la tabla de siempre. sin matchMedia (las pruebas), la tabla
const CONSULTA = '(max-width: 639.98px)'

export function useEsTelefono(): boolean {
  return useSyncExternalStore(
    (oyente) => {
      if (typeof window.matchMedia !== 'function') return () => undefined
      const consulta = window.matchMedia(CONSULTA)
      consulta.addEventListener('change', oyente)
      return () => consulta.removeEventListener('change', oyente)
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA).matches
  )
}

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

export function ListaEnTarjetas({ etiqueta, tarjetas }: { etiqueta: string; tarjetas: TarjetaDeLista[] }) {
  return (
    <ul aria-label={etiqueta} className="space-y-2">
      {tarjetas.map((t) => (
        <li key={t.id} className="space-y-1.5 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
          <div className="min-w-0">{t.titulo}</div>
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
  )
}
