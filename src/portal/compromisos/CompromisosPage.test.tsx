import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeCompromisos, C1, EQUIPO_DE_COMPROMISOS, GESTORA, P1 } from '../../test/compromisos'
import { montar, pagina, registro, ubicacion, workflow } from '../../test/montar'
import type { Registro } from '../datos/registros'
import { permisos } from '../../test/portal'
import { listaDelServidor } from '../../test/listaDelServidor'
import { espiarRed, problema, type Red, type RutaEspecial } from '../../test/red'
import { conEstado } from '../datos/registros'
import { CompromisosPage, consultaDeVista, enVista } from './CompromisosPage'

// S28 (screens.md §7, flujo 7): las vistas de lo vencido, por vencer y bloqueado, el alta solo con asignación, y los candidatos
// decididos por una persona con IK, IM y CR; un código de error se dice con su texto
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const C2 = registro(
  'c2',
  { ...C1.attributes, code: 'C-002', title: 'Taller de costura', deadline_status: 'VENCIDO', owner_user_id: 'u-otro' },
  { state: 'blocked' }
)
const C3 = registro('c3', { ...C1.attributes, code: 'C-003', title: 'Becas escolares', deadline_status: 'POR VENCER' }, { state: 'approved' })
const C4 = registro('c4', { ...C1.attributes, code: 'C-004', title: 'Botiquín comunal', deadline_status: null }, { state: 'closed' })
const PROPUESTO = registro(
  'k1',
  { project: 'p1', proposed_text: 'Mejorar el camino al anexo Huallpa', ai_generated: false, suggested_due_date: '2026-12-15', engagement: 'e1' },
  { state: 'proposed', updatedAt: '2026-10-06T15:00:00Z' }
)
const RECHAZADO = registro(
  'k2',
  { project: 'p1', proposed_text: 'Pintar la escuela', ai_generated: true, confidence: 0.82, evidence_quote: '«…pintar la escuela…»' },
  { state: 'rejected' }
)

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/objects/commitment_candidate/records', body: pagina([PROPUESTO, RECHAZADO]) },
  {
    path: '/objects/commitment_candidate/workflow',
    body: workflow('commitment_candidate', [
      ['proposed', 'Propuesto'],
      ['rejected', 'Rechazado']
    ])
  },
  {
    path: '/objects/commitment_candidate/records/k1/transitions',
    body: [{ name: 'reject', label: 'Rechazar', to: 'rejected', toLabel: 'Rechazado', allowed: true, reason: null }]
  },
  { path: '/objects/project/records', body: pagina([P1]) },
  { path: '/sgspe/dashboards/indicators', body: [] }
]
// la lista de compromisos la contesta el servidor emulado: la página y el conteo de cada vista son consultas (D10)
const conServidor = (especiales: RutaEspecial[] = [], compromisos = [C1, C2, C3, C4], candidatos: Registro[] | null = [PROPUESTO, RECHAZADO]) =>
  espiarRed([...especiales, listaDelServidor('commitment', compromisos), ...(candidatos ? [listaDelServidor('commitment_candidate', candidatos)] : [])])
const consultasA = (r: Red, objeto = 'commitment') =>
  r.a('GET', `/objects/${objeto}/records`).map((l) => Object.fromEntries(new URLSearchParams(l.ruta.split('?')[1] ?? '')))
const enProyecto = (p = EQUIPO_DE_COMPROMISOS, ruta = '/projects/p1/commitments') =>
  montar(<CompromisosPage />, { ruta, camino: '/projects/:projectId/commitments', usuario: GESTORA, permisos: p })

