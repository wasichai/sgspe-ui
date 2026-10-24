import { cn } from '@wasichai/ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegistro, useTodos } from '../datos/registros'
import { NS } from '../i18n'
import { CONTROL } from './Campo'
import { FalloDeLectura } from './LecturaConEstados'
import { useNombreDelGrupo, useNombresDeGrupos } from './NombreDeActor'

// el chip del filtro ?stakeholder=<id> de una lista (revisión de UX, etapa 6): las cifras de la ficha del grupo de interés llevan a
// la lista con él puesto. el nombre se lee como quien mira; mientras llega, «…»
export function useChipDeGrupo(id: string): string {
  const { t } = useTranslation(NS)
  const grupo = useRegistro('stakeholder', id || undefined)
  const nombre = useNombreDelGrupo(grupo.data)
  return t('paginas.filtroDeGrupo', { nombre: nombre || '…' })
}

// sin mayúsculas ni tildes: «pena» encuentra «Peña»
const comparable = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')

// el selector con búsqueda del filtro ?stakeholder=<id> en «Más filtros» (flujo F-C): los grupos de interés que quien mira lee (el
// servidor acota por proyecto), buscados por el nombre que se le muestra a esa persona. el nombre de un grupo no está en el grupo,
// sino en su persona u organización, y el de una persona puede estar restringido: entonces dice «Persona registrada», como su
// chip. elegir uno escribe el filtro; quitarlo es cosa de su chip
export function SelectorDeGrupo({
  proyecto,
  valor,
  alElegir,
  textos
}: {
  proyecto: string | undefined
  valor: string
  alElegir: (id: string) => void
  textos: { etiqueta: string; buscar: string; lista: string; ninguno: string; vacio: string }
}) {
  const { t } = useTranslation(NS)
  const id = useId()
  const [q, setQ] = useState('')
  const grupos = useTodos('stakeholder', { project: proyecto })
  const nombres = useNombresDeGrupos(grupos.data ?? [])
  const buscado = comparable(q.trim())
  const opciones = (grupos.data ?? [])
    .map((g) => ({ id: g.id, nombre: nombres.get(g.id) || '…' }))
    .filter((g) => !buscado || comparable(g.nombre).includes(buscado))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return (
    <div role="group" aria-labelledby={id} className="space-y-1 text-sm">
      <span id={id} className="block text-sg-label">
        {textos.etiqueta}
      </span>
      <input type="search" aria-label={textos.buscar} placeholder={textos.buscar} value={q} onChange={(e) => setQ(e.target.value)} className={CONTROL} />
      {grupos.isPending ? (
        <p className="text-sg-caption text-sg-text-muted">{t('comun.cargando')}</p>
      ) : grupos.isError && !grupos.data ? (
        <FalloDeLectura error={grupos.error} alReintentar={() => void grupos.refetch()} />
      ) : opciones.length === 0 ? (
        <p className="text-sg-caption text-sg-text-muted">{buscado ? textos.ninguno : textos.vacio}</p>
      ) : (
        <ul aria-label={textos.lista} className="max-h-64 overflow-y-auto rounded-sg-md border border-sg-border">
          {opciones.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                aria-pressed={g.id === valor}
                className={cn(
                  'w-full px-2.5 py-1.5 text-left text-sm hover:bg-sg-surface-hover',
                  g.id === valor && 'bg-sg-primary-soft font-medium text-sg-primary-text'
                )}
                onClick={() => alElegir(g.id)}
              >
                {g.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
