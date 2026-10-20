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
import { arbolPara, estadoDe, NAV_TREE, type ClaveDeSeccion } from './navTree'

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
// el nombre de cada sección: el accesible (el rótulo corto «QCS» lleva el completo en aria-label)
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
      ['Administración', '/admin', 'F1']
    ])
    expect(NAV_TREE.filter((s) => !s.icon)).toEqual([])
    expect(new Set(NAV_TREE.map((s) => s.icon)).size).toBe(13)
  })

  it('las etiquetas del árbol son las de los textos en español', () => {
    for (const seccion of NAV_TREE) expect(ES.secciones[seccion.clave]).toBe(seccion.label)
  })

  it('en F1, sin pantallas, el admin ve Dashboard y Administración y los demás solo Dashboard', () => {
    expect(arbolPara(NAV_TREE, { ...cuenta([], true), conPantalla: soloDashboard }).map((s) => s.label)).toEqual(['Inicio', 'Administración'])
    expect(arbolPara(NAV_TREE, { ...cuenta(['project READ']), conPantalla: soloDashboard }).map((s) => s.label)).toEqual(['Inicio'])
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

  it('el admin ve Dashboard y Administración, que lleva a /admin', async () => {
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS))
    await screen.findByRole('navigation', { name: 'Secciones' })
    await waitFor(() => expect(enlaces()).toEqual(['Inicio', 'Administración']))
    expect(within(lateral()).getByRole('link', { name: 'Administración' })).toHaveAttribute('href', '/admin')
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
    expect(screen.queryByText(/no puede abrir/)).not.toBeInTheDocument()
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

  it('«Quejas, consultas y solicitudes» se ve como «QCS», con el nombre completo para lectores y en title', async () => {
    registradas.attention = Prueba
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS), '/attention')
    const qcs = await within(lateral()).findByRole('link', { name: 'Quejas, consultas y solicitudes' })
    expect(qcs).toHaveTextContent('QCS')
    expect(qcs).toHaveAttribute('title', 'Quejas, consultas y solicitudes')
    expect(qcs).toHaveAttribute('aria-current', 'page')
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
    await waitFor(() => expect(enlaces()).toEqual(NAV_TREE.map((s) => s.label)))
    expect(enlaces()).toHaveLength(13)
  })

  // rediseño de UX (2026-10-20): las 13 secciones en su orden (RNF-USA-001), en bloques contiguos con su título, para no leer
  // una lista plana de trece
  it('agrupa las secciones en bloques con título sin cambiar su orden', async () => {
    for (const seccion of NAV_TREE) registradas[seccion.clave] = Prueba
    start(ADMINISTRACION, rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS))
    await waitFor(() => expect(enlaces()).toHaveLength(13))
    const grupo = (nombre: string) =>
      within(within(lateral()).getByRole('group', { name: nombre }))
        .getAllByRole('link')
        .map((l) => l.getAttribute('aria-label') ?? l.textContent)
    expect(grupo('Proyectos y territorio')).toEqual(['Proyectos', 'Territorio'])
    expect(grupo('Trabajo con las comunidades')).toEqual(['Grupos de interés', 'Relacionamiento', 'Compromisos', 'Quejas, consultas y solicitudes'])
    expect(grupo('Riesgos e inversión social')).toEqual(['Riesgos', 'Programas sociales'])
    expect(grupo('Documentos y seguimiento')).toEqual(['Documentos', 'Tareas', 'Reportes'])
    expect(enlaces()).toEqual(NAV_TREE.map((s) => s.label))
  })

  it('un bloque sin secciones para la cuenta no se dibuja', async () => {
    registradas.projects = Prueba
    registradas.risks = Prueba
    start(RELACIONISTA, rutasDeSesion(RELACIONISTA, { admin: false, objects: { project: ['READ'] } }))
    await within(await screen.findByRole('navigation', { name: 'Secciones' })).findByRole('link', { name: 'Proyectos' })
    expect(within(lateral()).getByRole('group', { name: 'Proyectos y territorio' })).toBeInTheDocument()
    expect(within(lateral()).queryByRole('group', { name: 'Riesgos e inversión social' })).not.toBeInTheDocument()
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
    expect(await screen.findByText('Su cuenta no puede abrir «Proyectos».')).toBeInTheDocument()
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
