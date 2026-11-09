import { Table, Td, Th, cn } from '@wasichai/ui'
import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { createContext, Fragment, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { ATRIBUTO_DE_FICHA, ResultadoDeLista } from '../contexto/Origen'
import { NS, numeroPe } from '../i18n'
import { ExplicacionDeColumna } from './Estados'
import { useCoincide } from './ListaEnTarjetas'
import { MasAcciones } from './Pagina'
import { claveDePrevia, DESDE_XL, PanelDeVistaPrevia, useAcopleDeVistaPrevia, usePeek, useRutaDeVistaPrevia } from './VistaPrevia'

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
  // el encabezado de una columna de cifras partido en dos líneas («Comp. / vencidos», S04): la columna queda angosta
  enDosLineas?: boolean
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
  // la columna del título (design-system.md §5.3): toma el ancho sobrante (mínimo 240 px) y es la única que se parte en líneas;
  // un EnlaceDeRegistro dentro se dibuja con el código en mono arriba y el título en 600, sin subrayado
  titulo?: boolean
}

// un grupo de filas de la tabla (Vencidos, Por vencer, Al día): una fila de grupo con su conteo que se pliega y despliega
export interface GrupoDeFilas<T> {
  clave: string
  titulo: string
  filas: T[]
  // cuántos tiene el grupo entero, si no son las filas que llegan (un conteo del servidor)
  conteo?: number
}

export interface OrdenDeTabla {
  columna: string
  dir: 'asc' | 'desc'
}

// la selección de filas (para actuar sobre varias: tomar las tareas elegidas): las claves elegidas las guarda quien llama
export interface SeleccionDeFilas<T> {
  elegidas: ReadonlySet<string>
  alCambiar: (elegidas: Set<string>) => void
  // la casilla de una fila, con el nombre de lo que elige («Elegir «Escalamiento C-002»»)
  etiquetaDeFila: (fila: T) => string
  etiquetaDeTodas: string
  // sin casilla (una tarea que ya no se puede tomar); por defecto, todas
  puedeElegir?: (fila: T) => boolean
}

export interface PropsDeTablaPriorizada<T> {
  etiqueta: string
  columnas: ColumnaPriorizada[]
  // con grupos, las filas son las de los grupos y esta lista no hace falta
  filas?: T[]
  grupos?: GrupoDeFilas<T>[]
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
  // cuántos registros tiene el resultado entero (no la página): la ficha abierta desde la tabla lo dice en «Volver a <lista> (N)»
  total?: number | null
  // el registro de cada fila para su vista previa (?peek=): Espacio la abre (sin alPrevisualizar), la fila en ?peek= se marca
  // como elegida y, desde xl, la vista previa se acopla a la derecha de la tabla (VistaPrevia.tsx)
  previaDe?: (fila: T) => { objeto: string; id: string }
  // la fila elegida, si no la dice ?peek=
  seleccionada?: (fila: T) => boolean
  // lo que la tabla necesita para leerse, bajo ella dentro de su caja: unidades, monedas, «— = sin monto» (DD-38)
  notaAlPie?: ReactNode
  // la fila abierta (S11: el ciclo de vida de la QCS, su siguiente acción y su primaria): una fila de detalle a todo el ancho bajo
  // la suya, con el id que el control que la abre referencia (aria-controls). null, la fila va cerrada. la fila abierta se marca
  // como elegida
  detalleDe?: (fila: T) => { id: string; contenido: ReactNode } | null
  // una primera columna de casillas y la de todas en su encabezado; la fila que se puede elegir lleva aria-selected y Espacio,
  // con ella enfocada, la elige o la deja (en lugar de la vista previa)
  seleccion?: SeleccionDeFilas<T>
}

// las celdas de la columna del título: EnlaceDeRegistro se dibuja ahí en su forma de tabla
const EnCeldaDeTitulo = createContext(false)
export const useEnCeldaDeTitulo = (): boolean => useContext(EnCeldaDeTitulo)

// las clases de las tablas de Civic Modern (design-system.md §5.3), compartidas con TablaDeRegistros. la capa de componentes
// (theme/componentes.css) ya fija el alto, el fondo, el texto y los bordes de Th y Td; aquí van el relleno, la caja, el
// encabezado fijo y la densidad compacta (data-density en <html>: 36 px, 3 × 10 y 14 px)
export const CAJA_DE_TABLA = 'overflow-hidden rounded-sg-md border border-sg-border bg-sg-surface text-sg-text'
export const ENCABEZADO = 'sticky top-0 z-[1] px-3 py-0 align-middle in-data-[density=compact]:px-2.5'
// los vínculos de una celda no van subrayados (U-05): solo al pasar o con el foco
export const CELDA =
  '[&_a]:no-underline [&_a:hover]:underline [&_a:focus-visible]:underline whitespace-nowrap px-3 py-1.5 align-middle text-sg-table in-data-[density=compact]:px-2.5 in-data-[density=compact]:py-0.75 in-data-[density=compact]:text-sg-table-dense'
