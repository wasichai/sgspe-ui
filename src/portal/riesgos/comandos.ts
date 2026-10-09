import { useComando } from '../datos/comandos'
import type { Registro } from '../datos/registros'

// la revisión de un riesgo (api.md §4.7, plan 4.2b): POST /api/sgspe/social-risks/{id}/assessments → 201 { assessment, risk }. el
// servidor valida probabilidad e impacto de 1 a 5, la fecha (no futura en Lima ni anterior a la última del mismo tipo), calcula
// puntaje, nivel y tendencia, crea la revisión inmutable, mueve los valores vigentes o residuales y la próxima revisión, y en la
// primera aplica assess. exige motivo (CR) y honra Idempotency-Key (IK): un reintento tras perder la red no crea dos revisiones
export interface Revision {
  assessment: Registro
  risk: Registro
}

export interface PedidoDeRevision {
  riesgo: Registro
  // AAAA-MM-DD, la fecha de Lima de la revisión
  fecha: string
  probabilidad: number
  impacto: number
  residual: boolean
  notas: string
  motivo: string
}

export function useRevisarRiesgo() {
  return useComando<Revision, PedidoDeRevision>(
    ({ riesgo, fecha, probabilidad, impacto, residual, notas, motivo }) => ({
      ruta: `/sgspe/social-risks/${encodeURIComponent(riesgo.id)}/assessments`,
      json: {
        attributes: { assessment_date: fecha, probability: probabilidad, impact: impacto, residual, ...(notas.trim() ? { notes: notas.trim() } : {}) }
      },
      motivo
    }),
    {
      invalidar: (_r, { riesgo }) => [
        ['record', 'social_risk', riesgo.id],
        ['records', 'social_risk'],
        ['records', 'risk_assessment'],
        ['transitions', 'social_risk', riesgo.id],
        ['history', 'social_risk', riesgo.id],
        ['transition-check', 'social_risk', riesgo.id]
      ]
    }
  )
}
