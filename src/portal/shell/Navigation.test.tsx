import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, ADMIN_PERMISOS, ADMINISTRACION, AUDITORA, permisosConCapacidades, RELACIONISTA, rutasDeSesion, SIN_PERMISOS, yo } from '../../test/portal'
import { PortalApp } from '../PortalApp'
import { ES } from '../textos/es'
import { scopeFromPath, territoryFromSearch } from './context'
import { arbolPara, BLOQUES, estadoDe, NAV_TREE, type ClaveDeSeccion } from './navTree'

// RF-IAM-002 y RNF-USA-001 con las rutas de docs/ux/ux-architecture.md §6.2: las 13 secciones en su orden y su fase; una
// sección se dibuja solo con pantalla y con los permisos de GET /api/auth/me/permissions; Administración solo para quien
// administra; el asistente no es una sección (ASM-073). en F1 no hay pantallas registradas:
// cada prueba registra la suya
const registradas = vi.hoisted(() => ({}) as Record<string, ComponentType>)
vi.mock('../pantallas', () => ({ PANTALLAS: registradas, RUTAS_ADICIONALES: [] }))

function Prueba() {
  return <h2>Pantalla de prueba</h2>
}

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  for (const clave of Object.keys(registradas)) delete registradas[clave]
  // desde S53 (rediseño de UX, U-08) Administración es una pantalla del portal y no un enlace a /admin: como las demás
  // secciones, sin pantalla no se dibuja. se registra en todas las pruebas para que digan quién la ve
  registradas.admin = Prueba
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

function start(user: AuthUser, rutas: MockRoute[], path = '/') {
  abrirSesion(user)
  window.history.pushState({}, '', path)
  fetch = mockFetch(rutas)
  render(<PortalApp />)
}

const lateral = () => screen.getByRole('navigation', { name: 'Secciones' })
// el nombre de cada sección en la barra lateral
const enlaces = () =>
  within(lateral())
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label') ?? link.textContent)

// una cuenta que puede exactamente estos pares "objeto ACCION", con todas las pantallas registradas
const cuenta = (pares: string[], isAdmin = false, capacidades: string[] = []) => ({
  isAdmin,
  capacidades,
  can: (objeto: string, accion: string) => isAdmin || pares.includes(`${objeto} ${accion}`),
  conPantalla: () => true
})
const soloDashboard = (clave: ClaveDeSeccion) => clave === 'dashboard'

