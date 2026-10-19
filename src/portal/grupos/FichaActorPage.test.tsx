import { screen, waitFor, within } from '@testing-library/react'
import type { FetchMock, MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro } from '../../test/montar'
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
    const cargos = screen.getByRole('table', { name: 'Lista de cargos' })
    expect(await within(cargos).findByText('Persona registrada')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'APAFA' })).toHaveAttribute('href', '/actors/o3')
    // el contacto restringido lleva el candado y su motivo, como todo dato restringido (revisión final, M11)
    const restringido = screen.getByText('Restringido')
    expect(restringido.closest('li')).toHaveTextContent(/^Teléfono: Restringido/)
    expect(restringido).toHaveAccessibleDescription('Su rol no puede leer este dato')
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
    const cargos = screen.getByRole('table', { name: 'Lista de cargos' })
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

  // las rutas mínimas de una organización sin cargos, relaciones ni contactos; cada prueba agrega o cambia lo suyo
  const sinListas = (): MockRoute[] => [
    { path: '/objects/position/records', body: pagina([]) },
    { path: '/objects/contact_method/records', body: pagina([]) },
    { path: '/objects/actor_relationship/records', body: pagina([]) }
  ]
  const PERMISOS_DE_LECTURA = { stakeholder: ['READ'], organization: ['READ'], position: ['READ'], project: ['READ'], person: ['READ'] }

  describe('los proyectos del actor', () => {
    const grupoEn = (id: string, proyecto: string | null) => registro(id, { ...(proyecto ? { project: proyecto } : {}), organization: 'o1' })

    it('mientras cargan hay un solo estado de carga, sin una fila por proyecto: no cuenta los grupos fuera del alcance', async () => {
      let soltar: () => void = () => {}
      const retenida = new Promise<void>((r) => (soltar = r))
      fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos(PERMISOS_DE_LECTURA), [
        { path: '/objects/stakeholder/records', body: pagina([S1, grupoEn('sx', 'p8'), grupoEn('sy', 'p9')]) },
        ...base(),
        ...sinListas()
      ])
      red = espiarRed([
        {
          path: /^\/objects\/project\/records\/p[89]$/,
          responder: async (l) => {
            await retenida
            return problema(l.ruta.endsWith('p8') ? 403 : 404, 'Sin acceso')
          }
        }
      ])
      const proyectos = await screen.findByRole('region', { name: 'Es grupo de interés en' })
      await waitFor(() => expect(red!.a('GET', /\/objects\/project\/records\/p9$/)).toHaveLength(1))
      expect(within(proyectos).queryAllByRole('listitem')).toHaveLength(0)
      expect(within(proyectos).getAllByRole('status')).toHaveLength(1)
      // ni siquiera el proyecto legible se muestra a medias: la lista aparece completa
      expect(within(proyectos).queryByRole('link')).not.toBeInTheDocument()
      soltar()
      expect(await within(proyectos).findByRole('link', { name: 'PRJ-01 · Pukaqaqa' })).toBeInTheDocument()
      expect(within(proyectos).getAllByRole('listitem')).toHaveLength(1)
      expect(within(proyectos).queryByRole('status')).not.toBeInTheDocument()
    })

    it('un grupo sin la clave project no pide /records/undefined', async () => {
      fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos(PERMISOS_DE_LECTURA), [
        { path: '/objects/stakeholder/records', body: pagina([S1, grupoEn('sx', null)]) },
        ...base(),
        ...sinListas()
      ])
      red = espiarRed()
      const proyectos = await screen.findByRole('region', { name: 'Es grupo de interés en' })
      expect(await within(proyectos).findByRole('link', { name: 'PRJ-01 · Pukaqaqa' })).toBeInTheDocument()
      expect(red.llamadas.filter((l) => l.ruta.includes('/undefined'))).toHaveLength(0)
    })

    it('si todos los proyectos son ilegibles lo dice sin decir "ningún proyecto"', async () => {
      fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos(PERMISOS_DE_LECTURA), [
        { path: '/objects/stakeholder/records', body: pagina([grupoEn('sx', 'p8'), grupoEn('sy', 'p9')]) },
        { path: '/objects/project/records/p8', status: 403, body: { title: 'Forbidden' } },
        { path: '/objects/project/records/p9', status: 404, body: { title: 'Not Found' } },
        ...base(),
        ...sinListas()
      ])
      const proyectos = await screen.findByRole('region', { name: 'Es grupo de interés en' })
      expect(await within(proyectos).findByText(/no están disponibles para su cuenta/)).toBeInTheDocument()
      expect(within(proyectos).queryByRole('listitem')).not.toBeInTheDocument()
      expect(within(proyectos).queryByText(/Sin grupos de interés/)).not.toBeInTheDocument()
    })

    it('un 403 no se lista ni se anuncia; otro error se dice una vez con su reintento', async () => {
      fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos(PERMISOS_DE_LECTURA), [
        { path: '/objects/stakeholder/records', body: pagina([S1, grupoEn('sx', 'p8'), grupoEn('sy', 'p9')]) },
        { path: '/objects/project/records/p8', status: 403, body: { title: 'Forbidden' } },
        ...base(),
        ...sinListas()
      ])
      red = espiarRed([{ path: '/objects/project/records/p9', responder: () => problema(500, 'Falló la lectura') }])
      const proyectos = await screen.findByRole('region', { name: 'Es grupo de interés en' })
      expect(await within(proyectos).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
      expect(within(proyectos).getAllByRole('alert')).toHaveLength(1)
      expect(within(proyectos).queryByText('No disponible')).not.toBeInTheDocument()
    })
  })

  describe('el otro lado de un cargo o una relación', () => {
    it('una organización ilegible dice "No disponible", no "Persona registrada"; una persona ilegible, "Persona registrada"', async () => {
      fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos(PERMISOS_DE_LECTURA), [
        { path: '/objects/person/records/pe1', status: 403, body: { title: 'Forbidden' } },
        { path: '/objects/stakeholder/records', body: pagina([S1]) },
        ...base(),
        { path: '/objects/position/records', body: pagina([registro('po', { position_title: 'Presidente', position_status: 'VIGENTE', person: 'pe1' })]) },
        { path: '/objects/contact_method/records', body: pagina([]) },
        {
          path: /^\/objects\/actor_relationship\/records\?.*from_organization/,
          body: pagina([registro('ar', { relationship_type: 'AFILIADO A', to_organization: 'o9' })])
        },
        { path: '/objects/actor_relationship/records', body: pagina([]) },
        { path: '/objects/organization/records/o9', status: 403, body: { title: 'Forbidden' } }
      ])
      const relaciones = await screen.findByRole('region', { name: 'Red de relaciones' })
      expect(await within(relaciones).findByText('No disponible')).toBeInTheDocument()
      expect(within(relaciones).queryByText('Persona registrada')).not.toBeInTheDocument()
      const cargos = screen.getByRole('region', { name: 'Cargos' })
      expect(await within(cargos).findByText('Persona registrada')).toBeInTheDocument()
    })

    it('el nombre de una persona llega solo si la API lo devuelve', async () => {
      fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos(PERMISOS_DE_LECTURA), [
        { path: '/objects/person/records/pe1', body: registro('pe1', { given_names: 'Nombre', surnames: 'Ficticio' }) },
        { path: '/objects/stakeholder/records', body: pagina([S1]) },
        ...base(),
        { path: '/objects/position/records', body: pagina([registro('po', { position_title: 'Presidente', position_status: 'VIGENTE', person: 'pe1' })]) },
        { path: '/objects/contact_method/records', body: pagina([]) },
        { path: '/objects/actor_relationship/records', body: pagina([]) }
      ])
      const cargos = await screen.findByRole('table', { name: 'Lista de cargos' })
      expect(await within(cargos).findByText('Nombre Ficticio')).toBeInTheDocument()
      expect(within(cargos).queryByText('Persona registrada')).not.toBeInTheDocument()
    })
  })

  describe('abrir el actor', () => {
    const PERSONA = [
      { path: '/objects/stakeholder/records', body: pagina([S2]) },
      ...base(),
      { path: '/objects/position/records', body: pagina([]) },
      { path: '/objects/contact_method/records', body: pagina([]) },
      { path: '/objects/actor_relationship/records', body: pagina([]) }
    ]

    it('una organización que la cuenta no lee (403) se busca como persona', async () => {
      fetch = abrirPortal('/actors/pe1', RELACIONISTA, permisos({ ...PERMISOS_DE_LECTURA, organization: [] }), [
        { path: '/objects/organization/records/pe1', status: 403, body: { title: 'Forbidden' } },
        ...PERSONA
      ])
      expect(await screen.findByRole('heading', { name: 'Persona registrada' })).toBeInTheDocument()
      expect(screen.queryByText('No disponible')).not.toBeInTheDocument()
    })

    it.each([
      ['organización 403 y persona 404', 403, 404, 'No disponible'],
      ['organización 404 y persona 403', 404, 403, 'No disponible'],
      ['organización 404 y persona 500', 404, 500, 'Reintentar'],
      ['organización 403 y persona 500', 403, 500, 'Reintentar']
    ])('%s: el error final es el que corresponde', async (_caso, deLaOrganizacion, deLaPersona, esperado) => {
      fetch = abrirPortal('/actors/x1', RELACIONISTA, permisos(PERMISOS_DE_LECTURA), [
        { path: '/objects/organization/records/x1', status: deLaOrganizacion, body: { title: 'Error' } },
        { path: '/objects/person/records/x1', status: deLaPersona, body: { title: 'Error' } },
        ...PERSONA
      ])
      if (esperado === 'Reintentar') expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
      else expect(await screen.findByText(esperado)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Persona registrada' })).not.toBeInTheDocument()
      if (esperado !== 'Reintentar') expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    })
  })

  describe('Editar', () => {
    const rutasDeOrganizacion = (editable: boolean): MockRoute[] => [
      { path: '/objects/stakeholder/records', body: pagina([S1]) },
      ...base(),
      ...sinListas(),
      { path: '/metadata/objects/organization', body: definicion('organization', [['name', { editable }]]) }
    ]

    it('se ofrece con UPDATE y un campo escribible', async () => {
      fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos({ ...PERMISOS_DE_LECTURA, organization: ['READ', 'UPDATE'] }), rutasDeOrganizacion(true))
      expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument()
    })

    it('no se ofrece con UPDATE y todos los campos de solo lectura (rol con "u")', async () => {
      fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos({ ...PERMISOS_DE_LECTURA, organization: ['READ', 'UPDATE'] }), rutasDeOrganizacion(false))
      red = espiarRed()
      expect(await screen.findByRole('heading', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
      await waitFor(() => expect(red!.a('GET', '/metadata/objects/organization').length).toBeGreaterThan(0))
      expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    })

    it('no se ofrece sin UPDATE', async () => {
      fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos(PERMISOS_DE_LECTURA), rutasDeOrganizacion(true))
      red = espiarRed()
      expect(await screen.findByRole('heading', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
      await waitFor(() => expect(red!.a('GET', '/metadata/objects/organization').length).toBeGreaterThan(0))
      expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    })
  })

  it('la región y su tabla no repiten el mismo nombre', async () => {
    fetch = abrirPortal('/actors/o1', RELACIONISTA, permisos(PERMISOS_DE_LECTURA), [
      { path: '/objects/stakeholder/records', body: pagina([S1]) },
      ...base(),
      ...sinListas()
    ])
    expect(await screen.findByRole('region', { name: 'Cargos' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Lista de cargos' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Red de relaciones' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Lista de relaciones' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Cargos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Red de relaciones' })).not.toBeInTheDocument()
  })
})
