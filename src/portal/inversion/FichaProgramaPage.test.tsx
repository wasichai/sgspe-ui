import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APROBACION_DE_APORTES,
  baseDeInversion,
  DEF_PROGRAMA,
  EQUIPO_DE_INVERSION,
  INVERSION,
  PERMISOS_DE_APROBACION,
  PRESUPUESTO_2026,
  PRESUPUESTO_USD,
  PROGRAMA
} from '../../test/inversion'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import type { Registro } from '../datos/registros'
import { FichaProgramaPage } from './FichaProgramaPage'
import { estadosDeLaFicha } from '../../test/fichas'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// S43 (screens.md §10, WF-G): el programa con su socio y su convenio, las transiciones del rol, el aviso de G3, «Editar» y el
// presupuesto por año y moneda con el ejecutado registrado a mano (decisión 4); nada se suma entre monedas (ASM-063)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const transiciones = (lista: [string, string][]) => ({
  path: '/objects/social_program/records/sp1/transitions',
  body: lista.map(([name, label]) => ({ name, label, to: 'x', toLabel: 'Siguiente', allowed: true, reason: null }))
})
const rutas = (programa: Registro = PROGRAMA, extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeInversion(),
  { path: '/objects/social_program/records/sp1', body: programa },
  transiciones([
    ['start_monitoring', 'Pasar a monitoreo'],
    ['suspend', 'Suspender']
  ]),
  { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } },
  { path: '/objects/program_budget/records', body: pagina([PRESUPUESTO_2026, PRESUPUESTO_USD]) },
  { path: '/objects/task/records', body: pagina([]) },
  { path: '/objects/social_program/records/sp1/related/evidence_social_program', body: pagina([]) },
  { path: '/objects/social_program/records/sp1/history', body: [] }
]
const abrir = (usuario = INVERSION, permisos = EQUIPO_DE_INVERSION) =>
  montar(<FichaProgramaPage />, { ruta: '/projects/p1/programs/sp1', camino: '/projects/:projectId/programs/:programId', usuario, permisos })

