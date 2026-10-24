import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro, ubicacion, workflow } from '../../test/montar'
import { ADMIN_PERMISOS, permisos, RELACIONISTA } from '../../test/portal'
import { BarraDeContexto } from './BarraDeContexto'
import { useLeeTodosLosProyectos, useMisAsignaciones, useProyecto } from './proyectos'
import { ProyectoLayout } from './ProyectoLayout'
import { useMigaDelRegistro } from '../componentes/Migas'
import { filtroDeTerritorio, rutaEquivalente } from './rutas'
import { SelectorDeProyecto } from './SelectorDeProyecto'

let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const LEE_PROYECTOS = { admin: false, objects: { project: ['READ'], project_assignment: ['READ'] } }
const P1 = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'active' })
const P2 = registro('p2', { code: 'PRJ-02', name: 'Qorihuasi' }, { state: 'draft' })
const AVISO = 'No está asignado a este proyecto: puede leerlo, pero no cambiarlo.'
const MI_ASIGNACION = registro('a1', { project: 'p2', member_user_id: RELACIONISTA.id, role_name: 'X', active: true })

// ASM-076: la misma página con otro alcance; entre proyectos se conserva la sección, no los registros
describe('rutaEquivalente', () => {
  it.each([
    ['/stakeholders', 'p1', '/projects/p1/stakeholders'],
    ['/stakeholders/dashboard', 'p1', '/projects/p1/stakeholders/dashboard'],
    ['/engagements/calendar?month=2026-10', 'p1', '/projects/p1/engagements/calendar'],
    ['/territory/communities/c1', 'p1', '/projects/p1/map'],
    ['/reports', 'p1', '/projects/p1/reports'],
    ['/projects', 'p1', '/projects/p1/overview'],
    ['/', 'p1', '/projects/p1/overview'],
    ['/projects/p1/stakeholders/s9', 'p2', '/projects/p2/stakeholders'],
    ['/projects/p1/stakeholders/matrix', 'p2', '/projects/p2/stakeholders/matrix'],
    ['/projects/p1/engagements/e1/minutes', 'p2', '/projects/p2/engagements'],
    ['/projects/p1/areas/a1', 'p2', '/projects/p2/map'],
    ['/projects/p1/settings', 'p2', '/projects/p2/settings'],
    ['/projects/p1/stakeholders/s9', null, '/stakeholders'],
    ['/projects/p1/engagements/calendar', null, '/engagements/calendar'],
    ['/projects/p1/field-visits/v1', null, '/engagements'],
    ['/projects/p1/map', null, '/territory'],
    ['/projects/p1/overview', null, '/projects'],
    ['/stakeholders', null, '/stakeholders'],
    // F3: compromisos, acuerdos, documentos y tareas; los ids de registro se sueltan al cambiar de proyecto
    ['/commitments', 'p1', '/projects/p1/commitments'],
    ['/commitments/dashboard', 'p1', '/projects/p1/commitments/dashboard'],
    ['/agreements', 'p1', '/projects/p1/agreements'],
    ['/documents/ev1', 'p1', '/projects/p1/documents'],
    ['/tasks/approvals', 'p1', '/projects/p1/tasks'],
    ['/projects/p1/commitments/c1', 'p2', '/projects/p2/commitments'],
    ['/projects/p1/commitments/dashboard', 'p2', '/projects/p2/commitments/dashboard'],
    ['/projects/p1/agreements/ag1', null, '/agreements'],
    ['/projects/p1/documents/ev1', null, '/documents'],
    ['/projects/p1/tasks', null, '/tasks']
  ])('%s con %s va a %s', (desde, proyecto, hacia) => {
    expect(rutaEquivalente(desde.split('?')[0], proyecto)).toBe(hacia)
  })
})

describe('filtroDeTerritorio', () => {
  it('aplica el chip si la lista tiene la relación y avisa si no', () => {
    expect(filtroDeTerritorio({ kind: 'locality', id: 'l1' }, { locality: 'locality' })).toEqual({ locality: 'l1' })
    expect(filtroDeTerritorio({ kind: 'community', id: 'c1' }, { locality: 'locality' })).toBeNull()
    expect(filtroDeTerritorio(null, {})).toEqual({})
  })
})

