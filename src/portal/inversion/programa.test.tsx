import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeInversion, EQUIPO_DE_INVERSION, GRUPO_BENEFICIARIO, HITO, INDICADOR, INICIATIVA, INVERSION, MEDICION, PROGRAMA } from '../../test/inversion'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { FichaProgramaPage } from './FichaProgramaPage'
import { Beneficiarios, IniciativasEHitos, situacionDeHito } from './HijosDelPrograma'
import { Indicadores } from './Indicadores'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// los hijos del programa en S43 (spec F5 §3.6): indicadores con su última medición y su historial sin corregir (appendOnly), la
// medición nueva del indicador elegido, los hitos atrasados en la fecha de Lima y los beneficiarios con su meta y alcanzados
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const SIN_MEDIR = registro('pi2', { social_program: 'sp1', name: 'Escuelas con agua', unit: 'escuelas', baseline_value: 2, target_value: 10 })
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeInversion(),
  { path: '/objects/program_indicator/records', body: pagina([INDICADOR, SIN_MEDIR]) },
  { path: /^\/objects\/program_measurement\/records\?.*program_indicator=pi1/, body: pagina([MEDICION]) },
  { path: /^\/objects\/program_measurement\/records\?.*program_indicator=pi2/, body: pagina([]) },
  { path: '/objects/social_initiative/records', body: pagina([INICIATIVA]) },
  { path: '/objects/program_milestone/records', body: pagina([HITO]) },
  {
    path: '/objects/beneficiary_group/records',
    body: pagina([GRUPO_BENEFICIARIO, registro('bg2', { social_program: 'sp1', name: 'Escolares', target_count: 80, reached_count: 30 })])
  },
  { path: '/objects/social_initiative/records/si1', body: INICIATIVA }
]
const como = { usuario: INVERSION, permisos: EQUIPO_DE_INVERSION }

