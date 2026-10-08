import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro } from '../../test/montar'
import { hoyEnLima } from '../datos/fechas'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { base, LEE, P1, S1 } from '../../test/grupos'

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

const filas = () =>
  within(screen.getByRole('table', { name: 'Grupos de interés' }))
    .getAllByRole('row')
    .slice(1)

describe('S16 · lista de grupos de interés', () => {
  it('sin acceso a la postura, la columna dice Restringida y no hay filtro por ella; los retirados no salen en "Todos"', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(within(filas()[0]).getByText('Restringido')).toBeInTheDocument()
    expect(within(filas()[1]).getAllByText('Sin evaluar')).toHaveLength(2)
    expect(screen.queryByRole('combobox', { name: 'Postura' })).not.toBeInTheDocument()
    expect(await within(filas()[0]).findByText('Ronda campesina Tunas')).toBeInTheDocument()
    expect(await within(filas()[1]).findByText('Persona registrada')).toBeInTheDocument()
  })

  it('el nombre de una persona sale solo de lo que la API devuelve: sin las claves (ANALYST, READ_ONLY), Persona registrada', async () => {
    // quien lee given_names y surnames los recibe; a quien no, wasichai no le manda las claves (security.md §7.9)
    fetch = abrirPortal('/projects/p1/stakeholders', GERENCIA_SOCIAL, LEE, [
      { path: '/objects/person/records/pe1', body: registro('pe1', { sex: 'FEMENINO', given_names: 'Nombre', surnames: 'Ficticio' }) },
      ...base(GERENCIA_SOCIAL, true)
    ])
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(await within(filas()[1]).findByText('Nombre Ficticio')).toBeInTheDocument()
    fetch.restore()
    document.body.innerHTML = ''
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(await within(filas()[1]).findByText('Persona registrada')).toBeInTheDocument()
    expect(screen.queryByText('Nombre Ficticio')).not.toBeInTheDocument()
  })

  it('con acceso, la gerencia social ve la postura y la filtra', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(within(filas()[0]).getByText('EN CONTRA')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Postura' }), 'EN CONTRA')
    await waitFor(() => expect(filas()).toHaveLength(1))
  })

  it.each([
    ['prioridad', 1],
    ['mios', 1],
    ['sinEvaluar', 1],
    ['sinContacto', 1],
    ['retirados', 1]
  ])('la vista %s', async (vista, n) => {
    fetch = abrirPortal(`/projects/p1/stakeholders?view=${vista}`, RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(n))
  })

  it('seleccionar varios abre el registro de interacción con ellos', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(2))
    await userEvent.click(within(filas()[0]).getByRole('checkbox'))
    await userEvent.click(within(filas()[1]).getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar una interacción con ellos' }))
    expect(rutaActual()).toBe('/projects/p1/engagements/new?stakeholders=s1,s2')
  })

  it('en el alcance global agrega la columna Proyecto y no ofrece la matriz', async () => {
    fetch = abrirPortal('/stakeholders', RELACIONISTA, LEE, [
      ...base(),
      { path: '/objects/project/records', body: pagina([P1]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(screen.getByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
    expect(await within(filas()[0]).findByText('PRJ-01')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver como matriz' })).not.toBeInTheDocument()
  })

  it('con el chip de una localidad, la lista se limita al lugar', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders?territory=locality:l1', RELACIONISTA, LEE, [
      ...base(),
      { path: '/objects/locality/records/l1', body: registro('l1', { name: 'Tunas' }) }
    ])
    red = espiarRed()
    await screen.findByRole('table', { name: 'Grupos de interés' })
    await waitFor(() => expect(red!.a('GET', '/objects/stakeholder/records').some((l) => l.ruta.includes('locality=l1'))).toBe(true))
  })

  it('un 403 de la lista dice No disponible y no un error de carga', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, [
      { path: '/objects/stakeholder/records', status: 403, body: { title: 'Forbidden', status: 403 } },
      ...base()
    ])
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Grupos de interés' })).not.toBeInTheDocument()
    expect(screen.queryByText('No se pudo cargar')).not.toBeInTheDocument()
  })

  it('un error al leer la lista se dice con su texto y ofrece reintentar, no una lista vacía', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    red = espiarRed([{ path: '/objects/stakeholder/records', responder: () => problema(400, 'Consulta inválida') }])
    expect(await screen.findByText('Consulta inválida')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Grupos de interés' })).not.toBeInTheDocument()
    expect(screen.queryByText('Un grupo de interés nace al buscar a la persona u organización y vincularla al proyecto.')).not.toBeInTheDocument()
  })

  it('"Sin contacto" cuenta los días de calendario de Lima del último contacto', async () => {
    // el proyecto tolera 60 días: uno de hace 61 sale, uno de hace 30 no y uno sin contacto sale. el día es el de Lima
    const hace = (dias: number) => hoyEnLima(new Date(Date.now() - dias * 86_400_000))
    fetch = abrirPortal('/projects/p1/stakeholders?view=sinContacto', RELACIONISTA, LEE, [
      {
        path: '/objects/stakeholder/records',
        body: pagina([
          registro('a', { project: 'p1', organization: 'o1', last_contact_date: hace(61) }, { state: 'profiled' }),
          registro('b', { project: 'p1', organization: 'o1', last_contact_date: hace(30) }, { state: 'profiled' }),
          registro('c', { project: 'p1', organization: 'o1' }, { state: 'profiled' })
        ])
      },
      ...base()
    ])
    await waitFor(() => expect(filas()).toHaveLength(2))
  })
})

