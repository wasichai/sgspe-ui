import { ListaEnTarjetas, useEsTelefono } from './ListaEnTarjetas'
import { Table, Td, Th, cn } from '@wasichai/ui'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Fragment, useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useSearchParams } from 'react-router'
import { texto, type Pagina, type Registro } from '../datos/registros'
import { ResultadoDeLista } from '../contexto/Origen'
import { NS, numeroPe } from '../i18n'
import { Cargando, ErrorDeCarga, Vacio } from './Estados'
import type { UseQueryResult } from '@tanstack/react-query'
import { CAJA_DE_TABLA, CELDA, CELDA_DE_TITULO, ENCABEZADO, FILA, NOTA_AL_PIE, type OrdenDeTabla } from './TablaPriorizada'

// el patrón de lista de design-system.md §6.4: vistas guardadas en pestañas, filtros como chips en la URL, tabla real con
// encabezados, selección para acciones masivas y paginación. las vistas personales (ASM-079) se guardan en el navegador

export interface Columna {
  id: string
  encabezado: string
  celda: (registro: Registro) => ReactNode
  // la del título toma el ancho sobrante y es la única que se parte en líneas; una numérica va a la derecha con cifras tabulares
  titulo?: boolean
  numerica?: boolean
}

export interface Vista {
  id: string
  etiqueta: string
  // cuántos registros tiene la vista con el alcance y los filtros (revisión de UX, etapa 3); sin él, no se dice
  conteo?: number | null
}

// los filtros y la vista viven en la URL (ASM-075): volver atrás nunca los pierde
export function useParametrosDeLista(porDefecto: string) {
  const [busqueda, fijar] = useSearchParams()
  const { state } = useLocation()
  const vista = busqueda.get('view') ?? porDefecto
  const pagina = Number(busqueda.get('page') ?? '0') || 0
  const filtro = (clave: string) => busqueda.get(clave) ?? ''
  const cambiar = (cambios: Record<string, string | null>) => {
    const siguiente = new URLSearchParams(busqueda)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === '') siguiente.delete(clave)
      else siguiente.set(clave, valor)
    }
    if (!('page' in cambios)) siguiente.delete('page')
    // el estado del historial (el rastro y, en una ficha, su origen) sigue con los filtros
    fijar(siguiente, { replace: true, state })
  }
  return { vista, pagina, filtro, cambiar, busqueda }
}
export type ParametrosDeLista = ReturnType<typeof useParametrosDeLista>

// el orden de una tabla también vive en la URL (?sort=&dir=; tercera pasada de UX, 3.6 y DD-37): volver de una ficha monta la
// lista con el mismo orden, y el enlace lo comparte. una columna que la pantalla no ordena (un ?sort= de otra vista o escrito a
// mano) vuelve al orden inicial; ordenar vuelve a la primera página
type ConOrden = Pick<ParametrosDeLista, 'filtro' | 'cambiar'>
export function ordenEnUrl(
  lista: ConOrden,
  inicial: OrdenDeTabla,
  ordenables: readonly string[],
  pagina?: string
): [OrdenDeTabla, (orden: OrdenDeTabla) => void]
export function ordenEnUrl(
  lista: ConOrden,
  inicial: OrdenDeTabla | undefined,
  ordenables: readonly string[],
  pagina?: string
): [OrdenDeTabla | undefined, (orden: OrdenDeTabla) => void]
// pagina: el parámetro de la página que el orden reinicia (los programas paginan con ?pp=)
export function ordenEnUrl(
  lista: ConOrden,
  inicial: OrdenDeTabla | undefined,
  ordenables: readonly string[],
  pagina = 'page'
): [OrdenDeTabla | undefined, (orden: OrdenDeTabla) => void] {
  const columna = lista.filtro('sort')
  const dir = lista.filtro('dir')
  const orden: OrdenDeTabla | undefined = ordenables.includes(columna) && (dir === 'asc' || dir === 'desc') ? { columna, dir } : inicial
  return [orden, (siguiente) => lista.cambiar({ sort: siguiente.columna, dir: siguiente.dir, [pagina]: null })]
}