// la acción declarada READ_ALL_PROJECTS sobre project exime del alcance de lectura por proyecto (ADR-0029); ADMIN la tiene siempre
describe('useLeeTodosLosProyectos', () => {
  function Sonda() {
    return <span>{useLeeTodosLosProyectos() ? 'lee todo' : 'lee lo suyo'}</span>
  }
  it.each([
    ['con la acción sobre project', permisos({ project: ['READ', 'READ_ALL_PROJECTS'] }), 'lee todo'],
    ['ADMIN', ADMIN_PERMISOS, 'lee todo'],
    ['solo READ sobre project', permisos({ project: ['READ'] }), 'lee lo suyo'],
    ['la acción sobre otro objeto no cuenta', permisos({ project: ['READ'], commitment: ['READ_ALL_PROJECTS'] }), 'lee lo suyo']
  ])('%s', async (_caso, p, texto) => {
    fetch = mockFetch([])
    montar(<Sonda />, { permisos: p })
    expect(await screen.findByText(texto)).toBeInTheDocument()
  })
})

// el selector de proyecto es un combobox con búsqueda (DD-09): un campo con rol combobox que abre una lista (listbox) con «Todos
// mis proyectos» y los proyectos; se escribe para filtrar por código o nombre, las flechas mueven la opción activa, Enter elige
// y Escape cierra sin cambiar
const opciones = () => screen.getAllByRole('option').map((o) => o.textContent)