describe('flujo 3 · registrar un grupo de interés', () => {
  const ALTA = [
    { method: 'POST', path: '/objects/stakeholder/records', body: registro('s9', { project: 'p1', organization: 'o1' }, { state: 'identified' }) },
    { path: '/objects/stakeholder/records/s9', body: registro('s9', { project: 'p1', organization: 'o1' }, { state: 'identified' }) },
    { path: '/objects/organization/records', body: pagina([registro('o1', { name: 'Ronda campesina Tunas' })]) }
  ]

  it('busca la organización antes de crear, crea el grupo del proyecto con ella y abre su ficha', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, [...ALTA, ...base()])
    red = espiarRed()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo grupo de interés' }))
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar antes de crear' }), 'Ronda')
    await userEvent.click(await screen.findByRole('button', { name: 'Ronda campesina Tunas' }))
    expect(await screen.findByText('Actor: Ronda campesina Tunas')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/stakeholders/s9'))
    const [alta] = red.a('POST', '/objects/stakeholder/records')
    expect(alta.cuerpo).toMatchObject({ attributes: { project: 'p1', organization: 'o1' } })
    // nunca un derivado ni la postura (restringida) en el alta
    expect(alta.cuerpo).not.toHaveProperty('attributes.influence_group')
    expect(alta.cuerpo).not.toHaveProperty('attributes.stance')
  })

  it('una persona sin los nombres legibles se ofrece como Persona registrada', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, [
      { path: '/objects/person/records', body: pagina([registro('pe1', { sex: 'FEMENINO' })]) },
      ...ALTA,
      ...base()
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo grupo de interés' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Persona' }))
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar antes de crear' }), 'Ana')
    expect(await screen.findByRole('button', { name: 'Persona registrada' })).toBeInTheDocument()
  })

  it('un error del alta se dice con su texto, no con el código', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, [...ALTA, ...base()])
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/stakeholder/records',
        responder: () => problema(403, 'sin asignación', [{ field: 'project', message: 'NOT_ASSIGNED' }])
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo grupo de interés' }))
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar antes de crear' }), 'Ronda')
    await userEvent.click(await screen.findByRole('button', { name: 'Ronda campesina Tunas' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/asign/i)).toBeInTheDocument()
    expect(screen.queryByText(/NOT_ASSIGNED/)).not.toBeInTheDocument()
  })

  it('sin CREATE sobre stakeholder, o sin asignación vigente al proyecto, no se ofrece', async () => {
    fetch = abrirPortal(
      '/projects/p1/stakeholders',
      RELACIONISTA,
      permisos({ project: ['READ'], stakeholder: ['READ'], organization: ['READ'], person: ['READ'] }),
      base()
    )
    await screen.findByRole('table', { name: 'Grupos de interés' })
    expect(screen.queryByRole('button', { name: 'Nuevo grupo de interés' })).not.toBeInTheDocument()
    fetch.restore()
    document.body.innerHTML = ''
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...base()
    ])
    await screen.findByRole('table', { name: 'Grupos de interés' })
    expect(screen.queryByRole('button', { name: 'Nuevo grupo de interés' })).not.toBeInTheDocument()
  })

  it('en el alcance global no se ofrece crear: el grupo es de un proyecto', async () => {
    fetch = abrirPortal('/stakeholders', RELACIONISTA, LEE, [
      ...base(),
      { path: '/objects/project/records', body: pagina([P1]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    await screen.findByRole('table', { name: 'Grupos de interés' })
    expect(screen.queryByRole('button', { name: 'Nuevo grupo de interés' })).not.toBeInTheDocument()
    expect(S1.id).toBe('s1')
  })
})
