import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { RELACIONISTA } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { ALERTA, baseDeRiesgos, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS, REGLA, RELACIONES_EN_RIESGOS, RIESGO } from '../../test/riesgos'
import { AlertasPage, FichaAlertaPage } from './AlertasPage'

// S41 · centro de alerta temprana (screens.md §9, flujo 14): la lista por vistas, la ficha con la regla que la creó (sin su clave),
// sus señales, «Vincular señal…» y el riesgo vinculado; confirmar y descartar solo con CONFIRM_ALERT (RN-EWS-001)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const CONFIRMADA = registro(
  'w2',
  { project: 'p1', title: 'Bloqueo anunciado', detected_at: '2026-10-03T13:00:00Z', severity: 'CRITICO' },
  { state: 'confirmed' }
)
const SENAL_VINCULADA = registro('s1', {
  project: 'p1',
  source_type: 'MEDIOS LOCALES',
  received_at: '2026-10-04T15:00:00Z',
  description: 'La radio local anuncia una asamblea de protesta',
  early_warning: 'w1'
})
const SENAL_LIBRE = registro('s2', {
  project: 'p1',
  source_type: 'EQUIPO SOCIAL',
  received_at: '2026-10-05T15:00:00Z',
  description: 'Comuneros piden reunión urgente con la gerencia',
  early_warning: null
})

// la alerta como la lee la API genérica: con el riesgo vacío (un campo legible llega aunque sea null)
const ALERTA_LEIDA = { ...ALERTA, attributes: { ...ALERTA.attributes, social_risk: null } }

const transiciones = {
  path: '/objects/early_warning/records/w1/transitions',
  body: [
    { name: 'confirm', label: 'Confirmar', to: 'confirmed', toLabel: 'Confirmada', allowed: true, reason: null },
    { name: 'dismiss', label: 'Descartar', to: 'dismissed', toLabel: 'Descartada', allowed: true, reason: null }
  ]
}

const rutasDeFicha = (usuario = GESTOR_DE_RIESGOS, extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeRiesgos(usuario),
  { path: '/objects/early_warning/records/w1', body: ALERTA_LEIDA },
  { path: '/objects/early_warning_rule/records/rg1', body: REGLA },
  { path: /^\/objects\/early_warning_signal\/records\?early_warning=w1/, body: pagina([SENAL_VINCULADA]) },
  { path: /^\/objects\/early_warning_signal\/records\?project=p1/, body: pagina([SENAL_VINCULADA, SENAL_LIBRE]) },
  transiciones,
  { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } }
]

const abrirFicha = (usuario = GESTOR_DE_RIESGOS, permisos = EQUIPO_DE_RIESGOS) =>
  montar(<FichaAlertaPage />, {
    ruta: '/projects/p1/risks/warnings/w1',
    camino: '/projects/:projectId/risks/warnings/:warningId',
    usuario,
    permisos
  })

