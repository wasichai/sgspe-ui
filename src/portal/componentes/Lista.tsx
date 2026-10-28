import { ListaEnTarjetas, useEsTelefono } from './ListaEnTarjetas'
import { Pagination, Table, Td, Th, cn } from '@wasichai/ui'
import { X } from 'lucide-react'
import { Fragment, useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useSearchParams } from 'react-router'
import { texto, type Pagina, type Registro } from '../datos/registros'
import { ResultadoDeLista } from '../contexto/Origen'
import { NS } from '../i18n'
import { Cargando, ErrorDeCarga, Vacio } from './Estados'
import type { UseQueryResult } from '@tanstack/react-query'

// el patrón de lista de design-system.md §6.4: vistas guardadas en pestañas, filtros como chips en la URL, tabla real con
// encabezados, selección para acciones masivas y paginación. las vistas personales (ASM-079) se guardan en el navegador

export interface Columna {
  id: string
  encabezado: string
  celda: (registro: Registro) => ReactNode
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
  alAbrir
}: {
  consulta: UseQueryResult<Pagina>
  columnas: Columna[]
  etiqueta: string
  vacio: ReactNode
  alPagina: (pagina: number) => void
  seleccion?: ReadonlySet<string>
  alSeleccionar?: (id: string, marcado: boolean) => void
  alAbrir?: (registro: Registro) => void
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
          <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
            <Table aria-label={etiqueta}>
              <thead>
                <tr>
                  {alSeleccionar ? (
                    <Th className="w-8">
                      <span className="sr-only">{t('comun.seleccionar')}</span>
                    </Th>
                  ) : null}
                  {columnas.map((c) => (
                    <Th key={c.id} scope="col">
                      {c.encabezado}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagina.content.map((registro) => (
                  <tr
                    key={registro.id}
                    className={alAbrir ? 'cursor-pointer hover:bg-sg-surface-hover' : undefined}
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
                      <Td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={t('comun.seleccionarA', { nombre: nombreDeFila(registro) || t('comun.esteRegistro') })}
                          checked={seleccion?.has(registro.id) ?? false}
                          onChange={(e) => alSeleccionar(registro.id, e.target.checked)}
                        />
                      </Td>
                    ) : null}
                    {columnas.map((c) => (
                      <Td key={c.id} className="text-sm">
                        {c.celda(registro)}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        {pagina.totalPages && pagina.totalPages > 1 ? (
          <Pagination page={pagina.page} totalPages={pagina.totalPages} totalElements={pagina.totalElements ?? 0} onPage={alPagina} />
        ) : null}
      </div>
    </ResultadoDeLista>
  )
}

// la paginación de una lista que pagina el servidor (D10 de la revisión de UX): el total y las páginas son los de su conteo
export function PaginacionDelServidor({
  datos,
  alPagina
}: {
  datos: Pick<Pagina<unknown>, 'page' | 'totalPages' | 'totalElements'> | undefined
  alPagina: (pagina: number) => void
}) {
  if (!datos?.totalPages || datos.totalPages <= 1) return null
  return <Pagination page={datos.page} totalPages={datos.totalPages} totalElements={datos.totalElements ?? 0} onPage={alPagina} />
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
