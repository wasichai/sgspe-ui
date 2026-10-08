import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { RELACIONISTA } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { base, LEE } from '../../test/grupos'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))
vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

// el catálogo de indicadores (GET /api/sgspe/dashboards/indicators): KPI-STK-04, KPI-STK-05 y KPI-STK-07 no tienen
// tablero en F2 (dashboard null, dashboards.md §11)
const CATALOGO = [
  { code: 'KPI-STK-01', label: 'Clasificación', dashboard: 'stakeholders', available: true },
  { code: 'KPI-STK-04', label: 'Grupos de interés contactados', dashboard: null, available: true },
  { code: 'KPI-STK-05', label: 'Oposición que aceptó conversar', dashboard: null, available: false },
  { code: 'KPI-ENG-01', label: 'Actividad', dashboard: 'engagement', available: true }
]

const STK03 = {
  code: 'KPI-STK-03',
  label: 'Matriz',
  available: true,
  value: 2,
  numerator: 2,
  denominator: 5,
  breakdowns: [
    {
      by: 'stakeholder',
      rows: [
        { key: 's1', label: 'Ronda campesina Tunas', value: 7.5, interest: 4, power: 3.5, influenceGroup: 'ESTRATEGICO', overridden: false },
        { key: 's4', label: 'Iglesia', value: 4, interest: 2, power: 2, influenceGroup: 'POLITICO', overridden: true, overrideReason: 'Peso real' }
      ]
    }
  ]
}

