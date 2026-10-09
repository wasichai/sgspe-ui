import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { usePedir } from '../datos/http'
import { campoDe, useDefinicion } from '../datos/registros'
import { fechaPe, NS } from '../i18n'

// la actividad de un registro (GET /api/objects/{object}/records/{id}/history, design-system.md §6.6): cuándo, quién, qué
// y por qué; los campos que la cuenta no lee no aparecen (wasichai filtra la historia con los permisos de campo)
interface Entrada {
  id: string
  userEmail: string
  operation: string
  occurredAt: string
  reason: string | null
  changes?: { field: string }[]
}

// la clave lleva el límite: el editor de actas pide la misma historia con otro (500) y no deben compartir la caché
const LIMITE = 50

export function Historia({ objeto, id }: { objeto: string; id: string }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const definicion = useDefinicion(objeto)
  const historia = useQuery({
    queryKey: ['history', objeto, id, LIMITE],
    queryFn: () => pedir<Entrada[]>(`/objects/${objeto}/records/${id}/history?limit=${LIMITE}`)
  })
  // el campo con la etiqueta de la metadata; el estado, con la suya; uno que la metadata no nombra, tal cual
  const campo = (nombre: string) => (nombre === 'state' ? t('relacionamiento.columnas.estado') : (campoDe(definicion.data, nombre)?.label ?? nombre))
  if (historia.isPending) return <Cargando compacto />
  if (historia.isError && !historia.data) return <FalloDeLectura error={historia.error} alReintentar={() => void historia.refetch()} />
  if (historia.data.length === 0) return <p className="pt-3 text-sm text-sg-text-muted">{t('relacionamiento.ficha.sinActividad')}</p>
  return (
    <ol className="space-y-1 pt-3 text-sm">
      {historia.data.map((e) => (
        <li key={e.id}>
          <span className="text-sg-text-muted">{fechaPe(new Date(e.occurredAt))}</span> · {e.userEmail} ·{' '}
          {t(`p360.resumen.operaciones.${e.operation}`, { defaultValue: e.operation })}
          {e.changes?.length ? <span className="text-sg-text-secondary"> ({e.changes.map((c) => campo(c.field)).join(', ')})</span> : null}
          {e.reason ? <span className="text-sg-text-secondary"> — {e.reason}</span> : null}
        </li>
      ))}
    </ol>
  )
}
