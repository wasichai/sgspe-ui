import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro, ubicacion } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { ALERTA, baseDeRiesgos, DEF_IMPACTO, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS } from '../../test/riesgos'
import { Impactos, ImpactosPage } from './ImpactosPage'
import { MencionesPage } from './MencionesPage'
import { SenalesPage } from './SenalesPage'

// S58, S59 y S61 (screens.md §9): las menciones con su tono y su enlace (nunca descargado, solo http o https), la mención abierta
// desde la ruta, las señales con o sin alerta, y los impactos del proyecto o de un riesgo
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const MENCION = registro('m1', {
  project: 'p1',
  outlet_name: 'Radio Andina',
  published_date: '2026-10-03',
  headline: 'Comuneros denuncian polvo en la vía',
  url: 'https://radio.example.pe/nota/123',
  tone: 'NEGATIVO'
})
const SOSPECHOSA = registro('m2', { project: 'p1', headline: 'Nota sin enlace válido', url: 'javascript:alert(1)', tone: 'NEUTRO' })

const montarEn = (ui: React.ReactElement, ruta: string, camino: string) => montar(ui, { ruta, camino, usuario: GESTOR_DE_RIESGOS, permisos: EQUIPO_DE_RIESGOS })

describe('S58 · menciones en medios', () => {
  const rutas = (extra: MockRoute[] = []): MockRoute[] => [
    ...extra,
    ...baseDeRiesgos(),
    { path: '/objects/media_mention/records', body: pagina([MENCION, SOSPECHOSA]) }
  ]

  it('dice el tono con texto y el dominio del enlace, que se abre en otra pestaña; un enlace que no es web no se enlaza', async () => {
    fetch = mockFetch(rutas())
    montarEn(<MencionesPage />, '/projects/p1/risks/mentions', '/projects/:projectId/risks/mentions/:mentionId?')
    const tabla = await screen.findByRole('table', { name: 'Menciones' })
    expect(within(tabla).getByLabelText('Tono: NEGATIVO')).toBeInTheDocument()
    const enlace = within(tabla).getByRole('link', { name: /radio\.example\.pe/ })
    expect(enlace).toHaveAttribute('href', 'https://radio.example.pe/nota/123')
    expect(enlace).toHaveAttribute('target', '_blank')
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(tabla).getByText('javascript:alert(1)')).toBeInTheDocument()
    expect(within(tabla).getAllByRole('link')).toHaveLength(1)
  })

  it('una mención sin titular abre su drawer con un botón que dice «—», nunca sin nombre', async () => {
    fetch = mockFetch(rutas().map((r) => (r.path === '/objects/media_mention/records' ? { ...r, body: pagina([registro('m3', { project: 'p1' })]) } : r)))
    montarEn(<MencionesPage />, '/projects/p1/risks/mentions', '/projects/:projectId/risks/mentions/:mentionId?')
    const tabla = await screen.findByRole('table', { name: 'Menciones' })
    expect(within(tabla).getByRole('button', { name: '—' })).toBeInTheDocument()
  })

  it('abrir una mención lleva a su ruta, y la ruta abre su drawer', async () => {
    fetch = mockFetch(rutas())
    montarEn(<MencionesPage />, '/projects/p1/risks/mentions', '/projects/:projectId/risks/mentions/:mentionId?')
    await userEvent.click(await screen.findByRole('button', { name: 'Comuneros denuncian polvo en la vía' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/risks/mentions/m1'))
    expect(await screen.findByRole('dialog', { name: 'Menciones' })).toBeInTheDocument()
  })

  // tercera pasada de UX, 3.7 y 3.8: la lista de la página busca por titular o medio, con ?q= en la URL, y abrir una mención la
  // conserva; sin coincidencias, ofrece limpiar la búsqueda
  it('busca por titular o medio, abrir una mención conserva la búsqueda y sin coincidencias ofrece limpiarla', async () => {
    fetch = mockFetch(rutas())
    montarEn(<MencionesPage />, '/projects/p1/risks/mentions', '/projects/:projectId/risks/mentions/:mentionId?')
    const caja = await screen.findByRole('searchbox', { name: 'Buscar por titular o medio' })
    await userEvent.type(caja, 'radio andina')
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Menciones' })).getAllByRole('row')).toHaveLength(2))
    expect(ubicacion.actual).toBe('/projects/p1/risks/mentions?q=radio+andina')
    await userEvent.click(screen.getByRole('button', { name: 'Comuneros denuncian polvo en la vía' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/risks/mentions/m1?q=radio+andina'))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/risks/mentions?q=radio+andina'))
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar por titular o medio' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por titular o medio' }), 'xyz')
    expect(await screen.findByText('Nada coincide con los filtros')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Menciones' })).getAllByRole('row')).toHaveLength(3))
    expect(ubicacion.actual).toBe('/projects/p1/risks/mentions')
  })
})

describe('S59 · señales de alerta', () => {
  const SIN_ALERTA = registro('sg1', { project: 'p1', source_type: 'EQUIPO SOCIAL', received_at: '2026-10-04T15:00:00Z', description: 'x'.repeat(120) })
  const CON_ALERTA = registro('sg2', {
    project: 'p1',
    source_type: 'MEDIOS LOCALES',
    received_at: '2026-10-05T15:00:00Z',
    description: 'Rumor de paro',
    early_warning: 'w1'
  })

  it('una señal sin alerta lo dice; con alerta enlaza su ficha; la descripción larga se recorta', async () => {
    fetch = mockFetch([
      ...baseDeRiesgos(),
      { path: '/objects/early_warning_signal/records', body: pagina([SIN_ALERTA, CON_ALERTA]) },
      { path: '/objects/early_warning/records/w1', body: ALERTA }
    ])
    montarEn(<SenalesPage />, '/projects/p1/risks/signals', '/projects/:projectId/risks/signals/:signalId?')
    const tabla = await screen.findByRole('table', { name: 'Señales' })
    expect(within(tabla).getByText('Sin alerta')).toBeInTheDocument()
    expect(await within(tabla).findByRole('link', { name: /Señales de conflicto/ })).toHaveAttribute('href', '/projects/p1/risks/warnings/w1')
    expect(within(tabla).getByRole('button', { name: `${'x'.repeat(80)}…` })).toBeInTheDocument()
  })

  it('una señal sin descripción abre su drawer con un botón que dice «—», nunca sin nombre', async () => {
    fetch = mockFetch([...baseDeRiesgos(), { path: '/objects/early_warning_signal/records', body: pagina([registro('sg3', { project: 'p1' })]) }])
    montarEn(<SenalesPage />, '/projects/p1/risks/signals', '/projects/:projectId/risks/signals/:signalId?')
    const tabla = await screen.findByRole('table', { name: 'Señales' })
    expect(within(tabla).getByRole('button', { name: '—' })).toBeInTheDocument()
  })

  it('el alta pide no escribir nombres de personas', async () => {
    fetch = mockFetch([...baseDeRiesgos(), { path: '/objects/early_warning_signal/records', body: pagina([]) }])
    montarEn(<SenalesPage />, '/projects/p1/risks/signals', '/projects/:projectId/risks/signals/:signalId?')
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar señal' }))
    await waitFor(() => expect(ubicacion.actual).toMatch(/^\/projects\/p1\/risks\/signals\//))
    expect(await screen.findByText('Describa lo que pasó sin nombres de personas.')).toBeInTheDocument()
  })
})

describe('S61 · impactos potenciales', () => {
  const IMPACTO = registro('pi1', { project: 'p1', activity_type: 'Perforación', description: 'Ruido cerca del colegio', impact_sign: 'NEGATIVO' })

  it('la lista del proyecto dice «Sin riesgo vinculado» a un impacto sin riesgo', async () => {
    fetch = mockFetch([...baseDeRiesgos(), { path: '/objects/potential_impact/records', body: pagina([IMPACTO]) }])
    montarEn(<ImpactosPage />, '/projects/p1/risks/impacts', '/projects/:projectId/risks/impacts')
    const tabla = await screen.findByRole('table', { name: 'Impactos' })
    expect(within(tabla).getByText('Sin riesgo vinculado')).toBeInTheDocument()
  })

  it('dentro de un riesgo lista y crea sus impactos con el proyecto y el riesgo fijos, sin la columna Riesgo', async () => {
    const texto = (f: { name: string }) => (['project', 'social_risk'].includes(f.name) ? { ...f, type: 'TEXT' } : f)
    fetch = mockFetch([
      // los ids de prueba no son UUID: las relaciones fijas se leen como texto para que el formulario de wasichai las acepte
      { path: '/metadata/objects/potential_impact', body: { ...DEF_IMPACTO, fields: DEF_IMPACTO.fields.map(texto) } },
      ...baseDeRiesgos(),
      { path: '/objects/potential_impact/records', body: pagina([{ ...IMPACTO, attributes: { ...IMPACTO.attributes, social_risk: 'k1' } }]) },
      { method: 'POST', path: '/objects/potential_impact/records', status: 201, body: IMPACTO }
    ])
    red = espiarRed()
    montarEn(<Impactos proyecto="p1" riesgo="k1" />, '/projects/p1/risks/k1', '/projects/:projectId/risks/:riskId')
    const tabla = await screen.findByRole('table', { name: 'Impactos' })
    expect(within(tabla).queryByRole('columnheader', { name: 'Riesgo' })).not.toBeInTheDocument()
    expect(red.llamadas.some((l) => /potential_impact\/records\?.*social_risk=k1/.test(l.ruta))).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: '+ Impacto potencial' }))
    const drawer = await screen.findByRole('dialog', { name: '+ Impacto potencial' })
    await userEvent.type(await within(drawer).findByLabelText(/^description/), 'Tránsito de cisternas')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('POST', '/objects/potential_impact/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/potential_impact/records')[0].cuerpo).toMatchObject({
      attributes: { description: 'Tránsito de cisternas', project: 'p1', social_risk: 'k1' }
    })
  })
})