describe('NAV_TREE', () => {
  it('declara las 13 secciones en su orden, con su ruta de docs/ux, su ícono y sus fases', () => {
    expect(NAV_TREE.map((s) => [s.label, s.to, s.fases.join(', ')])).toEqual([
      ['Inicio', '/', 'F1, F8'],
      ['Proyectos', '/projects', 'F2, F7'],
      ['Territorio', '/territory', 'F2, F6'],
      ['Grupos de interés', '/stakeholders', 'F2'],
      ['Relacionamiento', '/engagements', 'F2'],
      ['Compromisos', '/commitments', 'F3'],
      ['Quejas, consultas y solicitudes', '/attention', 'F4'],
      ['Riesgos', '/risks', 'F4'],
      ['Programas sociales', '/programs', 'F5'],
      ['Documentos', '/documents', 'F3'],
      ['Tareas', '/tasks', 'F3'],
      ['Reportes', '/reports', 'F2, F8'],
      ['Administración', '/administration', 'F1']
    ])
    expect(NAV_TREE.filter((s) => !s.icon)).toEqual([])
    expect(new Set(NAV_TREE.map((s) => s.icon)).size).toBe(13)
  })

  it('las etiquetas del árbol son las de los textos en español', () => {
    for (const seccion of NAV_TREE) expect(ES.secciones[seccion.clave]).toBe(seccion.label)
  })

  // ux-architecture.md §7.1 y DD-10: las secciones van en bloques contiguos con título, sin cambiar su orden
  it('los bloques de la navegación reúnen las 13 secciones en su orden', () => {
    expect(BLOQUES.flatMap((b) => b.secciones)).toEqual(NAV_TREE.map((s) => s.clave))
    expect(BLOQUES.map((b) => b.clave ?? null)).toEqual([null, 'territorio', 'comunidades', 'riesgos', 'seguimiento', null])
  })

  it('en F1, con las pantallas de Inicio y Administración, el admin ve las dos y los demás solo Inicio', () => {
    const deF1 = (clave: ClaveDeSeccion) => clave === 'dashboard' || clave === 'admin'
    expect(arbolPara(NAV_TREE, { ...cuenta([], true), conPantalla: deF1 }).map((s) => s.label)).toEqual(['Inicio', 'Administración'])
    expect(arbolPara(NAV_TREE, { ...cuenta(['project READ']), conPantalla: deF1 }).map((s) => s.label)).toEqual(['Inicio'])
    // S53 ya no es un enlace externo: sin su pantalla, Administración no se dibuja, ni siquiera para el admin
    expect(arbolPara(NAV_TREE, { ...cuenta([], true), conPantalla: soloDashboard }).map((s) => s.label)).toEqual(['Inicio'])
  })

  it.each([
    [[], ['Inicio']],
    [['project READ'], ['Inicio', 'Proyectos']],
    [['inquiry READ'], ['Inicio', 'Quejas, consultas y solicitudes']],
    [
      ['early_warning READ', 'task READ'],
      ['Inicio', 'Riesgos', 'Tareas']
    ],
    [['project CREATE', 'stakeholder UPDATE'], ['Inicio']],
    // Reportes, con EXPORT sobre grupos de interés o con el historial de exportaciones (revisión final, M7)
    [['stakeholder EXPORT'], ['Inicio', 'Reportes']],
    [['export_log READ'], ['Inicio', 'Reportes']]
  ])('con todas las pantallas, la cuenta %j ve %j', (pares, secciones) => {
    expect(arbolPara(NAV_TREE, cuenta(pares)).map((s) => s.label)).toEqual(secciones)
  })

  it('estadoDe dice por qué una sección no se dibuja', () => {
    const f1 = { ...cuenta([]), conPantalla: soloDashboard }
    const de = (clave: ClaveDeSeccion) =>
      estadoDe(
        NAV_TREE.find((s) => s.clave === clave)!,
        f1
      )
    expect([de('dashboard'), de('projects'), de('admin')]).toEqual(['disponible', 'por-llegar', 'solo-admin'])
    expect(estadoDe(NAV_TREE[1], cuenta([]))).toBe('sin-acceso')
    const admin = NAV_TREE.find((s) => s.clave === 'admin')!
    expect(estadoDe(admin, cuenta([], false, ['MANAGE_METADATA']))).toBe('disponible')
    expect(estadoDe(admin, cuenta([], false, []))).toBe('solo-admin')
  })
})

