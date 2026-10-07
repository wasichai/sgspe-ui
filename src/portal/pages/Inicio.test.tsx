import { render, screen, waitFor, within } from '@testing-library/react'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, ADMIN_PERMISOS, ADMINISTRACION, AUDITORA, RELACIONISTA, rutasDeSesion, SIN_PERMISOS, yo } from '../../test/portal'
import type { VarianteDeInicio } from '../inicios'
import { PortalApp } from '../PortalApp'

// el inicio de F1 (S02, docs/ux/ux-architecture.md §6.2: "F1 bienvenida"; roadmap, B7): usuario, organización, roles y
// mapa de módulos por fase, sin indicadores; y el inicio por rol de ASM-078, decidido por permisos. F1 no registra
// variantes: cada prueba registra la suya
const variantes = vi.hoisted(() => [] as VarianteDeInicio[])
vi.mock('../inicios', async (original) => ({ ...(await original<typeof import('../inicios')>()), INICIOS: variantes }))

const ORGANIZACION = { id: 'o1', name: 'Organización de prueba', slug: 'prueba', createdAt: null }

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  variantes.length = 0
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

function start(user: AuthUser, permisos: CallerPermissions, primero: MockRoute[] = []) {
  abrirSesion(user)
  window.history.pushState({}, '', '/')
  fetch = mockFetch([...primero, { path: '/organizations/current', body: ORGANIZACION }, ...rutasDeSesion(user, permisos)])
  render(<PortalApp />)
}

// retiene la respuesta de los permisos hasta que se llame a liberar(): el estado de carga de core, que mockFetch no sabe hacer
function retenerPermisos() {
  const original = globalThis.fetch
  let liberar = () => {}
  const retenida = new Promise<void>((resolver) => {
    liberar = resolver
  })
  globalThis.fetch = async (entrada, opciones) => {
    if (String(entrada instanceof Request ? entrada.url : entrada).includes('/auth/me/permissions')) await retenida
    return original(entrada, opciones)
  }
  return () => liberar()
}

// el contenido de la página, sin la barra superior (que también muestra el nombre y los roles)
const pagina = () => within(screen.getByRole('main'))

