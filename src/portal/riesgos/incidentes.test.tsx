import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { QUEJA } from '../../test/atencion'
import { montar, pagina, registro } from '../../test/montar'
import { RELACIONISTA } from '../../test/portal'
import { baseDeRiesgos, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS, INCIDENTE, RIESGO } from '../../test/riesgos'
import { FichaIncidentePage, IncidentesPage } from './IncidentesPage'

// los incidentes (screens.md §9, WF-M): la lista con «Registrar incidente» para quien crea, y la ficha con la respuesta que exige el
// cierre (transition-checks lo dice antes), lo que generó y el alta de un riesgo con el incidente de origen
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const SENAL = registro('s3', { project: 'p1', received_at: '2026-10-04T16:00:00Z', description: 'Vecinos anuncian otro bloqueo', incident: 'n1' })

const rutasDeFicha = (usuario = GESTOR_DE_RIESGOS, extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeRiesgos(usuario),
  { path: '/objects/incident/records/n1', body: INCIDENTE },
  {
    path: '/objects/incident/records/n1/transitions',
    body: [{ name: 'close', label: 'Cerrar', to: 'closed', toLabel: 'Cerrado', allowed: true, reason: null }]
  },
  {
    method: 'POST',
    path: '/sgspe/transition-checks',
    body: {
      allowed: false,
      blocking: [{ code: 'FIELD_REQUIRED', message: 'Falta la respuesta inmediata del incidente', field: 'immediate_response' }],
      warnings: []
    }
  },
  { path: /^\/objects\/social_risk\/records\?origin_incident=n1/, body: pagina([{ ...RIESGO, attributes: { ...RIESGO.attributes, origin_incident: 'n1' } }]) },
  { path: /^\/objects\/grievance\/records\?incident=n1/, body: pagina([{ ...QUEJA, attributes: { ...QUEJA.attributes, incident: 'n1' } }]) },
  { path: /^\/objects\/early_warning_signal\/records\?incident=n1/, body: pagina([SENAL]) }
]

const abrirFicha = (usuario = GESTOR_DE_RIESGOS, permisos = EQUIPO_DE_RIESGOS) =>
  montar(<FichaIncidentePage />, { ruta: '/projects/p1/incidents/n1', camino: '/projects/:projectId/incidents/:incidentId', usuario, permisos })

describe('incidentes', () => {
  it('la lista enlaza cada ficha y ofrece «Registrar incidente» a quien crea, con su formulario', async () => {
    fetch = mockFetch([...baseDeRiesgos(), { path: '/objects/incident/records', body: pagina([INCIDENTE]) }])
    montar(<IncidentesPage />, {
      ruta: '/projects/p1/incidents',
      camino: '/projects/:projectId/incidents',
      usuario: GESTOR_DE_RIESGOS,
      permisos: EQUIPO_DE_RIESGOS
    })
    const tabla = await screen.findByRole('table', { name: 'Incidentes del proyecto' })
    expect(within(tabla).getByRole('link', { name: 'I-001' })).toHaveAttribute('href', '/projects/p1/incidents/n1')
    expect(within(tabla).getByText('Bloqueo de vía')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar incidente' }))
    const drawer = await screen.findByRole('dialog', { name: 'Registrar incidente' })
    expect(await within(drawer).findByLabelText(/^code/)).toBeInTheDocument()
    expect(within(drawer).queryByLabelText(/^immediate_response/)).not.toBeInTheDocument()
  })

  it('sin CREATE no se ofrece registrar; mientras carga no dice que no hay incidentes', async () => {
    fetch = mockFetch([...baseDeRiesgos(RELACIONISTA), { path: '/objects/incident/records', body: pagina([]) }])
    montar(<IncidentesPage />, {
      ruta: '/projects/p1/incidents',
      camino: '/projects/:projectId/incidents',
      usuario: RELACIONISTA,
      permisos: { admin: false, objects: { project: ['READ'], project_assignment: ['READ'], incident: ['READ'] } }
    })
    expect(screen.queryByText('No hay incidentes registrados')).not.toBeInTheDocument()
    expect(await screen.findByText('No hay incidentes registrados')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar incidente' })).not.toBeInTheDocument()
  })

  // tercera pasada de UX (1.2 y 1.5): la ficha con la anatomía común; el título dice qué pasó y cerrar pide en su diálogo la respuesta
  // inmediata que falta, en vez de salir bloqueado
  it('la ficha dice qué pasó, que cerrar pide la respuesta inmediata en su diálogo y qué generó', async () => {
    fetch = mockFetch(rutasDeFicha())
    abrirFicha()
    expect(await screen.findByRole('heading', { name: 'Un grupo de comuneros bloqueó la vía durante cuatro horas', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/^Incidente · I-001/)).toBeInTheDocument()
    expect(screen.getAllByText('Para cerrar el incidente hacen falta la respuesta inmediata y las consecuencias.').length).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: 'Situación' })).toBeInTheDocument()
    const cerrar = await screen.findByRole('button', { name: 'Cerrar' })
    expect(cerrar).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(cerrar)
    const dialogo = await screen.findByRole('dialog', { name: 'Cerrar' })
    expect(await within(dialogo).findByLabelText('immediate_response (obligatorio)')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    const genero = screen.getByRole('complementary', { name: 'Qué generó' })
    expect(await within(genero).findByRole('link', { name: 'R-001 · Bloqueo de la vía de acceso por la comunidad' })).toHaveAttribute(
      'href',
      '/projects/p1/risks/k1'
    )
    expect(await within(genero).findByRole('link', { name: /^Q-001/ })).toHaveAttribute('href', '/projects/p1/grievances/g1')
    expect(await within(genero).findByRole('link', { name: /Vecinos anuncian otro bloqueo/ })).toHaveAttribute('href', '/projects/p1/risks/signals/s3')
    expect(await screen.findByRole('link', { name: 'Identificar un riesgo desde este incidente' })).toHaveAttribute(
      'href',
      '/projects/p1/risks/register?nuevo=1&origin_incident=n1'
    )
  })

  it('quien edita incidentes pero no crea riesgos no ve «Identificar un riesgo»; quien sí crea, lo ve', async () => {
    const sinRiesgos = { ...EQUIPO_DE_RIESGOS, objects: { ...EQUIPO_DE_RIESGOS.objects, social_risk: ['READ', 'UPDATE', 'EXPORT'] } }
    fetch = mockFetch(rutasDeFicha())
    const { unmount } = abrirFicha(GESTOR_DE_RIESGOS, sinRiesgos)
    expect(await screen.findByRole('heading', { name: 'Un grupo de comuneros bloqueó la vía durante cuatro horas', level: 1 })).toBeInTheDocument()
    // «Editar» sale con la misma guarda de proyecto: con ella resuelta, la ausencia del enlace es por el permiso
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Identificar un riesgo desde este incidente' })).not.toBeInTheDocument()
    unmount()
    abrirFicha(GESTOR_DE_RIESGOS, EQUIPO_DE_RIESGOS)
    expect(await screen.findByRole('link', { name: 'Identificar un riesgo desde este incidente' })).toBeInTheDocument()
  })

  it('un incidente que no existe lo dice y no ofrece identificar un riesgo', async () => {
    fetch = mockFetch(rutasDeFicha(RELACIONISTA, [{ path: '/objects/incident/records/n1', status: 404, body: { title: 'Not Found', status: 404 } }]))
    abrirFicha(RELACIONISTA)
    expect(await screen.findByText('Este incidente no existe o no es de sus proyectos.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Identificar un riesgo desde este incidente' })).not.toBeInTheDocument()
  })
})