describe('S28 · lista de compromisos', () => {
  it('abiertos por defecto; vencidos, por vencer y bloqueados en su vista; el alta con la asignación vigente', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto()
    const tabla = await screen.findByRole('table', { name: 'Compromisos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(4)
    expect(within(tabla).queryByText('Botiquín comunal')).not.toBeInTheDocument()
    expect(within(tabla).getByRole('link', { name: 'Reservorio de agua para Tunas Pampa' })).toHaveAttribute('href', '/projects/p1/commitments/c1')
    // el ojo abre su vista previa sin dejar la lista (revisión de UX, etapa 6)
    expect(within(tabla).getByRole('link', { name: /^Vista previa de C-\d+ Reservorio de agua para Tunas Pampa$/ })).toHaveAttribute(
      'href',
      '/projects/p1/commitments?peek=commitment%3Ac1'
    )
    expect(within(tabla).getAllByText('S/ 25,000.00')).toHaveLength(3)
    await userEvent.click(screen.getByRole('radio', { name: /^Vencidos\b/ }))
    expect(await within(await screen.findByRole('table', { name: 'Compromisos' })).findByText('Taller de costura')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
    await userEvent.click(screen.getByRole('radio', { name: /^Bloqueados\b/ }))
    expect(screen.getByText('Taller de costura')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Por vencer\b/ }))
    expect(screen.getByText('Becas escolares')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nuevo compromiso' })).toHaveAttribute('href', '/projects/p1/commitments/new')
  })

  // hallazgo U-18 (CA-1.3.1): las vistas van en una sola fila, sin una segunda fila de pestañas
  it('elegir «Vencidos» deja ?view=vencidos en la URL y conserva los demás parámetros', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?q=Taller&state=blocked')
    await screen.findByRole('table', { name: 'Compromisos' })
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Vistas' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Vencidos\b/ }))
    expect(ubicacion.actual).toBe('/projects/p1/commitments?q=Taller&state=blocked&view=vencidos')
    expect(screen.getByRole('radio', { name: /^Vencidos\b/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('«Míos» lista los abiertos de quien mira; «Cerrados y cancelados», los cerrados', () => {
    expect([C1, C2, C3, C4].filter((c) => enVista('mios', c, 'u-cmm')).map((c) => c.id)).toEqual(['c1', 'c3'])
    expect([C1, C2, C3, C4].filter((c) => enVista('cerrados', c, 'u-cmm')).map((c) => c.id)).toEqual(['c4'])
    expect(enVista('cerrados', { ...C1, state: 'cancelled' }, 'u-cmm')).toBe(true)
    expect(enVista('mios', { ...C1, state: 'cancelled' }, 'u-cmm')).toBe(false)
  })

  it('sin asignación vigente no se ofrece el alta; mientras carga no dice que no hay compromisos', async () => {
    fetch = mockFetch([...rutas().filter((r) => !(r.path instanceof RegExp)), { path: /^\/objects\/project_assignment\/records/, body: pagina([]) }])
    red = conServidor([{ path: '/objects/commitment/records', responder: () => problema(500, 'caído') }])
    enProyecto()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No hay compromisos en esta vista.')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Nuevo compromiso' })).not.toBeInTheDocument()
  })

  // revisión de UX, etapa 3: crear no depende del selector de proyecto
  it('en el alcance global dice el proyecto de cada compromiso y ofrece crear eligiendo el proyecto', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    montar(<CompromisosPage />, { ruta: '/commitments', camino: '/commitments', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
    expect((await screen.findAllByRole('link', { name: 'PRJ-01 · Pukaqaqa' }))[0]).toHaveAttribute('href', '/projects/p1/overview')
    expect(screen.getByRole('button', { name: 'Nuevo compromiso' })).toBeInTheDocument()
    expect(screen.queryByText(/elija su proyecto en el selector/)).not.toBeInTheDocument()
  })

  it('cada vista dice cuántos tiene, el código va junto al título y el total va en el encabezado', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto()
    const tabla = await screen.findByRole('table', { name: 'Compromisos' })
    // el conteo va en el nombre de cada vista (SelectorDeVista); las que no caben, en «Más vistas», también con su conteo
    expect(await screen.findByRole('radio', { name: 'Abiertos, 3' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Vencidos, 1' })).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Más vistas' }))
    expect(screen.getByRole('button', { name: 'Cerrados y cancelados, 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Candidatos' })).toHaveTextContent(/^Candidatos$/)
    expect(screen.getByText('3 compromisos')).toBeInTheDocument()
    expect(within(tabla).getByText('C-002')).toHaveClass('font-sg-mono')
  })

  it('los filtros son chips en la URL con «Limpiar», y el vacío por filtros dice cuántos hay sin ellos', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?q=inexistente')
    expect(await screen.findByText('Nada coincide con los filtros')).toBeInTheDocument()
    expect(screen.getByText('Sin los filtros hay 3.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar el filtro Contiene «inexistente»' })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0])
    expect(ubicacion.actual).toBe('/projects/p1/commitments')
    expect(await screen.findByRole('table', { name: 'Compromisos' })).toBeInTheDocument()
  })

  // hallazgo U-22 (CA-1.4.1 a CA-1.4.3): la vista, la búsqueda y el estado van en la barra de filtros, con un chip por filtro
  it('quitar un chip quita solo su parámetro; «Limpiar filtros» deja solo la vista; «Filtros (N)» cuenta los chips', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=vencidos&q=Taller&state=blocked')
    const barra = await screen.findByRole('group', { name: 'Filtros' })
    expect(within(barra).getByRole('radiogroup', { name: 'Vistas' })).toBeInTheDocument()
    expect(within(barra).getByRole('searchbox', { name: 'Buscar por código o título' })).toHaveValue('Taller')
    const chips = within(within(barra).getByRole('list', { name: 'Filtros aplicados' })).getAllByRole('listitem')
    expect(chips).toHaveLength(2)
    expect(within(barra).getByRole('button', { name: `Filtros (${chips.length})` })).toBeInTheDocument()
    await userEvent.click(within(barra).getByRole('button', { name: /^Quitar el filtro Estado:/ }))
    expect(ubicacion.actual).toBe('/projects/p1/commitments?view=vencidos&q=Taller')
    expect(screen.getByRole('button', { name: 'Filtros (1)' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Filtros (1)' }))
    const drawer = await screen.findByRole('dialog', { name: 'Filtros' })
    await userEvent.selectOptions(within(drawer).getByLabelText('Estado'), 'blocked')
    expect(ubicacion.actual).toBe('/projects/p1/commitments?view=vencidos&q=Taller&state=blocked')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Ver resultados' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Filtros' })).getByRole('button', { name: 'Limpiar filtros' }))
    expect(ubicacion.actual).toBe('/projects/p1/commitments?view=vencidos')
    expect(screen.queryByRole('list', { name: 'Filtros aplicados' })).not.toBeInTheDocument()
  })

  it('cada vista es una consulta del servidor: «Abiertos» pide su página con state_not, y cada vista cuenta con una página de uno', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto()
    await screen.findByRole('table', { name: 'Compromisos' })
    const consultas = consultasA(red)
    expect(consultas).toContainEqual({ project: 'p1', state_not: 'closed,cancelled', sort: 'due_date', dir: 'asc', page: '0', size: '25' })
    expect(consultas).toContainEqual({ project: 'p1', state: 'blocked', size: '1' })
    expect(consultas).toContainEqual({ project: 'p1', owner_user_id: 'u-cmm', state_not: 'closed,cancelled', size: '1' })
    expect(consultas).toContainEqual({ project: 'p1', deadline_status: 'POR VENCER', size: '1' })
    // ninguna lectura del alcance entero con tope
    expect(consultas.some((c) => c.count === 'false')).toBe(false)
  })

  it('la búsqueda y el estado viajan en la consulta; un estado que la vista no admite no pide nada y dice el vacío', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?q=costura&state=blocked')
    const tabla = await screen.findByRole('table', { name: 'Compromisos' })
    expect(within(tabla).getByText('Taller de costura')).toBeInTheDocument()
    expect(consultasA(red)).toContainEqual({
      project: 'p1',
      state_not: 'closed,cancelled',
      state: 'blocked',
      q: 'costura',
      sort: 'due_date',
      dir: 'asc',
      page: '0',
      size: '25'
    })
    await userEvent.click(screen.getByRole('button', { name: 'Más vistas' }))
    await userEvent.click(screen.getByRole('button', { name: /^Cerrados y cancelados\b/ }))
    expect(await screen.findByText('Nada coincide con los filtros')).toBeInTheDocument()
    // la vista elegida del menú entra a la fila, con su conteo
    expect(screen.getByRole('radio', { name: 'Cerrados y cancelados, 0' })).toHaveAttribute('aria-checked', 'true')
    expect(consultasA(red).some((c) => c.state === 'closed,cancelled' && c.size === '25')).toBe(false)
  })

  it('la paginación es la del servidor: la segunda página se pide con page=1 y el total es el del conteo', async () => {
    const muchos = Array.from({ length: 30 }, (_, i) =>
      registro(
        `m${i}`,
        { ...C1.attributes, code: `C-${String(i + 100)}`, title: `Compromiso ${i}`, due_date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}` },
        { state: 'in_progress' }
      )
    )
    fetch = mockFetch(rutas())
    red = conServidor([], muchos)
    enProyecto()
    const tabla = await screen.findByRole('table', { name: 'Compromisos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(26)
    expect(screen.getByText('30 compromisos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /siguiente|next/i }))
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Compromisos' })).getAllByRole('row')).toHaveLength(6))
    expect(consultasA(red)).toContainEqual(expect.objectContaining({ state_not: 'closed,cancelled', page: '1', size: '25' }))
  })

  it('con el filtro de un grupo de interés, la fuente son sus compromisos relacionados, con las vistas armadas en el portal', async () => {
    fetch = mockFetch(
      rutas([
        { path: '/objects/stakeholder/records/s1', body: registro('s1', { project: 'p1', name: 'Junta directiva' }) },
        { path: '/objects/stakeholder/records/s1/related/commitment_stakeholder', body: pagina([C1, C2, C4]) }
      ])
    )
    red = conServidor()
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?stakeholder=s1')
    const tabla = await screen.findByRole('table', { name: 'Compromisos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(3)
    expect(within(tabla).queryByText('Becas escolares')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Más vistas' }))
    expect(screen.getByRole('button', { name: 'Cerrados y cancelados, 1' })).toBeInTheDocument()
    expect(consultasA(red)).toEqual([])
  })

  // flujo F-C (02-arquitectura-de-informacion §6, issue #77): Compromisos → «Vencidos» → «Más filtros» → Grupo de interés → chip,
  // con la URL para compartir. el grupo se busca por el nombre que lee quien mira; una persona sin nombres legibles dice «Persona
  // registrada», como su chip
  const GRUPOS: MockRoute[] = [
    {
      path: '/objects/stakeholder/records',
      body: pagina([registro('s1', { project: 'p1', organization: 'o-junta' }), registro('s2', { project: 'p1', person: 'pe2' })])
    },
    { path: '/objects/stakeholder/records/s1', body: registro('s1', { project: 'p1', organization: 'o-junta' }) },
    { path: '/objects/organization/records/o-junta', body: registro('o-junta', { name: 'Junta de regantes' }) },
    { path: '/objects/person/records/pe2', body: registro('pe2', {}) },
    { path: '/objects/stakeholder/records/s1/related/commitment_stakeholder', body: pagina([C1, C2, C4]) }
  ]

  it('F-C: en «Vencidos» con un estado, «Más filtros» busca el grupo de interés, deja ?stakeholder= y su chip', async () => {
    fetch = mockFetch(rutas(GRUPOS))
    red = conServidor()
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=vencidos&state=blocked')
    await screen.findByRole('table', { name: 'Compromisos' })
    await userEvent.click(within(screen.getByRole('group', { name: 'Filtros' })).getByRole('button', { name: 'Más filtros' }))
    const drawer = await screen.findByRole('dialog', { name: 'Más filtros' })
    const grupos = await within(drawer).findByRole('list', { name: 'Grupos de interés' })
    expect(await within(grupos).findByRole('button', { name: 'Junta de regantes' })).toBeInTheDocument()
    expect(await within(grupos).findByRole('button', { name: 'Persona registrada' })).toBeInTheDocument()
    // los grupos que lee quien mira, del proyecto
    expect(consultasA(red, 'stakeholder')).toContainEqual(expect.objectContaining({ project: 'p1' }))
    const buscar = within(drawer).getByRole('searchbox', { name: 'Buscar el grupo de interés' })
    await userEvent.type(buscar, 'junta')
    expect(within(grupos).queryByRole('button', { name: 'Persona registrada' })).not.toBeInTheDocument()
    await userEvent.click(within(grupos).getByRole('button', { name: 'Junta de regantes' }))
    expect(ubicacion.actual).toBe('/projects/p1/commitments?view=vencidos&state=blocked&stakeholder=s1')
    expect(within(grupos).getByRole('button', { name: 'Junta de regantes' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(buscar, 'xyz')
    expect(within(drawer).getByText('Ningún grupo de interés coincide con la búsqueda.')).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Ver resultados' }))
    // el chip es el mismo que deja la ficha del grupo; la vista y el estado siguen filtrando sus compromisos
    const chips = within(screen.getByRole('list', { name: 'Filtros aplicados' })).getAllByRole('listitem')
    expect(chips.map((c) => c.textContent)).toContain('Grupo de interés: Junta de regantes')
    const tabla = await screen.findByRole('table', { name: 'Compromisos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(2)
    expect(within(tabla).getByText('Taller de costura')).toBeInTheDocument()
  })

  it('en el alcance global, «Más filtros» ofrece los grupos de todos los proyectos que lee', async () => {
    fetch = mockFetch(rutas(GRUPOS))
    red = conServidor()
    montar(<CompromisosPage />, { ruta: '/commitments', camino: '/commitments', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await screen.findByRole('table', { name: 'Compromisos' })
    await userEvent.click(screen.getByRole('button', { name: 'Más filtros' }))
    const drawer = await screen.findByRole('dialog', { name: 'Más filtros' })
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Junta de regantes' }))
    expect(ubicacion.actual).toBe('/commitments?stakeholder=s1')
    expect(consultasA(red, 'stakeholder').length).toBeGreaterThan(0)
    expect(consultasA(red, 'stakeholder').every((c) => !('project' in c))).toBe(true)
  })

  it('sin leer grupos de interés, la lista no ofrece «Más filtros»', async () => {
    const { stakeholder: _sinGrupos, ...sinGrupos } = EQUIPO_DE_COMPROMISOS.objects
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto(permisos(sinGrupos))
    await screen.findByRole('table', { name: 'Compromisos' })
    expect(screen.queryByRole('button', { name: 'Más filtros' })).not.toBeInTheDocument()
  })

  // 05-especificacion §1.6 y DD-05: el código, el título y el vencimiento se ordenan en el servidor; el orden dura la visita
  it('el código, el título y el vencimiento ordenan en el servidor, con aria-sort, y otro orden vuelve a la primera página', async () => {
    const muchos = Array.from({ length: 30 }, (_, i) =>
      registro(
        `m${i}`,
        {
          ...C1.attributes,
          code: `C-${String(i + 100)}`,
          title: `Compromiso ${String(i).padStart(2, '0')}`,
          due_date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`
        },
        { state: 'in_progress' }
      )
    )
    fetch = mockFetch(rutas())
    red = conServidor([], muchos)
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?page=1')
    const tabla = () => screen.getByRole('table', { name: 'Compromisos' })
    await screen.findByRole('table', { name: 'Compromisos' })
    expect(within(tabla()).getByRole('columnheader', { name: 'Vence' })).toHaveAttribute('aria-sort', 'ascending')
    // la prioridad de columnas (DD-05): el responsable y el monto, desde xl
    expect(within(tabla()).getByRole('columnheader', { name: 'Responsable' })).toHaveClass('hidden', 'xl:table-cell')
    expect(within(tabla()).getByRole('columnheader', { name: 'Monto' })).toHaveClass('hidden', 'xl:table-cell')
    // el estado, la situación y el monto no se ordenan
    for (const c of ['Estado', 'Plazo', 'Monto']) expect(within(tabla()).queryByRole('button', { name: c })).not.toBeInTheDocument()
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Código' }))
    await waitFor(() => expect(consultasA(red!)).toContainEqual(expect.objectContaining({ sort: 'code', dir: 'asc', page: '0', size: '25' })))
    // el orden viaja en la URL (tercera pasada de UX, 3.6; DD-37): volver de una ficha lo conserva
    expect(ubicacion.actual).toBe('/projects/p1/commitments?sort=codigo&dir=asc')
    await waitFor(() => expect(within(tabla()).getAllByRole('row')[1]).toHaveTextContent('C-100'))
    expect(within(tabla()).getByRole('columnheader', { name: 'Código' })).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Código' }))
    await waitFor(() => expect(consultasA(red!)).toContainEqual(expect.objectContaining({ sort: 'code', dir: 'desc' })))
    await waitFor(() => expect(within(tabla()).getAllByRole('row')[1]).toHaveTextContent('C-129'))
    expect(within(tabla()).getByRole('columnheader', { name: 'Código' })).toHaveAttribute('aria-sort', 'descending')
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Compromiso' }))
    await waitFor(() => expect(consultasA(red!)).toContainEqual(expect.objectContaining({ sort: 'title', dir: 'asc' })))
    expect(within(tabla()).getByRole('columnheader', { name: 'Compromiso' })).toHaveAttribute('aria-sort', 'ascending')
  })

  it('con el filtro de un grupo de interés, el orden es del portal por la misma columna, estable, y vuelve a la primera página', async () => {
    const delGrupo = [
      registro('g1', { ...C1.attributes, code: 'C-003', title: 'Óvalo deportivo', due_date: '2026-12-01' }, { state: 'in_progress' }),
      registro('g2', { ...C1.attributes, code: 'C-001', title: 'Zanja de riego', due_date: null }, { state: 'in_progress' }),
      registro('g3', { ...C1.attributes, code: 'C-002', title: 'Aula comunal', due_date: '2026-10-15' }, { state: 'in_progress' })
    ]
    fetch = mockFetch(
      rutas([
        { path: '/objects/stakeholder/records/s1', body: registro('s1', { project: 'p1', name: 'Junta directiva' }) },
        { path: '/objects/stakeholder/records/s1/related/commitment_stakeholder', body: pagina(delGrupo) }
      ])
    )
    red = conServidor()
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?stakeholder=s1&page=0')
    const tabla = () => screen.getByRole('table', { name: 'Compromisos' })
    const codigos = () =>
      within(tabla())
        .getAllByRole('row')
        .slice(1)
        .map((f) => within(f).getAllByRole('cell')[0].textContent)
    await screen.findByRole('table', { name: 'Compromisos' })
    // por el vencimiento, de antes a después; el que no tiene fecha, al final
    expect(codigos()).toEqual(['C-002', 'C-003', 'C-001'])
    expect(within(tabla()).getByRole('columnheader', { name: 'Vence' })).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Vence' }))
    expect(codigos()).toEqual(['C-003', 'C-002', 'C-001'])
    // el título con el colador del español: la «Ó» va con la «O», no al final
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Compromiso' }))
    expect(codigos()).toEqual(['C-002', 'C-003', 'C-001'])
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Código' }))
    expect(codigos()).toEqual(['C-001', 'C-002', 'C-003'])
    expect(ubicacion.actual).toBe('/projects/p1/commitments?stakeholder=s1&sort=codigo&dir=asc')
    // el servidor no ordena lo que filtra el portal
    expect(consultasA(red)).toEqual([])
  })

  it('consultaDeVista dice lo mismo que enVista; «Míos» sin quien mira no pide nada; conEstado cruza el estado con la vista', () => {
    expect(consultaDeVista('abiertos', 'u-cmm')).toEqual({ state_not: 'closed,cancelled' })
    expect(consultaDeVista('cerrados', 'u-cmm')).toEqual({ state: 'closed,cancelled' })
    expect(consultaDeVista('mios', undefined)).toBeNull()
    expect(conEstado({ state: 'closed,cancelled' }, 'closed')).toEqual({ state: 'closed' })
    expect(conEstado({ state: 'closed,cancelled' }, 'blocked')).toBeNull()
    expect(conEstado({ state_not: 'closed,cancelled' }, 'closed')).toBeNull()
    expect(conEstado({ deadline_status: 'VENCIDO' }, 'blocked')).toEqual({ deadline_status: 'VENCIDO', state: 'blocked' })
    expect(conEstado(null, 'blocked')).toBeNull()
  })
})

