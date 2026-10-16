import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeF8, CIERRE, TABLERO_MONITOREO } from '../../test/f8'
import { montar } from '../../test/montar'
import { ADMIN_PERMISOS, ADMINISTRACION, GERENCIA_SOCIAL } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { MonitoreoPage } from './MonitoreoPage'

// el monitoreo de la Tabla 9.5 (dashboards.md §5.5 y §10): el mes anterior en Lima por defecto, la cifra oficial marcada, la
// meta con su origen y el cierre de periodo con cada respuesta del servidor dicha en su texto
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-16T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const RUTAS = [{ path: '/sgspe/dashboards/monitoring', body: TABLERO_MONITOREO }]
const abrir = (ruta = '/dashboards/monitoring', usuario = GERENCIA_SOCIAL, permisos = CIERRE, especiales: Parameters<typeof espiarRed>[0] = []) => {
  fetch = mockFetch([...RUTAS, ...baseDeF8(usuario)])
  red = espiarRed(especiales)
  montar(<MonitoreoPage />, { ruta, usuario, permisos })
}
const fila = async (numero: string) => {
  const tabla = await screen.findByRole('table', { name: 'Monitoreo de la Tabla 9.5' })
  await within(tabla).findByText('Grupos de interés contactados, por sexo, ámbito e institución')
  return within(tabla)
    .getAllByRole('row')
    .find((r) => within(r).queryAllByRole('cell')[0]?.textContent === numero)!
}

describe('Monitoreo de la Tabla 9.5', () => {
  it('pide el mes anterior en Lima, marca la cifra oficial y dice la meta con su origen', async () => {
    abrir()
    const primera = await fila('1')
    expect(within(primera).getByText('Oficial: 13')).toBeInTheDocument()
    expect(screen.getByText('Periodo cerrado: las filas con cifra oficial la muestran marcada.')).toBeInTheDocument()
    const llamada = red!.a('GET', '/sgspe/dashboards/monitoring')[0]
    expect(llamada.ruta).toContain('periodStart=2026-09-01')
    expect(llamada.ruta).toContain('periodEnd=2026-09-30')
    expect(within(await fila('2')).getByText('No disponible')).toBeInTheDocument()
    const quinta = await fila('5')
    expect(within(quinta).getByText('Del proyecto')).toBeInTheDocument()
    expect(within(quinta).getByText('Sin cerrar')).toBeInTheDocument()
    expect(within(primera).getByRole('link', { name: 'Grupos de interés contactados, por sexo, ámbito e institución' })).toHaveAttribute(
      'href',
      '/dashboards/indicators/KPI-STK-04?periodStart=2026-09-01&periodEnd=2026-09-30'
    )
  })

  it('cierra el periodo del proyecto con el indicador del catálogo y dice la cifra oficial', async () => {
    abrir('/dashboards/monitoring?project=p1', GERENCIA_SOCIAL, CIERRE, [
      { method: 'POST', path: '/sgspe/indicators/i-eng02/measurements', responder: () => jsonResponse({ id: 'm9', attributes: { measured_value: 3 } }, 201) }
    ])
    await userEvent.click(within(await fila('5')).getByRole('button', { name: 'Cerrar periodo…' }))
    const dialogo = screen.getByRole('dialog', { name: 'Cerrar el periodo de Reuniones sostenidas al mes (al menos 2)' })
    expect(within(dialogo).getByText('Solo el proyecto PRJ-01 · Proyecto Ejemplo A')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar periodo' }))
    expect(await within(dialogo).findByText('Periodo cerrado: la cifra oficial es 3.')).toBeInTheDocument()
    const [cierre] = red!.a('POST', '/sgspe/indicators/i-eng02/measurements')
    expect(cierre.cuerpo).toEqual({ project: 'p1', attributes: { period_start_date: '2026-09-01', period_end_date: '2026-09-30' } })
    expect(cierre.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it.each([
    [problema(409, 'x', [{ field: 'indicator', message: 'INDICATOR_NOT_CLOSABLE' }]), 'STANCE', /leen la postura/],
    [problema(409, 'x', [{ field: 'indicator', message: 'INDICATOR_NOT_CLOSABLE' }]), 'NO_SCALAR_VALUE', /no tiene una cifra única/],
    [problema(400, 'x', [{ field: 'attributes.period_end_date', message: 'PERIOD_NOT_ENDED' }]), null, /todavía no terminó/],
    [problema(409, 'x', [{ field: 'attributes.period_start_date', message: 'MEASUREMENT_EXISTS' }]), null, /ya está cerrado/]
  ])('explica cada rechazo del cierre en su texto (%#)', async (respuesta, razon, texto) => {
    abrir('/dashboards/monitoring?project=p1', GERENCIA_SOCIAL, CIERRE, [
      {
        method: 'POST',
        path: '/sgspe/indicators/i-eng02/measurements',
        responder: async () => {
          if (!razon) return respuesta
          const cuerpo = (await respuesta.json()) as Record<string, unknown>
          return new Response(JSON.stringify({ ...cuerpo, reason: razon }), { status: 409, headers: { 'Content-Type': 'application/problem+json' } })
        }
      }
    ])
    await userEvent.click(within(await fila('5')).getByRole('button', { name: 'Cerrar periodo…' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar periodo' }))
    expect(await within(dialogo).findByText(texto)).toBeInTheDocument()
  })

  it('toda la organización solo la cierra la administración', async () => {
    abrir()
    await userEvent.click(within(await fila('5')).getByRole('button', { name: 'Cerrar periodo…' }))
    let dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('Cerrar para toda la organización solo lo hace la administración. Elija un proyecto en el filtro.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cerrar periodo' })).toBeDisabled()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    cleanup()
    fetch!.restore()
    red!.restaurar()
    abrir('/dashboards/monitoring', ADMINISTRACION, ADMIN_PERMISOS, [
      { method: 'POST', path: '/sgspe/indicators/i-eng02/measurements', responder: () => jsonResponse({ id: 'm9', attributes: { measured_value: 3 } }, 201) }
    ])
    await userEvent.click(within(await fila('5')).getByRole('button', { name: 'Cerrar periodo…' }))
    dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('Toda la organización')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar periodo' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/indicators/i-eng02/measurements')[0]?.cuerpo).toMatchObject({ project: null }))
  })

  it('sin CREATE sobre las mediciones no ofrece cerrar; una fila sin indicatorId dice por qué', async () => {
    abrir('/dashboards/monitoring?project=p1', GERENCIA_SOCIAL, { admin: false, objects: { indicator: ['READ'], project: ['READ'] } })
    expect(within(await fila('5')).queryByRole('button', { name: 'Cerrar periodo…' })).not.toBeInTheDocument()
    fetch!.restore()
    red!.restaurar()
    document.body.innerHTML = ''
    abrir('/dashboards/monitoring?project=p1')
    const boton = within(await fila('6')).getByRole('button', { name: 'Cerrar periodo…' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('title', 'El catálogo de indicadores no tiene este indicador o su cuenta no lo lee.')
  })
})
