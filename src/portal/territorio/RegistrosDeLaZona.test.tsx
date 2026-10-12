import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { permisos } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { ANALISTA_SIG } from '../../test/sig'
import { OBJETOS_DE_LA_ZONA, RegistrosDeLaZona } from './RegistrosDeLaZona'

// los registros de una zona (spec F6 §3.1, ZoneCriterion): solo los objetos que la cuenta lee, con su enlace a la ficha
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

// las llamadas a la API de SGSPE: montar también lee las preferencias de la sesión
const consultas = () => red!.llamadas.filter((l) => l.ruta.startsWith('/sgspe/'))

describe('registros de la zona', () => {
  it('ofrece los objetos legibles, pide el elegido con el periodo y enlaza cada registro a su ficha', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/territory/zones/locality/l1/records',
        body: { ...pagina([registro('cm1', { project: 'p1', code: 'C-001', title: 'Reservorio de agua' }, { state: 'approved' })]), available: true }
      }
    ])
    red = espiarRed()
    montar(<RegistrosDeLaZona zona="locality" id="l1" periodo={{ periodEnd: '2026-09-30' }} />, {
      usuario: ANALISTA_SIG,
      permisos: permisos({ commitment: ['READ'], grievance: ['READ'] })
    })
    const elegir = await screen.findByLabelText('Qué registros')
    expect(
      within(elegir)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Compromisos', 'Quejas'])
    const tabla = await screen.findByRole('table', { name: 'Registros del lugar' })
    expect(await within(tabla).findByRole('link', { name: 'C-001 · Reservorio de agua' })).toHaveAttribute('href', '/projects/p1/commitments/cm1')
    expect(consultas()[0].ruta).toBe('/sgspe/territory/zones/locality/l1/records?of=commitment&periodEnd=2026-09-30&size=25')
    await userEvent.selectOptions(elegir, 'grievance')
    await waitFor(() => expect(consultas().some((l) => l.ruta.includes('of=grievance'))).toBe(true))
  })

  it('ofrece los nueve objetos de la zona, las señales de alerta incluidas', () => {
    expect(OBJETOS_DE_LA_ZONA).toHaveLength(9)
    montar(<RegistrosDeLaZona zona="locality" id="l1" />, {
      usuario: ANALISTA_SIG,
      permisos: permisos(Object.fromEntries(OBJETOS_DE_LA_ZONA.map((o) => [o, ['READ']])))
    })
    expect(within(screen.getByLabelText('Qué registros')).getAllByRole('option')).toHaveLength(9)
    expect(within(screen.getByLabelText('Qué registros')).getByRole('option', { name: 'Señales de alerta' })).toBeInTheDocument()
  })

  it('los grupos de interés y los riesgos se piden sin periodo y lo dicen', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/zones/community/c1/records', body: { ...pagina([]), available: true } }])
    red = espiarRed()
    montar(<RegistrosDeLaZona zona="community" id="c1" periodo={{ periodStart: '2026-07-01' }} />, {
      usuario: ANALISTA_SIG,
      permisos: permisos({ stakeholder: ['READ'], commitment: ['READ'] })
    })
    const elegir = await screen.findByLabelText('Qué registros')
    expect(screen.queryByText('Estos registros no tienen fecha: se muestran sin el periodo del mapa.')).not.toBeInTheDocument()
    await userEvent.selectOptions(elegir, 'stakeholder')
    expect(await screen.findByText('Estos registros no tienen fecha: se muestran sin el periodo del mapa.')).toBeInTheDocument()
    await waitFor(() => expect(consultas().map((l) => l.ruta)).toContain('/sgspe/territory/zones/community/c1/records?of=stakeholder&size=25'))
  })

  it('una lista incompleta lo avisa con lo que falta leer, nunca como completa', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/territory/zones/locality/l1/records',
        body: { ...pagina([]), available: false, missingFields: ['commitment.locality'] }
      }
    ])
    montar(<RegistrosDeLaZona zona="locality" id="l1" />, { usuario: ANALISTA_SIG, permisos: permisos({ commitment: ['READ'] }) })
    expect(await screen.findByText('La lista puede estar incompleta: falta leer commitment.locality.')).toBeInTheDocument()
    expect(screen.queryByText('No hay registros de este tipo en el lugar.')).not.toBeInTheDocument()
  })

  it('pagina con «Siguiente» y manda page desde la segunda', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/territory/zones/locality/l1/records',
        body: { ...pagina([registro('cm1', { project: 'p1', code: 'C-001' })], { totalPages: 2, totalElements: 26 }), available: true }
      }
    ])
    red = espiarRed()
    montar(<RegistrosDeLaZona zona="locality" id="l1" />, { usuario: ANALISTA_SIG, permisos: permisos({ commitment: ['READ'] }) })
    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(consultas().map((l) => l.ruta)).toContain('/sgspe/territory/zones/locality/l1/records?of=commitment&page=1&size=25'))
  })

  it('un 404 ZONE_NOT_FOUND se dice con su texto', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/territory/zones/locality/l1/records',
        status: 404,
        body: { title: 'Not Found', status: 404, detail: 'No existe', errors: [{ field: 'id', message: 'ZONE_NOT_FOUND' }] }
      }
    ])
    montar(<RegistrosDeLaZona zona="locality" id="l1" />, { usuario: ANALISTA_SIG, permisos: permisos({ commitment: ['READ'] }) })
    expect(await screen.findByText('La zona no existe o no está a su alcance.')).toBeInTheDocument()
  })

  it('sin objetos legibles no se ofrece nada', () => {
    montar(<RegistrosDeLaZona zona="community" id="c1" />, { usuario: ANALISTA_SIG, permisos: permisos({ community: ['READ'] }) })
    expect(screen.getByText('Su cuenta no puede leer registros de este lugar.')).toBeInTheDocument()
  })
})
