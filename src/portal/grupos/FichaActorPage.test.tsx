import { screen, within } from '@testing-library/react'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { base, S1, S2 } from '../../test/grupos'

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

describe('S18 · ficha de actor', () => {
  it('muestra cargos, relaciones, contactos sin consentimiento y los proyectos legibles', async () => {
    fetch = abrirPortal(
      '/actors/o1',
      RELACIONISTA,
      permisos({ stakeholder: ['READ'], organization: ['READ'], position: ['READ'], project: ['READ'], community: ['READ'] }),
      [
        // los grupos de interés del actor: uno en un proyecto legible y otro en uno que no lo es
        { path: '/objects/stakeholder/records', body: pagina([S1, registro('sx', { project: 'p9', organization: 'o1' })]) },
        ...base(),
        { path: '/objects/community/records/c1', body: registro('c1', { name: 'CC Tunas Pampa' }) },
        { path: '/objects/position/records', body: pagina([registro('po', { position_title: 'Presidente', position_status: 'VIGENTE', person: 'pe1' })]) },
        { path: '/objects/contact_method/records', body: pagina([registro('cm', { channel: 'TELEFONO', consent_given: false })]) },
        {
          path: /^\/objects\/actor_relationship\/records\?.*from_organization/,
          body: pagina([registro('ar', { relationship_type: 'AFILIADO A', to_organization: 'o3' })])
        },
        { path: '/objects/actor_relationship/records', body: pagina([]) },
        { path: '/objects/project/records/p9', status: 404, body: { title: 'Not Found' } }
      ]
    )
    expect(await screen.findByRole('heading', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'CC Tunas Pampa' })).toHaveAttribute('href', '/territory/communities/c1')
    const cargos = screen.getByRole('table', { name: 'Cargos' })
    expect(await within(cargos).findByText('Persona registrada')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'APAFA' })).toHaveAttribute('href', '/actors/o3')
    expect(screen.getByText('TELEFONO: Restringido')).toBeInTheDocument()
    expect(screen.getByText('(sin consentimiento: no se usa para avisos)')).toBeInTheDocument()
    const proyectos = screen.getByRole('region', { name: 'Es grupo de interés en' })
    expect(await within(proyectos).findByRole('link', { name: 'PRJ-01 · Pukaqaqa' })).toBeInTheDocument()
    expect(within(proyectos).getAllByRole('link')).toHaveLength(1)
  })

  it('un 403 en los cargos o los contactos dice "No disponible" y un error ofrece reintentar, nunca una lista vacía', async () => {
    fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos({ stakeholder: ['READ'], organization: ['READ'], project: ['READ'] }), [
      { path: '/objects/stakeholder/records', body: pagina([S1]) },
      ...base(),
      { path: '/objects/position/records', body: pagina([]) },
      { path: '/objects/contact_method/records', body: pagina([]) },
      { path: '/objects/actor_relationship/records', body: pagina([]) }
    ])
    red = espiarRed([
      { path: '/objects/position/records', responder: () => problema(403, 'Sin permiso') },
      { path: '/objects/contact_method/records', responder: () => problema(403, 'Sin permiso') },
      { path: '/objects/actor_relationship/records', responder: () => problema(409, 'Conflicto') }
    ])
    expect(await screen.findByRole('heading', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
    const contactos = await screen.findByRole('region', { name: 'Medios de contacto' })
    expect(await within(contactos).findByText('No disponible')).toBeInTheDocument()
    expect(within(contactos).queryByText(/Sin medios de contacto/)).not.toBeInTheDocument()
    const red_ = await screen.findByRole('region', { name: 'Red de relaciones' })
    expect(await within(red_).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(within(red_).queryByText(/Sin relaciones registradas/)).not.toBeInTheDocument()
    const cargos = screen.getByRole('region', { name: 'Cargos' })
    expect(await within(cargos).findByText('No disponible')).toBeInTheDocument()
    expect(within(cargos).queryByText(/Sin cargos registrados/)).not.toBeInTheDocument()
  })

  it('una persona se abre en el mismo camino: sin los nombres es "Persona registrada" y su ficha no ofrece agregar cargos', async () => {
    fetch = abrirPortal(
      '/actors/pe1',
      RELACIONISTA,
      permisos({ stakeholder: ['READ'], person: ['READ', 'UPDATE'], position: ['READ', 'CREATE'], project: ['READ'] }),
      [
        { path: '/objects/organization/records/pe1', status: 404, body: { title: 'Not Found' } },
        { path: '/objects/stakeholder/records', body: pagina([S2]) },
        ...base(),
        { path: '/objects/position/records', body: pagina([registro('po', { position_title: 'Secretaria', position_status: 'VIGENTE', organization: 'o3' })]) },
        { path: '/objects/contact_method/records', body: pagina([]) },
        { path: '/objects/actor_relationship/records', body: pagina([]) }
      ]
    )
    expect(await screen.findByRole('heading', { name: 'Persona registrada' })).toBeInTheDocument()
    const cargos = screen.getByRole('table', { name: 'Cargos' })
    expect(await within(cargos).findByText('APAFA')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar cargo' })).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'PRJ-01 · Pukaqaqa' })).toHaveAttribute('href', '/projects/p1/stakeholders/s2')
  })

  it('un error que no es 404 al abrir el actor no se toma por una persona y ofrece reintentar', async () => {
    fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos({ organization: ['READ'], stakeholder: ['READ'] }), [
      { path: '/objects/organization/records/o1', status: 409, body: { title: 'Conflict' } }
    ])
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Persona registrada' })).not.toBeInTheDocument()
  })
})
