import { Button } from '@wasichai/ui'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { CONTROL } from './Campo'
import { Drawer } from './Drawer'
import { FormaDelFiltro } from './FiltroDeLista'

// la barra de filtros común de una lista (hallazgo U-22, DD-04): la búsqueda, la vista (SelectorDeVista), hasta tres filtros
// frecuentes a la vista como chips (FiltroDeLista), «Más filtros» en un drawer, un chip por filtro aplicado y «Limpiar filtros». los filtros viven en
// la URL: quien la usa lee y escribe sus parámetros. por debajo de md, los frecuentes pasan al drawer y el botón dice
// «Filtros (N)», con N los chips. lo escrito en la búsqueda se ve al instante, pero llega a quien la usa (y a la URL) 300 ms
// después de la última tecla, o en el acto con Enter (05-especificacion §1.4)

const ESPERA_DE_BUSQUEDA = 300

// la búsqueda de la barra: un campo de 36 px con la lupa (design-system.md §5.3)
const BUSQUEDA_EN_BARRA = 'h-9 w-full rounded-sg-md border-2 border-sg-border-control bg-sg-surface pr-3 pl-8.5 text-sm placeholder:text-sg-text-muted'

export interface FiltroAplicado {
  clave: string
  etiqueta: string
  alQuitar: () => void
}

export function BarraDeFiltros({
  vista,
  busqueda,
  frecuentes,
  todos,
  aplicados,
  alLimpiar
}: {
  vista?: ReactNode
  busqueda?: { etiqueta: string; valor: string; alCambiar: (valor: string) => void }
  frecuentes?: ReactNode
  todos?: ReactNode
  aplicados: FiltroAplicado[]
  alLimpiar?: () => void
}) {
  const { t } = useTranslation(NS)
  // desde dónde se abrió el drawer: en el teléfono lleva también los frecuentes, que no caben en la barra
  const [abierto, setAbierto] = useState<'telefono' | 'mas' | null>(null)
  const cerrar = () => setAbierto(null)
  const n = aplicados.length
  const enTelefono = abierto === 'telefono'
  // design-system.md §5.3, «Barra de filtros y chips»: una sola fila (que envuelve si no cabe) en un panel surface con borde de
  // 1 px y relleno de 10 × 12 px, separación de 8 px: la búsqueda de 36 px, la vista, los frecuentes como chips, los aplicados
  // con su «×», «Más filtros» y «Limpiar filtros» (sutil)
  return (
    <div
      role="group"
      aria-label={t('comun.filtros')}
      className="flex flex-wrap items-center gap-2 rounded-sg-md border border-sg-border bg-sg-surface px-3 py-2.5 text-sg-body-sm"
    >
      {busqueda ? <CajaDeBusqueda {...busqueda} enBarra /> : null}
      {vista ? <div className="max-w-full min-w-0">{vista}</div> : null}
      {frecuentes ? (
        <FormaDelFiltro.Provider value="chip">
          <div className="hidden flex-wrap items-center gap-2 md:flex">{frecuentes}</div>
        </FormaDelFiltro.Provider>
      ) : null}
      {n > 0 ? (
        <ul aria-label={t('comun.barraDeFiltros.aplicados')} className="flex flex-wrap items-center gap-2">
          {aplicados.map((filtro) => (
            <li
              key={filtro.clave}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-sg-md border-2 border-sg-primary bg-sg-primary-soft pr-1 pl-2.5 text-sm text-sg-text"
            >
              {/* un solo texto, que las pantallas arman («Estado: Bloqueado»): va entero en 700 */}
              <span className="font-bold">{filtro.etiqueta}</span>
              <button
                type="button"
                aria-label={t('comun.barraDeFiltros.quitar', { etiqueta: filtro.etiqueta })}
                title={t('comun.barraDeFiltros.quitar', { etiqueta: filtro.etiqueta })}
                onClick={filtro.alQuitar}
                className="inline-flex size-6 items-center justify-center rounded-sg-sm text-sg-primary-text hover:bg-sg-surface-hover"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {todos ? (
        <div className="hidden md:block">
          <Button type="button" size="sm" variant="secondary" onClick={() => setAbierto('mas')}>
            <SlidersHorizontal aria-hidden className="size-4" />
            {t('comun.barraDeFiltros.masFiltros')}
          </Button>
        </div>
      ) : null}
      {frecuentes || todos ? (
        <div className="md:hidden">
          <Button type="button" size="sm" variant="secondary" onClick={() => setAbierto('telefono')}>
            <SlidersHorizontal aria-hidden className="size-4" />
            {n > 0 ? t('comun.barraDeFiltros.filtrosConConteo', { n }) : t('comun.filtros')}
          </Button>
        </div>
      ) : null}
      {n > 0 && alLimpiar ? (
        <button
          type="button"
          onClick={alLimpiar}
          className="inline-flex h-8 items-center px-2 text-sm font-bold text-sg-primary-text underline underline-offset-2"
        >
          {t('comun.barraDeFiltros.limpiar')}
        </button>
      ) : null}
      <Drawer
        titulo={enTelefono ? t('comun.filtros') : t('comun.barraDeFiltros.masFiltros')}
        abierto={abierto !== null}
        alCerrar={cerrar}
        pie={
          <Button type="button" size="sm" onClick={cerrar}>
            {t('comun.barraDeFiltros.cerrar')}
          </Button>
        }
      >
        {enTelefono && frecuentes ? <div className="flex flex-col gap-4">{frecuentes}</div> : null}
        {todos ? <div className="flex flex-col gap-4">{todos}</div> : null}
      </Drawer>
    </div>
  )
}

// también la usa una lista con sus propios filtros (la Biblioteca): la espera es la misma
export function CajaDeBusqueda({
  etiqueta,
  valor,
  alCambiar,
  enBarra = false
}: {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  // en la barra de filtros: 36 px, con la lupa y sin rótulo a la vista (el nombre accesible es la etiqueta, que también va de
  // marcador); suelta (la Biblioteca, el mapa), con su rótulo encima como todo campo
  enBarra?: boolean
}) {
  const [texto, setTexto] = useState(valor)
  // si la búsqueda cambia desde fuera (su chip, «Limpiar filtros», volver atrás), la caja lo dice
  const [recibido, setRecibido] = useState(valor)
  if (valor !== recibido) {
    setRecibido(valor)
    setTexto(valor)
  }
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // la última alCambiar: la de quien llama cambia en cada dibujo
  const avisar = useRef(alCambiar)
  useEffect(() => {
    avisar.current = alCambiar
  })
  useEffect(() => () => clearTimeout(espera.current), [])
  const enviar = (v: string) => {
    clearTimeout(espera.current)
    espera.current = undefined
    avisar.current(v)
  }
  const caja = (
    <span className="relative block">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-sg-text-secondary" />
      <input
        type="search"
        aria-label={enBarra ? etiqueta : undefined}
        placeholder={enBarra ? etiqueta : undefined}
        className={enBarra ? BUSQUEDA_EN_BARRA : `${CONTROL} pl-8.5`}
        value={texto}
        onChange={(e) => {
          const v = e.target.value
          setTexto(v)
          clearTimeout(espera.current)
          espera.current = setTimeout(() => enviar(v), ESPERA_DE_BUSQUEDA)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            enviar(texto)
          }
        }}
      />
    </span>
  )
  if (enBarra) return <div className="w-full md:w-60">{caja}</div>
  return (
    <label className="flex w-full flex-col gap-1.5 md:w-64">
      <span className="block text-sg-label font-bold">{etiqueta}</span>
      {caja}
    </label>
  )
}
