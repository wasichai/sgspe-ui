import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { ANALISTA_SIG, EQUIPO_SIG, PREDIOS_AFECTADOS } from '../../test/sig'
import { AnalisisDelProyecto, capaDeComponente } from './AnalisisDelProyecto'

// el panel «Análisis» de S09 (spec F6 §3.7, gis.md §5.3): seis tablas por SpatialGate; los titulares solo para quien los lee y
// un permiso secundario que falta se dice, nunca como cero
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const RUTA = '/sgspe/territory/projects/p1'
const sinPredios = { path: `${RUTA}/component-parcels`, body: { available: true, truncated: false, rows: [] } }

const panel = (resaltar = vi.fn()) => {
  montar(<AnalisisDelProyecto proyecto="p1" alResaltar={resaltar} />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
  return resaltar
}

describe('S09 · análisis', () => {
  it('los predios afectados traen sus titulares vigentes con enlace, «Sin titulares» si no hay y cada fila resalta su predio', async () => {
    fetch = mockFetch([{ path: `${RUTA}/component-parcels`, body: PREDIOS_AFECTADOS }])
    const resaltar = panel()
    const tabla = await screen.findByRole('table', { name: 'Predios afectados' })
    const [, uno, dos] = within(tabla).getAllByRole('row')
    expect(uno).toHaveTextContent('PLT-01')
    expect(uno).toHaveTextContent('PR-001')
    expect(uno).toHaveTextContent('0.42')
    expect(within(uno).getByRole('link', { name: 'Titular Ejemplo Uno' })).toHaveAttribute('href', '/r/person/pe1')
    expect(dos).toHaveTextContent('Sin titulares registrados')
    expect(screen.queryByText('Su cuenta no lee una parte de estos datos: la tabla puede estar incompleta.')).not.toBeInTheDocument()
    await userEvent.click(within(uno).getByRole('button', { name: 'Ver PR-001 en el mapa' }))
    expect(resaltar).toHaveBeenCalledWith('land_parcel', 'lp1', 'LYR-14')
  })

  it('sin leer los derechos, los titulares son «Restringido» (nunca vacíos) y la tabla avisa que está incompleta', async () => {
    fetch = mockFetch([
      {
        path: `${RUTA}/component-parcels`,
        body: {
          ...PREDIOS_AFECTADOS,
          available: false,
          missingFields: ['land_right.holder_person'],
          rows: PREDIOS_AFECTADOS.rows.map((r) => ({ ...r, holders: null }))
        }
      }
    ])
    panel()
    const tabla = await screen.findByRole('table', { name: 'Predios afectados' })
    const [, uno, dos] = within(tabla).getAllByRole('row')
    expect(within(uno).getByText('Restringido')).toBeInTheDocument()
    expect(within(dos).getByText('Restringido')).toBeInTheDocument()
    expect(dos).not.toHaveTextContent('Sin titulares registrados')
    expect(screen.getByText('Su cuenta no lee una parte de estos datos: la tabla puede estar incompleta.')).toBeInTheDocument()
  })

  it('un predio de la empresa se resalta en su capa y una lista recortada lo avisa', async () => {
    fetch = mockFetch([
      {
        path: `${RUTA}/component-parcels`,
        body: {
          available: true,
          truncated: true,
          rows: [PREDIOS_AFECTADOS.rows[0], { ...PREDIOS_AFECTADOS.rows[0], parcel: { id: 'lp9', code: 'PR-009', tenureType: 'PROPIEDAD DE LA EMPRESA' } }]
        }
      }
    ])
    const resaltar = panel()
    expect(await screen.findByText('Se muestran las primeras 2 filas: hay más resultados de los que caben en una consulta.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver PR-009 en el mapa' }))
    expect(resaltar).toHaveBeenCalledWith('land_parcel', 'lp9', 'LYR-15')
  })

  it('el territorio comunal resalta el componente en la capa de su tipo', async () => {
    fetch = mockFetch([
      sinPredios,
      {
        path: `${RUTA}/component-communal-land`,
        body: {
          available: true,
          truncated: false,
          rows: [
            {
              component: { id: 'pc2', code: 'ACC-01', componentType: 'ACCESO' },
              community: { id: 'c1', name: 'Comunidad Ejemplo' },
              areaHa: null,
              lengthM: 340.5
            }
          ]
        }
      }
    ])
    const resaltar = panel()
    await userEvent.click(await screen.findByRole('tab', { name: 'Territorio comunal' }))
    const tabla = await screen.findByRole('table', { name: 'Territorio comunal' })
    const [, uno] = within(tabla).getAllByRole('row')
    expect(uno).toHaveTextContent('Comunidad Ejemplo')
    expect(uno).toHaveTextContent('340.5')
    await userEvent.click(within(uno).getByRole('button', { name: 'Ver ACC-01 en el mapa' }))
    expect(resaltar).toHaveBeenCalledWith('project_component', 'pc2', 'LYR-12')
  })

  it('la capa de un componente sale de su tipo', () => {
    expect(capaDeComponente('SONDAJE')).toBe('LYR-10')
    expect(capaDeComponente('ACCESO')).toBe('LYR-12')
    expect(capaDeComponente('PLATAFORMA')).toBe('LYR-11')
    expect(capaDeComponente(null)).toBe('LYR-11')
  })

  it('los elementos sensibles se piden a 5 km por defecto, con su campo, y resaltan el elemento', async () => {
    fetch = mockFetch([
      sinPredios,
      {
        path: `${RUTA}/sensitive-distances`,
        body: {
          available: true,
          truncated: false,
          rows: [
            {
              component: { id: 'pc1', code: 'PLT-01', componentType: 'PLATAFORMA' },
              feature: { id: 'ef1', name: 'Manantial Ejemplo', featureType: 'FUENTE DE AGUA' },
              distanceM: 1250
            }
          ]
        }
      }
    ])
    red = espiarRed()
    const resaltar = panel()
    await userEvent.click(await screen.findByRole('tab', { name: 'Elementos sensibles' }))
    await screen.findByRole('table', { name: 'Elementos sensibles' })
    expect(red.a('GET', `${RUTA}/sensitive-distances`)[0].ruta).toContain('distanceKm=5')
    expect(screen.getByLabelText('Distancia (km)')).toHaveValue('5')
    await userEvent.click(screen.getByRole('button', { name: 'Ver Manantial Ejemplo en el mapa' }))
    expect(resaltar).toHaveBeenCalledWith('environmental_feature', 'ef1', 'LYR-08')
  })

  it('el buffer pide sus metros, no consulta fuera de 1 a 20 000 y resalta la localidad', async () => {
    fetch = mockFetch([
      {
        path: `${RUTA}/buffer-localities`,
        body: {
          available: true,
          localities: [
            { id: 'l1', name: 'Localidad Ejemplo', localityType: 'CASERIO' },
            { id: 'l2', name: 'Ciudad Ejemplo', localityType: 'CIUDAD' }
          ]
        }
      },
      sinPredios
    ])
    red = espiarRed()
    const resaltar = panel()
    await userEvent.click(await screen.findByRole('tab', { name: 'Localidades en el buffer' }))
    const tabla = await screen.findByRole('table', { name: 'Localidades en el buffer' })
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Localidad', 'Tipo', 'Mapa'])
    expect(red.a('GET', `${RUTA}/buffer-localities`)[0].ruta).toContain('bufferM=500')
    const metros = screen.getByLabelText('Buffer (m)')
    await userEvent.clear(metros)
    await userEvent.type(metros, '25000')
    expect(await screen.findByText('Indique entre 1 y 20 000 metros.')).toBeInTheDocument()
    expect(red.a('GET', `${RUTA}/buffer-localities`).some((l) => l.ruta.includes('bufferM=25000'))).toBe(false)
    await userEvent.clear(metros)
    await userEvent.type(metros, '1000')
    await waitFor(() => expect(red!.a('GET', `${RUTA}/buffer-localities`).some((l) => l.ruta.includes('bufferM=1000'))).toBe(true))
    await userEvent.click(await screen.findByRole('button', { name: 'Ver Localidad Ejemplo en el mapa' }))
    expect(resaltar).toHaveBeenCalledWith('locality', 'l1', 'LYR-02')
    await userEvent.click(screen.getByRole('button', { name: 'Ver Ciudad Ejemplo en el mapa' }))
    expect(resaltar).toHaveBeenCalledWith('locality', 'l2', 'LYR-03')
  })

  it('demasiadas localidades en el buffer se dicen con su texto, no como una tabla vacía', async () => {
    fetch = mockFetch([sinPredios])
    red = espiarRed([{ path: /buffer-localities/, responder: () => problema(400, 'demasiados', [{ field: 'bufferM', message: 'TOO_MANY_RECORDS' }]) }])
    panel()
    await userEvent.click(await screen.findByRole('tab', { name: 'Localidades en el buffer' }))
    expect(await screen.findByText('Hay demasiadas localidades en el buffer: indique menos metros.')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Localidades en el buffer' })).not.toBeInTheDocument()
  })

  it('un proyecto sin CRS de trabajo lo dice con su texto', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      {
        path: /component-parcels/,
        responder: () => problema(409, 'sin crs', [{ field: 'project', message: 'WORKING_CRS_REQUIRED' }])
      }
    ])
    panel()
    expect(await screen.findByText('El proyecto necesita su CRS de trabajo antes de este paso.')).toBeInTheDocument()
  })

  it('los territorios de las concesiones dicen el lugar con su tipo y lo resaltan en su capa', async () => {
    fetch = mockFetch([
      sinPredios,
      {
        path: `${RUTA}/concession-territories`,
        body: {
          available: true,
          truncated: false,
          rows: [
            {
              concession: { id: 'mc1', code: 'CM-01', name: 'Concesión Ejemplo' },
              object: 'community',
              id: 'c1',
              name: 'Comunidad Ejemplo',
              localityType: null,
              areaHa: 210.25
            },
            {
              concession: { id: 'mc1', code: 'CM-01', name: 'Concesión Ejemplo' },
              object: 'locality',
              id: 'l1',
              name: 'Localidad Ejemplo',
              localityType: 'CASERIO',
              areaHa: null
            }
          ]
        }
      }
    ])
    const resaltar = panel()
    await userEvent.click(await screen.findByRole('tab', { name: 'Territorios de las concesiones' }))
    const tabla = await screen.findByRole('table', { name: 'Territorios de las concesiones' })
    const [, uno, dos] = within(tabla).getAllByRole('row')
    expect(uno).toHaveTextContent('CM-01')
    expect(uno).toHaveTextContent('Comunidad')
    expect(uno).toHaveTextContent('210.25')
    expect(dos).toHaveTextContent('Localidad · CASERIO')
    await userEvent.click(within(uno).getByRole('button', { name: 'Ver Comunidad Ejemplo en el mapa' }))
    expect(resaltar).toHaveBeenCalledWith('community', 'c1', 'LYR-05')
    await userEvent.click(within(dos).getByRole('button', { name: 'Ver Localidad Ejemplo en el mapa' }))
    expect(resaltar).toHaveBeenCalledWith('locality', 'l1', 'LYR-02')
  })

  it('sin permiso sobre el principal dice «No disponible»; un permiso secundario que falta se dice sobre la tabla', async () => {
    fetch = mockFetch([
      { path: `${RUTA}/component-parcels`, status: 403, body: { title: 'Forbidden', status: 403 } },
      {
        path: `${RUTA}/nearby-conflicts`,
        body: {
          items: [
            { object: 'incident', id: 'i1', label: 'INC-001', distanceM: 2500 },
            { object: 'local_conflict', id: 'lc1', label: 'Conflicto Ejemplo', distanceM: 4200 }
          ],
          available: false,
          missingFields: ['early_warning_signal.location'],
          truncated: false
        }
      }
    ])
    red = espiarRed()
    panel()
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Conflictos cercanos' }))
    expect(await screen.findByText('Su cuenta no lee una parte de estos datos: la tabla puede estar incompleta.')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'INC-001' })).toHaveAttribute('href', '/r/incident/i1')
    expect(screen.getByRole('link', { name: 'Conflicto Ejemplo' })).toHaveAttribute('href', '/r/local_conflict/lc1')
    const tabla = screen.getByRole('table', { name: 'Conflictos cercanos' })
    const [, uno, dos] = within(tabla).getAllByRole('row')
    expect(uno).toHaveTextContent('2.5')
    expect(dos).toHaveTextContent('4.2')
    expect(red.a('GET', `${RUTA}/nearby-conflicts`)[0].ruta).toContain('distanceKm=5')
  })

  // revisión final del plan 6.3, m9: un backend sin el plan 6.2a (404 sin código) deja S09 como en F2
  it('un 404 sin código oculta el panel; PROJECT_NOT_FOUND, con su código, se dice en la tabla', async () => {
    fetch = mockFetch([{ path: `${RUTA}/component-parcels`, status: 404, body: { title: 'Not Found', status: 404 } }])
    red = espiarRed()
    panel()
    await waitFor(() => expect(red!.a('GET', `${RUTA}/component-parcels`)).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Análisis' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // revisión final del plan 6.3, m7: un registro sin etiqueta legible se nombra con un texto, nunca con su id
  it('un conflicto sin etiqueta se nombra «Registro sin nombre», no con su id', async () => {
    fetch = mockFetch([
      sinPredios,
      {
        path: `${RUTA}/nearby-conflicts`,
        body: { items: [{ object: 'incident', id: '5c7e0d4b-0000-4000-8000-000000000001', label: null, distanceM: 2500 }], truncated: false }
      }
    ])
    panel()
    await userEvent.click(await screen.findByRole('tab', { name: 'Conflictos cercanos' }))
    const tabla = await screen.findByRole('table', { name: 'Conflictos cercanos' })
    expect(within(tabla).getByRole('link', { name: 'Registro sin nombre' })).toHaveAttribute('href', '/r/incident/5c7e0d4b-0000-4000-8000-000000000001')
    expect(within(tabla).queryByText(/5c7e0d4b/)).not.toBeInTheDocument()
  })
})
