import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro } from '../../test/montar'
import { hoyEnLima } from '../datos/fechas'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ADMINISTRACION, GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { base, LEE, P1, S1, S2 } from '../../test/grupos'

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

  // revisión de UX, etapa 6: una fila abre la vista previa del grupo sin dejar la lista (ux-architecture.md §8.3, paso 2)
  it('el ojo de una fila abre la vista previa del grupo sobre la lista, con «Abrir ficha»', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(2))
    await userEvent.click(await within(filas()[0]).findByRole('link', { name: 'Vista previa de Ronda campesina Tunas' }))
    expect(rutaActual()).toMatch(/^\/projects\/p1\/stakeholders\?peek=stakeholder%3A/)
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByRole('link', { name: 'Abrir ficha' })).toHaveAttribute('href', expect.stringMatching(/^\/projects\/p1\/stakeholders\//))
    expect(screen.getByRole('table', { name: 'Grupos de interés', hidden: true })).toBeInTheDocument()
  })

  // revisión de UX, etapa 3: vistas con conteo y el total en el encabezado
  it('cada vista dice cuántos tiene y el encabezado el total', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(screen.getByRole('tab', { name: 'Todos' })).toHaveAccessibleDescription('2 registros')
    expect(screen.getByRole('tab', { name: 'Retirados' })).toHaveAccessibleDescription('1 registro')
    expect(screen.getByText('2 grupos de interés')).toBeInTheDocument()
  })

  // hallazgo U-06 (DD-05): la tabla cabe a 1440 px por la prioridad de sus columnas
  it('las columnas van por prioridad: las secundarias desde xl, las opcionales desde 1536 px y las uniformes van a una nota', async () => {
    const conResponsable = (id: string, extra: Record<string, unknown>) => {
      const g = [S1, S2].find((r) => r.id === id)!
      return { ...g, attributes: { ...g.attributes, owner_user_email: 'gestion@sgspe.test', ...extra } }
    }
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, [
      { path: '/sgspe/people', body: [{ email: 'gestion@sgspe.test', displayName: 'Gestión de compromisos (demo)' }] },
      { path: '/objects/locality/records/l1', body: registro('l1', { name: 'Tunas' }) },
      { path: '/objects/locality/records/l2', body: registro('l2', { name: 'Huaylla' }) },
      { path: '/objects/stakeholder/records', body: pagina([conResponsable('s1', { locality: 'l1' }), conResponsable('s2', { locality: 'l2' })]) },
      ...base()
    ])
    await waitFor(() => expect(filas()).toHaveLength(2))
    const tabla = within(screen.getByRole('table', { name: 'Grupos de interés' }))
    // esenciales, siempre
    for (const c of ['Grupo de interés', 'Grupo de influencia', 'Postura', 'Prioridad', 'Estado'])
      expect(tabla.getByRole('columnheader', { name: c })).not.toHaveClass('hidden')
    // secundarias, desde xl
    for (const c of ['Territorio', 'Último contacto']) expect(tabla.getByRole('columnheader', { name: c })).toHaveClass('hidden', 'xl:table-cell')
    // opcionales, desde 1536 px hasta que llegue el selector «Columnas»
    for (const c of ['Relación', 'Evaluación']) expect(tabla.getByRole('columnheader', { name: c })).toHaveClass('hidden', 'min-[96rem]:table-cell')
    // el mismo responsable en toda la página: sale de la tabla y queda en la nota, con su nombre
    expect(tabla.queryByRole('columnheader', { name: 'Responsable' })).not.toBeInTheDocument()
    const nota = screen.getByRole('list', { name: 'Igual en todas las filas' })
    await waitFor(() => expect(within(nota).getByRole('listitem')).toHaveTextContent('Responsable: Gestión de compromisos (demo)'))
    expect(await within(filas()[0]).findByText('Tunas')).toBeInTheDocument()
  })

  it('en «Míos» no se dibuja el responsable: es quien mira', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders?view=mios', RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(screen.queryByRole('columnheader', { name: 'Responsable' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Responsable:/)).not.toBeInTheDocument()
  })

  it('Enter en una fila enfocada abre la ficha del grupo', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(2))
    filas()[1].focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/stakeholders/s2'))
  })

  it('la postura restringida se explica una vez, en el encabezado: las celdas no llevan botón de ayuda', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(2))
    const tabla = screen.getByRole('table', { name: 'Grupos de interés' })
    // el nombre del encabezado es el de la columna: ni el botón de ayuda ni el motivo entran en él
    const encabezado = within(tabla).getByRole('columnheader', { name: 'Postura' })
    // un solo botón de ayuda para toda la columna, en el encabezado
    const ayuda = within(encabezado).getByRole('button', { name: 'Por qué no se muestra' })
    expect(within(tabla).getAllByRole('button', { name: 'Por qué no se muestra' })).toEqual([ayuda])
    // la celda sigue diciendo Restringido y su motivo (sr-only, en el encabezado) la describe
    const celda = within(filas()[0]).getByText('Restringido')
    const motivo = document.getElementById(celda.getAttribute('aria-describedby')!)!
    expect(encabezado).toContainElement(motivo)
    expect(motivo).toHaveTextContent('Su rol no puede leer este dato')
    expect(motivo).toHaveClass('sr-only')
    expect(celda).toHaveAccessibleDescription('Su rol no puede leer este dato')
    await userEvent.click(ayuda)
    expect(motivo).not.toHaveClass('sr-only')
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
    expect(within(filas()[0]).getByText('En contra')).toBeInTheDocument()
    // el filtro tiene su rótulo a la vista y, sin elegir, dice «Todos»
    const postura = screen.getByRole('combobox', { name: 'Postura' })
    expect(postura.closest('label')).toHaveTextContent(/^Postura/)
    expect(postura).toHaveDisplayValue('Todos')
    await userEvent.selectOptions(postura, 'EN CONTRA')
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

  it('en el teléfono, cada tarjeta lleva su casilla y la selección abre el registro de interacción con ellos', async () => {
    const original = window.matchMedia
    window.matchMedia = ((consulta: string) => ({
      matches: true,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    })) as unknown as typeof window.matchMedia
    try {
      fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
      const tarjetas = await screen.findByRole('list', { name: 'Grupos de interés' })
      const casillas = await within(tarjetas).findAllByRole('checkbox')
      expect(casillas).toHaveLength(2)
      await userEvent.click(casillas[0])
      await userEvent.click(casillas[1])
      expect(screen.getByText('2 seleccionados')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Registrar una interacción con ellos' }))
      expect(rutaActual()).toBe('/projects/p1/engagements/new?stakeholders=s1,s2')
    } finally {
      window.matchMedia = original
    }
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

  it('un error al leer la definición se ve con su reintento: no una lista a medias', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    red = espiarRed([{ path: '/metadata/objects/stakeholder', responder: () => problema(500, 'Falló la definición') }])
    expect(await screen.findByText('Falló la definición')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Grupos de interés' })).not.toBeInTheDocument()
    expect(screen.queryByText('Restringido')).not.toBeInTheDocument()
  })

  it('un 403 al leer la definición dice "No disponible", no un error con reintento', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    red = espiarRed([{ path: '/metadata/objects/stakeholder', responder: () => problema(403, 'Prohibido') }])
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Grupos de interés' })).not.toBeInTheDocument()
  })

  it('la vista "Sin contacto" espera al proyecto: mientras carga no usa 90 días, y con él usa los suyos', async () => {
    let entregar: () => void = () => {}
    const llegada = new Promise<void>((resolver) => (entregar = resolver))
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    red = espiarRed([
      {
        path: '/objects/project/records/p1',
        responder: async () => {
          await llegada
          return Response.json(P1)
        }
      }
    ])
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Sin contacto en 90 días' })).not.toBeInTheDocument()
    entregar()
    expect(await screen.findByRole('tab', { name: 'Sin contacto en 60 días' })).toBeInTheDocument()
  })

  it('la selección se reinicia al cambiar de vista: no viaja una fila que ya no se ve', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, base())
    await waitFor(() => expect(filas()).toHaveLength(2))
    await userEvent.click(within(filas()[0]).getByRole('checkbox'))
    await userEvent.click(within(filas()[1]).getByRole('checkbox'))
    expect(screen.getByText('2 seleccionados')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Retirados' }))
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(screen.queryByText(/seleccionados/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Todos' }))
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(screen.queryByText(/seleccionados/)).not.toBeInTheDocument()
    await userEvent.click(within(filas()[0]).getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar una interacción con ellos' }))
    expect(rutaActual()).toBe('/projects/p1/engagements/new?stakeholders=s1')
  })

  it('la selección se reinicia al cambiar un filtro', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    await waitFor(() => expect(filas()).toHaveLength(2))
    await userEvent.click(within(filas()[1]).getByRole('checkbox'))
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Postura' }), 'EN CONTRA')
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(screen.queryByText(/seleccionados/)).not.toBeInTheDocument()
  })

  it('un grupo evaluado cuyo grupo de influencia no se lee dice —, no una celda vacía', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, [
      { path: '/objects/stakeholder/records', body: pagina([registro('s5', { project: 'p1', organization: 'o1' }, { state: 'assessed' })]) },
      ...base()
    ])
    await waitFor(() => expect(filas()).toHaveLength(1))
    const celdas = within(filas()[0]).getAllByRole('cell')
    // seleccionar, grupo, territorio, influencia
    expect(celdas[3]).toHaveTextContent('—')
  })

  it('en el límite, el día es el de Lima y no el del reloj: 60 días de calendario con un umbral de 60 no se marcan', async () => {
    // 2026-10-02T03:00Z es el 1 de octubre a las 22:00 en Lima. desde el 2026-08-02 son 60 días de calendario (no pasa el
    // umbral de 60), pero por reloj son 61 días y 3 horas, que sí lo pasarían. el 2026-08-01 son 61 y sí se marca
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T03:00:00Z'))
    try {
      fetch = abrirPortal('/projects/p1/stakeholders?view=sinContacto', RELACIONISTA, LEE, [
        {
          path: '/objects/stakeholder/records',
          body: pagina([
            registro('en-el-limite', { project: 'p1', organization: 'o1', last_contact_date: '2026-08-02' }, { state: 'profiled' }),
            registro('pasado', { project: 'p1', organization: 'o1', last_contact_date: '2026-08-01' }, { state: 'profiled' })
          ])
        },
        ...base()
      ])
      await waitFor(() => expect(filas()).toHaveLength(1))
      expect(within(filas()[0]).getByRole('checkbox', { name: /pasado$/ })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('sin la definición no se decide la postura: espera a que llegue y no muestra Restringido a quien tiene acceso', async () => {
    const definicionDelGrupo = base(GERENCIA_SOCIAL, true).find((r) => r.path === '/metadata/objects/stakeholder')!.body
    let entregar: () => void = () => {}
    const llegada = new Promise<void>((resolver) => (entregar = resolver))
    fetch = abrirPortal('/projects/p1/stakeholders', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      {
        path: '/metadata/objects/stakeholder',
        responder: async () => {
          await llegada
          return Response.json(definicionDelGrupo)
        }
      }
    ])
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Restringido')).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Grupos de interés' })).not.toBeInTheDocument()
    entregar()
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(screen.queryByText('Restringido')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Postura' })).toBeInTheDocument()
  })
})

