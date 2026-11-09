import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { cuandoRelativo, hoyEnLima } from '../datos/fechas'
import { usePedir } from '../datos/http'
import { atributo, texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// la situación de plazo de un compromiso con sus días (S08: «VENCIDO · 54 DÍAS», «POR VENCER · 5 DÍAS»), contados en días
// corridos desde hoy en Lima hasta el vencimiento. al día, sin plazo o fuera de los estados que corren (JOB-01 deja la situación
// vacía), sin días
export function SituacionDelCompromiso({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const situacion = atributo(compromiso, 'deadline_status')
  const relativo = situacion === 'VENCIDO' || situacion === 'POR VENCER' ? cuandoRelativo(texto(compromiso, 'due_date'), hoyEnLima()) : null
  const detalle = relativo ? (relativo.dias === 0 ? t('compromisos.situacion.hoy') : t('compromisos.situacion.dias', { count: relativo.dias })) : undefined
  return <SituacionDePlazo valor={situacion} detalle={detalle} />
}

// el motivo con que se bloqueó (S08 y M17b): el de la última entrada de la actividad que llevó el compromiso a «bloqueado». se lee
// con la misma consulta que la pestaña Actividad (Historia: limit 50), y solo mientras está bloqueado; sin motivo no se dibuja
interface EntradaDeHistoria {
  occurredAt: string
  reason: string | null
  changes?: { field: string; after?: unknown }[]
}

export function useMotivoDelBloqueo(compromiso: Registro): string | null {
  const pedir = usePedir()
  const bloqueado = compromiso.state === 'blocked'
  const historia = useQuery({
    queryKey: ['history', 'commitment', compromiso.id, 50],
    queryFn: () => pedir<EntradaDeHistoria[]>(`/objects/commitment/records/${compromiso.id}/history?limit=50`),
    enabled: bloqueado
  })
  if (!bloqueado || !historia.data) return null
  const alBloquear = historia.data
    .filter((e) => (e.changes ?? []).some((c) => c.field === 'state' && c.after === 'blocked'))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
  return alBloquear?.reason?.trim() || null
}

// la alerta de peligro con el motivo del bloqueo (S08: «Motivo del bloqueo · «Falta la autorización…»»): la caja de Alert de la
// capa de componentes (data-slot), sin role="alert": es un dato del registro, no un aviso que interrumpe al leer
export function MotivoDelBloqueo({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const motivo = useMotivoDelBloqueo(compromiso)
  if (!motivo) return null
  return (
    <div data-slot="alert" data-tone="danger" data-motivo-del-bloqueo className="text-sm">
      <span data-slot="alert-text">
        <strong className="block font-bold">{t('compromisos.motivoDelBloqueo')}</strong>
        <span className="block">{t('compromisos.motivoCitado', { motivo })}</span>
      </span>
    </div>
  )
}
