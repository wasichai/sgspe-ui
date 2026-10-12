import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { definicion, montar, registro } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { ANALISTA_SIG, EQUIPO_SIG, RESUMEN_AREA, SUGERENCIAS } from '../../test/sig'
import { ResumenDelArea } from './ResumenDelArea'
import { SugerenciasDelArea } from './SugerenciasDelArea'

// S10 en F6 (spec §3.7): las sugerencias no escriben; aceptar una crea el miembro con spatially_suggested. el resumen dice cada
// cifra o «No disponible»
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const DEF_MIEMBRO = definicion('area_of_influence_member', [
  'area_of_influence',
  'locality',
  'community',
  'administrative_unit',
  ['member_condition', { type: 'ENUM', enumOptions: ['INCLUIDO', 'PROVISIONAL'] }],
  'rationale',
  ['spatially_suggested', { type: 'BOOLEAN' }]
])

const rutas = (sugerencias: unknown = SUGERENCIAS) => [
  { path: '/sgspe/areas-of-influence/ai1/member-suggestions', body: sugerencias },
  { path: '/metadata/objects/area_of_influence_member', body: DEF_MIEMBRO },
  { method: 'POST', path: '/objects/area_of_influence_member/records', body: registro('m9', { area_of_influence: 'ai1', locality: 'l1' }) }
]

describe('S10 · sugerencias del cálculo', () => {
  it('lista lo sugerido sin escribir; aceptar crea el miembro con spatially_suggested y lo elegido', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    montar(<SugerenciasDelArea area="ai1" editable />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    await userEvent.click(screen.getByRole('button', { name: 'Sugerencias del cálculo' }))
    const lista = await screen.findByRole('table', { name: 'Sugerencias del cálculo' })
    const [, localidad, comunidad] = within(lista).getAllByRole('row')
    expect(localidad).toHaveTextContent('Localidad Ejemplo')
    expect(localidad).toHaveTextContent('Interseca el área')
    expect(within(comunidad).getByText('Ya es miembro')).toBeInTheDocument()
    expect(within(comunidad).queryByRole('button', { name: /Aceptar/ })).not.toBeInTheDocument()
    expect(red.a('POST', '/objects/area_of_influence_member/records')).toEqual([])
    await userEvent.click(within(localidad).getByRole('button', { name: 'Aceptar Localidad Ejemplo' }))
    const formulario = screen.getByRole('group', { name: 'Agregar Localidad Ejemplo como miembro' })
    expect(within(formulario).getByLabelText('Condición')).toHaveValue('PROVISIONAL')
    expect(within(formulario).getByLabelText('Justificación')).toHaveValue('Sugerido por el cálculo espacial: interseca el área.')
    await userEvent.selectOptions(within(formulario).getByLabelText('Condición'), 'INCLUIDO')
    await userEvent.click(within(formulario).getByRole('button', { name: 'Agregar como miembro' }))
    await waitFor(() => expect(red!.a('POST', '/objects/area_of_influence_member/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/area_of_influence_member/records')[0].cuerpo).toEqual({
      attributes: {
        area_of_influence: 'ai1',
        locality: 'l1',
        member_condition: 'INCLUIDO',
        rationale: 'Sugerido por el cálculo espacial: interseca el área.',
        spatially_suggested: true
      }
    })
  })

  it('el buffer viaja en la consulta y fuera de rango no consulta', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    montar(<SugerenciasDelArea area="ai1" editable />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    await userEvent.click(screen.getByRole('button', { name: 'Sugerencias del cálculo' }))
    await screen.findByRole('table', { name: 'Sugerencias del cálculo' })
    await userEvent.type(screen.getByLabelText('Buffer (m), opcional'), '300')
    await waitFor(() => expect(red!.llamadas.some((l) => l.ruta === '/sgspe/areas-of-influence/ai1/member-suggestions?bufferM=300')).toBe(true))
    const antes = red.llamadas.length
    await userEvent.type(screen.getByLabelText('Buffer (m), opcional'), '00000')
    expect(await screen.findByText('Indique entre 1 y 20 000 metros, o déjelo vacío.')).toBeInTheDocument()
    expect(red.llamadas.slice(antes).filter((l) => l.ruta.includes('bufferM=30000000'))).toEqual([])
    const campo = screen.getByLabelText('Buffer (m), opcional')
    await userEvent.clear(campo)
    await userEvent.type(campo, '1.5')
    expect(await screen.findByText('Indique entre 1 y 20 000 metros, o déjelo vacío.')).toBeInTheDocument()
    expect(red.llamadas.some((l) => l.ruta.includes('bufferM=1.5'))).toBe(false)
  })

  it('en una versión que no se edita no ofrece aceptar', async () => {
    fetch = mockFetch(rutas())
    montar(<SugerenciasDelArea area="ai1" editable={false} />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    await userEvent.click(screen.getByRole('button', { name: 'Sugerencias del cálculo' }))
    await screen.findByRole('table', { name: 'Sugerencias del cálculo' })
    expect(screen.queryByRole('button', { name: /^Aceptar/ })).not.toBeInTheDocument()
  })

  it('sin saber si ya es miembro no ofrece aceptar; sin disponibilidad avisa', async () => {
    fetch = mockFetch(
      rutas({
        available: false,
        missingFields: ['area_of_influence.project'],
        suggestions: [{ object: 'locality', recordId: 'l1', name: 'Localidad Ejemplo', relation: 'WITHIN_BUFFER', alreadyMember: null }]
      })
    )
    montar(<SugerenciasDelArea area="ai1" editable />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    await userEvent.click(screen.getByRole('button', { name: 'Sugerencias del cálculo' }))
    const lista = await screen.findByRole('table', { name: 'Sugerencias del cálculo' })
    expect(within(lista).getByText('No se puede saber si ya es miembro')).toBeInTheDocument()
    expect(within(lista).getByText('Está en el buffer')).toBeInTheDocument()
    expect(within(lista).queryByRole('button', { name: /Aceptar/ })).not.toBeInTheDocument()
    expect(screen.getByText(/la lista puede estar incompleta/)).toBeInTheDocument()
  })

  it('un código de error se dice con su texto', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/areas-of-influence/ai1/member-suggestions',
        status: 409,
        body: { errors: [{ message: 'WORKING_CRS_REQUIRED', field: 'project' }] }
      }
    ])
    montar(<SugerenciasDelArea area="ai1" editable />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    await userEvent.click(screen.getByRole('button', { name: 'Sugerencias del cálculo' }))
    expect(await screen.findByText('El proyecto necesita su CRS de trabajo antes de este paso.')).toBeInTheDocument()
  })
})

describe('S10 · resumen del área', () => {
  it('dice la superficie, las localidades por tipo y los componentes; una cifra sin dato es «No disponible»', async () => {
    fetch = mockFetch([{ path: '/sgspe/areas-of-influence/ai1/summary', body: RESUMEN_AREA }])
    montar(<ResumenDelArea area="ai1" />, { usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    const resumen = await screen.findByRole('region', { name: 'Resumen del área' })
    expect(await within(resumen).findByText('1,234.5 ha')).toBeInTheDocument()
    expect(within(resumen).getByText('ANEXO: 1')).toBeInTheDocument()
    expect(within(resumen).getByText('CASERIO: 3')).toBeInTheDocument()
    expect(within(resumen).getAllByText('No disponible')).toHaveLength(2)
    expect(within(resumen).getByText(/no se pudieron calcular/)).toBeInTheDocument()
  })
})
