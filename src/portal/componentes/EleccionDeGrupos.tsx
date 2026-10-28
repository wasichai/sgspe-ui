import { cn } from '@wasichai/ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'
import { CONTROL } from './Campo'
import { comparable } from './FiltroDeGrupo'
import { NombreDelGrupo, useNombresDeGrupos } from './NombreDeActor'

// desde cuántos grupos la lista trae su búsqueda: con menos, se ven todos de un vistazo
const CON_BUSQUEDA = 6

// la elección de varios grupos de interés en un alta (tercera pasada de UX, 2.7): las casillas de los grupos vigentes del
// proyecto y, con muchos, una búsqueda por el nombre que se le muestra a quien mira (sin tildes ni mayúsculas, como el filtro de
// «Más filtros»). lo ya elegido no se esconde al buscar: queda en la lista para poder quitarlo, y la cuenta dice cuántos van.
// Enter en la búsqueda no envía el formulario que la contiene. en el teléfono (grande), las casillas miden 44 px y la lista no
// tiene desplazamiento propio
export function EleccionDeGrupos({
  etiqueta,
  etiquetaOculta = false,
  grupos,
  elegidos,
  alCambiar,
  grande = false
}: {
  etiqueta: string
  etiquetaOculta?: boolean
  grupos: Registro[]
  elegidos: readonly string[]
  alCambiar: (ids: string[]) => void
  grande?: boolean
}) {
  const { t } = useTranslation(NS)
  const idDeLaLista = useId()
  const [q, setQ] = useState('')
  const vigentes = grupos.filter((g) => g.state !== 'retired')
  const nombres = useNombresDeGrupos(vigentes)
  const conBusqueda = vigentes.length >= CON_BUSQUEDA
  const buscado = conBusqueda ? comparable(q.trim()) : ''
  const visibles = buscado ? vigentes.filter((g) => elegidos.includes(g.id) || comparable(nombres.get(g.id) ?? '').includes(buscado)) : vigentes
  const coinciden = visibles.some((g) => !elegidos.includes(g.id) || comparable(nombres.get(g.id) ?? '').includes(buscado))
  const cambiar = (id: string, elegido: boolean) => alCambiar(elegido ? [...elegidos, id] : elegidos.filter((x) => x !== id))
  return (
    <fieldset className="space-y-1">
      <legend className={etiquetaOculta ? 'sr-only' : 'text-sg-label font-medium'}>{etiqueta}</legend>
      {conBusqueda ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label={t('comun.eleccionDeGrupos.buscar')}
            aria-controls={idDeLaLista}
            placeholder={t('comun.eleccionDeGrupos.buscar')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
            className={cn(CONTROL, 'min-w-0 flex-1', grande && 'h-11')}
          />
          {elegidos.length > 0 ? (
            <span role="status" className="text-sg-caption text-sg-text-muted">
              {t('comun.eleccionDeGrupos.elegidos', { count: elegidos.length })}
            </span>
          ) : null}
        </div>
      ) : null}
      {buscado && !coinciden ? <p className="text-sg-caption text-sg-text-muted">{t('comun.eleccionDeGrupos.ninguno', { q: q.trim() })}</p> : null}
      <ul id={idDeLaLista} className={cn('text-sm', !grande && 'max-h-60 overflow-y-auto rounded-sg-md border border-sg-border p-2')}>
        {visibles.map((g) => (
          <li key={g.id}>
            <label className={cn('flex items-center gap-2', grande && 'min-h-11')}>
              <input
                type="checkbox"
                className={grande ? 'size-5' : undefined}
                checked={elegidos.includes(g.id)}
                onChange={(e) => cambiar(g.id, e.target.checked)}
              />
              <NombreDelGrupo grupo={g} />
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