describe('S41 · lista de alertas', () => {
  it('abre en las alertas por triar, con su origen; otra vista muestra las confirmadas', async () => {
    fetch = mockFetch([
      ...baseDeRiesgos(),
      { path: '/objects/early_warning/records', body: pagina([ALERTA, CONFIRMADA]) },
      { path: '/objects/early_warning_rule/records/rg1', body: REGLA }
    ])
    montar(<AlertasPage />, {
      ruta: '/projects/p1/risks/warnings',
      camino: '/projects/:projectId/risks/warnings',
      usuario: GESTOR_DE_RIESGOS,
      permisos: EQUIPO_DE_RIESGOS
    })
    const tabla = await screen.findByRole('table', { name: 'Alertas del proyecto' })
    expect(within(tabla).getByRole('link', { name: 'Señales de conflicto: CONTEO DE SEÑALES' })).toHaveAttribute('href', '/projects/p1/risks/warnings/w1')
    expect(await within(tabla).findByRole('link', { name: 'Señales de conflicto' })).toHaveAttribute('href', '/projects/p1/risks/rules')
    expect(within(tabla).queryByText('Bloqueo anunciado')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Confirmadas' }))
    expect(await screen.findByRole('link', { name: 'Bloqueo anunciado' })).toBeInTheDocument()
    expect(screen.getByText('Registrada a mano')).toBeInTheDocument()
  })

  it('mientras carga no dice que no hay alertas', async () => {
    fetch = mockFetch([...baseDeRiesgos(), { path: '/objects/early_warning/records', body: pagina([]) }])
    montar(<AlertasPage />, {
      ruta: '/projects/p1/risks/warnings',
      camino: '/projects/:projectId/risks/warnings',
      usuario: GESTOR_DE_RIESGOS,
      permisos: EQUIPO_DE_RIESGOS
    })
    expect(screen.queryByText('No hay alertas en esta vista')).not.toBeInTheDocument()
    expect(await screen.findByText('No hay alertas en esta vista')).toBeInTheDocument()
  })
})

describe('S41 · ficha de alerta', () => {
  it('dice qué la disparó y la regla que la creó, sin su clave de origen; quien gestiona riesgos puede confirmar o descartar', async () => {
    fetch = mockFetch(rutasDeFicha())
    abrirFicha()
    expect(await screen.findByRole('heading', { name: 'Señales de conflicto: CONTEO DE SEÑALES', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('4 señales en 7 días (umbral 3)')).toBeInTheDocument()
    const regla = screen.getByRole('region', { name: 'Regla que la creó' })
    expect(await within(regla).findByText('CONTEO DE SEÑALES')).toBeInTheDocument()
    expect(within(regla).getByText('7 días')).toBeInTheDocument()
    expect(within(regla).getByText(/La creó la regla/)).toBeInTheDocument()
    expect(screen.queryByText(/warning_rule:rg1/)).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument()
    expect(screen.queryByText('Solo quien gestiona los riesgos confirma o descarta una alerta.')).not.toBeInTheDocument()
    const senales = screen.getByRole('region', { name: 'Señales' })
    expect(await within(senales).findByText('La radio local anuncia una asamblea de protesta')).toBeInTheDocument()
  })

  it('sin la acción de confirmar alertas, confirmar y descartar no se ofrecen y se dice por qué', async () => {
    // una transición que no es de confirmar ni descartar prueba que las transiciones ya llegaron antes de afirmar la ausencia
    const conOtra = {
      path: transiciones.path,
      body: [...transiciones.body, { name: 'watch', label: 'Poner en seguimiento', to: 'watching', toLabel: 'En seguimiento', allowed: true, reason: null }]
    }
    fetch = mockFetch(rutasDeFicha(RELACIONISTA, [conOtra]))
    abrirFicha(RELACIONISTA, RELACIONES_EN_RIESGOS)
    expect(await screen.findByText('Solo quien gestiona los riesgos confirma o descarta una alerta.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Poner en seguimiento' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument()
  })

  it('«Vincular señal…» escribe la alerta en una señal del proyecto sin alerta, con la versión leída', async () => {
    fetch = mockFetch(
      rutasDeFicha(GESTOR_DE_RIESGOS, [
        { path: '/objects/early_warning_signal/records/s2', body: { ...SENAL_LIBRE, attributes: { ...SENAL_LIBRE.attributes, early_warning: 'w1' } } }
      ])
    )
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/early_warning_signal/records/s2',
        responder: () => jsonResponse({ ...SENAL_LIBRE, attributes: { ...SENAL_LIBRE.attributes, early_warning: 'w1' } })
      }
    ])
    abrirFicha()
    await userEvent.click(await screen.findByText('Vincular señal…'))
    const elegir = await screen.findByLabelText('Señal del proyecto sin alerta')
    expect(within(elegir).queryByRole('option', { name: /La radio local/ })).not.toBeInTheDocument()
    await userEvent.selectOptions(elegir, 's2')
    await userEvent.click(screen.getByRole('button', { name: 'Vincular' }))
    expect(await screen.findByText('Señal vinculada.')).toBeInTheDocument()
    const [put] = red.a('PUT', '/objects/early_warning_signal/records/s2')
    expect(put.cuerpo).toMatchObject({ attributes: { early_warning: 'w1' } })
    expect(put.cabeceras.get('If-Match')).toBe(`"${SENAL_LIBRE.updatedAt}"`)
  })

  it('«Vincular riesgo» busca en los riesgos del proyecto y escribe el riesgo en la alerta', async () => {
    fetch = mockFetch(
      rutasDeFicha(GESTOR_DE_RIESGOS, [
        { path: /^\/objects\/social_risk\/records\?project=p1/, body: pagina([RIESGO]) },
        { path: '/objects/social_risk/records/k1', body: RIESGO }
      ])
    )
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/early_warning/records/w1',
        responder: () => jsonResponse({ ...ALERTA_LEIDA, attributes: { ...ALERTA_LEIDA.attributes, social_risk: 'k1' } })
      }
    ])
    abrirFicha()
    expect(await screen.findByText('Sin riesgo vinculado')).toBeInTheDocument()
    await userEvent.type(await screen.findByLabelText('Vincular riesgo: buscar por código o título'), 'R-0')
    await userEvent.click(await screen.findByRole('button', { name: 'R-001 · Bloqueo de la vía de acceso por la comunidad' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/early_warning/records/w1')).toHaveLength(1))
    expect(red.a('PUT', '/objects/early_warning/records/w1')[0].cuerpo).toMatchObject({ attributes: { social_risk: 'k1' } })
  })

  it('una alerta que no existe lo dice con su texto', async () => {
    fetch = mockFetch(rutasDeFicha(GESTOR_DE_RIESGOS, [{ path: '/objects/early_warning/records/w1', status: 404, body: { title: 'Not Found', status: 404 } }]))
    abrirFicha()
    expect(await screen.findByText('Esta alerta no existe o no es de su organización.')).toBeInTheDocument()
  })
})
