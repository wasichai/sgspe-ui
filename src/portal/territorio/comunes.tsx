import { useSiguientePaso } from '../contexto/Rastro'
import { useQueries } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ErrorDeCarga } from '../componentes/Estados'
import { useMisAsignaciones, useProyectos } from '../contexto/proyectos'
import { valorDeTerritorio } from '../contexto/rutas'
import { usePedir } from '../datos/http'
import { atributo, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import type { TerritoryKind } from '../shell/context'

// "Trabajar en el proyecto con este lugar" (screens.md S13, flujo 17): fija el chip de territorio y abre la lista de grupos
// de interés del proyecto. con ?project= en la ficha va directo; sin él, se elige entre los proyectos de la persona. el
// destino es una sección que la cuenta debe poder abrir: sin READ sobre stakeholder no se ofrece
export function TrabajarEnProyecto({ tipo, id }: { tipo: TerritoryKind; id: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const [busqueda] = useSearchParams()
  const navegar = useNavigate()
  const asignaciones = useMisAsignaciones()
  const proyectos = useProyectos()
  const proyecto = busqueda.get('project')
  const destino = (p: string) => `/projects/${encodeURIComponent(p)}/stakeholders?territory=${encodeURIComponent(valorDeTerritorio(tipo, id))}`
  // el lugar queda en el rastro (revisión de UX, etapa 6)
  const paso = useSiguientePaso()
  if (!can('stakeholder', 'READ')) return null
  if (proyecto)
    return (
      <Button asChild size="sm">
        <Link to={destino(proyecto)} state={paso()}>
          {t('territorio.trabajarEnProyecto')}
        </Link>
      </Button>
    )
  if (proyectos.isError && !proyectos.data) return <ErrorDeCarga error={proyectos.error} alReintentar={() => void proyectos.refetch()} />
  // mientras llegan los proyectos y las asignaciones no se ofrece una lista a medias: las asignaciones solo acotan la lista
  // (una comodidad, no un control de acceso), así que si no se pueden leer se ofrecen todos los proyectos
  if (!proyectos.data || (asignaciones.isPending && !asignaciones.isError)) {
    return (
      <select aria-label={t('territorio.trabajarEnProyecto')} disabled className="h-8 rounded-sg-md border border-sg-border-strong bg-sg-surface px-2 text-sm">
        <option>{t('comun.cargando')}</option>
      </select>
    )
  }
  const mios = new Set((asignaciones.data ?? []).map((a) => String(atributo(a, 'project'))))
  const opciones = proyectos.data.filter((p) => mios.size === 0 || mios.has(p.id))
  if (opciones.length === 0) return null
  return (
    <select
      aria-label={t('territorio.trabajarEnProyecto')}
      className="h-8 rounded-sg-md border border-sg-border-strong bg-sg-surface px-2 text-sm"
      value=""
      onChange={(e) => e.target.value && navegar(destino(e.target.value), { state: paso() })}
    >
      <option value="">{t('territorio.trabajarEnProyecto')}…</option>
      {opciones.map((p) => (
        <option key={p.id} value={p.id}>
          {String(atributo(p, 'code') ?? '')} · {String(atributo(p, 'name') ?? '')}
        </option>
      ))}
    </select>
  )
}

export function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-sg-text-muted">{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  )
}

// los registros de un objeto por su id, con la misma clave de caché que useRegistro. un 403 o un 404 es un registro que la
// cuenta no puede leer (o que ya no está) y no se lista; cualquier otro error no se calla (`error`), y mientras alguno
// llega no se da la lista por completa (`pendiente`)
export function useRegistrosPorId(
  objeto: string,
  ids: readonly string[]
): { registros: Registro[]; pendiente: boolean; error: unknown; reintentar: () => void } {
  const pedir = usePedir()
  const consultas = useQueries({
    queries: ids.map((id) => ({ queryKey: ['record', objeto, id], queryFn: () => pedir<Registro>(`/objects/${objeto}/records/${id}`), retry: false }))
  })
  const ilegible = (error: unknown) => error instanceof ApiError && (error.status === 403 || error.status === 404)
  const fallida = consultas.find((c) => c.isError && !c.data && !ilegible(c.error))
  return {
    registros: consultas.flatMap((c) => (c.data ? [c.data] : [])),
    pendiente: consultas.some((c) => c.isPending),
    error: fallida?.error,
    reintentar: () => consultas.forEach((c) => c.isError && void c.refetch())
  }
}