describe('selector de proyecto', () => {
  it('lista primero los proyectos de la persona y lleva a la misma sección del proyecto elegido', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([P1, P2]) },
      { path: '/objects/project_assignment/records', body: pagina([MI_ASIGNACION]) }
    ])
    montar(<SelectorDeProyecto />, { ruta: '/stakeholders', permisos: LEE_PROYECTOS })
    const selector = await screen.findByRole('combobox', { name: 'Proyecto' })
    expect(selector).toHaveValue('Todos mis proyectos')
    expect(selector).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(selector)
    expect(selector).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: 'Proyecto' })).toBeInTheDocument()
    await waitFor(() => expect(opciones()).toEqual(['Todos mis proyectos', 'PRJ-02 · Qorihuasi', 'PRJ-01 · Pukaqaqa']))
    expect(screen.getByRole('option', { name: 'Todos mis proyectos' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('option', { name: 'PRJ-01 · Pukaqaqa' }))
    expect(ubicacion.actual).toBe('/projects/p1/stakeholders')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('escribir filtra por código o nombre, sin distinguir tildes ni mayúsculas, y Enter elige la primera que coincide', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([P1, P2]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    montar(<SelectorDeProyecto />, { ruta: '/stakeholders', permisos: LEE_PROYECTOS })
    const selector = await screen.findByRole('combobox', { name: 'Proyecto' })
    await userEvent.type(selector, 'QORÍ')
    // «Todos mis proyectos» queda siempre a mano
    await waitFor(() => expect(opciones()).toEqual(['Todos mis proyectos', 'PRJ-02 · Qorihuasi']))
    expect(selector).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'PRJ-02 · Qorihuasi' }).id)
    await userEvent.keyboard('{Enter}')
    expect(ubicacion.actual).toBe('/projects/p2/stakeholders')
  })

  it('sin coincidencias lo dice', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([P1, P2]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    montar(<SelectorDeProyecto />, { ruta: '/stakeholders', permisos: LEE_PROYECTOS })
    const selector = await screen.findByRole('combobox', { name: 'Proyecto' })
    await userEvent.type(selector, 'zzz')
    expect(await screen.findByText('Ningún proyecto coincide con la búsqueda.')).toBeInTheDocument()
    expect(opciones()).toEqual(['Todos mis proyectos'])
  })

  it('las flechas mueven la opción activa, Enter la elige y Escape cierra sin cambiar', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([P1, P2]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    montar(<SelectorDeProyecto />, { ruta: '/projects/p1/stakeholders', permisos: LEE_PROYECTOS })
    const selector = await screen.findByRole('combobox', { name: 'Proyecto' })
    await waitFor(() => expect(selector).toHaveValue('PRJ-01 · Pukaqaqa'))
    selector.focus()
    // abre con la elegida activa
    await userEvent.keyboard('{ArrowDown}')
    expect(selector).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'PRJ-01 · Pukaqaqa' }).id)
    await userEvent.keyboard('{ArrowDown}')
    expect(selector).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'PRJ-02 · Qorihuasi' }).id)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(selector).toHaveValue('PRJ-01 · Pukaqaqa')
    expect(ubicacion.actual).toBe('/projects/p1/stakeholders')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{Enter}')
    expect(ubicacion.actual).toBe('/stakeholders')
  })

  it('sin READ sobre project no se dibuja', () => {
    fetch = mockFetch([])
    montar(<SelectorDeProyecto />, { permisos: { admin: false, objects: {} } })
    expect(screen.queryByRole('combobox', { name: 'Proyecto' })).not.toBeInTheDocument()
  })

  it.each([
    ['la acción de leer todos', permisos({ project: ['READ', 'READ_ALL_PROJECTS'], project_assignment: ['READ'] })],
    ['ADMIN', ADMIN_PERMISOS]
  ])('con %s, el alcance global es «Todos los proyectos», por defecto, aunque no tenga asignaciones', async (_caso, p) => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([P1, P2]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    montar(<SelectorDeProyecto />, { ruta: '/stakeholders', permisos: p })
    const selector = await screen.findByRole('combobox', { name: 'Proyecto' })
    await waitFor(() => expect(selector).toHaveValue('Todos los proyectos'))
    await userEvent.click(selector)
    await waitFor(() => expect(opciones()).toEqual(['Todos los proyectos', 'PRJ-01 · Pukaqaqa', 'PRJ-02 · Qorihuasi']))
  })

  it('con la acción de leer todos y una organización sin proyectos, sigue el selector y no el aviso de asignación', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    montar(<SelectorDeProyecto />, { ruta: '/stakeholders', permisos: permisos({ project: ['READ', 'READ_ALL_PROJECTS'] }) })
    await userEvent.click(await screen.findByRole('combobox', { name: 'Proyecto' }))
    await waitFor(() => expect(opciones()).toEqual(['Todos los proyectos']))
    expect(screen.queryByText(/No tiene proyectos asignados/)).not.toBeInTheDocument()
  })

  it('sin proyectos que leer ni la acción de leer todos, dice que no tiene proyectos asignados en lugar de un selector vacío', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    montar(<SelectorDeProyecto />, { ruta: '/stakeholders', permisos: LEE_PROYECTOS })
    expect(await screen.findByText('No tiene proyectos asignados. Pida una asignación al administrador de proyectos.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Proyecto' })).not.toBeInTheDocument()
  })
})

