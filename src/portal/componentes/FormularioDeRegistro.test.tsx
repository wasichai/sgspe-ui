import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { FormularioDeRegistro } from './FormularioDeRegistro'

// screens.md §2: el formulario sale de la metadata; SGSPE no manda derivados (DerivedFieldsGuard, api.md §2) ni
// geometrías en attributes, y al cambiar manda If-Match con la versión leída
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const COMUNIDAD = definicion('community', [
  ['name', { label: 'Nombre', required: true }],
  ['community_type', { label: 'Tipo de comunidad', type: 'ENUM', enumOptions: ['COMUNIDAD CAMPESINA'] }],
  ['calculated_area_ha', { label: 'Área calculada', type: 'DECIMAL' }],
  ['territory', { label: 'Territorio', type: 'GEOMETRY' }],
  ['registered_members_count', { label: 'Comuneros inscritos', type: 'INTEGER' }]
])

describe('FormularioDeRegistro', () => {
  it('no muestra ni manda derivados ni geometrías', async () => {
    fetch = mockFetch([
      { path: '/metadata/objects/community', body: COMUNIDAD },
      { method: 'POST', path: '/objects/community/records', body: registro('c1', { name: 'CC Tunas Pampa' }) }
    ])
    red = espiarRed()
    const guardado = vi.fn()
    montar(<FormularioDeRegistro objeto="community" alGuardar={guardado} />)
    await userEvent.type(await screen.findByLabelText(/^Nombre/), 'CC Tunas Pampa')
    expect(screen.queryByLabelText('Área calculada')).not.toBeInTheDocument()
    expect(screen.queryByText('Territorio')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(guardado).toHaveBeenCalled())
    const [alta] = red.a('POST', '/objects/community/records')
    expect(alta.cuerpo).toEqual({ attributes: { name: 'CC Tunas Pampa', community_type: null, registered_members_count: null } })
  })

  it('un 400 de una guarda dice el texto del código junto a la etiqueta de su campo, nunca el código', async () => {
    fetch = mockFetch([{ path: '/metadata/objects/community', body: COMUNIDAD }])
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/community/records',
        responder: () => problema(400, 'Un campo derivado no se envía', [{ field: 'registered_members_count', message: 'DERIVED_FIELD' }])
      }
    ])
    montar(<FormularioDeRegistro objeto="community" />)
    await userEvent.type(await screen.findByLabelText(/^Nombre/), 'CC Tunas Pampa')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Comuneros inscritos: Ese dato lo calcula el sistema: no se escribe a mano.')).toBeInTheDocument()
    expect(screen.queryByText(/DERIVED_FIELD/)).not.toBeInTheDocument()
  })

  it('las relaciones fijas viajan ocultas y un cambio lleva la versión leída', async () => {
    fetch = mockFetch([
      {
        path: '/metadata/objects/community_sector',
        body: definicion('community_sector', [
          ['name', { label: 'Nombre' }],
          ['community', { label: 'Comunidad', type: 'RELATION', relationTarget: 'community' }]
        ])
      },
      { method: 'PUT', path: '/objects/community_sector/records/s1', body: registro('s1', {}) },
      { path: '/objects/community_sector/records/s1', body: registro('s1', { name: 'Sector bajo' }) }
    ])
    red = espiarRed()
    // las relaciones son UUID: Zod las valida aunque viajen ocultas
    const comunidad = '6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f'
    const sector = registro('s1', { name: 'Sector alto', community: comunidad }, { updatedAt: '2026-10-06T10:00:00Z' })
    montar(<FormularioDeRegistro objeto="community_sector" registro={sector} fijos={{ community: comunidad }} />)
    const nombre = await screen.findByLabelText('Nombre')
    expect(screen.queryByText('Comunidad')).not.toBeInTheDocument()
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Sector bajo')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/community_sector/records/s1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/community_sector/records/s1')
    expect(cambio.cabeceras.get('If-Match')).toBe('"2026-10-06T10:00:00Z"')
    expect(cambio.cuerpo).toEqual({ attributes: { name: 'Sector bajo', community: comunidad } })
  })
})
