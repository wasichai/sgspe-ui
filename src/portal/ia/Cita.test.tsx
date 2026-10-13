import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeIa, CANDIDATO_IA, EQUIPO_IA, GERENCIA_IA, SIN_DESCARGA, SUG_CLASIFICACION } from '../../test/ia'
import { montar, registro } from '../../test/montar'
import { CitaDelCandidato, CitaDeLaSugerencia } from './Cita'
import { referenciaDe } from './fuentes'

// la cita y el enlace a la fuente solo para quien puede abrirla (ai-architecture.md §9.3): descargar la evidencia o, si la fuente
// es la minuta, leer minutes; si no, «Fuente restringida». la fuente de una sugerencia sale de su ai_interaction (decisión 8)
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const montarCon = (ui: React.ReactElement, rutas: MockRoute[] = [], permisos = EQUIPO_IA) => {
  fetch = mockFetch([...rutas, ...baseDeIa()])
  return montar(ui, { usuario: GERENCIA_IA, permisos })
}

describe('la cita y su fuente', () => {
  it('lee la referencia de la interacción: objeto e id al comienzo', () => {
    expect(referenciaDe('evidence:ev1 sha256:0f3a')).toEqual({ objeto: 'evidence', id: 'ev1' })
    expect(referenciaDe('engagement:e1@2026-10-05T15:00:00Z')).toEqual({ objeto: 'engagement', id: 'e1' })
    expect(referenciaDe('sha256 de la pregunta')).toBeNull()
    expect(referenciaDe('')).toBeNull()
    // AI-05: input_reference es la huella de la pregunta, no un registro
    expect(referenciaDe('sha256:0f3a9c')).toBeNull()
  })

  it('quien descarga el acta ve la cita re-identificada y el enlace a la fuente', async () => {
    montarCon(<CitaDelCandidato candidato={CANDIDATO_IA} etiqueta="Cita" />)
    expect(await screen.findByText('Ana Ejemplo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir la fuente' })).toHaveAttribute('href', '/r/evidence/ev1')
  })

  it('sin descargar la evidencia, la cita dice Fuente restringida y no hay enlace', async () => {
    montarCon(<CitaDelCandidato candidato={CANDIDATO_IA} etiqueta="Cita" />, [], SIN_DESCARGA)
    expect(await screen.findByText('Fuente restringida')).toBeInTheDocument()
    expect(screen.queryByText(/reservorio/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir la fuente' })).not.toBeInTheDocument()
  })

  it('la cita de un campo que la cuenta no lee dice Restringido', () => {
    const sinCita = Object.fromEntries(Object.entries(CANDIDATO_IA.attributes).filter(([campo]) => campo !== 'evidence_quote'))
    montarCon(<CitaDelCandidato candidato={{ ...CANDIDATO_IA, attributes: sinCita }} etiqueta="Cita" />)
    expect(screen.getByText('Restringido')).toBeInTheDocument()
  })

  it('una sugerencia sobre una queja cita la queja, si se lee', async () => {
    montarCon(<CitaDeLaSugerencia sugerencia={SUG_CLASIFICACION} etiqueta="Cita" />)
    expect(await screen.findByText('Falta agua en el anexo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir la fuente' })).toHaveAttribute('href', '/r/grievance/g1')
  })

  it('una sugerencia cuya interacción no se lee tiene la fuente restringida', async () => {
    montarCon(<CitaDeLaSugerencia sugerencia={SUG_CLASIFICACION} etiqueta="Cita" />, [
      { path: '/objects/ai_interaction/records/ai2', status: 404, body: { title: 'Not Found', status: 404 } }
    ])
    expect(await screen.findByText('Fuente restringida')).toBeInTheDocument()
  })

  it('la minuta como fuente se abre solo si se lee el acta; un candidato sin fuente muestra su cita sin enlace', async () => {
    const sobreLaMinuta = registro('k5', { project: 'p1', proposed_text: 'x', evidence_quote: 'Se acordó el reservorio', engagement: 'e2' })
    const humano = registro('k6', { project: 'p1', proposed_text: 'y', evidence_quote: 'Pintar la escuela', ai_generated: false })
    montarCon(
      <>
        <CitaDelCandidato candidato={sobreLaMinuta} etiqueta="Cita" />
        <CitaDelCandidato candidato={humano} etiqueta="Cita" />
      </>,
      [{ path: '/objects/engagement/records/e2', body: registro('e2', { project: 'p1', title: 'Taller' }) }]
    )
    expect(await screen.findByText('Fuente restringida')).toBeInTheDocument()
    expect(screen.getByText('Pintar la escuela')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir la fuente' })).not.toBeInTheDocument()
  })
})