export function VistasGuardadas({ vistas, actual, alCambiar }: { vistas: Vista[]; actual: string; alCambiar: (id: string) => void }) {
  const { t } = useTranslation(NS)
  const id = useId()
  return (
    <div role="tablist" aria-label={t('comun.vistas')} className="flex gap-1 overflow-x-auto border-b border-sg-border">
      {vistas.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={v.id === actual}
          aria-describedby={v.conteo != null ? `${id}-${v.id}` : undefined}
          onClick={() => alCambiar(v.id)}
          className={cn(
            'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm',
            v.id === actual ? 'border-sg-primary font-medium text-sg-primary-text' : 'border-transparent text-sg-text-secondary'
          )}
        >
          {v.etiqueta}
          {v.conteo != null ? (
            <>
              <span aria-hidden className="rounded-full bg-sg-surface-sunken px-1.5 text-sg-caption tabular-nums text-sg-text-muted">
                {v.conteo}
              </span>
              <span id={`${id}-${v.id}`} hidden>
                {t('comun.registros', { count: v.conteo })}
              </span>
            </>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export interface Chip {
  clave: string
  etiqueta: string
}

export function ChipsDeFiltro({ chips, alQuitar, alLimpiar }: { chips: Chip[]; alQuitar: (clave: string) => void; alLimpiar: () => void }) {
  const { t } = useTranslation(NS)
  if (chips.length === 0) return null
  return (
    <div aria-label={t('comun.filtros')} className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span key={chip.clave} className="inline-flex items-center gap-1 rounded-sg-sm bg-sg-surface-sunken px-2 py-0.5 text-sg-caption">
          {chip.etiqueta}
          <button type="button" aria-label={`${t('comun.quitar')} ${chip.etiqueta}`} onClick={() => alQuitar(chip.clave)}>
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={alLimpiar} className="text-sg-caption text-sg-primary-text underline">
        {t('comun.limpiarFiltros')}
      </button>
    </div>
  )
}

// cómo se anuncia una fila al seleccionarla: su código y su título o nombre, nunca su id (tercera pasada de UX)
const nombreDeFila = (registro: Registro): string => [texto(registro, 'code'), texto(registro, 'title') || texto(registro, 'name')].filter(Boolean).join(' · ')

export function TablaDeRegistros({
  consulta,
  columnas,
  etiqueta,
  vacio,
  alPagina,
  seleccion,
  alSeleccionar,
  alAbrir,
  notaAlPie
}: {
  consulta: UseQueryResult<Pagina>
  columnas: Columna[]
  etiqueta: string
  vacio: ReactNode
  alPagina: (pagina: number) => void
  seleccion?: ReadonlySet<string>
  alSeleccionar?: (id: string, marcado: boolean) => void
  alAbrir?: (registro: Registro) => void
  notaAlPie?: ReactNode
}) {
  const { t } = useTranslation(NS)
  const telefono = useEsTelefono()
  if (consulta.isPending) return <Cargando />
  if (consulta.isError) return <ErrorDeCarga error={consulta.error} alReintentar={() => void consulta.refetch()} />
  const pagina = consulta.data
  if (pagina.content.length === 0) return <>{vacio}</>
  const [primera, ...resto] = columnas
  return (
    <ResultadoDeLista total={pagina.totalElements ?? null}>
      <div className="space-y-3">
        {telefono ? (
          // en el teléfono, cada fila es una tarjeta: la primera columna como título y las demás como datos (revisión de UX, etapa 8)
          <ListaEnTarjetas
            etiqueta={etiqueta}
            tarjetas={pagina.content.map((registro) => ({
              id: registro.id,
              titulo: (
                <span className="flex items-start gap-2">
                  {alSeleccionar ? (
                    <input
                      type="checkbox"
                      aria-label={t('comun.seleccionarA', { nombre: nombreDeFila(registro) || t('comun.esteRegistro') })}
                      checked={seleccion?.has(registro.id) ?? false}
                      onChange={(e) => alSeleccionar(registro.id, e.target.checked)}
                    />
                  ) : null}
                  <span className="min-w-0">{primera?.celda(registro)}</span>
                </span>
              ),
              detalle: (
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2">
                  {resto.map((c) => (
                    <Fragment key={c.id}>
                      <dt>{c.encabezado}</dt>
                      <dd className="text-sg-text">{c.celda(registro)}</dd>
                    </Fragment>
                  ))}
                </dl>
              )
            }))}
          />
        ) : (
          <div className={CAJA_DE_TABLA}>
            <Table aria-label={etiqueta}>
              <thead>
                <tr>
                  {alSeleccionar ? (
                    <Th className={cn(ENCABEZADO, 'w-8')}>
                      <span className="sr-only">{t('comun.seleccionar')}</span>
                    </Th>
                  ) : null}
                  {columnas.map((c) => (
                    <Th key={c.id} scope="col" className={cn(ENCABEZADO, c.numerica && 'text-right')}>
                      {c.encabezado}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagina.content.map((registro) => (
                  <tr
                    key={registro.id}
                    className={alAbrir ? cn(FILA, 'cursor-pointer') : FILA}
                    onClick={alAbrir ? () => alAbrir(registro) : undefined}
                    // la fila se abre también con el teclado (Enter o Espacio); una tecla pulsada dentro de un control de la
                    // fila (la casilla, un enlace) es de ese control. la fila conserva su rol de fila de la tabla
                    tabIndex={alAbrir ? 0 : undefined}
                    onKeyDown={
                      alAbrir
                        ? (e) => {
                            if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
                            e.preventDefault()
                            alAbrir(registro)
                          }
                        : undefined
                    }
                  >
                    {alSeleccionar ? (
                      <Td className={CELDA} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={t('comun.seleccionarA', { nombre: nombreDeFila(registro) || t('comun.esteRegistro') })}
                          checked={seleccion?.has(registro.id) ?? false}
                          onChange={(e) => alSeleccionar(registro.id, e.target.checked)}
                        />
                      </Td>
                    ) : null}
                    {columnas.map((c) => (
                      <Td key={c.id} className={cn(CELDA, c.titulo && CELDA_DE_TITULO, c.numerica && 'text-right tabular-nums')}>
                        {c.celda(registro)}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
            {notaAlPie ? <div className={NOTA_AL_PIE}>{notaAlPie}</div> : null}
            <Paginador pagina={pagina} alPagina={alPagina} />
          </div>
        )}
        {telefono ? <Paginador pagina={pagina} alPagina={alPagina} suelto /> : null}
      </div>
    </ResultadoDeLista>
  )
}
// la paginación de una lista que pagina el servidor (D10 de la revisión de UX): el total y las páginas son los de su conteo
export function PaginacionDelServidor({
  datos,
  alPagina
}: {
  datos: (Pick<Pagina<unknown>, 'page' | 'totalPages' | 'totalElements'> & { size?: number }) | undefined
  alPagina: (pagina: number) => void
}) {
  if (!datos) return null
  return <Paginador pagina={datos} alPagina={alPagina} suelto />
}

// el paginador de Civic Modern (design-system.md §5.3): «Mostrando 1–8 de 23» y botones de 32 px con borde, el actual en primary.
// dentro de la caja de una tabla va en su barra al pie; suelto (bajo una tabla de otro componente), en su propia caja. con una sola
// página no se dibuja. size: cuántas filas trae cada página (sin él no se dice el rango)
export function Paginador({
  pagina: { page, totalPages, totalElements, size },
  alPagina,
  suelto = false
}: {
  pagina: Pick<Pagina<unknown>, 'page' | 'totalPages' | 'totalElements'> & { size?: number }
  alPagina: (pagina: number) => void
  suelto?: boolean
}) {
  const { t } = useTranslation(NS)
  if (!totalPages || totalPages <= 1) return null
  const desde = size ? page * size + 1 : null
  const hasta = size && totalElements != null ? Math.min(totalElements, (page + 1) * size) : null
  const boton = 'inline-flex h-8 min-w-8 items-center justify-center rounded-sg-md border border-sg-border-strong font-semibold tabular-nums'
  return (
    <nav
      aria-label={t('comun.paginador.etiqueta')}
      className={cn(
        'flex flex-wrap items-center gap-2 border-t border-sg-border px-3 py-2.5 text-sm text-sg-text-secondary',
        suelto && 'rounded-sg-md border bg-sg-surface'
      )}
    >
      {desde !== null && hasta !== null && totalElements != null ? (
        <span className="mr-auto">{t('comun.paginador.mostrando', { desde: numeroPe(desde), hasta: numeroPe(hasta), total: numeroPe(totalElements) })}</span>
      ) : (
        <span className="mr-auto" />
      )}
      <button
        type="button"
        aria-label={t('comun.paginador.anterior')}
        disabled={page === 0}
        onClick={() => alPagina(page - 1)}
        className={cn(boton, 'text-sg-text disabled:text-sg-text-muted disabled:opacity-60')}
      >
        <ChevronLeft aria-hidden className="size-4" />
      </button>
      {paginasVisibles(page, totalPages).map((n, i) =>
        n === null ? (
          <span key={`salto-${i}`} aria-hidden className="px-1">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-label={t('comun.paginador.pagina', { n: numeroPe(n + 1) })}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => alPagina(n)}
            className={cn(boton, 'px-1.5', n === page ? 'border-sg-primary bg-sg-primary text-sg-on-primary' : 'text-sg-text hover:bg-sg-surface-hover')}
          >
            {numeroPe(n + 1)}
          </button>
        )
      )}
      <button
        type="button"
        aria-label={t('comun.paginador.siguiente')}
        disabled={page + 1 >= totalPages}
        onClick={() => alPagina(page + 1)}
        className={cn(boton, 'text-sg-text disabled:text-sg-text-muted disabled:opacity-60')}
      >
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </nav>
  )
}

// las páginas que se ofrecen: la primera, la última y las vecinas de la actual; null es un salto («…»)
export function paginasVisibles(actual: number, total: number): (number | null)[] {
  const elegidas = [...new Set([0, actual - 1, actual, actual + 1, total - 1])].filter((n) => n >= 0 && n < total).sort((a, b) => a - b)
  return elegidas.flatMap((n, i) => (i > 0 && n - elegidas[i - 1] > 1 ? [null, n] : [n]))
}

// sinFiltros: cuántos habría sin los filtros (revisión de UX, etapa 3: «Sin los filtros hay 3»); así se sabe que no es la lista
// la que está vacía
export function VacioDeLista({
  conFiltros,
  alLimpiar,
  sinFiltros,
  children
}: {
  conFiltros: boolean
  alLimpiar: () => void
  sinFiltros?: number
  children?: ReactNode
}) {
  const { t } = useTranslation(NS)
  if (!conFiltros) return <Vacio titulo={t('comun.vacio')}>{children}</Vacio>
  return (
    <Vacio titulo={t('comun.sinResultados')}>
      {sinFiltros ? <p>{t('comun.sinFiltrosHay', { count: sinFiltros })}</p> : null}
      <button type="button" className="text-sg-primary-text underline" onClick={alLimpiar}>
        {t('comun.limpiarFiltros')}
      </button>
    </Vacio>
  )
}
