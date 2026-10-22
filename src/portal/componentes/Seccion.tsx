import { cn } from '@wasichai/ui'
import { createContext, useContext, useId, type ReactNode } from 'react'

// la superficie titulada de toda página (revisión de UX, U-34 y DD-08): reemplaza el «rounded-sg-lg border … p-4» escrito a
// mano en cada pantalla, para que el borde, el relleno y el peso del título sean los mismos en todas

// una sección dentro de otra no repite el borde (una caja dentro de otra se lee como ruido) y baja su encabezado un nivel
const DentroDeSeccion = createContext(false)

export interface PropsDeSeccion {
  titulo?: ReactNode
  descripcion?: ReactNode
  // a la derecha del título: «Agregar», «Ver todo»…
  acciones?: ReactNode
  // sin borde, relleno ni fondo; dentro de otra Seccion lo es sola
  anidada?: boolean
  // por defecto 2, y 3 dentro de otra Seccion
  nivel?: 2 | 3
  className?: string
  // el nombre de la región cuando no hay título visible
  etiqueta?: string
  children?: ReactNode
}

export function Seccion({ titulo, descripcion, acciones, anidada, nivel, className, etiqueta, children }: PropsDeSeccion) {
  const dentro = useContext(DentroDeSeccion)
  const idDelTitulo = useId()
  const sinCaja = anidada || dentro
  const Encabezado = `h${nivel ?? (sinCaja ? 3 : 2)}` as 'h2' | 'h3'
  const conTitulo = titulo !== undefined && titulo !== null
  return (
    <section
      aria-labelledby={conTitulo ? idDelTitulo : undefined}
      aria-label={conTitulo ? undefined : etiqueta}
      className={cn('space-y-2', !sinCaja && 'rounded-sg-lg border border-sg-border bg-sg-surface p-4', className)}
    >
      {(conTitulo || descripcion || acciones) && (
        // dentro de una sección el encabezado no es un landmark (HTML-AAM): role="none" lo dice también a las herramientas que,
        // como Testing Library, cuentan todo <header> como «banner» y lo confundirían con la barra superior
        <header role="none" className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {conTitulo && (
              <Encabezado id={idDelTitulo} className="text-sg-h3 font-semibold">
                {titulo}
              </Encabezado>
            )}
            {descripcion && <p className="text-sg-body-sm text-sg-text-secondary">{descripcion}</p>}
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </header>
      )}
      <DentroDeSeccion.Provider value={true}>{children}</DentroDeSeccion.Provider>
    </section>
  )
}
