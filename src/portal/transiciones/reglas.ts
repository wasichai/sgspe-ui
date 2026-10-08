// las transiciones de F2 que exigen motivo sin que el objeto sea requiresReason (workflows.md, «Transiciones con motivo
// obligatorio»; TransitionReasonGuard): el diálogo no deja confirmar sin él
export const MOTIVO_OBLIGATORIO: Readonly<Record<string, readonly string[]>> = {
  project: ['return_to_draft', 'suspend', 'cancel_draft', 'cancel_in_review'],
  stakeholder: ['retire_identified', 'retire_profiled', 'retire_assessed', 'reinstate'],
  engagement: ['postpone', 'return_minutes', 'cancel_planned', 'cancel_scheduled', 'cancel_postponed'],
  field_visit: ['cancel']
}

// las transiciones de comando (workflows.md, «Transiciones de comando»): solo las aplica su endpoint, así que no son
// botones de transición; cada una tiene su pantalla (la evaluación, S20; la aprobación del área, S10)
export const DE_COMANDO: Readonly<Record<string, readonly string[]>> = {
  stakeholder: ['assess'],
  area_of_influence: ['approve', 'supersede']
}

export const exigeMotivo = (objeto: string, transicion: string): boolean => MOTIVO_OBLIGATORIO[objeto]?.includes(transicion) ?? false
export const esDeComando = (objeto: string, transicion: string): boolean => DE_COMANDO[objeto]?.includes(transicion) ?? false
