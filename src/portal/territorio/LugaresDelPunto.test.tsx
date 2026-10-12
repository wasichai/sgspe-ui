import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { ANALISTA_SIG, EQUIPO_SIG, UBICADOS } from '../../test/sig'
import { LugaresDelPunto } from './LugaresDelPunto'

// el punto en polígono (caso 16 de gis.md §5.3): propone, la persona confirma
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('lugares del punto', () => {
  it('propone la unidad, la localidad y la comunidad y solo las usa al confirmar', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/locate', body: UBICADOS }])
    const usar = vi.fn()
    montar(<LugaresDelPunto punto={[-78.5, -7.9]} alUsar={usar} />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    expect(await screen.findByText('Distrito Ejemplo')).toBeInTheDocument()
    expect(screen.getByText('(DISTRITO)')).toBeInTheDocument()
    expect(screen.getByText('Localidad Ejemplo')).toBeInTheDocument()
    expect(screen.getByText('(CASERIO)')).toBeInTheDocument()
    expect(screen.getByText('Comunidad Ejemplo')).toBeInTheDocument()
    expect(usar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Usar estos lugares' }))
    expect(usar).toHaveBeenCalledWith({ locality: UBICADOS.locality, community: UBICADOS.community })
  })

  it('una localidad sin límite no se propone y se dice sin tratarlo como error', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/locate', body: { ...UBICADOS, locality: null } }])
    montar(<LugaresDelPunto punto={[-78.5, -7.9]} alUsar={vi.fn()} />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    expect(await screen.findByText(/Solo se propone una localidad que tenga límite registrado/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar estos lugares' })).toBeInTheDocument()
  })

  it('un objeto no disponible dice «No disponible» y no «Ninguno»', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/locate', body: { ...UBICADOS, community: null, unavailable: ['community'] } }])
    montar(<LugaresDelPunto punto={[-78.5, -7.9]} alUsar={vi.fn()} />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByText('Ninguno')).not.toBeInTheDocument()
  })

  it('un punto que no cae en ningún lugar lo dice y no ofrece usar nada', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/locate', body: { administrativeUnit: null, locality: null, community: null, unavailable: [] } }])
    montar(<LugaresDelPunto punto={[-78.5, -7.9]} alUsar={vi.fn()} />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    expect(await screen.findByText('El punto no cae en ningún lugar registrado que su cuenta lea.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Usar estos lugares' })).not.toBeInTheDocument()
  })

  it('sin punto no pide nada ni dibuja nada', () => {
    fetch = mockFetch([])
    const { container } = montar(<LugaresDelPunto punto={null} alUsar={vi.fn()} />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    expect(container).toBeEmptyDOMElement()
    expect(fetch.calls.filter((c) => c.url.includes('/sgspe/'))).toEqual([])
  })
})