export const CELDA_DE_TITULO = 'w-full min-w-60 whitespace-normal'
export const FILA = 'hover:bg-sg-surface-hover'
export const FILA_ELEGIDA = 'bg-sg-primary-soft hover:bg-sg-primary-soft [&>td:first-child]:shadow-[inset_4px_0_0_var(--sg-primary)]'
// la fila elegida para actuar sobre ella (selección), sin la barra de la fila abierta
export const FILA_MARCADA = 'bg-sg-primary-soft hover:bg-sg-primary-soft'
// la casilla de selección: 16 px con el color de la marca, y su objetivo de 24 px con el relleno de la celda
const CASILLA = 'size-4 cursor-pointer accent-sg-primary align-middle'
export const NOTA_AL_PIE = 'border-t border-sg-border px-3 py-2 text-sg-caption text-sg-text-secondary'

// un valor numérico vacío es «—» en text-muted (DD-38), con su nota al pie
const vacioNumerico = (valor: ReactNode) => valor === null || valor === undefined || valor === '' || valor === '—'

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

export function TablaPriorizada<T>({
  etiqueta,
  columnas,
  filas: lasFilas,
  grupos,
  clave,
  celda,
  valorPlano,
  ocultarUniformes,
  alAbrir,
  alPrevisualizar,
  idDeTabla,
  orden,
  alOrdenar,
  total,
  previaDe,
  seleccionada,
  notaAlPie,
  detalleDe,
  seleccion
}: PropsDeTablaPriorizada<T>) {
  const { t } = useTranslation(NS)
  const ancha = useCoincide(ANCHA)
  const desdeXl = useCoincide(DESDE_XL)
  const filas = grupos ? grupos.flatMap((g) => g.filas) : (lasFilas ?? [])
  const [plegados, setPlegados] = useState<ReadonlySet<string>>(new Set())
  const [busqueda] = useSearchParams()
  const navegar = useNavigate()
  const rutaDePrevia = useRutaDeVistaPrevia()
  const peek = usePeek()
  const cuerpo = useRef<HTMLDivElement>(null)
  const claveDeFila = (f: T) => (previaDe ? claveDePrevia(previaDe(f)) : undefined)
  useAcopleDeVistaPrevia(previaDe ? filas.map((f) => claveDePrevia(previaDe(f))) : null)
  // desde xl, la vista previa de una de sus filas va acoplada a su derecha
  const acoplada = Boolean(desdeXl && peek && previaDe && filas.some((f) => claveDeFila(f) === peek.clave))
  const elegida = (f: T) => (seleccionada ? seleccionada(f) : Boolean(previaDe) && claveDeFila(f) === busqueda.get('peek'))
  const previsualizar = alPrevisualizar ?? (previaDe ? (f: T) => navegar(rutaDePrevia(previaDe(f).objeto, previaDe(f).id)) : undefined)
  // cerrar el panel devuelve el foco a la fila que lo abrió
  const cerrarAcoplada = () => {
    if (!peek) return
    const fila = [...(cuerpo.current?.querySelectorAll<HTMLElement>('tr[data-previa]') ?? [])].find((tr) => tr.dataset.previa === peek.clave)
    peek.cerrar()
    fila?.focus()
  }
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
  // las filas que se pueden elegir, de las que llegan
  const elegibles = seleccion ? filas.filter((f) => seleccion.puedeElegir?.(f) ?? true) : []
  const esElegible = (f: T) => Boolean(seleccion) && (seleccion!.puedeElegir?.(f) ?? true)
  const elegidasAqui = elegibles.filter((f) => seleccion!.elegidas.has(clave(f)))
  const alternarFila = (f: T) => {
    const siguientes = new Set(seleccion!.elegidas)
    if (siguientes.has(clave(f))) siguientes.delete(clave(f))
    else siguientes.add(clave(f))
    seleccion!.alCambiar(siguientes)
  }
  const enfocable = Boolean(alAbrir || previsualizar || seleccion)
  const alTeclear = (fila: T) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    // solo la fila enfocada: Enter o Espacio en un enlace o una casilla de la fila es de ese control
    if (e.target !== e.currentTarget) return
    if (e.key === ' ' && esElegible(fila)) {
      e.preventDefault()
      alternarFila(fila)
    } else if (e.key === 'Enter' && alAbrir) {
      e.preventDefault()
      // la ficha de la fila se abre como con su enlace, con el origen de la lista (flujo F-C); sin enlace, como diga quien llama
      const enlace = e.currentTarget.querySelector<HTMLAnchorElement>(`a[${ATRIBUTO_DE_FICHA}]`)
      if (enlace) enlace.click()
      else alAbrir(fila)
    } else if (e.key === ' ' && previsualizar) {
      // sin desplazar la página
      e.preventDefault()
      previsualizar(fila)
    }
  }
  return (
    <ResultadoDeLista total={total}>
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
        <div
          ref={cuerpo}
          className={cn(acoplada && 'grid grid-cols-[minmax(0,1fr)_420px] items-start gap-4')}
          // Esc en una fila de la tabla también cierra el panel acoplado
          onKeyDown={
            acoplada
              ? (e) => {
                  if (e.key !== 'Escape' || e.defaultPrevented) return
                  e.preventDefault()
                  cerrarAcoplada()
                }
              : undefined
          }
        >
          <div className={CAJA_DE_TABLA}>
            {/* la tabla se desplaza en horizontal dentro de su caja (Table la envuelve en un overflow-x-auto) */}
            <Table aria-label={etiqueta}>
              <thead>
                <tr>
                  {seleccion ? (
                    <Th scope="col" className={cn(ENCABEZADO, 'w-10')}>
                      {elegibles.length > 0 ? (
                        <CasillaDeTodas
                          etiqueta={seleccion.etiquetaDeTodas}
                          todas={elegidasAqui.length === elegibles.length}
                          algunas={elegidasAqui.length > 0 && elegidasAqui.length < elegibles.length}
                          alCambiar={(si) => {
                            const siguientes = new Set(seleccion.elegidas)
                            for (const f of elegibles) {
                              if (si) siguientes.add(clave(f))
                              else siguientes.delete(clave(f))
                            }
                            seleccion.alCambiar(siguientes)
                          }}
                        />
                      ) : (
                        <span className="sr-only">{seleccion.etiquetaDeTodas}</span>
                      )}
                    </Th>
                  ) : null}
                  {visibles.map((c) => {
                    // la que ordena dice su sentido en el th; una ordenable que no ordena no lleva aria-sort
                    const sentido = alOrdenar && c.ordenable && orden?.columna === c.id ? orden.dir : undefined
                    const ordenar = alOrdenar && c.ordenable ? () => alOrdenar({ columna: c.id, dir: sentido === 'asc' ? 'desc' : 'asc' }) : undefined
                    const ariaSort = sentido === 'asc' ? 'ascending' : sentido === 'desc' ? 'descending' : undefined
                    return c.explicacion ? (
                      <ThExplicado key={c.id} columna={c} visibilidad={visibilidad(c)} ariaSort={ariaSort} sentido={sentido} alOrdenar={ordenar} />
                    ) : (
                      <Th
                        key={c.id}
                        scope="col"
                        aria-sort={ariaSort}
                        className={cn(ENCABEZADO, visibilidad(c), c.numerica && 'text-right', c.enDosLineas && 'w-20 py-1 leading-tight whitespace-normal')}
                      >
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
              {(grupos ?? [{ clave: '', titulo: '', filas }]).map((grupo) => {
                const plegado = plegados.has(grupo.clave)
                return (
                  <tbody key={grupo.clave}>
                    {grupos ? (
                      <FilaDeGrupo
                        titulo={t('comun.grupoDeTabla', { titulo: grupo.titulo, n: numeroPe(grupo.conteo ?? grupo.filas.length) })}
                        columnas={visibles.length + (seleccion ? 1 : 0)}
                        plegado={plegado}
                        alAlternar={() => {
                          const siguientes = new Set(plegados)
                          if (plegado) siguientes.delete(grupo.clave)
                          else siguientes.add(grupo.clave)
                          setPlegados(siguientes)
                        }}
                      />
                    ) : null}
                    {plegado
                      ? null
                      : grupo.filas.map((f) => {
                          const detalle = detalleDe?.(f) ?? null
                          const esLaElegida = elegida(f) || detalle !== null
                          const elegible = esElegible(f)
                          const marcada = elegible && seleccion!.elegidas.has(clave(f))
                          return (
                            <Fragment key={clave(f)}>
                              <tr
                                data-previa={claveDeFila(f)}
                                aria-current={esLaElegida ? 'true' : undefined}
                                aria-selected={elegible ? marcada : undefined}
                                tabIndex={enfocable ? 0 : undefined}
                                onKeyDown={enfocable ? alTeclear(f) : undefined}
                                // group/fila: lo que la fila muestra al pasar o con el foco (la vista previa, hallazgo U-17)
                                className={cn('group/fila', esLaElegida ? FILA_ELEGIDA : marcada ? FILA_MARCADA : FILA)}
                              >
                                {seleccion ? (
                                  <Td className={cn(CELDA, 'w-10')}>
                                    {elegible ? (
                                      <input
                                        type="checkbox"
                                        aria-label={seleccion.etiquetaDeFila(f)}
                                        checked={marcada}
                                        onChange={() => alternarFila(f)}
                                        className={CASILLA}
                                      />
                                    ) : null}
                                  </Td>
                                ) : null}
                                {visibles.map((c) => {
                                  const valor = celda(f, c.id)
                                  return (
                                    <Td
                                      key={c.id}
                                      className={cn(
                                        CELDA,
                                        visibilidad(c),
                                        c.titulo && CELDA_DE_TITULO,
                                        c.numerica && 'text-right tabular-nums',
                                        c.claseDeCelda
                                      )}
                                    >
                                      {c.numerica && vacioNumerico(valor) ? (
                                        <span className="text-sg-text-muted">—</span>
                                      ) : c.titulo ? (
                                        <EnCeldaDeTitulo.Provider value>{valor}</EnCeldaDeTitulo.Provider>
                                      ) : (
                                        valor
                                      )}
                                    </Td>
                                  )
                                })}
                              </tr>
                              {detalle ? (
                                <tr data-detalle className="bg-sg-primary-soft">
                                  <td
                                    id={detalle.id}
                                    colSpan={visibles.length + (seleccion ? 1 : 0)}
                                    className="border-b border-sg-border px-3 py-3 shadow-[inset_4px_0_0_var(--sg-primary)] in-data-[density=compact]:py-2"
                                  >
                                    {detalle.contenido}
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          )
                        })}
                  </tbody>
                )
              })}
            </Table>
            {notaAlPie ? <div className={NOTA_AL_PIE}>{notaAlPie}</div> : null}
          </div>
          {acoplada && peek ? <PanelDeVistaPrevia key={peek.clave} objeto={peek.objeto} id={peek.id} alCerrar={cerrarAcoplada} /> : null}
        </div>
      </div>
    </ResultadoDeLista>
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
    <Th scope="col" aria-labelledby={nombre} aria-sort={ariaSort} className={cn(ENCABEZADO, visibilidad, columna.numerica && 'text-right')}>
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
    <button type="button" onClick={alPulsar} className="inline-flex items-center gap-1 rounded-sg-sm hover:text-sg-text">
      {children}
      <Flecha aria-hidden className={cn('size-3.5 shrink-0', sentido ? 'text-sg-text' : 'text-sg-text-muted')} />
    </button>
  )
}

// la fila de un grupo (36 px en bg, 13,5 px 700 text-secondary): su nombre y su conteo en un botón que lo pliega y despliega
function FilaDeGrupo({ titulo, columnas, plegado, alAlternar }: { titulo: string; columnas: number; plegado: boolean; alAlternar: () => void }) {
  return (
    <tr className="h-9 bg-sg-bg">
      <th
        scope="rowgroup"
        colSpan={columnas}
        className="border-b border-sg-border px-3 text-left align-middle text-sg-body-sm font-bold text-sg-text-secondary"
      >
        <button
          type="button"
          aria-expanded={!plegado}
          onClick={alAlternar}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-sg-sm hover:text-sg-text"
        >
          <ChevronDown aria-hidden className={cn('size-4 shrink-0 transition-transform', plegado && '-rotate-90')} />
          {titulo}
        </button>
      </th>
    </tr>
  )
}

// la casilla de todas: marcada con todas, a medias (indeterminate, que el lector de pantalla dice «mixto») con algunas
function CasillaDeTodas({ etiqueta, todas, algunas, alCambiar }: { etiqueta: string; todas: boolean; algunas: boolean; alCambiar: (si: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = algunas
  }, [algunas])
  return <input ref={ref} type="checkbox" aria-label={etiqueta} checked={todas} onChange={() => alCambiar(!todas)} className={CASILLA} />
}
