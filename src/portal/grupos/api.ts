import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePedir } from '../datos/http'
import type { Registro } from '../datos/registros'

// las evaluaciones de grupos de interés (api.md §4.3): inmutables, solo por su endpoint. la vista previa calcula sin
// guardar y exige READ sobre stakeholder_assessment, porque lee el historial para la línea base (sin él, 403 sin código);
// el alta lleva motivo (CR), If-Match opcional (IM?) y una clave de idempotencia por acción (IK, desde F3). sus errores:
// 403 ROLE_REQUIRED (el rol de assess de WF-B), 403 FIELD_NOT_WRITABLE (la postura) y 409 STATE_MISMATCH (retirado)
export const INDICADORES_DE_INTERES = [
  'affect_environment',
  'affect_livelihood',
  'affect_property_status',
  'opportunity_work',
  'opportunity_development',
  'opportunity_benefits'
] as const
export const INDICADORES_DE_PODER = [
  'power_legal_action',
  'power_credibility',
  'power_permit_control',
  'power_action_scope',
  'power_organization_level',
  'power_convening_capacity',
  'power_network_membership',
  'power_group_mobilization',
  'power_other_pressure'
] as const
export const INDICADORES = [...INDICADORES_DE_INTERES, ...INDICADORES_DE_PODER]

// STANCE_DIVERGENCE, BACKDATED_ASSESSMENT (hay evaluaciones posteriores) o NO_PRIORITY_RULE (la prioridad queda vacía)
export interface Advertencia {
  code: string
  message?: string
}

// lo que la vista previa calcula, con los nombres de campo del modelo (api.md §3.2): los índices, el grupo y la prioridad,
// más los componentes de cada índice, si el grupo quedó ajustado, la evaluación que es su línea base y si la postura cambió
export interface Calculo {
  interest_index: number
  power_index: number
  influence_score: number
  influence_group: string
  information_priority?: string | null
  group_overridden?: boolean
  baseline_assessment?: string | null
  stance_changed?: boolean
  [componente: string]: unknown
}

export interface VistaPreviaDeEvaluacion {
  computed: Calculo
  warnings: Advertencia[]
}

export interface EvaluacionGuardada {
  assessment: Registro
  stakeholder: Registro
  warnings: Advertencia[]
}

export function useVistaPreviaDeEvaluacion(grupo: string, atributos: Record<string, unknown> | null) {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['assessment-preview', grupo, atributos],
    queryFn: () => pedir<VistaPreviaDeEvaluacion>(`/sgspe/stakeholders/${grupo}/assessments/preview`, { json: { attributes: atributos } }),
    enabled: atributos !== null,
    staleTime: Infinity
  })
}

export function useGuardarEvaluacion(grupo: Registro) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ atributos, motivo, clave }: { atributos: Record<string, unknown>; motivo: string; clave: string }) =>
      pedir<EvaluacionGuardada>(`/sgspe/stakeholders/${grupo.id}/assessments`, { json: { attributes: atributos }, motivo, clave, version: grupo.updatedAt }),
    onSuccess: () => {
      for (const clave of [
        ['record', 'stakeholder', grupo.id],
        ['records', 'stakeholder'],
        ['records', 'stakeholder_assessment'],
        ['transitions', 'stakeholder', grupo.id],
        ['indicator'],
        ['dashboard']
      ])
        void cliente.invalidateQueries({ queryKey: clave })
    }
  })
}