describe('navegación del portal', () => {
  it('el encabezado no muestra el código del rol; con el directorio de roles, su rótulo', async () => {
    start(RELACIONISTA, rutasDeSesion(RELACIONISTA, permisosConCapacidades({ project: ['READ'] }, [])))
    await screen.findByRole('navigation', { name: 'Secciones' })
    expect(screen.getByText('Relacionista de prueba')).toBeInTheDocument()
    expect(screen.queryByText(RELACIONISTA.roles.join(', '))).not.toBeInTheDocument()
    cleanup()
    start(ADMINISTRACION, [
      ...rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS),
      { path: '/roles', body: ADMINISTRACION.roles.map((name) => ({ name, label: 'Administración de la organización' })) }
    ])
    expect(await within(screen.getByRole('banner')).findByText('Administración de la organización')).toBeInTheDocument()
  })

  // S53: Administración lleva a su pantalla del portal, que enlaza la consola de /admin (AdministracionPage.test.tsx)
  it('el admin ve Dashboard y Administración, que lleva a /administration', async () => {
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS))
    await screen.findByRole('navigation', { name: 'Secciones' })
    await waitFor(() => expect(enlaces()).toEqual(['Inicio', 'Administración']))
    expect(within(lateral()).getByRole('link', { name: 'Administración' })).toHaveAttribute('href', '/administration')
  })

  // WAS-ADR-0053: la plataforma dice que la cuenta tiene MANAGE_METADATA o MANAGE_ORGANIZATION aunque no sea admin: el portal lo lee
  it.each([['MANAGE_METADATA'], ['MANAGE_ORGANIZATION']])('una cuenta con %s en capabilities ve Administración sin ser admin', async (capacidad) => {
    start(AUDITORA, rutasDeSesion(AUDITORA, permisosConCapacidades({ project: ['READ'] }, [capacidad])))
    await screen.findByRole('navigation', { name: 'Secciones' })
    await waitFor(() => expect(enlaces()).toEqual(['Inicio', 'Administración']))
  })

  it('con capabilities vacío, Administración no se ofrece', async () => {
    start(AUDITORA, rutasDeSesion(AUDITORA, permisosConCapacidades({ project: ['READ'] }, [])))
    await screen.findByRole('navigation', { name: 'Secciones' })
    // los permisos ya se leyeron: la prueba no pasa por el estado «leyendo», en el que tampoco habría Administración
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/auth/me/permissions')).toBe(true))
    await waitFor(() => expect(enlaces()).toEqual(['Inicio']))
  })

  it('AUDITOR no ve Administración', async () => {
    start(AUDITORA, rutasDeSesion(AUDITORA, { admin: false, objects: { project: ['READ'] } }))
    await screen.findByRole('navigation', { name: 'Secciones' })
    expect(enlaces()).toEqual(['Inicio'])
  })

  it('si los permisos no se pueden leer, nadie ve Administración', async () => {
    start(ADMINISTRACION, [
      { path: '/auth/me', body: yo(ADMINISTRACION) },
      { path: '/auth/me/permissions', status: 403, body: { title: 'Forbidden', status: 403 } }
    ])
    await screen.findByRole('navigation', { name: 'Secciones' })
    expect(enlaces()).toEqual(['Inicio'])
  })

  it('si los permisos no se pueden leer, la URL de una sección lo dice y no afirma que la cuenta no pueda abrirla', async () => {
    registradas.projects = Prueba
    start(
      ADMINISTRACION,
      [
        { path: '/auth/me', body: yo(ADMINISTRACION) },
        { path: '/auth/me/permissions', status: 403, body: { title: 'Forbidden', status: 403 } }
      ],
      '/projects'
    )
    expect(await screen.findByText('No se pudieron leer sus permisos')).toBeInTheDocument()
    expect(screen.queryByText(/no puede abrir/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pantalla de prueba' })).not.toBeInTheDocument()
  })

  it('una sección con pantalla se ofrece con su permiso y abre su pantalla', async () => {
    registradas.projects = Prueba
    start(RELACIONISTA, rutasDeSesion(RELACIONISTA, { admin: false, objects: { project: ['READ'] } }), '/projects')
    expect(await screen.findByRole('heading', { name: 'Pantalla de prueba' })).toBeInTheDocument()
    expect(enlaces()).toEqual(['Inicio', 'Proyectos'])
  })

  // revisión de UX, etapa 1: dentro de una ficha de proyecto se marca el módulo, no «Proyectos»
  it('dentro de un proyecto marca la sección del módulo abierto', async () => {
    registradas.projects = Prueba
    registradas.commitments = Prueba
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS), '/projects/p1/commitments/c1')
    const compromisos = await within(lateral()).findByRole('link', { name: 'Compromisos' })
    expect(compromisos).toHaveAttribute('aria-current', 'page')
    expect(within(lateral()).getByRole('link', { name: 'Proyectos' })).not.toHaveAttribute('aria-current')
  })

  it('el título del documento dice la sección (D7)', async () => {
    registradas.commitments = Prueba
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS), '/commitments')
    await screen.findByRole('heading', { name: 'Pantalla de prueba' })
    expect(document.title).toBe('Compromisos · SGSPE')
  })

  // DD-10: en la barra, QCS se dice por su nombre largo; la sigla queda en la pestaña del proyecto (contexto.test.tsx)
  it('en la barra, QCS se dice «Quejas y solicitudes», con el nombre completo en title', async () => {
    registradas.attention = Prueba
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS), '/attention')
    const qcs = await within(lateral()).findByRole('link', { name: 'Quejas y solicitudes' })
    expect(qcs).toHaveTextContent('Quejas y solicitudes')
    expect(qcs).not.toHaveTextContent('QCS')
    expect(qcs).toHaveAttribute('title', 'Quejas, consultas y solicitudes')
    expect(qcs).toHaveAttribute('aria-current', 'page')
  })

  it('en inglés, la barra dice «Grievances and requests»', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    registradas.attention = Prueba
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS), '/attention')
    expect(await within(screen.getByRole('navigation', { name: 'Sections' })).findByRole('link', { name: 'Grievances and requests' })).toBeInTheDocument()
  })

  // DD-10: expandida desde lg (1024 px), con los títulos de bloque a la vista; por debajo, solo íconos. jsdom no evalúa las
  // media queries: se prueban las clases y la estructura
  it('desde lg la barra lateral está expandida, con las etiquetas y los títulos de bloque a la vista', async () => {
    for (const seccion of NAV_TREE) registradas[seccion.clave] = Prueba
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS))
    const nav = await screen.findByRole('navigation', { name: 'Secciones' })
    expect(nav).toHaveClass('w-[52px]', 'lg:w-60')
    const proyectos = await within(nav).findByRole('link', { name: 'Proyectos' })
    expect(within(proyectos).getByText('Proyectos')).toHaveClass('sr-only', 'lg:not-sr-only')
    // cada bloque con título es una lista nombrada por él, y el título se ve desde lg
    const bloque = within(nav).getByRole('list', { name: 'Trabajo con las comunidades' })
    expect(
      within(bloque)
        .getAllByRole('link')
        .map((l) => l.textContent)
    ).toEqual(['Grupos de interés', 'Relacionamiento', 'Compromisos', 'Quejas y solicitudes'])
    expect(within(nav).getByText('Trabajo con las comunidades')).toHaveClass('sr-only', 'lg:not-sr-only')
    expect(within(nav).getAllByRole('list').length).toBe(6)
  })

  it('un bloque sin secciones para la cuenta no se dibuja', async () => {
    registradas.projects = Prueba
    start(RELACIONISTA, rutasDeSesion(RELACIONISTA, { admin: false, objects: { project: ['READ'] } }))
    const nav = await screen.findByRole('navigation', { name: 'Secciones' })
    await within(nav).findByRole('list', { name: 'Proyectos y territorio' })
    expect(within(nav).queryByRole('list', { name: 'Trabajo con las comunidades' })).not.toBeInTheDocument()
    expect(within(nav).queryByText('Riesgos e inversión social')).not.toBeInTheDocument()
  })

  it('«Contraer» deja solo los íconos y se recuerda al volver a abrir el portal', async () => {
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS))
    const nav = await screen.findByRole('navigation', { name: 'Secciones' })
    const contraer = within(nav).getByRole('button', { name: 'Contraer' })
    expect(contraer).toHaveClass('hidden', 'lg:flex')
    await userEvent.click(contraer)
    expect(nav).not.toHaveClass('lg:w-60')
    expect(within(within(nav).getByRole('link', { name: 'Inicio' })).getByText('Inicio')).not.toHaveClass('lg:not-sr-only')
    expect(localStorage.getItem('sgspe.navegacion')).toBe('contraida')
    cleanup()
    fetch?.restore()
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS))
    const otra = await screen.findByRole('navigation', { name: 'Secciones' })
    expect(otra).not.toHaveClass('lg:w-60')
    await userEvent.click(within(otra).getByRole('button', { name: 'Expandir' }))
    expect(otra).toHaveClass('lg:w-60')
    expect(localStorage.getItem('sgspe.navegacion')).toBeNull()
  })

  // ASM-073: el asistente es el botón Preguntar de la barra superior, nunca una sección. llega en F7: se dibuja si
  // GET /api/sgspe/ai/status responde, y un backend sin F7 (404) no lo dibuja
  it('Preguntar está en la barra superior si el servidor tiene la IA, abre el asistente y no es una sección', async () => {
    start(ADMINISTRACION, [
      ...rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS),
      { path: '/sgspe/ai/status', body: { enabled: true, providerAvailable: true, useCases: ['AI-05'] } }
    ])
    const preguntar = await within(await screen.findByRole('banner')).findByRole('button', { name: 'Preguntar' })
    await waitFor(() => expect(enlaces()).toEqual(['Inicio', 'Administración']))
    await userEvent.click(preguntar)
    expect(await screen.findByRole('dialog', { name: 'Asistente de IA' })).toBeInTheDocument()
  })

  it('sin la IA en el servidor (404) no hay botón Preguntar', async () => {
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS))
    await screen.findByRole('navigation', { name: 'Secciones' })
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/sgspe/ai/status')).toBe(true))
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Preguntar' })).not.toBeInTheDocument()
  })
  it('un admin con todas las pantallas registradas ve las 13 secciones', async () => {
    for (const seccion of NAV_TREE) registradas[seccion.clave] = Prueba
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS))
    await screen.findByRole('navigation', { name: 'Secciones' })
    // en la barra, QCS se nombra «Quejas y solicitudes» (DD-10)
    await waitFor(() => expect(enlaces()).toEqual(NAV_TREE.map((s) => (s.clave === 'attention' ? 'Quejas y solicitudes' : s.label))))
    expect(enlaces()).toHaveLength(13)
  })

  // design-system.md §6.5: una sección que aún no llega lo dice, sin un error técnico; llega en la primera de sus fases
  it.each([
    ['/projects', 'Esta sección todavía no está disponible en su organización.'],
    ['/territory', 'Esta sección todavía no está disponible en su organización.'],
    ['/commitments', 'Esta sección todavía no está disponible en su organización.'],
    ['/attention', 'Esta sección todavía no está disponible en su organización.'],
    ['/programs', 'Esta sección todavía no está disponible en su organización.'],
    ['/reports', 'Esta sección todavía no está disponible en su organización.']
  ])('la ruta directa a %s, sin pantalla todavía, dice «%s»', async (ruta, texto) => {
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS), ruta)
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText('Esta página no existe')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pantalla de prueba' })).not.toBeInTheDocument()
  })

  it('la sección por llegar habla inglés con el idioma en inglés', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS), '/projects')
    expect(await screen.findByText('This section is not available in your organization yet.')).toBeInTheDocument()
  })

  it('una ruta que no es de ninguna sección sigue siendo la página no encontrada', async () => {
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS), '/no-existe')
    expect(await screen.findByText('Esta página no existe')).toBeInTheDocument()
    expect(screen.queryByText(/Esta sección llega en/)).not.toBeInTheDocument()
  })

  it('la sección abierta se marca como la página actual', async () => {
    start(RELACIONISTA, rutasDeSesion(RELACIONISTA, SIN_PERMISOS))
    await screen.findByRole('navigation', { name: 'Secciones' })
    expect(within(lateral()).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it('sin el permiso, la URL de la sección dice que la cuenta no puede abrirla', async () => {
    registradas.projects = Prueba
    start(RELACIONISTA, rutasDeSesion(RELACIONISTA, SIN_PERMISOS), '/projects')
    expect(await screen.findByRole('heading', { name: 'No puede abrir «Proyectos»' })).toBeInTheDocument()
    // hallazgo U-09: dice a quién pedirlo (fuera de un proyecto no se sabe la jefatura) y ofrece la salida al inicio
    const bloque = screen.getByRole('region', { name: 'No puede abrir «Proyectos»' })
    expect(bloque).toHaveTextContent('pídalo a la administración de su organización')
    expect(within(bloque).getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('heading', { name: 'Pantalla de prueba' })).not.toBeInTheDocument()
    expect(enlaces()).toEqual(['Inicio'])
  })
})

// el gancho del contexto (ASM-075, ASM-076): en F1 nadie lo dibuja todavía, pero la URL ya lo dice
describe('contexto en la URL', () => {
  it.each([
    ['/', { kind: 'mine' }],
    ['/projects', { kind: 'mine' }],
    ['/projects/new', { kind: 'mine' }],
    ['/projects/p-1', { kind: 'project', projectId: 'p-1' }],
    ['/projects/p-1/commitments/c-9', { kind: 'project', projectId: 'p-1' }],
    ['/territory/communities/c-1', { kind: 'mine' }]
  ])('%s tiene el alcance %j', (ruta, alcance) => {
    expect(scopeFromPath(ruta)).toEqual(alcance)
  })

  // un % mal formado en la URL no tumba la pantalla: sin proyecto legible, el alcance es el global
  it.each(['/projects/%E0', '/projects/%', '/projects/%E0%A4%A/documents', '/projects/ok%zz'])('%s, tiene el alcance global', (ruta) => {
    expect(() => scopeFromPath(ruta)).not.toThrow()
    expect(scopeFromPath(ruta)).toEqual({ kind: 'mine' })
  })

  it('un proyecto con caracteres codificados bien formados se lee', () => {
    expect(scopeFromPath('/projects/a%20b/risks')).toEqual({ kind: 'project', projectId: 'a b' })
  })

  it.each([
    ['?territory=community:c-1', { kind: 'community', id: 'c-1' }],
    ['?territory=admin-unit:150101&view=candidates', { kind: 'admin-unit', id: '150101' }],
    ['?territory=planeta:x', null],
    ['?territory=community:', null],
    ['?territory=c-1', null],
    ['', null]
  ])('%s filtra por %j', (consulta, territorio) => {
    expect(territoryFromSearch(consulta)).toEqual(territorio)
  })
})
