import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Cargando } from './Estados'
import { FalloDeLectura } from './LecturaConEstados'
import { usePedir } from '../datos/http'
import { campoDe, useDefinicion } from '../datos/registros'
import { fechaPe, NS } from '../i18n'

// la actividad de un registro (GET /api/objects/{object}/records/{id}/history, design-system.md §6.6): cuándo, quién, qué
// y por qué; los campos que la cuenta no lee no aparecen (wasichai filtra la historia con los permisos de campo). la usan la
// ficha de una interacción (S22) y el resumen del proyecto (S08), cada una con su límite y su texto de vacío
interface Entrada {
  id: string
  userEmail: string
  operation: string
  occurredAt: string
  reason: string | null
  changes?: { field: string }[]
}

// la clave lleva el límite: el editor de actas pide la misma historia con otro (500) y no deben compartir la caché
export function Historia({ objeto, id, limite = 50, vacio }: { objeto: string; id: string; limite?: number; vacio: string }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const definicion = useDefinicion(objeto)
  const historia = useQuery({
    queryKey: ['history', objeto, id, limite],
    queryFn: () => pedir<Entrada[]>(`/objects/${objeto}/records/${id}/history?limit=${limite}`)
  })
  // el campo con la etiqueta de la metadata; el estado, con la suya; uno que la metadata no nombra, tal cual
  const campo = (nombre: string) => (nombre === 'state' ? t('comun.actividad.estado') : (campoDe(definicion.data, nombre)?.label ?? nombre))
  if (historia.isPending) return <Cargando compacto />
  if (historia.isError && !historia.data) return <FalloDeLectura error={historia.error} alReintentar={() => void historia.refetch()} />
  if (historia.data.length === 0) return <p className="text-sm text-sg-text-muted">{vacio}</p>
  return (
    <ol className="space-y-1 text-sm">
      {historia.data.map((e) => (
        <li key={e.id}>
          <span className="text-sg-text-muted">{fechaPe(new Date(e.occurredAt))}</span> · {e.userEmail} ·{' '}
          {t(`comun.actividad.operaciones.${e.operation}`, { defaultValue: e.operation })}
          {e.changes?.length ? <span className="text-sg-text-secondary"> ({e.changes.map((c) => campo(c.field)).join(', ')})</span> : null}
          {e.reason ? <span className="text-sg-text-secondary"> — {e.reason}</span> : null}
        </li>
      ))}
    </ol>
  )
}