describe('S43 · hijos del programa', () => {
  it('cada indicador dice su línea base, su meta y su última medición; uno sin mediciones se marca', async () => {
    fetch = mockFetch(rutas())
    montar(<Indicadores programa={PROGRAMA} escribe />, como)
    const tabla = await screen.findByRole('table', { name: 'Indicadores' })
    const medido = within(tabla).getByRole('button', { name: 'Familias con agua segura' }).closest('tr') as HTMLElement
    expect(within(medido).getByText('40')).toBeInTheDocument()
    expect(within(medido).getByText('200')).toBeInTheDocument()
    expect(await within(medido).findByText(/^85 del /)).toBeInTheDocument()
    const sinMedir = within(tabla).getByRole('button', { name: 'Escuelas con agua' }).closest('tr') as HTMLElement
    expect(await within(sinMedir).findByText('Sin mediciones')).toBeInTheDocument()
  })

  it('«Registrar medición» elige el indicador y manda el periodo y el valor; el historial se ve sin editar ni borrar', async () => {
    fetch = mockFetch(
      rutas([{ method: 'POST', path: '/objects/program_measurement/records', status: 201, body: registro('pm9', { program_indicator: 'pi2' }) }])
    )
    red = espiarRed()
    montar(<Indicadores programa={PROGRAMA} escribe />, como)
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar medición' }))
    const drawer = await screen.findByRole('dialog', { name: 'Registrar medición' })
    await userEvent.selectOptions(within(drawer).getByLabelText('Indicador'), 'pi2')
    fireEvent.change(await within(drawer).findByLabelText(/^period_start_date/), { target: { value: '2026-07-01' } })
    fireEvent.change(within(drawer).getByLabelText(/^period_end_date/), { target: { value: '2026-12-31' } })
    await userEvent.type(within(drawer).getByLabelText(/^measured_value/), '4')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('POST', '/objects/program_measurement/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/program_measurement/records')[0].cuerpo).toMatchObject({
      attributes: { program_indicator: 'pi2', period_start_date: '2026-07-01', period_end_date: '2026-12-31' }
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Ver mediciones de Familias con agua segura' }))
    const historial = await screen.findByRole('dialog', { name: 'Mediciones de Familias con agua segura' })
    expect(await within(historial).findByText('Medición del primer semestre')).toBeInTheDocument()
    expect(within(historial).getByText(/no se corrigen ni se borran/)).toBeInTheDocument()
    expect(within(historial).queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
    expect(within(historial).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('un indicador con mediciones no se borra: el 409 sin código de wasichai dice el texto propio de la ficha', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'DELETE',
        path: '/objects/program_indicator/records/pi1',
        // AppendOnlyReferences de wasichai: un 409 sin código ni violaciones (decisión 9 del plan 5.2b)
        responder: () => problema(409, 'Record is referenced by append-only records', [])
      }
    ])
    montar(<Indicadores programa={PROGRAMA} escribe />, como)
    await userEvent.click(await screen.findByRole('button', { name: 'Familias con agua segura' }))
    const drawer = await screen.findByRole('dialog', { name: 'Indicadores' })
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Borrar' }))
    await userEvent.click(within(drawer).getByRole('button', { name: 'Borrar' }))
    expect(await within(drawer).findByText('Un indicador con mediciones no se borra: sus mediciones son historia.')).toBeInTheDocument()
  })

  it('un hito vencido sin alcanzar se marca atrasado con la fecha de Lima, no la de UTC', async () => {
    // 22:00 del 30 de septiembre en Lima: en UTC ya es el 1 de octubre
    expect(situacionDeHito(HITO, '2026-09-30')).toBe('previsto')
    expect(situacionDeHito(HITO, '2026-10-01')).toBe('atrasado')
    expect(situacionDeHito(registro('ms2', { planned_date: '2026-09-01', reached_date: '2026-09-15' }), '2026-10-01')).toBe('alcanzado')
    expect(situacionDeHito(registro('ms3', { name: 'Sin fecha' }), '2026-10-01')).toBe('sinFecha')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T03:00:00Z'))
    fetch = mockFetch(rutas())
    montar(<IniciativasEHitos programa={PROGRAMA} />, como)
    const hitos = await screen.findByRole('table', { name: 'Hitos' })
    expect(await within(hitos).findByText('Previsto')).toBeInTheDocument()
  })

  it('los grupos beneficiarios suman meta y alcanzados; una iniciativa de otro programa (PROGRAM_MISMATCH) se dice con su texto', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/beneficiary_group/records/bg1',
        responder: () => problema(409, 'otro programa', [{ field: 'social_initiative', message: 'PROGRAM_MISMATCH' }])
      }
    ])
    montar(<Beneficiarios programa={PROGRAMA} />, como)
    expect(await screen.findByText('Alcanzados: 75 de 200 previstos.')).toBeInTheDocument()
    const tabla = screen.getByRole('table', { name: 'Grupos beneficiarios' })
    expect(await within(tabla).findByRole('link', { name: 'Reservorio de Localidad Ejemplo' })).toBeInTheDocument()
    await userEvent.click(within(tabla).getByRole('button', { name: 'Familias de Localidad Ejemplo' }))
    const drawer = await screen.findByRole('dialog', { name: 'Grupos beneficiarios' })
    const alcanzados = await within(drawer).findByLabelText(/^reached_count/)
    await userEvent.clear(alcanzados)
    await userEvent.type(alcanzados, '50')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    expect(await within(drawer).findByText(/La iniciativa elegida es de otro programa: elija una de este programa\./)).toBeInTheDocument()
  })

  it('si el tope de lectura corta los grupos, el total de beneficiarios no se presenta como completo', async () => {
    const muchos = Array.from({ length: 1000 }, (_, i) => registro(`bg${i}`, { social_program: 'sp1', name: `Grupo ${i}`, target_count: 1, reached_count: 1 }))
    fetch = mockFetch(rutas([{ path: '/objects/beneficiary_group/records', body: pagina(muchos, { nextCursor: 'c2' }) }]))
    montar(<Beneficiarios programa={PROGRAMA} />, como)
    expect(
      await screen.findByText('La lista llegó al tope de lectura: el total de beneficiarios no se calcula porque podría faltar algún grupo.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Alcanzados: /)).not.toBeInTheDocument()
  })

  it('la ficha del programa ofrece los indicadores, las iniciativas e hitos y los beneficiarios en sus pestañas', async () => {
    fetch = mockFetch(
      rutas([
        { path: '/objects/social_program/records/sp1', body: PROGRAMA },
        { path: '/objects/social_program/records/sp1/transitions', body: [] },
        { path: '/objects/program_budget/records', body: pagina([]) },
        { path: '/objects/task/records', body: pagina([]) }
      ])
    )
    montar(<FichaProgramaPage />, { ...como, ruta: '/projects/p1/programs/sp1', camino: '/projects/:projectId/programs/:programId' })
    await userEvent.click(await screen.findByRole('tab', { name: 'Indicadores' }))
    expect(await screen.findByRole('table', { name: 'Indicadores' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Iniciativas e hitos' }))
    expect(await screen.findByRole('table', { name: 'Iniciativas' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Beneficiarios' }))
    expect(await screen.findByRole('table', { name: 'Grupos beneficiarios' })).toBeInTheDocument()
  })
})