const filas = () =>
  within(pagina().getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((fila) =>
      within(fila)
        .getAllByRole('cell')
        .map((celda) => celda.textContent)
    )

const POR_LLEGAR = [
  ['Proyectos', 'F2, F7', 'Llega en F2'],
  ['Territorio', 'F2, F6', 'Llega en F2'],
  ['Grupos de interés', 'F2', 'Llega en F2'],
  ['Relacionamiento', 'F2', 'Llega en F2'],
  ['Compromisos', 'F3', 'Llega en F3'],
  ['Quejas, consultas y solicitudes', 'F4', 'Llega en F4'],
  ['Riesgos', 'F4', 'Llega en F4'],
  ['Programas sociales', 'F5', 'Llega en F5'],
  ['Documentos', 'F3', 'Llega en F3'],
  ['Tareas', 'F3', 'Llega en F3'],
  ['Reportes', 'F2–F4 exportaciones; F8 entregables', 'Llega en F2']
]

function InicioDePrueba() {
  return <h1>Inicio de prueba</h1>
}

describe('inicio de F1', () => {
  it('muestra la cuenta, la organización, los roles y el mapa de módulos por fase', async () => {
    start(ADMINISTRACION, ADMIN_PERMISOS)
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    expect(pagina().getByText('Le damos la bienvenida, Administración de prueba.')).toBeInTheDocument()
    expect(pagina().getByText('Administración de prueba (admin@sgspe.test)')).toBeInTheDocument()
    expect(await pagina().findByText('Organización de prueba')).toBeInTheDocument()
    expect(await pagina().findByText('ADMIN')).toBeInTheDocument()
    await waitFor(() => expect(filas()).toEqual([['Dashboard', 'F1, F8', 'Disponible'], ...POR_LLEGAR, ['Administración', 'F1', 'Disponible']]))
    expect(pagina().getByText('2 de 13 secciones disponibles para su cuenta')).toBeInTheDocument()
  })

  it('a AUDITOR le muestra su rol y que Administración es solo para quien administra', async () => {
    start(AUDITORA, { admin: false, objects: {} })
    expect(await pagina().findByText('AUDITOR')).toBeInTheDocument()
    expect(filas()).toEqual([['Dashboard', 'F1, F8', 'Disponible'], ...POR_LLEGAR, ['Administración', 'F1', 'Solo para administración']])
    expect(pagina().getByText('1 de 13 secciones disponibles para su cuenta')).toBeInTheDocument()
  })

  it('dice que no pudo leer la organización en lugar de inventarla', async () => {
    start(AUDITORA, { admin: false, objects: {} }, [{ path: '/organizations/current', status: 404, body: { title: 'Not Found', status: 404 } }])
    expect(await pagina().findByText('No se pudo leer la organización')).toBeInTheDocument()
  })

  it('también lo dice cuando la organización contesta 403', async () => {
    start(AUDITORA, { admin: false, objects: {} }, [{ path: '/organizations/current', status: 403, body: { title: 'Forbidden', status: 403 } }])
    expect(await pagina().findByText('No se pudo leer la organización')).toBeInTheDocument()
  })

  // los permisos que no se pueden leer, o que aún no llegan, no son «sin acceso»: la tabla no inventa un estado (RQ-SEC-005)
  it('si los permisos no se pueden leer, lo dice y no calcula estados con permisos que no tiene', async () => {
    start(ADMINISTRACION, SIN_PERMISOS, [{ path: '/auth/me/permissions', status: 403, body: { title: 'Forbidden', status: 403 } }])
    await waitFor(() => expect(pagina().getAllByText('No se pudieron leer sus permisos').length).toBeGreaterThan(0))
    expect(pagina().queryByText(/Sin acceso/)).not.toBeInTheDocument()
    expect(pagina().queryByText('Solo para administración')).not.toBeInTheDocument()
    expect(pagina().queryByText('Disponible')).not.toBeInTheDocument()
    expect(pagina().queryByText(/secciones disponibles/)).not.toBeInTheDocument()
    expect(filas().every(([, , estado]) => estado === 'No se pudieron leer sus permisos')).toBe(true)
    expect(filas()).toHaveLength(13)
  })

  it('mientras los permisos se leen, dice «Cargando…» y no «Solo para administración»', async () => {
    const liberar = retenerPermisos()
    start(ADMINISTRACION, ADMIN_PERMISOS)
    expect(await pagina().findByText('Administración de prueba (admin@sgspe.test)')).toBeInTheDocument()
    expect(filas().every(([, , estado]) => estado === 'Cargando…')).toBe(true)
    expect(pagina().queryByText('Solo para administración')).not.toBeInTheDocument()
    liberar()
    await waitFor(() => expect(filas()[0][2]).toBe('Disponible'))
    expect(pagina().getByText('2 de 13 secciones disponibles para su cuenta')).toBeInTheDocument()
  })

  it('dice que no pudo leer la cuenta cuando /auth/me falla', async () => {
    start(AUDITORA, SIN_PERMISOS, [{ path: '/auth/me', status: 500, body: { title: 'Error', status: 500 } }])
    expect(await pagina().findByText('No se pudo leer la cuenta')).toBeInTheDocument()
  })

  it('dice «Sin roles» cuando la cuenta no tiene ninguno', async () => {
    start(AUDITORA, SIN_PERMISOS, [{ path: '/auth/me', body: { ...yo(AUDITORA), roles: [] } }])
    expect(await pagina().findByText('Sin roles')).toBeInTheDocument()
  })
})

// ASM-078 sin nombres de rol (RQ-SEC-005): la variante del inicio sale de los permisos de la cuenta
describe('inicio por rol', () => {
  it('sin variantes registradas, toda cuenta ve la bienvenida y sabe que su inicio llega con su módulo', async () => {
    start(RELACIONISTA, SIN_PERMISOS)
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    expect(pagina().getByText('Cada rol tendrá su propio inicio cuando llegue su módulo; mientras tanto, todas las cuentas empiezan aquí.')).toBeInTheDocument()
  })

  it('una variante registrada se ofrece a quien tiene sus permisos, y solo a quien los tiene', async () => {
    variantes.push({ clave: 'prueba', seOfreceCon: [[{ objeto: 'project', accion: 'READ' }]], Pantalla: InicioDePrueba })
    start(RELACIONISTA, { admin: false, objects: { project: ['READ'] } })
    expect(await screen.findByRole('heading', { name: 'Inicio de prueba' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument()
  })

  it('sin los permisos de ninguna variante, la bienvenida', async () => {
    variantes.push({ clave: 'prueba', seOfreceCon: [[{ objeto: 'project', accion: 'READ' }]], Pantalla: InicioDePrueba })
    start(RELACIONISTA, SIN_PERMISOS)
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Inicio de prueba' })).not.toBeInTheDocument()
  })
})
