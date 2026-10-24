import { describe, expect, it } from 'vitest'
import { leerEspecificacion } from './especificacion'

// la especificación que sirve GET /api/sgspe/presentations/{id}/spec (deliverables.md §16.3) se valida con el esquema del
// paquete @wasichai/sgspe-slides antes de dibujarla: el reproductor no pinta lo que el esquema no admite. todo es ficticio
const especificacion = (cambios: Record<string, unknown> = {}) => ({
  schema: 1,
  meta: {
    code: 'INF-001',
    title: 'Informe de campo de la Comunidad Ejemplo',
    project: 'Proyecto Ejemplo A',
    revision: '1',
    level: 'EXTERNO',
    audience: 'DIRECCION',
    dateLabel: '30 de setiembre de 2026',
    derivation: 'Derivada de INF-001 rev. 1, nivel EXTERNO; no es un documento emitido'
  },
  theme: { accent: '#1F4E79', onAccent: '#FFFFFF' },
  assets: {},
  slides: [
    { id: 'portada', purpose: 'Abrir', title: 'Informe de campo', data: { layout: 'cover' } },
    { id: 'cierre', purpose: 'Cerrar', title: 'Gracias', data: { layout: 'closing', message: 'Preguntas' } }
  ],
  ...cambios
})

describe('leerEspecificacion', () => {
  it('admite la versión de esquema vigente y devuelve la presentación', () => {
    const leida = leerEspecificacion(especificacion())
    expect(leida.admitida).toBe(true)
    if (leida.admitida) expect(leida.deck.slides.map((s) => s.id)).toEqual(['portada', 'cierre'])
  })

  it('no admite una versión de esquema que el paquete no conoce: se presenta con el PDF', () => {
    expect(leerEspecificacion(especificacion({ schema: 99 }))).toEqual({ admitida: false, motivo: 'version' })
    expect(leerEspecificacion(especificacion({ schema: 0 }))).toEqual({ admitida: false, motivo: 'version' })
  })

  it('no admite una especificación que el esquema rechaza, como un texto con una URL', () => {
    const conUrl = especificacion({
      slides: [{ id: 'portada', purpose: 'Abrir', title: 'Ver https://ejemplo.test', data: { layout: 'cover' } }]
    })
    expect(leerEspecificacion(conUrl)).toEqual({ admitida: false, motivo: 'invalida' })
    expect(leerEspecificacion(null)).toEqual({ admitida: false, motivo: 'invalida' })
  })
})
