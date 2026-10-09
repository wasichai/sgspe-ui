import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { useRegistro } from '../datos/registros'
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

  it('muestra todos los errores de campo reconocidos, cada uno con su etiqueta, no solo el primero', async () => {
    fetch = mockFetch([{ path: '/metadata/objects/community', body: COMUNIDAD }])
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/community/records',
        responder: () =>
          problema(400, 'Revise los datos', [
            { field: 'registered_members_count', message: 'DERIVED_FIELD' },
            { field: 'registered_members_count', message: 'INVALID_NUMBER' },
            { field: 'calculated_area_ha', message: 'DERIVED_FIELD' },
            { field: 'name', message: 'EXACTLY_ONE' }
          ])
      }
    ])
    montar(<FormularioDeRegistro objeto="community" />)
    await userEvent.type(await screen.findByLabelText(/^Nombre/), 'CC Tunas Pampa')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const derivado = 'Ese dato lo calcula el sistema: no se escribe a mano.'
    const aviso = await screen.findByText(new RegExp(`^Comuneros inscritos: ${derivado} Escriba un número\\.`))
    // dos violaciones del mismo campo se unen en lugar de pisarse
    expect(aviso).toHaveTextContent(`Área calculada: ${derivado}`)
    expect(aviso).toHaveTextContent(/Nombre: Indique exactamente uno/)
    // los campos se separan con «; » (un salto de línea lo colapsa el HTML) y el aviso es un solo texto
    expect(aviso.textContent).not.toContain('\n')
    expect(aviso.textContent).toMatch(/número\.; Área calculada: /)
    expect(screen.queryByText(/DERIVED_FIELD|EXACTLY_ONE/)).not.toBeInTheDocument()
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

  describe('un 412 al cambiar (revisión final, I2)', () => {
    const SECTOR = definicion('community_sector', [['name', { label: 'Nombre' }]])
    const V1 = registro('s1', { name: 'Sector alto' }, { updatedAt: '2026-10-06T10:00:00Z' })
    const V2 = registro('s1', { name: 'Sector alto' }, { updatedAt: '2026-10-06T11:00:00Z' })
    // como en una ficha: el registro sale de su consulta, así que la relectura le llega al formulario
    function Ficha() {
      const sector = useRegistro('community_sector', 's1')
      return sector.data ? <FormularioDeRegistro objeto="community_sector" registro={sector.data} /> : null
    }
    // la primera lectura es V1; las siguientes, lo que diga `relectura`
    const montarConConflicto = (relectura: () => Response | Promise<Response>) => {
      fetch = mockFetch([{ path: '/metadata/objects/community_sector', body: SECTOR }])
      let lecturas = 0
      let cambios = 0
      red = espiarRed([
        { path: '/objects/community_sector/records/s1', responder: () => (++lecturas === 1 ? jsonResponse(V1) : relectura()) },
        {
          method: 'PUT',
          path: '/objects/community_sector/records/s1',
          responder: () => (++cambios === 1 ? problema(412, 'Precondition Failed') : jsonResponse(V2))
        }
      ])
      montar(<Ficha />)
    }
    const hastaElConflicto = async () => {
      const nombre = await screen.findByLabelText('Nombre')
      await userEvent.clear(nombre)
      await userEvent.type(nombre, 'Sector bajo')
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/Otra persona cambió este registro/)
    }

    it('«Recargar» relee, conserva lo escrito y el siguiente guardado lleva la versión nueva', async () => {
      let suelta!: () => void
      const espera = new Promise<void>((r) => (suelta = r))
      montarConConflicto(async () => {
        await espera
        return jsonResponse(V2)
      })
      await hastaElConflicto()
      await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
      // el aviso sigue mientras la relectura no llega: un guardado ahora mandaría la versión vieja
      expect(screen.getByRole('button', { name: 'Recargar' })).toBeDisabled()
      expect(screen.getByRole('alert')).toBeInTheDocument()
      suelta()
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
      expect(screen.getByLabelText('Nombre')).toHaveValue('Sector bajo')
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
      await waitFor(() => expect(red!.a('PUT', '/objects/community_sector/records/s1')).toHaveLength(2))
      const [primero, segundo] = red!.a('PUT', '/objects/community_sector/records/s1')
      expect(primero.cabeceras.get('If-Match')).toBe('"2026-10-06T10:00:00Z"')
      expect(segundo.cabeceras.get('If-Match')).toBe('"2026-10-06T11:00:00Z"')
      expect(segundo.cuerpo).toEqual({ attributes: { name: 'Sector bajo' } })
    })

    it('tras «Recargar», guardar no pisa lo que la otra persona cambió en un campo que no se tocó (re-revisión, N1)', async () => {
      // A abre con delegates_count 3 y edita solo el nombre; B guarda delegates_count 9 antes
      const DEF = definicion('community_sector', [
        ['name', { label: 'Nombre' }],
        ['delegates_count', { label: 'Delegados', type: 'INTEGER' }]
      ])
      const DE_A = registro('s1', { name: 'Sector alto', delegates_count: 3 }, { updatedAt: '2026-10-06T10:00:00Z' })
      const DE_B = registro('s1', { name: 'Sector alto', delegates_count: 9 }, { updatedAt: '2026-10-06T11:00:00Z' })
      fetch = mockFetch([{ path: '/metadata/objects/community_sector', body: DEF }])
      let lecturas = 0
      let cambios = 0
      red = espiarRed([
        { path: '/objects/community_sector/records/s1', responder: () => jsonResponse(++lecturas === 1 ? DE_A : DE_B) },
        {
          method: 'PUT',
          path: '/objects/community_sector/records/s1',
          responder: () => (++cambios === 1 ? problema(412, 'Precondition Failed') : jsonResponse(DE_B))
        }
      ])
      montar(<Ficha />)
      await hastaElConflicto()
      await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
      await waitFor(() => expect(red!.a('PUT', '/objects/community_sector/records/s1')).toHaveLength(2))
      const segundo = red!.a('PUT', '/objects/community_sector/records/s1')[1]
      expect(segundo.cabeceras.get('If-Match')).toBe('"2026-10-06T11:00:00Z"')
      expect(segundo.cuerpo).toEqual({ attributes: { name: 'Sector bajo', delegates_count: 9 } })
    })

    it('si la relectura falla, lo dice, el aviso se queda y lo escrito sigue', async () => {
      montarConConflicto(() => problema(404, 'No se encontró'))
      await hastaElConflicto()
      await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
      expect(await screen.findByText(/No se pudo recargar; lo escrito se conserva\. El registro no existe/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Recargar' })).toBeEnabled()
      expect(screen.getByLabelText('Nombre')).toHaveValue('Sector bajo')
    })
  })

  it('el error del formulario se anuncia (role="alert"), no es un párrafo mudo (revisión final, M11)', async () => {
    fetch = mockFetch([{ path: '/metadata/objects/community', body: COMUNIDAD }])
    red = espiarRed([{ method: 'POST', path: '/objects/community/records', responder: () => problema(400, 'Revise los datos') }])
    montar(<FormularioDeRegistro objeto="community" />)
    await userEvent.type(await screen.findByLabelText(/^Nombre/), 'CC Tunas Pampa')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revise los datos')
  })
})