describe('barra de contexto y Project 360', () => {
  it('muestra el proyecto con su estado y quita el chip de territorio sin cambiar de pantalla', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records/p1', body: P1 },
      { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
      { path: '/objects/community/records/c1', body: registro('c1', { name: 'CC Tunas Pampa' }) }
    ])
    montar(<BarraDeContexto />, { ruta: '/projects/p1/stakeholders?territory=community:c1' })
    expect(await screen.findByText('PRJ-01 · Pukaqaqa')).toBeInTheDocument()
    expect(await screen.findByText('Activo')).toBeInTheDocument()
    expect(await screen.findByText('Territorio: Comunidad CC Tunas Pampa')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el filtro de territorio' }))
    expect(ubicacion.actual).toBe('/projects/p1/stakeholders')
  })

  // observa las mismas consultas que el layout (misma clave, misma caché): cuando dice que llegaron, el layout ya las vio
  function Sonda() {
    const asignaciones = useMisAsignaciones()
    const proyecto = useProyecto('p1')
    return (
      <>
        <input aria-label="Motivo" />
        {asignaciones.isSuccess ? <span>asignaciones llegaron</span> : null}
        {proyecto.isError ? <span>proyecto falló</span> : null}
      </>
    )
  }
  const LAYOUT = (
    <Routes>
      <Route path="/projects/:projectId" element={<ProyectoLayout />}>
        <Route path="overview" element={<Sonda />} />
      </Route>
    </Routes>
  )
  const RUTAS_DEL_PROYECTO = [
    { path: '/objects/project/records/p1', body: P1 },
    { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) }
  ]

  it('sin asignación al proyecto avisa que es de solo lectura', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([MI_ASIGNACION]) }])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: LEE_PROYECTOS })
    expect(await screen.findByText(AVISO)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resumen' })).toHaveAttribute('aria-current', 'page')
  })

  // D7 de la revisión de UX: la pestaña y el proyecto en el título del documento
  it('el título del documento dice la pestaña y el proyecto', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: ADMIN_PERMISOS })
    await waitFor(() => expect(document.title).toBe('Resumen · Pukaqaqa · SGSPE'))
  })

  it('con asignación al proyecto no avisa', async () => {
    fetch = mockFetch([
      ...RUTAS_DEL_PROYECTO,
      {
        path: '/objects/project_assignment/records',
        body: pagina([registro('a2', { project: 'p1', member_user_id: RELACIONISTA.id, role_name: 'X', active: true })])
      }
    ])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: LEE_PROYECTOS })
    // las asignaciones ya llegaron: el aviso, de haber salido, saldría ahora
    await screen.findByText('asignaciones llegaron')
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })

  it('ADMIN no necesita asignación: no avisa aunque no tenga ninguna', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: ADMIN_PERMISOS })
    await screen.findByText('asignaciones llegaron')
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })

  // etapa 1 de la revisión de UX: migas en lugar del nombre suelto, nueve pestañas y «Más», y Acuerdos como vista de Compromisos
  it('las migas dicen dónde se está, con el registro que la ficha declara', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    function Ficha() {
      useMigaDelRegistro('C-001')
      return <p>Ficha</p>
    }
    montar(
      <Routes>
        <Route path="/projects/:projectId" element={<ProyectoLayout />}>
          <Route path="commitments/:commitmentId" element={<Ficha />} />
        </Route>
      </Routes>,
      { ruta: '/projects/p1/commitments/c1', permisos: ADMIN_PERMISOS }
    )
    const migas = await screen.findByRole('navigation', { name: 'Ubicación' })
    expect(await within(migas).findByRole('link', { name: 'PRJ-01 · Pukaqaqa' })).toHaveAttribute('href', '/projects/p1/overview')
    expect(within(migas).getByRole('link', { name: 'Compromisos' })).toHaveAttribute('href', '/projects/p1/commitments')
    expect(within(migas).getByText('C-001')).toHaveAttribute('aria-current', 'page')
  })

  // U-04 del rediseño: una ficha que no vive bajo el segmento de su pestaña (una queja en /grievances/:id) marca esa pestaña
  // y la nombra en las migas, nunca con el segmento de la ruta
  it.each([
    ['grievances/q1', 'Quejas, consultas y solicitudes', 'attention'],
    ['inquiries/q2', 'Quejas, consultas y solicitudes', 'attention'],
    ['requests/q3', 'Quejas, consultas y solicitudes', 'attention'],
    ['contributions/a1', 'Programas sociales', 'programs'],
    ['field-visits/v1', 'Relacionamiento', 'engagements'],
    ['incidents/i1', 'Riesgos', 'risks'],
    ['areas/z1', 'Mapa', 'map']
  ])('en %s marca la pestaña %s y la nombra en las migas', async (ruta, pestana, segmento) => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    function Ficha() {
      useMigaDelRegistro('R-001')
      return <p>Ficha</p>
    }
    montar(
      <Routes>
        <Route path="/projects/:projectId" element={<ProyectoLayout />}>
          <Route path="*" element={<Ficha />} />
        </Route>
      </Routes>,
      { ruta: `/projects/p1/${ruta}`, permisos: ADMIN_PERMISOS }
    )
    const subnav = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    expect(within(subnav).getByRole('link', { name: pestana })).toHaveAttribute('aria-current', 'page')
    const migas = await screen.findByRole('navigation', { name: 'Ubicación' })
    expect(await within(migas).findByRole('link', { name: pestana })).toHaveAttribute('href', `/projects/p1/${segmento}`)
    expect(within(migas).getByText('R-001')).toHaveAttribute('aria-current', 'page')
  })

  it('en el resumen, las migas terminan en el proyecto', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: ADMIN_PERMISOS })
    const migas = await screen.findByRole('navigation', { name: 'Ubicación' })
    expect(await within(migas).findByText('PRJ-01 · Pukaqaqa')).toHaveAttribute('aria-current', 'page')
  })

  it('nueve pestañas y «Más» con Tareas, Revisión de IA, Reportes y Equipo; la de «Más» abierta se marca en el botón', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    montar(
      <Routes>
        <Route path="/projects/:projectId" element={<ProyectoLayout />}>
          <Route path="*" element={null} />
        </Route>
      </Routes>,
      { ruta: '/projects/p1/overview', permisos: ADMIN_PERMISOS }
    )
    const subnav = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    expect(
      within(subnav)
        .getAllByRole('link')
        .map((a) => a.getAttribute('aria-label') ?? a.textContent)
    ).toEqual([
      'Resumen',
      'Mapa',
      'Grupos de interés',
      'Relacionamiento',
      'Compromisos',
      'Quejas, consultas y solicitudes',
      'Riesgos',
      'Programas sociales',
      'Documentos'
    ])
    const mas = screen.getByRole('button', { name: 'Más secciones del proyecto' })
    await userEvent.click(mas)
    const grupo = screen.getByRole('group', { name: 'Más secciones del proyecto' })
    expect(
      within(grupo)
        .getAllByRole('link')
        .map((a) => a.textContent)
    ).toEqual(['Tareas', 'Bandeja de IA', 'Reportes', 'Equipo y parámetros'])
    await userEvent.click(within(grupo).getByRole('link', { name: 'Equipo y parámetros' }))
    expect(ubicacion.actual).toBe('/projects/p1/settings')
    expect(screen.getByRole('button', { name: 'Más secciones del proyecto: Equipo y parámetros' })).toHaveAttribute('aria-current', 'page')
  })

  // B-03 (wasichai/sgspe#161): los conteos de todas las pestañas en una sola lectura de /api/sgspe/projects/{id}/counts
  const CONTEOS_DEL_SERVIDOR = {
    counts: {
      'stakeholders:total': 7,
      'engagements:total': 4,
      'commitments:total': 12,
      'commitments:accion': 3,
      'attention:total': 6,
      'attention:accion': 3,
      'risks:total': null,
      'programs:total': 2,
      'documents:total': 9
    },
    confidentialHidden: false
  }
  const lecturasGenericas = (llamadas: FetchMock['calls']) =>
    llamadas.filter((c) => /^\/objects\/(?!project)[a-z_]+\/records\?/.test(c.path) && c.path.includes('size=1'))

  it('una sola petición al abrir el proyecto da las mismas insignias, y la que es null no se dibuja', async () => {
    fetch = mockFetch([
      ...RUTAS_DEL_PROYECTO,
      { path: '/objects/project_assignment/records', body: pagina([]) },
      { path: '/sgspe/projects/p1/counts', body: CONTEOS_DEL_SERVIDOR }
    ])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: ADMIN_PERMISOS })
    const subnav = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    await waitFor(() => expect(within(subnav).getByRole('link', { name: 'Compromisos' })).toHaveAccessibleDescription('12 en total, 3 vencidos'))
    expect(within(subnav).getByRole('link', { name: 'Quejas, consultas y solicitudes' })).toHaveAccessibleDescription('6 en total, 3 vencidos')
    expect(within(subnav).getByRole('link', { name: 'Documentos' })).toHaveAccessibleDescription('9 en total')
    expect(within(subnav).getByRole('link', { name: 'Riesgos' })).not.toHaveAttribute('aria-describedby')
    expect(fetch.calls.filter((c) => c.path.startsWith('/sgspe/projects/p1/counts'))).toHaveLength(1)
    expect(lecturasGenericas(fetch.calls)).toEqual([])
  })

  it.each([
    ['un 404', 404],
    ['un 5xx', 503]
  ])('ante %s de la lectura única vuelve a las lecturas por pestaña', async (_, status) => {
    fetch = mockFetch([
      ...RUTAS_DEL_PROYECTO,
      { path: '/objects/project_assignment/records', body: pagina([]) },
      { path: '/sgspe/projects/p1/counts', status, body: { title: 'Error', status, detail: 'x', errors: [] } },
      { path: /\/objects\/commitment\/records\?.*deadline_status=VENCIDO/, body: pagina([], { totalElements: 3 }) },
      { path: '/objects/commitment/records', body: pagina([], { totalElements: 12 }) }
    ])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: ADMIN_PERMISOS })
    const subnav = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    await waitFor(() => expect(within(subnav).getByRole('link', { name: 'Compromisos' })).toHaveAccessibleDescription('12 en total, 3 vencidos'))
    expect(lecturasGenericas(fetch.calls).length).toBeGreaterThan(1)
  })

  it('ante otro error de la lectura única no hay insignias ni lecturas por pestaña', async () => {
    fetch = mockFetch([
      ...RUTAS_DEL_PROYECTO,
      { path: '/objects/project_assignment/records', body: pagina([]) },
      { path: '/sgspe/projects/p1/counts', status: 422, body: { title: 'Error', status: 422, detail: 'x', errors: [] } }
    ])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: ADMIN_PERMISOS })
    const subnav = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    await waitFor(() => expect(fetch?.calls.some((c) => c.path.startsWith('/sgspe/projects/p1/counts'))).toBe(true))
    expect(within(subnav).getByRole('link', { name: 'Compromisos' })).not.toHaveAttribute('aria-describedby')
    expect(lecturasGenericas(fetch.calls)).toEqual([])
  })

  // sin la ruta nueva (un backend anterior a B-03 responde 404), las lecturas de siempre
  it('cada pestaña dice su total y lo vencido, sin cambiar su nombre; QCS suma sus tres objetos', async () => {
    fetch = mockFetch([
      ...RUTAS_DEL_PROYECTO,
      { path: '/objects/project_assignment/records', body: pagina([]) },
      { path: /\/objects\/commitment\/records\?.*deadline_status=VENCIDO/, body: pagina([], { totalElements: 3 }) },
      { path: '/objects/commitment/records', body: pagina([], { totalElements: 12 }) },
      { path: /\/objects\/(grievance|inquiry|stakeholder_request)\/records\?.*deadline_status=VENCIDO/, body: pagina([], { totalElements: 1 }) },
      { path: /\/objects\/(grievance|inquiry|stakeholder_request)\/records/, body: pagina([], { totalElements: 2 }) }
    ])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: ADMIN_PERMISOS })
    const subnav = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    await waitFor(() => expect(within(subnav).getByRole('link', { name: 'Compromisos' })).toHaveAccessibleDescription('12 en total, 3 vencidos'))
    expect(within(subnav).getByRole('link', { name: 'Quejas, consultas y solicitudes' })).toHaveAccessibleDescription('6 en total, 3 vencidos')
  })

  // DD-03 (U-18): una sola fila de pestañas. la segunda fila con las vistas de una pestaña («Vistas de Compromisos», con
  // Compromisos y Acuerdos) ya no existe: Acuerdos se ofrece en el selector de páginas de su lista (compromisos.test.tsx y
  // acuerdos.test.tsx). en Acuerdos, la pestaña marcada sigue siendo Compromisos
  it('una sola fila de pestañas: en Acuerdos queda marcada Compromisos y no hay una segunda fila de vistas', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    montar(
      <Routes>
        <Route path="/projects/:projectId" element={<ProyectoLayout />}>
          <Route path="agreements" element={<p>Acuerdos</p>} />
          <Route path="commitments" element={<p>Compromisos</p>} />
        </Route>
      </Routes>,
      { ruta: '/projects/p1/agreements', permisos: ADMIN_PERMISOS }
    )
    const subnav = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    expect(within(subnav).getByRole('link', { name: 'Compromisos' })).toHaveAttribute('aria-current', 'page')
    expect(within(subnav).queryByRole('link', { name: 'Acuerdos' })).not.toBeInTheDocument()
    // la única navegación del proyecto es su fila de pestañas
    expect(screen.queryByRole('navigation', { name: /^Vistas de/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('navigation').map((n) => n.getAttribute('aria-label'))).not.toContain('Vistas de Compromisos')
    expect(screen.queryByRole('link', { name: 'Acuerdos' })).not.toBeInTheDocument()
  })

  it('las pestañas de otra sección se ofrecen con sus permisos (revisión final, M7)', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: permisos({ project: ['READ'] }) })
    const subnav = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    expect(
      within(subnav)
        .getAllByRole('link')
        .map((a) => a.textContent)
    ).toEqual(['Resumen', 'Mapa'])
  })

  it('con los permisos de cada sección, sus pestañas (unas a la vista y otras en «Más»)', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    montar(LAYOUT, {
      ruta: '/projects/p1/overview',
      permisos: permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], engagement: ['READ'] })
    })
    const subnav = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    // Resumen, Mapa, Grupos de interés y Relacionamiento a la vista; Reportes y Equipo en «Más»
    expect(within(subnav).getAllByRole('link')).toHaveLength(4)
  })

  // con el alcance por proyecto, un proyecto ajeno responde 404 como uno inexistente (spec 4.4 §3.6): no se distingue y
  // reintentar no sirve
  it('un proyecto que responde 404 dice que no existe o no es de sus proyectos, sin reintento, y ofrece volver a /projects', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records/p9', status: 404, body: { title: 'Error', status: 404, detail: 'Record p9 does not exist', errors: [] } },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    montar(LAYOUT, { ruta: '/projects/p9/overview', permisos: LEE_PROYECTOS })
    expect(await screen.findByText('El registro no existe o no es de sus proyectos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByText(/does not exist/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a todos los proyectos' })).toHaveAttribute('href', '/projects')
    expect(screen.queryByLabelText('Motivo')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Resumen' })).not.toBeInTheDocument()
  })

  it('un proyecto que responde 403 dice el error y ofrece reintentar y volver a /projects', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records/p9', status: 403, body: { title: 'Error', status: 403, detail: 'x', errors: [] } },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    montar(LAYOUT, { ruta: '/projects/p9/overview', permisos: LEE_PROYECTOS })
    expect(await screen.findByText('Su cuenta no tiene permiso para esta acción. Pídalo a la administración del proyecto.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a todos los proyectos' })).toHaveAttribute('href', '/projects')
    expect(screen.queryByLabelText('Motivo')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Resumen' })).not.toBeInTheDocument()
  })

  it('un refetch fallido con el proyecto ya cargado no desmonta el contenido ni pierde lo escrito', async () => {
    fetch = mockFetch([...RUTAS_DEL_PROYECTO, { path: '/objects/project_assignment/records', body: pagina([]) }])
    montar(LAYOUT, { ruta: '/projects/p1/overview', permisos: LEE_PROYECTOS })
    await userEvent.type(await screen.findByLabelText('Motivo'), 'Porque sí')
    fetch.restore()
    fetch = mockFetch([
      { path: '/objects/project/records/p1', status: 500, body: { title: 'Error', status: 500, detail: 'x', errors: [] } },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    // volver a la pestaña refetcha lo viejo, y ahora el servidor falla
    fireEvent(window, new Event('visibilitychange'))
    await screen.findByText('proyecto falló')
    expect(screen.getByLabelText('Motivo')).toHaveValue('Porque sí')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })
})
