import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { atributo, useRegistro } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { nombreDeProyecto, useProyecto } from './proyectos'
import { OBJETO_DE_TERRITORIO } from './rutas'

// la barra de contexto de ux-architecture.md §8.1: el proyecto con su estado y el chip de territorio; quitar el chip
// devuelve el proyecto entero sin cambiar de pantalla. con «principal» (las migas de ProyectoLayout, revisión de UX) dibuja eso
// en lugar del nombre del proyecto, que ya va en las migas con su estado: tras el último paso, el estado se leía como el del
// registro abierto (tercera pasada de UX)
export function BarraDeContexto({ principal }: { principal?: ReactNode }) {
  const { t } = useTranslation(NS)
  const { scope, territory } = useContextFilters()
  const proyecto = useProyecto(scope.kind === 'project' ? scope.projectId : undefined)
  const lugar = useRegistro(territory ? OBJETO_DE_TERRITORIO[territory.kind] : 'locality', territory?.id)
  const [busqueda, fijar] = useSearchParams()
  if (scope.kind !== 'project' && !territory) return null
  const nombreDelLugar = lugar.data ? String(atributo(lugar.data, 'name') ?? atributo(lugar.data, 'area_type') ?? territory?.id) : (territory?.id ?? '')
  return (
    <nav aria-label={t('contexto.contexto')} className="flex flex-wrap items-center gap-3 text-sm">
      {proyecto.data ? (
        <span className="flex items-center gap-2">
          {principal ?? (
            <>
              <span className="font-medium text-sg-text">{nombreDeProyecto(proyecto.data)}</span>
              <EstadoChip objeto="project" estado={proyecto.data.state} />
            </>
          )}
        </span>
      ) : null}
      {territory ? (
        <span className="inline-flex items-center gap-1 rounded-sg-sm border border-sg-territory-border bg-sg-territory-soft px-2 py-0.5 text-sg-territory">
          {t('contexto.territorio', { nombre: `${t(`contexto.tipos.${territory.kind}`)} ${nombreDelLugar}` })}
          <button
            type="button"
            aria-label={t('contexto.quitarTerritorio')}
            onClick={() => {
              const siguiente = new URLSearchParams(busqueda)
              siguiente.delete('territory')
              fijar(siguiente)
            }}
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ) : null}
    </nav>
  )
}
