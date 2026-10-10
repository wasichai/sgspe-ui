// los campos derivados de F2 a F4 (database-model.md, marca "(derivado)"; "derived": true en model.json): los escribe solo el
// código de SGSPE (en F3, CommitmentDerivationsListener y JOB-01; en F4, los listeners de plazos y fechas de las QCS, JOB-01, el
// endpoint de revisiones de riesgo y la derivación de preguntas). la API genérica responde 400 a un valor distinto del
// guardado (DerivedFieldsGuard) y devuelve el guardado al que el PUT deja vacío (DerivedFieldsKeeper, plan 2.2). el portal
// los muestra y nunca los envía
export const CAMPOS_DERIVADOS: Readonly<Record<string, readonly string[]>> = {
  exploration_campaign: ['executed_social_amount', 'other_currency_items_count'],
  mining_concession: ['calculated_area_ha'],
  community: ['calculated_area_ha'],
  area_of_influence: ['calculated_area_ha'],
  project_component: ['superseded'],
  land_parcel: ['calculated_area_ha'],
  stakeholder: [
    'stance',
    'influence_group',
    'information_priority',
    'interest_index',
    'power_index',
    'trust_score',
    'last_assessment_date',
    'last_contact_date'
  ],
  stakeholder_assessment: ['stance_changed'],
  engagement: [
    'attendees_total_count',
    'attendees_female_count',
    'attendees_male_count',
    'attendees_direct_area_count',
    'attendees_indirect_area_count',
    'attendees_regional_count',
    'attendees_national_count'
  ],
  strategic_alliance: ['formalized'],
  commitment: ['executed_amount', 'deadline_status', 'requires_senior_approval', 'fulfilled_date', 'closed_date', 'cancelled_date'],
  agreement: ['validity_status'],
  task: ['deadline_status'],
  // F4 (plan 4.1): los plazos y fechas de las QCS, los valores vigentes y residuales del riesgo, su próxima revisión y su
  // situación, y la marca de derivación de una pregunta
  engagement_question: ['referred_at'],
  grievance: ['response_due_date', 'deadline_status', 'closed_date', 'ack_due_date', 'resolution_due_date', 'resolved_date'],
  inquiry: ['response_due_date', 'deadline_status', 'closed_date'],
  stakeholder_request: ['response_due_date', 'deadline_status', 'closed_date'],
  social_risk: [
    'probability',
    'impact',
    'score',
    'risk_level',
    'residual_probability',
    'residual_impact',
    'residual_score',
    'residual_level',
    'next_review_date',
    'review_status'
  ]
}

export const esDerivado = (objeto: string, campo: string): boolean => CAMPOS_DERIVADOS[objeto]?.includes(campo) ?? false
