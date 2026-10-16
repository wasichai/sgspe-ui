import { describe, expect, it } from 'vitest'
import { esDeComando as esCampoDeComando, esDerivado } from './datos/derivados'
import { esDeComando, exigeMotivo } from './transiciones/reglas'

// las reglas de F8 que el portal repite del backend: deliverable es requiresReason (toda transición lleva motivo), issue es una
// transición de comando (solo POST …/issue), los draft_* y current_revision son derivados que el portal nunca envía y
// current_version solo la escribe la emisión
describe('reglas de F8', () => {
  it('WF-H: toda transición pide motivo e issue es de comando', () => {
    expect(exigeMotivo('deliverable', 'approve')).toBe(true)
    expect(exigeMotivo('deliverable', 'submit_for_review')).toBe(true)
    expect(esDeComando('deliverable', 'issue')).toBe(true)
    expect(esDeComando('deliverable', 'approve')).toBe(false)
  })

  it('los campos derivados y de comando del entregable', () => {
    for (const campo of [
      'generation_requested_at',
      'draft_generation_status',
      'draft_model_sha256',
      'draft_internal_pdf',
      'draft_candidate_external_pdf',
      'current_revision'
    ])
      expect(esDerivado('deliverable', campo)).toBe(true)
    expect(esDerivado('deliverable', 'title')).toBe(false)
    expect(esCampoDeComando('deliverable', 'current_version')).toBe(true)
  })
})
