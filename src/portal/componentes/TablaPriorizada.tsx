import { Table, Td, Th, cn } from '@wasichai/ui'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useId, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { ExplicacionDeColumna } from './Estados'
import { MasAcciones } from './Pagina'

// la tabla ancha con prioridad de columnas (hallazgo U-06, DD-05): las esenciales siempre, las secundarias desde xl
// (1280 px) y las opcionales desde 1536 px (el 2xl de SGSPE es 1440 px), salvo que quien mira elija en «Columnas» verlas u
// ocultarlas en todos los anchos (05-especificacion §1.6). la elección se recuerda por tabla (idDeTabla) en este navegador.
// con ocultarUniformes, una columna no esencial que dice lo mismo en todas las filas sale de la tabla y su valor queda en una
// nota encima
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
  // con alOrdenar en la tabla, su encabezado es un botón que ordena por ella
  ordenable?: boolean
}

export interface OrdenDeTabla {
  columna: string
  dir: 'asc' | 'desc'
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
  // Espacio en la fila enfocada: su vista previa (?peek=), sin dejar la lista
  alPrevisualizar?: (fila: T) => void
  // el nombre con que se recuerda la elección de «Columnas» (sgspe.columnas.<idDeTabla>); sin él, la elección dura la visita
  idDeTabla?: string
  // el orden en que llegan las filas (quien llama ordena: la consulta del servidor) y qué hacer al pedir otro
  orden?: OrdenDeTabla
  alOrdenar?: (orden: OrdenDeTabla) => void
}

const VISIBILIDAD: Record<PrioridadDeColumna, string | undefined> = {
  esencial: undefined,
  secundaria: 'hidden xl:table-cell',
  opcional: 'hidden min-[96rem]:table-cell'
}
// una opcional elegida en «Columnas» se ve (o no) en todos los anchos
type Eleccion = Record<string, boolean>
const visibilidadDe = (eleccion: Eleccion) => (c: ColumnaPriorizada) =>
  c.prioridad === 'opcional' && c.id in eleccion ? (eleccion[c.id] ? undefined : 'hidden') : VISIBILIDAD[c.prioridad]

