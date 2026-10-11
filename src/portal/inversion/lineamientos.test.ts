import { describe, expect, it } from 'vitest'
import type { Aviso } from '../transiciones/api'
import { leerLineamientos, type Contexto } from './lineamientos'

// «Antes de aprobar» (spec F5 §3.3 y §3.4): los hallazgos de la consulta en seco, fila por fila. la justificación cubre mano de obra,
// donación con dinero y tema no priorizado (RN-INV-006); la sinergia (P6) y la prioridad sin temas configurados no la piden
const aviso = (code: string, field: string | null = null): Aviso => ({ code, message: '', field })
const contexto = (extra: Partial<Contexto> = {}): Contexto => ({ politicas: {}, conCampana: true, conSinergia: false, ...extra })
const situacion = (lectura: ReturnType<typeof leerLineamientos>, fila: string) => lectura.filas.find((f) => f.fila === fila)?.situacion

describe('leerLineamientos', () => {
  it('un lineamiento incumplido sin justificación bloquea, con ella advierte; lo demás que aplica cumple', () => {
    const sin = leerLineamientos({ allowed: false, blocking: [aviso('PAID_LABOR', 'contribution_item')], warnings: [] }, contexto())
    expect(situacion(sin, 'manoDeObra')).toBe('bloquea')
    expect(situacion(sin, 'items')).toBe('cumple')
    expect(situacion(sin, 'tope')).toBe('cumple')
    expect(sin.pideJustificacion).toBe(true)
    const con = leerLineamientos({ allowed: true, blocking: [], warnings: [aviso('PAID_LABOR'), aviso('PRIORITY_NOT_MET', 'topic')] }, contexto())
    expect(situacion(con, 'manoDeObra')).toBe('advierte')
    expect(situacion(con, 'prioridad')).toBe('advierte')
    expect(con.pideJustificacion).toBe(true)
  })

  it('una política apagada, un aporte sin campaña o sin sinergia no se evalúan; vacía, la política vale activada', () => {
    const lectura = leerLineamientos(
      { allowed: true, blocking: [], warnings: [] },
      contexto({ politicas: { policy_no_paid_labor: false, policy_priority_warning: null }, conCampana: false, conSinergia: false })
    )
    expect(situacion(lectura, 'manoDeObra')).toBe('noAplica')
    expect(situacion(lectura, 'tope')).toBe('noAplica')
    expect(situacion(lectura, 'sinergia')).toBe('noAplica')
    expect(situacion(lectura, 'prioridad')).toBe('cumple')
    expect(situacion(lectura, 'donaciones')).toBe('cumple')
    expect(lectura.pideJustificacion).toBe(false)
  })

  it('la sinergia bloquea y no pide justificación; la prioridad sin temas configurados advierte y tampoco la pide', () => {
    const lectura = leerLineamientos(
      { allowed: false, blocking: [aviso('SYNERGY_AGREEMENT_REQUIRED', 'agreement')], warnings: [aviso('PRIORITIES_NOT_CONFIGURED', 'topic')] },
      contexto({ conSinergia: true })
    )
    expect(situacion(lectura, 'sinergia')).toBe('bloquea')
    expect(situacion(lectura, 'prioridad')).toBe('advierte')
    expect(lectura.pideJustificacion).toBe(false)
  })

  it('el tope, los ítems y quién aprueba juntan sus códigos; REASON_REQUIRED no es una regla; un código ajeno va a «otras»', () => {
    const lectura = leerLineamientos(
      {
        allowed: false,
        blocking: [aviso('ITEMS_REQUIRED', 'contribution_item'), aviso('SEGREGATION_OF_DUTIES', 'record'), aviso('PROJECT_MISMATCH', 'agreement')],
        warnings: [aviso('CAP_OTHER_CURRENCY', 'currency'), aviso('REASON_REQUIRED', 'reason')]
      },
      contexto()
    )
    expect(situacion(lectura, 'items')).toBe('bloquea')
    expect(situacion(lectura, 'quienAprueba')).toBe('bloquea')
    expect(situacion(lectura, 'tope')).toBe('advierte')
    expect(lectura.otros.map((a) => a.code)).toEqual(['PROJECT_MISMATCH'])
  })
})
