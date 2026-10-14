import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeIa, EQUIPO_IA, ESTADO_ACTIVO, ESTADO_SIN_ORGANIZACION, GERENCIA_IA, P1, SUG_RESUMEN } from '../../test/ia'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { ProveedorDelAsistente } from './Asistente'
import { ResumenEjecutivo } from './ResumenEjecutivo'

// el resumen ejecutivo de S08 (AI-04): el último del proyecto con su fecha y su marca; generarlo de nuevo corre AI-04 sobre el
// proyecto; copiar copia lo que se ve; sin IA la tarjeta no aparece
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
  vi.unstubAllGlobals()
})

const NUEVO = registro(
  's11',
  { ...SUG_RESUMEN.attributes, suggested_value: '## Resumen\nLo pidió [PERSONA:pe1] en la asamblea.' },
  { state: 'proposed', createdAt: '2026-10-12T15:00:00Z' }
)

const montarResumen = (estado: unknown = ESTADO_ACTIVO) => {
  fetch = mockFetch(baseDeIa(estado))
  let generado = false
  red = espiarRed([
    { path: '/objects/ai_suggestion/records', responder: () => jsonResponse(pagina([generado ? NUEVO : SUG_RESUMEN])) },
    {
      method: 'POST',
      path: '/sgspe/ai/runs',
      responder: () => {
        generado = true
        return jsonResponse({ interaction: 'ai7', interactions: ['ai7'], suggestions: [NUEVO], candidates: [] }, 201)
      }
    }
  ])
  montar(
    <ProveedorDelAsistente>
      <ResumenEjecutivo proyecto={P1} />
    </ProveedorDelAsistente>,
    { ruta: '/projects/p1/overview', usuario: GERENCIA_IA, permisos: EQUIPO_IA }
  )
}

describe('S08 · resumen ejecutivo', () => {
  it('muestra el último resumen con su fecha y la marca de resumen de IA', async () => {
    montarResumen()
    const tarjeta = await screen.findByRole('region', { name: 'Resumen ejecutivo' })
    expect(await within(tarjeta).findByText('El proyecto tuvo cuatro interacciones en el periodo.')).toBeInTheDocument()
    expect(within(tarjeta).getByText(/^Redactado el /)).toBeInTheDocument()
    expect(within(tarjeta).getByText('Resumen de IA')).toBeInTheDocument()
    expect(red!.a('GET', '/objects/ai_suggestion/records')[0].ruta).toContain('suggestion_kind=RESUMEN+EJECUTIVO')
  })

  it('generar de nuevo corre AI-04 sobre el proyecto con su clave y muestra el resumen nuevo', async () => {
    montarResumen()
    const tarjeta = await screen.findByRole('region', { name: 'Resumen ejecutivo' })
    await userEvent.click(await within(tarjeta).findByRole('button', { name: 'Generar de nuevo' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai/runs')).toHaveLength(1))
    const [corrida] = red!.a('POST', '/sgspe/ai/runs')
    expect(corrida.cuerpo).toEqual({ useCase: 'AI-04', target: { object: 'project', recordId: 'p1' } })
    expect(corrida.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(await within(tarjeta).findByText('Ana Ejemplo')).toBeInTheDocument()
  })

  it('copiar copia el texto como se ve, con los nombres re-identificados', async () => {
    const copiar = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: copiar } })
    montarResumen()
    const tarjeta = await screen.findByRole('region', { name: 'Resumen ejecutivo' })
    await userEvent.click(await within(tarjeta).findByRole('button', { name: 'Generar de nuevo' }))
    await within(tarjeta).findByText('Ana Ejemplo')
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Copiar' }))
    await waitFor(() => expect(copiar).toHaveBeenCalledWith('## Resumen\nLo pidió Ana Ejemplo en la asamblea.'))
    expect(within(tarjeta).getByText('Copiado.')).toBeInTheDocument()
  })

  it('preguntar a los documentos abre el asistente en ese modo con el proyecto', async () => {
    montarResumen()
    const tarjeta = await screen.findByRole('region', { name: 'Resumen ejecutivo' })
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Preguntar a los documentos' }))
    const panel = await screen.findByRole('dialog', { name: 'Asistente de IA' })
    expect(within(panel).getByRole('tab', { name: 'Preguntar a los documentos' })).toHaveAttribute('aria-selected', 'true')
  })

  it('sin IA en la organización la tarjeta no aparece', async () => {
    montarResumen(ESTADO_SIN_ORGANIZACION)
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/sgspe/ai/status')).toBe(true))
    expect(screen.queryByRole('region', { name: 'Resumen ejecutivo' })).not.toBeInTheDocument()
  })
})