// la elección vive en el navegador de quien mira; sin almacenamiento (ventana privada, datos bloqueados) o con un valor que no
// se entiende, vale la de siempre, y lo que se elija dura lo que dure la página. las tablas con el mismo idDeTabla (los grupos
// de una lista) se enteran juntas de cada cambio
const SIN_ELECCION: Eleccion = {}
const claveDe = (idDeTabla: string) => `sgspe.columnas.${idDeTabla}`
const enMemoria = new Map<string, Eleccion>()
const leidas = new Map<string, { crudo: string | null; eleccion: Eleccion }>()
const oyentes = new Set<() => void>()
function interpretar(crudo: string | null): Eleccion {
  try {
    const leida: unknown = JSON.parse(crudo ?? '{}')
    if (!leida || typeof leida !== 'object' || Array.isArray(leida)) return SIN_ELECCION
    return Object.fromEntries(Object.entries(leida).filter(([, v]) => typeof v === 'boolean'))
  } catch {
    return SIN_ELECCION
  }
}
function leerEleccion(idDeTabla: string): Eleccion {
  let crudo: string | null
  try {
    crudo = localStorage.getItem(claveDe(idDeTabla))
  } catch {
    return enMemoria.get(idDeTabla) ?? SIN_ELECCION
  }
  // la misma lectura da el mismo objeto: useSyncExternalStore no vuelve a dibujar por nada
  const previa = leidas.get(idDeTabla)
  if (previa && previa.crudo === crudo) return previa.eleccion
  const eleccion = interpretar(crudo)
  leidas.set(idDeTabla, { crudo, eleccion })
  return eleccion
}
function guardarEleccion(idDeTabla: string, eleccion: Eleccion) {
  try {
    localStorage.setItem(claveDe(idDeTabla), JSON.stringify(eleccion))
  } catch {
    enMemoria.set(idDeTabla, eleccion)
  }
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
// sin idDeTabla, la elección es de esta tabla y dura la visita
function useEleccion(idDeTabla: string | undefined): [Eleccion, (eleccion: Eleccion) => void] {
  const [propia, setPropia] = useState(SIN_ELECCION)
  const guardada = useSyncExternalStore(suscribir, () => (idDeTabla ? leerEleccion(idDeTabla) : SIN_ELECCION))
  return idDeTabla ? [guardada, (eleccion) => guardarEleccion(idDeTabla, eleccion)] : [propia, setPropia]
}

// desde 1536 px, la opcional sin elección se ve: su casilla lo dice
const ANCHA = '(min-width: 96rem)'
function useEsAncha(): boolean {
  return useSyncExternalStore(
    (oyente) => {
      if (typeof window.matchMedia !== 'function') return () => undefined
      const consulta = window.matchMedia(ANCHA)
      consulta.addEventListener('change', oyente)
      return () => consulta.removeEventListener('change', oyente)
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(ANCHA).matches
  )
}

export function TablaPriorizada<T>({
  etiqueta,
  columnas,
  filas,
  clave,
  celda,
  valorPlano,
  ocultarUniformes,
  alAbrir,
  alPrevisualizar,
  idDeTabla,
  orden,
  alOrdenar
}: PropsDeTablaPriorizada<T>) {
  const { t } = useTranslation(NS)
  const ancha = useEsAncha()
  const [eleccion, fijarEleccion] = useEleccion(idDeTabla)
  const visibilidad = visibilidadDe(eleccion)
  const seVe = (c: ColumnaPriorizada) => (c.id in eleccion ? eleccion[c.id] : ancha)
  const alternar = (c: ColumnaPriorizada) => {
    fijarEleccion({ ...eleccion, [c.id]: !seVe(c) })
  }
  // una columna es uniforme si no es esencial y, con dos filas o más, su valor plano es el mismo en todas
  const esUniforme = (c: ColumnaPriorizada) =>
    Boolean(ocultarUniformes && valorPlano && c.prioridad !== 'esencial' && filas.length > 1) &&
    filas.every((f) => valorPlano!(f, c.id) === valorPlano!(filas[0], c.id))
  const uniformes = columnas.filter(esUniforme)
  const visibles = columnas.filter((c) => !uniformes.includes(c))
  // «Columnas» ofrece las opcionales que están en la tabla: las esenciales siempre se ven y las secundarias, desde xl
  const opcionales = visibles.filter((c) => c.prioridad === 'opcional')
  const enfocable = Boolean(alAbrir || alPrevisualizar)
  const alTeclear = (fila: T) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    // solo la fila enfocada: Enter o Espacio en un enlace o una casilla de la fila es de ese control
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' && alAbrir) {
      e.preventDefault()
      alAbrir(fila)
    } else if (e.key === ' ' && alPrevisualizar) {
      // sin desplazar la página
      e.preventDefault()
      alPrevisualizar(fila)
    }
  }
  return (
    <div className="space-y-2">
      {opcionales.length > 0 ? (
        <div className="flex justify-end">
          <MasAcciones etiqueta={t('comun.tablaPriorizada.columnas')}>
            {opcionales.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-sg-sm px-2 py-1 text-sm text-sg-text hover:bg-sg-surface-hover">
                <input type="checkbox" checked={seVe(c)} onChange={() => alternar(c)} className="size-4" />
                {c.encabezado}
              </label>
            ))}
          </MasAcciones>
        </div>
      ) : null}
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
              {visibles.map((c) => {
                // la que ordena dice su sentido en el th; una ordenable que no ordena no lleva aria-sort
                const sentido = alOrdenar && c.ordenable && orden?.columna === c.id ? orden.dir : undefined
                const ordenar = alOrdenar && c.ordenable ? () => alOrdenar({ columna: c.id, dir: sentido === 'asc' ? 'desc' : 'asc' }) : undefined
                const ariaSort = sentido === 'asc' ? 'ascending' : sentido === 'desc' ? 'descending' : undefined
                return c.explicacion ? (
                  <ThExplicado key={c.id} columna={c} visibilidad={visibilidad(c)} ariaSort={ariaSort} sentido={sentido} alOrdenar={ordenar} />
                ) : (
                  <Th key={c.id} scope="col" aria-sort={ariaSort} className={cn(visibilidad(c), c.numerica && 'text-right')}>
                    {ordenar ? (
                      <BotonDeOrden sentido={sentido} alPulsar={ordenar}>
                        {c.encabezado}
                      </BotonDeOrden>
                    ) : c.encabezadoOculto ? (
                      <span className="sr-only">{c.encabezado}</span>
                    ) : (
                      c.encabezado
                    )}
                  </Th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={clave(f)}
                tabIndex={enfocable ? 0 : undefined}
                onKeyDown={enfocable ? alTeclear(f) : undefined}
                // group/fila: lo que la fila muestra al pasar o con el foco (la vista previa, hallazgo U-17)
                className={cn('group/fila', enfocable && 'focus-visible:outline-2 focus-visible:outline-sg-focus')}
              >
                {visibles.map((c) => (
                  <Td key={c.id} className={cn(visibilidad(c), c.numerica && 'text-right tabular-nums', c.claseDeCelda)}>
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
function ThExplicado({
  columna,
  visibilidad,
  ariaSort,
  sentido,
  alOrdenar
}: {
  columna: ColumnaPriorizada
  visibilidad: string | undefined
  ariaSort?: 'ascending' | 'descending'
  sentido?: OrdenDeTabla['dir']
  alOrdenar?: () => void
}) {
  const nombre = useId()
  return (
    <Th scope="col" aria-labelledby={nombre} aria-sort={ariaSort} className={cn(visibilidad, columna.numerica && 'text-right')}>
      {alOrdenar ? (
        <BotonDeOrden sentido={sentido} alPulsar={alOrdenar}>
          <span id={nombre}>{columna.encabezado}</span>
        </BotonDeOrden>
      ) : (
        <span id={nombre}>{columna.encabezado}</span>
      )}
      <ExplicacionDeColumna id={columna.explicacion!.id} tipo={columna.explicacion!.tipo} soloLectores={columna.explicacion!.soloLectores} />
    </Th>
  )
}

// el encabezado que ordena: su nombre es el de la columna (aria-sort, en el th, dice el sentido) y la flecha lo dibuja
function BotonDeOrden({ sentido, alPulsar, children }: { sentido?: OrdenDeTabla['dir']; alPulsar: () => void; children: ReactNode }) {
  const Flecha = sentido === 'asc' ? ArrowUp : sentido === 'desc' ? ArrowDown : ChevronsUpDown
  return (
    <button
      type="button"
      onClick={alPulsar}
      className="inline-flex items-center gap-1 rounded-sg-sm hover:text-sg-text focus-visible:outline-2 focus-visible:outline-sg-focus"
    >
      {children}
      <Flecha aria-hidden className={cn('size-3.5 shrink-0', sentido ? 'text-sg-text' : 'text-sg-text-muted')} />
    </button>
  )
}
