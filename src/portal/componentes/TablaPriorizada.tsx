import { Table, Td, Th, cn } from '@wasichai/ui'
import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { ExplicacionDeColumna } from './Estados'

// la tabla ancha con prioridad de columnas (hallazgo U-06, DD-05): las esenciales siempre, las secundarias desde xl
// (1280 px) y las opcionales, mientras no llegue el selector «Columnas», desde 1536 px (el 2xl de SGSPE es 1440 px): a 1440 px la tabla cabe y
// ningún dato queda sin forma de verse. con ocultarUniformes, una
// columna no esencial que dice lo mismo en todas las filas sale de la tabla y su valor queda en una nota encima
export type PrioridadDeColumna = 'esencial' | 'secundaria' | 'opcional'

export interface ColumnaPriorizada {
  id: string
  encabezado: string
  prioridad: PrioridadDeColumna
  numerica?: boolean
  // el encabezado solo para lectores de pantalla (la columna de las casillas de selección)
  encabezadoOculto?: boolean
  // la explicación única de una columna con celdas restringidas o no disponibles (como ThConExplicacion): su id es el que
  // las celdas referencian con describedPor
  // con soloLectores, el motivo va solo para los lectores de pantalla, sin botón de ayuda (cuando no se sabe de antemano qué
  // celdas no se podrán leer)
  explicacion?: { id: string; tipo: 'restringido' | 'noDisponible'; soloLectores?: boolean }
  // clases propias de las celdas de la columna (un ancho mínimo, el tamaño del texto)
  claseDeCelda?: string
}

export interface PropsDeTablaPriorizada<T> {
  etiqueta: string
  columnas: ColumnaPriorizada[]
  filas: T[]
  clave: (fila: T) => string
  celda: (fila: T, columna: string) => ReactNode
  valorPlano?: (fila: T, columna: string) => string
  ocultarUniformes?: boolean
  alAbrir?: (fila: T) => void
}

const VISIBILIDAD: Record<PrioridadDeColumna, string | undefined> = {
  esencial: undefined,
  secundaria: 'hidden xl:table-cell',
  opcional: 'hidden min-[96rem]:table-cell'
}
const visibilidad = (prioridad: PrioridadDeColumna) => VISIBILIDAD[prioridad]

export function TablaPriorizada<T>({ etiqueta, columnas, filas, clave, celda, valorPlano, ocultarUniformes, alAbrir }: PropsDeTablaPriorizada<T>) {
  const { t } = useTranslation(NS)
  // una columna es uniforme si no es esencial y, con dos filas o más, su valor plano es el mismo en todas
  const esUniforme = (c: ColumnaPriorizada) =>
    Boolean(ocultarUniformes && valorPlano && c.prioridad !== 'esencial' && filas.length > 1) &&
    filas.every((f) => valorPlano!(f, c.id) === valorPlano!(filas[0], c.id))
  const uniformes = columnas.filter(esUniforme)
  const visibles = columnas.filter((c) => !uniformes.includes(c))
  const abrirConEnter = (fila: T) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    // solo la fila enfocada: Enter en un enlace o una casilla de la fila es de ese control
    if (e.key === 'Enter' && e.target === e.currentTarget) {
      e.preventDefault()
      alAbrir?.(fila)
    }
  }
  return (
    <div className="space-y-2">
      {uniformes.length > 0 ? (
        <ul aria-label={t('comun.tablaPriorizada.igualEnTodas')} className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-sg-text-secondary">
          {uniformes.map((c) => (
            <li key={c.id}>
              <Trans
                t={t}
                i18nKey="comun.tablaPriorizada.uniforme"
                values={{ encabezado: c.encabezado }}
                components={{ valor: <span className="font-medium text-sg-text">{celda(filas[0], c.id)}</span> }}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
        <Table aria-label={etiqueta}>
          <thead>
            <tr>
              {visibles.map((c) =>
                c.explicacion ? (
                  <ThExplicado key={c.id} columna={c} />
                ) : (
                  <Th key={c.id} scope="col" className={cn(visibilidad(c.prioridad), c.numerica && 'text-right')}>
                    {c.encabezadoOculto ? <span className="sr-only">{c.encabezado}</span> : c.encabezado}
                  </Th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={clave(f)}
                tabIndex={alAbrir ? 0 : undefined}
                onKeyDown={alAbrir ? abrirConEnter(f) : undefined}
                // group/fila: lo que la fila muestra al pasar o con el foco (la vista previa, hallazgo U-17)
                className={cn('group/fila', alAbrir && 'focus-visible:outline-2 focus-visible:outline-sg-focus')}
              >
                {visibles.map((c) => (
                  <Td key={c.id} className={cn(visibilidad(c.prioridad), c.numerica && 'text-right tabular-nums', c.claseDeCelda)}>
                    {celda(f, c.id)}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  )
}

// el encabezado con explicación única (ThConExplicacion de Estados.tsx con la clase de su prioridad): el nombre accesible es
// solo el de la columna
function ThExplicado({ columna }: { columna: ColumnaPriorizada }) {
  const nombre = useId()
  return (
    <Th scope="col" aria-labelledby={nombre} className={cn(visibilidad(columna.prioridad), columna.numerica && 'text-right')}>
      <span id={nombre}>{columna.encabezado}</span>
      <ExplicacionDeColumna id={columna.explicacion!.id} tipo={columna.explicacion!.tipo} soloLectores={columna.explicacion!.soloLectores} />
    </Th>
  )
}