describe('S19 · matriz y tablero de grupos de interés', () => {
  it('la matriz cuenta los sin evaluar, lista los puntos y un punto abre la ficha', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/matrix', RELACIONISTA, LEE, [...base(), { path: '/sgspe/dashboards/indicators/KPI-STK-03', body: STK03 }])
    expect(await screen.findByText('3 grupos de interés sin evaluar no aparecen')).toBeInTheDocument()
    expect(screen.getByText('Umbrales: interés 3 · poder 3')).toBeInTheDocument()
    const puntos = screen.getByRole('navigation', { name: 'Puntos de la matriz' })
    expect(within(puntos).getByRole('link', { name: 'Ronda campesina Tunas' })).toHaveAttribute('href', '/projects/p1/stakeholders/s1')
    expect(within(puntos).getByText(/grupo ajustado a mano/)).toHaveAttribute('title', 'Peso real')
    await userEvent.click(screen.getByRole('button', { name: 'punto s1' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/stakeholders/s1'))
  })

  it('el tablero pide stakeholders con los filtros y dice "no disponible" donde no hay permiso', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/dashboard?periodStart=2026-09-01', RELACIONISTA, LEE, [
      ...base(),
      { path: '/sgspe/dashboards/indicators', body: CATALOGO },
      {
        path: '/sgspe/dashboards/stakeholders',
        body: {
          dashboard: 'stakeholders',
          computedAt: '2026-10-07T15:04:05Z',
          filters: {},
          indicators: [
            {
              code: 'KPI-STK-01',
              label: 'x',
              available: true,
              value: 5,
              // los KPI-STK no aplican community: stakeholder no tiene comunidad (ruling P27)
              ignoredFilters: ['community'],
              breakdowns: [
                {
                  by: 'influence_group',
                  rows: [
                    { key: 'ESTRATEGICO', value: 2 },
                    { key: 'SIN EVALUAR', value: 3 }
                  ]
                }
              ]
            },
            { code: 'KPI-STK-02', label: 'Posturas', available: false, unavailableReason: 'FIELD_NOT_READABLE', missingFields: ['stakeholder.stance'] },
            STK03,
            { code: 'KPI-STK-06', label: 'Oposición que cambió de postura', available: false, unavailableReason: 'FIELD_NOT_READABLE' },
            {
              code: 'KPI-STK-08',
              label: 'Confianza',
              available: true,
              value: 3,
              series: [
                { period: '2026-09', value: 2.5 },
                { period: '2026-10', value: 3 }
              ]
            }
          ]
        }
      }
    ])
    red = espiarRed()
    const clasificacion = await screen.findByRole('region', { name: 'Clasificación por grupo de influencia y ámbito' })
    expect(within(clasificacion).getByRole('cell', { name: 'SIN EVALUAR' })).toBeInTheDocument()
    expect(within(clasificacion).getByRole('note')).toHaveTextContent('Esta cifra no aplica el filtro de comunidad')
    expect(within(screen.getByRole('region', { name: 'Confianza promedio' })).queryByRole('note')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Posturas' })).getByText('No disponible')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Oposición que cambió de postura' })).getByText('No disponible')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Confianza promedio' })).getByRole('cell', { name: '2.5' })).toBeInTheDocument()
    // los KPI-STK sin zona en F2 (dashboard null en el catálogo) llevan a su detalle con los mismos filtros
    const mas = await screen.findByRole('region', { name: 'Más indicadores' })
    expect(within(mas).getByRole('link', { name: 'Grupos de interés contactados' })).toHaveAttribute(
      'href',
      '/projects/p1/stakeholders/indicators/KPI-STK-04?periodStart=2026-09-01'
    )
    expect(within(mas).getByText('No disponible')).toBeInTheDocument()
    expect(within(mas).queryByText('Clasificación')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/stakeholders').length).toBeGreaterThan(0))
    expect(red.a('GET', '/sgspe/dashboards/stakeholders')[0].ruta).toBe('/sgspe/dashboards/stakeholders?project=p1&periodStart=2026-09-01')
  })

  it('el detalle de un KPI sin zona muestra la cifra, sus desgloses y pide el indicador con los filtros', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/indicators/KPI-STK-04?periodStart=2026-09-01', RELACIONISTA, LEE, [
      ...base(),
      {
        path: '/sgspe/dashboards/indicators/KPI-STK-04',
        body: {
          code: 'KPI-STK-04',
          label: 'Grupos de interés contactados',
          available: true,
          value: 12,
          unit: 'grupos de interés',
          breakdowns: [
            {
              by: 'sex',
              rows: [
                { key: 'FEMENINO', value: 5 },
                { key: 'MASCULINO', value: 6 },
                { key: 'ORGANIZACION', value: 1 }
              ]
            },
            { by: 'institution', rows: [{ key: 'o1', label: 'Ronda campesina Tunas', value: 3 }] }
          ]
        }
      }
    ])
    red = espiarRed()
    expect(await screen.findByRole('heading', { name: 'Grupos de interés contactados', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Por sexo' })).getByRole('cell', { name: 'FEMENINO' })).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Por institución' })).getByRole('cell', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al tablero' })).toHaveAttribute('href', '/projects/p1/stakeholders/dashboard?periodStart=2026-09-01')
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/indicators/KPI-STK-04').length).toBeGreaterThan(0))
    expect(red.a('GET', '/sgspe/dashboards/indicators/KPI-STK-04')[0].ruta).toBe('/sgspe/dashboards/indicators/KPI-STK-04?project=p1&periodStart=2026-09-01')
  })

  // api.md §4.11: no todo desglose es una categoría. los puntos y los umbrales de KPI-STK-03 y la cobertura de KPI-STK-06
  // no se dibujan en barras
  it('el detalle dibuja solo los desgloses que son categorías y dice los filtros que la cifra no aplica', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/indicators/KPI-STK-06', RELACIONISTA, LEE, [
      ...base(),
      {
        path: '/sgspe/dashboards/indicators/KPI-STK-06',
        body: {
          code: 'KPI-STK-06',
          label: 'Oposición que cambió de postura',
          available: true,
          value: 50,
          numerator: 2,
          denominator: 4,
          unit: '%',
          ignoredFilters: ['community', 'explorationCampaign'],
          breakdowns: [
            {
              by: 'direction',
              rows: [
                { key: 'MORE_FAVORABLE', value: 2 },
                { key: 'LESS_FAVORABLE', value: 0 }
              ]
            },
            {
              by: 'coverage',
              rows: [
                { key: 'evaluated', value: 4 },
                { key: 'opposition', value: 6 }
              ]
            }
          ]
        }
      }
    ])
    expect(await screen.findByRole('table', { name: 'Por dirección del cambio' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Más favorable' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'coverage' })).not.toBeInTheDocument()
    expect(screen.queryByText('evaluated')).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Esta cifra no aplica el filtro de comunidad, campaña de exploración')
    expect(screen.getByText('2 / 4 · %')).toBeInTheDocument()
  })

  it('el detalle de la matriz no dibuja sus puntos ni sus umbrales como barras', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/indicators/KPI-STK-03', RELACIONISTA, LEE, [
      ...base(),
      {
        path: '/sgspe/dashboards/indicators/KPI-STK-03',
        body: {
          ...STK03,
          breakdowns: [
            ...STK03.breakdowns,
            {
              by: 'thresholds',
              rows: [
                { key: 'interest', value: 3 },
                { key: 'power', value: 3 }
              ]
            }
          ]
        }
      }
    ])
    expect(await screen.findByRole('heading', { name: 'Matriz', level: 1 })).toBeInTheDocument()
    expect(screen.queryAllByRole('table')).toHaveLength(0)
    expect(screen.queryByText('Ronda campesina Tunas')).not.toBeInTheDocument()
  })
})