describe('flujo 3 · registrar un grupo de interés', () => {
  // las relaciones son UUID, como en wasichai: Zod las valida aunque viajen ocultas, así que el alta se prueba con ellos
  const PROYECTO = '6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f'
  const ORGANIZACION = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
  const PERSONA = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e'
  const ALTA = (relacion: Record<string, string>) => [
    // el proyecto del alta tiene un UUID: su registro y la asignación vigente de la cuenta
    { path: `/objects/project/records/${PROYECTO}`, body: registro(PROYECTO, { code: 'PRJ-02', name: 'Pukaqaqa', inactivity_days: 60 }, { state: 'active' }) },
    {
      path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
      body: pagina([registro('as', { project: PROYECTO, member_user_id: RELACIONISTA.id, active: true })])
    },
    { method: 'POST', path: '/objects/stakeholder/records', body: registro('s9', { project: PROYECTO, ...relacion }, { state: 'identified' }) },
    { path: '/objects/stakeholder/records/s9', body: registro('s9', { project: PROYECTO, ...relacion }, { state: 'identified' }) },
    { path: `/objects/organization/records/${ORGANIZACION}`, body: registro(ORGANIZACION, { name: 'Ronda campesina Tunas' }) },
    { path: `/objects/person/records/${PERSONA}`, body: registro(PERSONA, { sex: 'FEMENINO' }) },
    { path: '/objects/organization/records', body: pagina([registro(ORGANIZACION, { name: 'Ronda campesina Tunas' })]) },
    { path: '/objects/person/records', body: pagina([registro(PERSONA, { sex: 'FEMENINO' })]) }
  ]
  const valorDe = (cuerpo: unknown, campo: string) => (cuerpo as { attributes: Record<string, unknown> }).attributes[campo] ?? null
  const alta = (usuario = RELACIONISTA, conPostura = false, relacion: Record<string, string> = { organization: ORGANIZACION }) =>
    abrirPortal(`/projects/${PROYECTO}/stakeholders`, usuario, LEE, [...ALTA(relacion), ...base(usuario, conPostura)])

  it('busca la organización antes de crear, crea el grupo del proyecto con ella y abre su ficha', async () => {
    // una definición que sí tiene la postura: que el alta no la mande es una garantía y no un vacío
    fetch = alta(GERENCIA_SOCIAL, true)
    red = espiarRed()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo grupo de interés' }))
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar antes de crear' }), 'Ronda')
    await userEvent.click(await screen.findByRole('button', { name: 'Ronda campesina Tunas' }))
    expect(await screen.findByText('Actor: Ronda campesina Tunas')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(rutaActual()).toBe(`/projects/${PROYECTO}/stakeholders/s9`))
    const [envio] = red.a('POST', '/objects/stakeholder/records')
    expect(envio.cuerpo).toMatchObject({ attributes: { project: PROYECTO, organization: ORGANIZACION } })
    // la persona va vacía: la relación opcional y oculta pasa la validación sin valor (ExactlyOneGuard cuenta null como no informado)
    expect(valorDe(envio.cuerpo, 'person')).toBeNull()
    // nunca un derivado ni la postura (restringida) en el alta
    expect(envio.cuerpo).not.toHaveProperty('attributes.influence_group')
    expect(envio.cuerpo).not.toHaveProperty('attributes.stance')
  })

  it('el alta de una persona manda person y deja organization sin valor: la relación opcional oculta pasa la validación', async () => {
    fetch = alta(GERENCIA_SOCIAL, true, { person: PERSONA })
    red = espiarRed()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo grupo de interés' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Persona' }))
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar antes de crear' }), 'Ana')
    await userEvent.click(await screen.findByRole('button', { name: 'Persona registrada' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(rutaActual()).toBe(`/projects/${PROYECTO}/stakeholders/s9`))
    const [envio] = red.a('POST', '/objects/stakeholder/records')
    expect(envio.cuerpo).toMatchObject({ attributes: { project: PROYECTO, person: PERSONA } })
    expect(valorDe(envio.cuerpo, 'organization')).toBeNull()
    expect(envio.cuerpo).not.toHaveProperty('attributes.stance')
    expect(envio.cuerpo).not.toHaveProperty('attributes.influence_group')
  })

  it('una persona sin los nombres legibles se ofrece como Persona registrada', async () => {
    fetch = alta()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo grupo de interés' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Persona' }))
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar antes de crear' }), 'Ana')
    expect(await screen.findByRole('button', { name: 'Persona registrada' })).toBeInTheDocument()
  })

  it('un error del alta se dice con su texto, no con el código', async () => {
    fetch = alta()
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
  })
})

describe('la ruta de los grupos de interés', () => {
  it('una cuenta sin la sección stakeholders no entra a /projects/:p/stakeholders: lee que no puede y no se pide la lista', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, permisos({ project: ['READ'] }), base())
    red = espiarRed()
    expect(await screen.findByRole('heading', { name: 'No puede abrir «Grupos de interés»' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Grupos de interés' })).not.toBeInTheDocument()
    expect(red.a('GET', '/objects/stakeholder/records')).toHaveLength(0)
  })
})

// P38: solo ADMIN escribe sin asignación (revisión final, I3)
describe('S16 · escritura sin asignación', () => {
  it('ADMIN sin asignación ve «Nuevo grupo de interés»', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', ADMINISTRACION, { admin: true, objects: LEE.objects }, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...base(ADMINISTRACION)
    ])
    expect(await screen.findByText('Nuevo grupo de interés')).toBeInTheDocument()
  })

  it('otra cuenta sin asignación no lo ve', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', RELACIONISTA, LEE, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...base()
    ])
    await screen.findByText(/No está asignado a este proyecto/)
    expect(screen.queryByText('Nuevo grupo de interés')).not.toBeInTheDocument()
  })
})
