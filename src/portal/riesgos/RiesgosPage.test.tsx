import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { P1 } from '../../test/compromisos'
import { definicion, montar, pagina, registro } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { baseDeRiesgos, DEF_RIESGO, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS, RELACIONES_EN_RIESGOS, RIESGO } from '../../test/riesgos'
import { RELACIONISTA } from '../../test/portal'
import { nivelDePuntaje, umbralesDe } from './niveles'
import { RiesgosPage } from './RiesgosPage'

// S38 y S39 (screens.md §9): el mapa de calor por los valores vigentes, los riesgos sin revisión fuera del mapa, la celda que filtra
// la tabla, las vistas armadas en el portal y el alta con motivo, también desde un incidente
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const NUEVO = registro('k2', { project: 'p1', code: 'R-002', title: 'Desinformación sobre el uso del agua' }, { state: 'identified' })
const MEDIO = registro(
  'k3',
  {
    project: 'p1',
    code: 'R-003',
    title: 'Reclamo por polvo en la vía',
    probability: 2,
    impact: 3,
    score: 6,
    risk_level: 'MEDIO',
    review_status: 'POR REVISAR',
    next_review_date: '2026-10-10',
    owner_user_id: 'u-otro'
  },
  { state: 'assessed' }
)
const CERRADO = registro('k4', { project: 'p1', code: 'R-004', title: 'Paro de transportistas' }, { state: 'closed' })

const rutas = (extra: MockRoute[] = [], riesgos = [RIESGO, NUEVO, MEDIO, CERRADO]): MockRoute[] => [
  ...extra,
  ...baseDeRiesgos(),
  { path: '/objects/social_risk/records', body: pagina(riesgos) },
  { path: '/objects/project/records', body: pagina([P1]) }
]
const abrir = (ruta = '/projects/p1/risks/register', usuario = GESTOR_DE_RIESGOS, permisos = EQUIPO_DE_RIESGOS) =>
  montar(<RiesgosPage />, { ruta, camino: ruta.startsWith('/projects') ? '/projects/:projectId/risks/register' : '/risks/register', usuario, permisos })