describe('S43 · ficha del programa', () => {
  it('dice el programa con su estado, su socio y su convenio, las transiciones del rol y su total en su moneda', async () => {
    fetch = mockFetch(rutas())
    abrir()
    expect(await screen.findByRole('heading', { name: 'Programa Ejemplo de agua segura', level: 1 })).toBeInTheDocument()
    // en el encabezado, el camino del flujo y el panel de decisión (revisión de UX, etapa 4)
    expect((await screen.findAllByText('En ejecución')).length).toBeGreaterThan(0)
    expect(estadosDeLaFicha()).toHaveLength(1)
    expect(within(screen.getByRole('group', { name: 'Estado actual' })).getByText('En ejecución')).toHaveAttribute('data-estado')
    expect(await screen.findByRole('link', { name: 'Asociación Ejemplo' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'AC-001 · Convenio de sinergia de ejemplo' })).toHaveAttribute('href', '/projects/p1/agreements/ag1')
    expect(await screen.findByRole('button', { name: 'Pasar a monitoreo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suspender' })).toBeInTheDocument()
    expect(screen.getByText('Total del programa: S/ 80,000.00')).toBeInTheDocument()
  })

  it('el presupuesto por año dice lo asignado, lo ejecutado registrado y el avance; un presupuesto en otra moneda no se suma al total del programa', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Presupuesto' }))
    const anios = await screen.findByRole('table', { name: 'Presupuesto por año' })
    const fila2026 = within(anios).getByRole('button', { name: '2026' }).closest('tr') as HTMLElement
    expect(within(fila2026).getByText('S/ 80,000.00')).toBeInTheDocument()
    expect(within(fila2026).getByText('S/ 20,000.00')).toBeInTheDocument()
    expect(within(fila2026).getByText('25 %')).toBeInTheDocument()
    const fila2027 = within(anios).getByRole('button', { name: '2027' }).closest('tr') as HTMLElement
    expect(within(fila2027).getByText('Sin registrar')).toBeInTheDocument()
    const totales = screen.getByRole('table', { name: 'Totales por moneda' })
    const usd = within(totales).getAllByText(/^USD/)[0].closest('tr') as HTMLElement
    expect(within(usd).getByText(/10,000\.00/)).toBeInTheDocument()
    expect(within(usd).getAllByText('—').length).toBeGreaterThanOrEqual(1)
    // la fila PEN suma solo los PEN: 80,000, nunca 90,000 con el presupuesto en USD
    const pen = within(totales).getByText(/^PEN/).closest('tr') as HTMLElement
    expect(within(pen).getByText('S/ 80,000.00')).toBeInTheDocument()
    expect(within(totales).queryByText(/90,000/)).not.toBeInTheDocument()
    expect(screen.getByText('Los presupuestos en otra moneda no se suman al total del programa en PEN: se muestran aparte.')).toBeInTheDocument()
  })

  it('«Nuevo presupuesto» propone el año en curso de Lima y la moneda del programa; registrar el ejecutado de un año manda su cambio con la versión leída', async () => {
    // 22:00 del 31 de diciembre en Lima: en UTC ya es el 1 de enero de 2027
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-01-01T03:00:00Z'))
    fetch = mockFetch(rutas(PROGRAMA, [{ method: 'PUT', path: '/objects/program_budget/records/b1', body: PRESUPUESTO_2026 }]))
    red = espiarRed()
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Presupuesto' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo presupuesto' }))
    const alta = await screen.findByRole('dialog', { name: 'Nuevo presupuesto' })
    expect(await within(alta).findByLabelText(/^budget_year/)).toHaveDisplayValue('2026')
    // la moneda es un ENUM: un Select de Radix (combobox) con el valor en su texto
    expect(within(alta).getByLabelText(/^currency/)).toHaveTextContent('PEN')
    await userEvent.click(within(alta).getByRole('button', { name: /cancelar|cancel/i }))
    await userEvent.click(await screen.findByRole('button', { name: '2026' }))
    const drawer = await screen.findByRole('dialog', { name: 'Presupuesto por año' })
    const ejecutado = await within(drawer).findByLabelText(/^executed_amount/)
    await userEvent.clear(ejecutado)
    await userEvent.type(ejecutado, '30000')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('PUT', '/objects/program_budget/records/b1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/program_budget/records/b1')
    expect(String((cambio.cuerpo as { attributes: Record<string, unknown> }).attributes.executed_amount)).toBe('30000')
    expect(cambio.cabeceras.get('If-Match')).toBe(`"${PRESUPUESTO_2026.updatedAt}"`)
  })

  it('un programa sin moneda no tiene total ni moneda del programa; un presupuesto nuevo propone PEN', async () => {
    const { currency: _sinMoneda, ...sinMoneda } = PROGRAMA.attributes
    fetch = mockFetch(rutas(registro('sp1', sinMoneda)))
    abrir()
    expect(await screen.findByText('El programa no tiene moneda: su total no se calcula.')).toBeInTheDocument()
    expect(screen.queryByText(/^Total del programa/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Presupuesto' }))
    const totales = await screen.findByRole('table', { name: 'Totales por moneda' })
    expect(within(totales).queryByText(/moneda del programa/)).not.toBeInTheDocument()
    expect(screen.queryByText(/no se suman al total del programa/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo presupuesto' }))
    const alta = await screen.findByRole('dialog', { name: 'Nuevo presupuesto' })
    expect(await within(alta).findByLabelText(/^currency/)).toHaveTextContent('PEN')
  })

  it('si el tope de lectura corta los presupuestos, los totales por moneda no se presentan como completos', async () => {
    const muchos = Array.from({ length: 1000 }, (_, i) => ({ ...PRESUPUESTO_2026, id: `b${i}` }))
    fetch = mockFetch(rutas(PROGRAMA, [{ path: '/objects/program_budget/records', body: pagina(muchos, { nextCursor: 'c2' }) }]))
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Presupuesto' }))
    expect(
      await screen.findByText('La lista de presupuestos llegó al tope de lectura: los totales por moneda no se calculan porque podría faltar alguno.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Totales por moneda' })).not.toBeInTheDocument()
  })

  it('un programa por aprobar no muestra el ejecutado ni el avance de sus presupuestos, como S42 y el tablero', async () => {
    fetch = mockFetch(rutas({ ...PROGRAMA, state: 'pending_approval' }))
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Presupuesto' }))
    const anios = await screen.findByRole('table', { name: 'Presupuesto por año' })
    const fila2026 = within(anios).getByRole('button', { name: '2026' }).closest('tr') as HTMLElement
    expect(within(fila2026).getByText('S/ 80,000.00')).toBeInTheDocument()
    expect(within(fila2026).getByText('Por aprobar')).toBeInTheDocument()
    expect(within(fila2026).queryByText('S/ 20,000.00')).not.toBeInTheDocument()
    expect(within(fila2026).queryByText('25 %')).not.toBeInTheDocument()
    const totales = screen.getByRole('table', { name: 'Totales por moneda' })
    const pen = within(totales).getByText(/^PEN/).closest('tr') as HTMLElement
    expect(within(pen).queryByText('S/ 20,000.00')).not.toBeInTheDocument()
    expect(within(pen).queryByText('25 %')).not.toBeInTheDocument()
    expect(screen.getByText('Los programas por aprobar no cuentan en lo ejecutado ni en el avance.')).toBeInTheDocument()
  })

  it('con socio y la política de sinergia activa, en borrador avisa que aprobar o planificar exige el acuerdo con el socio', async () => {
    fetch = mockFetch(rutas(registro('sp1', PROGRAMA.attributes, { state: 'draft' }), [transiciones([['submit', 'Enviar a aprobación']])]))
    abrir()
    expect(
      await screen.findByText('Con socio, aprobar o planificar el programa exige un acuerdo vigente (activo y no vencido) en el que el socio sea parte.')
    ).toBeInTheDocument()
  })

  it('quien aprueba no edita el programa ni sus presupuestos', async () => {
    const soloLectura = { ...DEF_PROGRAMA, fields: DEF_PROGRAMA.fields.map((f) => ({ ...f, editable: false })) }
    fetch = mockFetch(rutas(PROGRAMA, [{ path: '/metadata/objects/social_program', body: soloLectura }, transiciones([['suspend', 'Suspender']])]))
    abrir(APROBACION_DE_APORTES, PERMISOS_DE_APROBACION)
    expect(await screen.findByRole('button', { name: 'Suspender' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Presupuesto' }))
    expect(await screen.findByRole('table', { name: 'Presupuesto por año' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo presupuesto' })).not.toBeInTheDocument()
  })
})
