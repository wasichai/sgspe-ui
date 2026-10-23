import { Button } from '@wasichai/ui'
import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { CONTROL } from './Campo'
import { Drawer } from './Drawer'

// la barra de filtros común de una lista (hallazgo U-22, DD-04): la vista (SelectorDeVista), la búsqueda, hasta tres filtros
// frecuentes a la vista, «Más filtros» en un drawer, un chip por filtro aplicado y «Limpiar filtros». los filtros viven en
// la URL: quien la usa lee y escribe sus parámetros. por debajo de md, los frecuentes pasan al drawer y el botón dice
// «Filtros (N)», con N los chips. lo escrito en la búsqueda se ve al instante, pero llega a quien la usa (y a la URL) 300 ms
// después de la última tecla, o en el acto con Enter (05-especificacion §1.4)

const ESPERA_DE_BUSQUEDA = 300

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
        {busqueda ? <CajaDeBusqueda {...busqueda} /> : null}
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

function CajaDeBusqueda({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: string; alCambiar: (valor: string) => void }) {
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
  return (
    <label className="w-full space-y-1 md:w-64">
      <span className="block text-sg-label">{etiqueta}</span>
      <input
        type="search"
        className={CONTROL}
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
    </label>
  )
}