describe('S38 y S39 · registro y matriz de riesgos', () => {
  it('el mapa cuenta los riesgos por P × I con el nivel de cada celda y deja fuera los que no tienen revisión', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const mapa = await screen.findByRole('region', { name: 'Mapa de calor' })
    expect(within(mapa).getByRole('button', { name: 'Probabilidad 4, impacto 4: 1 riesgo, nivel Crítico' })).toBeInTheDocument()
    expect(within(mapa).getByRole('button', { name: 'Probabilidad 2, impacto 3: 1 riesgo, nivel Medio' })).toBeInTheDocument()
    expect(within(mapa).getByRole('button', { name: 'Probabilidad 1, impacto 1: 0 riesgos, nivel Bajo' })).toBeInTheDocument()
    expect(within(mapa).getByText('Sin evaluar (fuera del mapa): 1')).toBeInTheDocument()
    const tabla = screen.getByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getByRole('link', { name: 'R-001 · Bloqueo de la vía de acceso por la comunidad' })).toHaveAttribute('href', '/projects/p1/risks/k1')
    expect(within(tabla).getByLabelText('Nivel de riesgo: Crítico')).toBeInTheDocument()
    expect(within(tabla).getByText('4 × 4 = 16')).toBeInTheDocument()
    expect(within(tabla).getByText('Sin evaluar')).toBeInTheDocument()
    expect(within(tabla).queryByText(/R-004/)).not.toBeInTheDocument()
  })

  it('sin puntaje la celda P × I dice «—» y un riesgo sin proyecto se nombra sin enlace', async () => {
    const SIN_PUNTAJE = registro('k5', { ...MEDIO.attributes, code: 'R-005', score: null }, { state: 'assessed' })
    const SIN_PROYECTO = registro('k6', { code: 'R-006', title: 'Huelga regional' }, { state: 'identified' })
    fetch = mockFetch(rutas([], [SIN_PUNTAJE, SIN_PROYECTO]))
    abrir()
    const tabla = await screen.findByRole('table', { name: 'Riesgos' })
    const fila = within(tabla).getByRole('row', { name: /R-005/ })
    expect(within(fila).queryByText(/=/)).not.toBeInTheDocument()
    expect(within(fila).getAllByText('—').length).toBeGreaterThan(0)
    expect(within(tabla).getByText('R-006 · Huelga regional')).toBeInTheDocument()
    expect(within(tabla).queryByRole('link', { name: /R-006/ })).not.toBeInTheDocument()
  })

  it('elegir una celda filtra la tabla y «Quitar filtro de celda» la devuelve entera', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: /Probabilidad 4, impacto 4/ }))
    const tabla = screen.getByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Probabilidad 4, impacto 4/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro de celda' }))
    expect(within(screen.getByRole('table', { name: 'Riesgos' })).getAllByRole('row')).toHaveLength(4)
  })

  it('las vistas: revisión pendiente, mis riesgos y cerrados', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Revisión pendiente' }))
    let tabla = screen.getByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getByText(/R-003/)).toBeInTheDocument()
    expect(within(tabla).getByLabelText('Situación de revisión: Por revisar')).toBeInTheDocument()
    expect(within(tabla).queryByText(/R-001/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Mis riesgos' }))
    tabla = screen.getByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getByText(/R-001/)).toBeInTheDocument()
    expect(within(tabla).queryByText(/R-003/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Cerrados' }))
    expect(within(screen.getByRole('table', { name: 'Riesgos' })).getByText(/R-004/)).toBeInTheDocument()
  })

  it('identificar un riesgo desde un incidente lo crea con el proyecto, el incidente de origen y el motivo', async () => {
    fetch = mockFetch(
      rutas([
        { method: 'POST', path: '/objects/social_risk/records', status: 201, body: NUEVO },
        // los ids de prueba no son UUID: aquí las relaciones fijas se leen como texto para que el formulario de wasichai las acepte
        {
          path: '/metadata/objects/social_risk',
          body: { ...DEF_RIESGO, fields: DEF_RIESGO.fields.map((f) => (['project', 'origin_incident'].includes(f.name) ? { ...f, type: 'TEXT' } : f)) }
        },
        { path: '/metadata/objects/locality', body: definicion('locality', ['name']) },
        { path: '/metadata/objects/community', body: definicion('community', ['name']) },
        { path: '/objects/locality/records', body: pagina([]) },
        { path: '/objects/community/records', body: pagina([]) }
      ])
    )
    red = espiarRed()
    abrir('/projects/p1/risks/register?nuevo=1&origin_incident=n1')
    const drawer = await screen.findByRole('dialog', { name: 'Identificar riesgo' })
    expect(within(drawer).getByText('El riesgo se registra con el incidente de origen.')).toBeInTheDocument()
    expect(within(drawer).getByText(/de 1 a 365/)).toBeInTheDocument()
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'riesgo visto en el bloqueo')
    await userEvent.type(await within(drawer).findByLabelText(/^code/), 'R-002')
    await userEvent.type(within(drawer).getByLabelText(/^title/), 'Desinformación sobre el uso del agua')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('POST', '/objects/social_risk/records')).toHaveLength(1))
    const [alta] = red.a('POST', '/objects/social_risk/records')
    expect(alta.cuerpo).toMatchObject({ attributes: { code: 'R-002', project: 'p1', origin_incident: 'n1' } })
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''riesgo%20visto%20en%20el%20bloqueo")
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('quien no crea riesgos no ve «Identificar riesgo»; en el alcance global se dice el proyecto de cada uno', async () => {
    fetch = mockFetch(rutas())
    abrir('/risks/register', RELACIONISTA, RELACIONES_EN_RIESGOS)
    const tabla = await screen.findByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getAllByRole('link', { name: 'PRJ-01 · Pukaqaqa' })[0]).toHaveAttribute('href', '/projects/p1/overview')
    expect(screen.queryByRole('button', { name: 'Identificar riesgo' })).not.toBeInTheDocument()
  })

  it('mientras los riesgos cargan no dice que no hay ninguno', async () => {
    fetch = mockFetch(rutas([], []))
    abrir()
    expect(screen.queryByText('No hay riesgos en esta vista.')).not.toBeInTheDocument()
    expect(await screen.findByText('No hay riesgos en esta vista.')).toBeInTheDocument()
  })
})

describe('niveles de riesgo', () => {
  it('el nivel sale del puntaje con los umbrales del proyecto, o los por defecto si están vacíos', () => {
    expect([4, 5, 10, 15].map((n) => nivelDePuntaje(n))).toEqual(['BAJO', 'MEDIO', 'ALTO', 'CRITICO'])
    const umbrales = umbralesDe(registro('p1', { risk_medium_min_score: 4, risk_high_min_score: 9, risk_critical_min_score: null }))
    expect(umbrales).toEqual({ medio: 4, alto: 9, critico: 15 })
    expect(nivelDePuntaje(9, umbrales)).toBe('ALTO')
  })
})
