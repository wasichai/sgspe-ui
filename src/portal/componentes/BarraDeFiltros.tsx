import { Button } from '@wasichai/ui'
import { SlidersHorizontal, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { CONTROL } from './Campo'
import { Drawer } from './Drawer'

// la barra de filtros común de una lista (hallazgo U-22, DD-04): la vista (SelectorDeVista), la búsqueda, hasta tres filtros
// frecuentes a la vista, «Más filtros» en un drawer, un chip por filtro aplicado y «Limpiar filtros». los filtros viven en
// la URL: quien la usa lee y escribe sus parámetros. por debajo de md, los frecuentes pasan al drawer y el botón dice
// «Filtros (N)», con N los chips

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
  return (
    <div role="group" aria-label={t('comun.filtros')} className="space-y-2">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        {vista ? <div className="max-w-full min-w-0">{vista}</div> : null}
        {busqueda ? (
          <label className="w-full space-y-1 md:w-64">
            <span className="block text-sg-label">{busqueda.etiqueta}</span>
            <input type="search" className={CONTROL} value={busqueda.valor} onChange={(e) => busqueda.alCambiar(e.target.value)} />
          </label>
        ) : null}
        {frecuentes ? <div className="hidden flex-wrap items-end gap-3 md:flex">{frecuentes}</div> : null}
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
      </div>
      {n > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <ul aria-label={t('comun.barraDeFiltros.aplicados')} className="flex flex-wrap items-center gap-2">
            {aplicados.map((filtro) => (
              <li key={filtro.clave} className="inline-flex items-center gap-1 rounded-sg-sm bg-sg-surface-sunken px-2 py-0.5 text-sg-caption text-sg-text">
                {filtro.etiqueta}
                <button
                  type="button"
                  aria-label={t('comun.barraDeFiltros.quitar', { etiqueta: filtro.etiqueta })}
                  title={t('comun.barraDeFiltros.quitar', { etiqueta: filtro.etiqueta })}
                  onClick={filtro.alQuitar}
                  className="rounded-sg-sm text-sg-text-secondary hover:bg-sg-surface-hover"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </li>
            ))}
          </ul>
          {alLimpiar ? (
            <button type="button" onClick={alLimpiar} className="text-sg-caption text-sg-primary-text underline">
              {t('comun.barraDeFiltros.limpiar')}
            </button>
          ) : null}
        </div>
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
        {enTelefono && frecuentes ? <div className="flex flex-col gap-3">{frecuentes}</div> : null}
        {todos ? <div className="flex flex-col gap-3">{todos}</div> : null}
      </Drawer>
    </div>
  )
}