describe('S19 · estados y límites', () => {
  const problema = (status: number, mensaje?: string) => ({
    title: 'x',
    status,
    detail: 'No se pudo',
    errors: mensaje ? [{ field: 'project', message: mensaje }] : []
  })

  it('un tablero con demasiados registros dice "Acote los filtros" y deja los filtros a la vista', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/dashboard', RELACIONISTA, LEE, [
      ...base(),
      { path: '/sgspe/dashboards/indicators', body: CATALOGO },
      { path: '/sgspe/dashboards/stakeholders', status: 400, body: problema(400, 'TOO_MANY_RECORDS') }
    ])
    expect(await screen.findByText('Acote los filtros')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Filtros del tablero' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Posturas' })).not.toBeInTheDocument()
  })

  it('un 403 del tablero dice "No disponible" con su motivo, y otro error ofrece reintentar', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/dashboard', RELACIONISTA, LEE, [
      ...base(),
      { path: '/sgspe/dashboards/indicators', body: CATALOGO },
      { path: '/sgspe/dashboards/stakeholders', status: 403, body: problema(403, 'NOT_ASSIGNED') }
    ])
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.getByText(/No tiene una asignación vigente a este proyecto/)).toBeInTheDocument()
    expect(screen.queryByText('NOT_ASSIGNED')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('un error del tablero que no es de permiso ofrece reintentar', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/dashboard', RELACIONISTA, LEE, [
      ...base(),
      { path: '/sgspe/dashboards/indicators', body: CATALOGO },
      { path: '/sgspe/dashboards/stakeholders', status: 404, body: problema(404) }
    ])
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Filtros del tablero' })).toBeInTheDocument()
  })

  it('un catálogo que falla no se lee como "no hay más indicadores"', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/dashboard', RELACIONISTA, LEE, [
      ...base(),
      { path: '/sgspe/dashboards/indicators', status: 404, body: problema(404) },
      { path: '/sgspe/dashboards/stakeholders', body: { dashboard: 'stakeholders', computedAt: '2026-10-07T15:04:05Z', filters: {}, indicators: [] } }
    ])
    const mas = await screen.findByRole('region', { name: 'Más indicadores' })
    expect(await within(mas).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('una cifra nula sale como "—" y nunca como cero; una postura nula no dibuja barra', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/dashboard', RELACIONISTA, LEE, [
      ...base(),
      { path: '/sgspe/dashboards/indicators', body: CATALOGO },
      {
        path: '/sgspe/dashboards/stakeholders',
        body: {
          dashboard: 'stakeholders',
          computedAt: '2026-10-07T15:04:05Z',
          filters: {},
          indicators: [
            {
              code: 'KPI-STK-01',
              label: 'x',
              available: true,
              value: null,
              breakdowns: [{ by: 'influence_group', rows: [{ key: 'ESTRATEGICO', value: null }] }]
            },
            {
              code: 'KPI-STK-02',
              label: 'Posturas',
              available: true,
              value: 3,
              breakdowns: [
                {
                  by: 'stance',
                  rows: [
                    { key: 'A FAVOR', value: 3 },
                    { key: 'NEUTRAL', value: null }
                  ]
                }
              ]
            }
          ]
        }
      }
    ])
    const clasificacion = await screen.findByRole('region', { name: 'Clasificación por grupo de influencia y ámbito' })
    const fila = within(clasificacion).getByRole('cell', { name: 'ESTRATEGICO' }).closest('tr')!
    expect(within(fila).getByRole('cell', { name: '—' })).toBeInTheDocument()
    const posturas = within(screen.getByRole('region', { name: 'Posturas' }))
    expect(posturas.getByRole('cell', { name: 'NEUTRAL' }).closest('tr')).toHaveTextContent('—')
    expect(posturas.getByRole('cell', { name: 'A FAVOR' }).closest('tr')).toHaveTextContent('3')
  })

  it('la matriz con un solo sin evaluar usa el singular y sin acceso a la postura no la lista', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/matrix', RELACIONISTA, LEE, [
      ...base(),
      {
        path: '/sgspe/dashboards/indicators/KPI-STK-03',
        body: { ...STK03, denominator: 3, breakdowns: [{ by: 'stakeholder', rows: [{ ...STK03.breakdowns[0].rows[0], label: undefined }] }] }
      }
    ])
    expect(await screen.findByText('1 grupo de interés sin evaluar no aparece')).toBeInTheDocument()
    const puntos = screen.getByRole('navigation', { name: 'Puntos de la matriz' })
    // sin etiqueta de la API no se muestra el identificador
    expect(within(puntos).getByRole('link', { name: 'Persona registrada' })).toBeInTheDocument()
    expect(within(puntos).queryByText(/EN CONTRA|A FAVOR/)).not.toBeInTheDocument()
    expect(screen.queryByText('s1')).not.toBeInTheDocument()
  })

  it('la matriz sin evaluaciones lo dice y no se queda vacía', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/matrix', RELACIONISTA, LEE, [
      ...base(),
      {
        path: '/sgspe/dashboards/indicators/KPI-STK-03',
        body: { code: 'KPI-STK-03', label: 'Matriz', available: true, value: 0, numerator: 0, denominator: 0 }
      }
    ])
    expect(await screen.findByText(/Aún no hay grupos de interés evaluados/)).toBeInTheDocument()
  })

  it('la matriz de una cuenta sin acceso dice "No disponible" con su motivo, no una matriz vacía', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/matrix', RELACIONISTA, LEE, [
      ...base(),
      {
        path: '/sgspe/dashboards/indicators/KPI-STK-03',
        body: { code: 'KPI-STK-03', label: 'Matriz', available: false, unavailableReason: 'OBJECT_NOT_READABLE' }
      }
    ])
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.getByText('Su rol no puede leer los registros de esta cifra')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Puntos de la matriz' })).not.toBeInTheDocument()
  })

  it('el detalle de un código sin lista dibuja todo menos los cinco desgloses que no son categorías', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/indicators/KPI-ENG-99', RELACIONISTA, LEE, [
      ...base(),
      {
        path: '/sgspe/dashboards/indicators/KPI-ENG-99',
        body: {
          code: 'KPI-ENG-99',
          label: 'Otro',
          available: true,
          value: 1,
          breakdowns: [
            { by: 'engagement', rows: [{ key: 'e1', label: 'Asamblea de agosto', value: 4 }] },
            { by: 'numerator', rows: [{ key: 'x', value: 1 }] },
            { by: 'denominator', rows: [{ key: 'y', value: 2 }] },
            { by: 'coverage', rows: [{ key: 'z', value: 2 }] }
          ]
        }
      }
    ])
    expect(await screen.findByRole('table', { name: 'Por interacción' })).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(1)
  })

  it('el detalle con demasiados registros dice "Acote los filtros" con los filtros a la vista, y un 403 "No disponible"', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/indicators/KPI-STK-04', RELACIONISTA, LEE, [
      ...base(),
      { path: '/sgspe/dashboards/indicators/KPI-STK-04', status: 400, body: problema(400, 'TOO_MANY_RECORDS') }
    ])
    expect(await screen.findByText('Acote los filtros')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Filtros del tablero' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Indicador' })).toBeInTheDocument()
  })

  it('el detalle de un indicador sin permiso dice "No disponible" con su motivo', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/indicators/KPI-STK-05', RELACIONISTA, LEE, [
      ...base(),
      {
        path: '/sgspe/dashboards/indicators/KPI-STK-05',
        body: { code: 'KPI-STK-05', label: 'Oposición que aceptó conversar', available: false, unavailableReason: 'FIELD_NOT_READABLE' }
      }
    ])
    expect(await screen.findByRole('heading', { name: 'Oposición que aceptó conversar', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('No disponible')).toBeInTheDocument()
    expect(screen.getByText('Su rol no puede leer un dato de esta cifra')).toBeInTheDocument()
    expect(screen.queryAllByRole('table')).toHaveLength(0)
  })
})
