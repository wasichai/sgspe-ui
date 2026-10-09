// las transiciones que exigen motivo sin que el objeto sea requiresReason (workflows.md, «Transiciones con motivo
// obligatorio»; TransitionReasonGuard): el diálogo no deja confirmar sin él
export const MOTIVO_OBLIGATORIO: Readonly<Record<string, readonly string[]>> = {
  project: ['return_to_draft', 'suspend', 'cancel_draft', 'cancel_in_review'],
  stakeholder: ['retire_identified', 'retire_profiled', 'retire_assessed', 'reinstate'],
  engagement: ['postpone', 'return_minutes', 'cancel_planned', 'cancel_scheduled', 'cancel_postponed'],
  field_visit: ['cancel'],
  commitment_candidate: ['reject', 'mark_duplicate'],
  task: ['cancel_open', 'cancel_in_progress', 'cancel_blocked'],
  // F4: descartar una alerta (WF-J)
  early_warning: ['dismiss']
}

// los objetos requiresReason con workflow: toda transición lleva motivo (ASM-058). F3: WF-D y WF-I; F4: las tres QCS (WF-E1, WF-E2
// y WF-E3) y el riesgo (WF-F)
export const MOTIVO_EN_TODAS: readonly string[] = ['commitment', 'agreement', 'grievance', 'inquiry', 'stakeholder_request', 'social_risk']

// las transiciones de comando (workflows.md, «Transiciones de comando»): solo las aplica su endpoint, así que no son
// botones de transición; cada una tiene su pantalla (la evaluación, S20; la aprobación del área, S10; aceptar un candidato y
// marcarlo duplicado, S28). mark_duplicate no es de comando para el servidor, pero sin duplicate_of (que solo escribe
// POST …/duplicate) CommitmentWriteGuard la rechaza: el portal la ofrece solo por su endpoint. F4: las reclasificaciones de las
// tres QCS («Reclasificar…»), la aceptación de una solicitud («Aceptar y crear el compromiso»), su cierre por el compromiso (lo
// aplica RequestClosureListener) y la primera revisión de un riesgo («Nueva revisión»)
export const DE_COMANDO: Readonly<Record<string, readonly string[]>> = {
  stakeholder: ['assess'],
  area_of_influence: ['approve', 'supersede'],
  commitment_candidate: ['accept', 'mark_duplicate'],
  grievance: ['close_reclassified_received', 'close_reclassified_acknowledged', 'close_reclassified_in_assessment'],
  inquiry: ['close_reclassified'],
  stakeholder_request: ['accept', 'close_accepted', 'close_reclassified_received', 'close_reclassified_under_evaluation'],
  social_risk: ['assess']
}

export const exigeMotivo = (objeto: string, transicion: string): boolean =>
  MOTIVO_EN_TODAS.includes(objeto) || (MOTIVO_OBLIGATORIO[objeto]?.includes(transicion) ?? false)
export const esDeComando = (objeto: string, transicion: string): boolean => DE_COMANDO[objeto]?.includes(transicion) ?? false