describe('S28 · candidatos', () => {
  it('lista los propuestos y los decididos; la cita que la cuenta no lee dice Restringido', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    const region = await screen.findByRole('region', { name: 'Candidatos a compromiso' })
    expect(await within(region).findByText('Mejorar el camino al anexo Huallpa')).toBeInTheDocument()
    // los candidatos no se filtran: la barra solo trae la vista
    expect(screen.getByRole('radio', { name: 'Candidatos' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(within(region).getByText('Propuesto por la IA · confianza 82 %')).toBeInTheDocument()
    expect(within(region).getByText('Restringido')).toBeInTheDocument()
    // la cita que sí se lee se dice tal cual
    expect(within(region).getByText(/«…pintar la escuela…»/)).toBeInTheDocument()
  })

  it('una lista de candidatos que el tope cortó lo dice con su propio texto', async () => {
    const muchos = Array.from({ length: 200 }, (_, i) => registro(`k${i}`, { project: 'p1', proposed_text: `Propuesta ${i}` }, { state: 'proposed' }))
    fetch = mockFetch(rutas([{ path: /^\/objects\/commitment_candidate\/records\?/, body: pagina(muchos, { nextCursor: 'siguiente' }) }]))
    red = conServidor([], undefined, null)
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    expect(await screen.findByText('Se muestran los 1,000 candidatos propuestos más recientes: elija un proyecto para ver el resto.')).toBeInTheDocument()
    expect(screen.queryByText(/compromisos del alcance/)).not.toBeInTheDocument()
  })

  it('aceptar valida el monto, manda IK, If-Match y motivo sin el proyecto, y abre el compromiso creado', async () => {
    fetch = mockFetch(rutas())
    red = conServidor([
      {
        method: 'POST',
        path: '/sgspe/commitment-candidates/k1/accept',
        responder: () =>
          jsonResponse({ commitment: registro('c9', { project: 'p1' }, { state: 'draft' }), candidate: { ...PROPUESTO, state: 'accepted' } }, 201)
      }
    ])
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    const panel = await screen.findByRole('dialog')
    // hallazgo U-07 (DD-07): la fecha sugerida se propone como dd/mm/aaaa
    expect(within(panel).getByLabelText('Fecha de vencimiento')).toHaveValue('15/12/2026')
    await userEvent.type(within(panel).getByLabelText('Código del compromiso'), 'C-010')
    await userEvent.type(within(panel).getByLabelText('Monto'), '-5')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    expect(await within(panel).findByText('Escriba un monto de hasta 15 dígitos enteros y 4 decimales')).toBeInTheDocument()
    expect(within(panel).getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/commitment-candidates/k1/accept')).toHaveLength(0)
    await userEvent.clear(within(panel).getByLabelText('Monto'))
    await userEvent.type(within(panel).getByLabelText('Monto'), '8,000.50')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Acordado en la asamblea')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c9'))
    const [llamada] = red.a('POST', '/sgspe/commitment-candidates/k1/accept')
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-06T15:00:00Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Acordado%20en%20la%20asamblea")
    expect(llamada.cuerpo).toEqual({
      attributes: {
        code: 'C-010',
        title: 'Mejorar el camino al anexo Huallpa',
        description: 'Mejorar el camino al anexo Huallpa',
        amount: '8000.50',
        currency: 'PEN',
        due_date: '2026-12-15',
        origin_engagement: 'e1'
      }
    })
  })

  it('otra persona ya lo decidió: dice el texto propio del STATE_MISMATCH, nunca el código', async () => {
    fetch = mockFetch(rutas())
    red = conServidor([
      { method: 'POST', path: '/sgspe/commitment-candidates/k1/accept', responder: () => problema(409, 'x', [{ field: 'state', message: 'STATE_MISMATCH' }]) }
    ])
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.type(within(panel).getByLabelText('Código del compromiso'), 'C-010')
    await userEvent.type(within(panel).getByLabelText('Monto'), '10')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Asamblea')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    expect(await within(panel).findByText(/Otra persona ya decidió este candidato/)).toBeInTheDocument()
    expect(within(panel).queryByText('STATE_MISMATCH')).not.toBeInTheDocument()
  })

  it('«Es duplicado de…» exige el compromiso y el motivo, y manda duplicateOf con la versión', async () => {
    fetch = mockFetch(rutas())
    red = conServidor([
      { method: 'POST', path: '/sgspe/commitment-candidates/k1/duplicate', responder: () => jsonResponse({ candidate: { ...PROPUESTO, state: 'duplicate' } }) }
    ])
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.click(within(panel).getByRole('radio', { name: 'Es duplicado de…' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Confirmar' }))
    expect(await within(panel).findByText('Este dato es obligatorio')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/commitment-candidates/k1/duplicate')).toHaveLength(0)
    await userEvent.type(within(panel).getByLabelText('Buscar el compromiso que ya lo cubre'), 'Re')
    await userEvent.click(await within(panel).findByRole('button', { name: 'C-001 · Reservorio de agua para Tunas Pampa' }))
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Ya está en C-001')
    await userEvent.click(within(panel).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitment-candidates/k1/duplicate')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/commitment-candidates/k1/duplicate')
    expect(llamada.cuerpo).toEqual({ duplicateOf: 'c1' })
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-06T15:00:00Z"')
    expect(llamada.cabeceras.has('Idempotency-Key')).toBe(false)
  })

  it('registrar un candidato manda el proyecto y su clave; sin el texto no se envía', async () => {
    fetch = mockFetch(rutas())
    red = conServidor([
      { method: 'POST', path: '/sgspe/commitment-candidates', responder: () => jsonResponse(registro('k9', { project: 'p1' }, { state: 'proposed' }), 201) }
    ])
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar candidato' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    expect(await within(panel).findByText('Escriba lo que se propuso')).toBeInTheDocument()
    await userEvent.type(within(panel).getByLabelText('Lo que se propuso'), 'Instalar dos pozos')
    // hallazgo U-07 (DD-07): la fecha sugerida se escribe como dd/mm/aaaa y viaja como AAAA-MM-DD
    await userEvent.type(within(panel).getByLabelText('Fecha sugerida'), '20/10/2026')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitment-candidates')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/commitment-candidates')
    expect(llamada.cuerpo).toEqual({ attributes: { proposed_text: 'Instalar dos pozos', suggested_due_date: '2026-10-20', project: 'p1' } })
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('quien solo lee los candidatos no ve las decisiones', async () => {
    fetch = mockFetch(rutas())
    red = conServidor()
    enProyecto(permisos({ project: ['READ'], commitment: ['READ'], commitment_candidate: ['READ'] }), '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    const panel = await screen.findByRole('dialog')
    expect(within(panel).queryByRole('button', { name: 'Aceptar y crear borrador' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar candidato' })).not.toBeInTheDocument()
  })
})
