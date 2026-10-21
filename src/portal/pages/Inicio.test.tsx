import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, ADMIN_PERMISOS, ADMINISTRACION, AUDITORA, RELACIONISTA, rutasDeSesion, SIN_PERMISOS, yo } from '../../test/portal'
import type { VarianteDeInicio } from '../inicios'
import { PortalApp } from '../PortalApp'

// la bienvenida (S02, docs/ux/ux-architecture.md §6.2): usuario, organización, roles y los accesos a las secciones que la
// cuenta puede abrir, sin fases ni indicadores; y el inicio por rol de ASM-078, decidido por permisos. cada prueba registra
// sus variantes
const variantes = vi.hoisted(() => [] as VarianteDeInicio[])
vi.mock('../inicios', async (original) => ({ ...(await original<typeof import('../inicios')>()), INICIOS: variantes }))

// los accesos se prueban sin pantallas registradas: solo Administración (de quien administra) es una sección disponible
vi.mock('../pantallas', () => ({ PANTALLAS: {}, RUTAS_ADICIONALES: [] }))

const ORGANIZACION = { id: 'o1', name: 'Organización de prueba', slug: 'prueba', createdAt: null }

let fetch: FetchMock | null = null
let fetchDelNavegador: typeof globalThis.fetch | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  variantes.length = 0
  fetchDelNavegador = globalThis.fetch
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  // por si una prueba dejó su envoltura de fetch puesta
  if (fetchDelNavegador) globalThis.fetch = fetchDelNavegador
})

// retiene la respuesta de los permisos hasta que se llame a liberar(): el estado de carga de core, que mockFetch no sabe
// hacer. se instala sobre el fetch que dejó mockFetch, no antes, y solicitada se cumple cuando la petición ya está retenida
interface Retencion {
  liberar: () => void
  solicitada: Promise<void>
}
function retenerPermisos(): Retencion {
  const siguiente = globalThis.fetch
  let liberar = () => {}
  let avisar = () => {}
  const retenida = new Promise<void>((resolver) => {
    liberar = resolver
  })
  const solicitada = new Promise<void>((resolver) => {
    avisar = resolver
  })
  globalThis.fetch = async (entrada, opciones) => {
    if (String(entrada instanceof Request ? entrada.url : entrada).includes('/auth/me/permissions')) {
      avisar()
      await retenida
    }
    return siguiente(entrada, opciones)
  }
  return { liberar, solicitada }
}

// retener: la respuesta de los permisos no llega hasta que la prueba la libera
function start(user: AuthUser, permisos: CallerPermissions, primero: MockRoute[] = [], retener = false): Retencion | null {
  abrirSesion(user)
  window.history.pushState({}, '', '/')
  fetch = mockFetch([...primero, { path: '/organizations/current', body: ORGANIZACION }, ...rutasDeSesion(user, permisos)])
  const retencion = retener ? retenerPermisos() : null
  render(<PortalApp />)
  return retencion
}

// el contenido de la página, sin la barra superior (que también muestra el nombre y los roles)
const pagina = () => within(screen.getByRole('main'))

// la cuenta vive en el menú del perfil de la barra superior (revisión de UX, etapa 2): se abre y se lee ahí
async function cuenta() {
  await userEvent.click(await screen.findByRole('button', { name: 'Su cuenta' }))
  return within(screen.getByRole('group', { name: 'Su cuenta' }))
}

// los accesos de la bienvenida: las secciones que la cuenta puede abrir, como enlaces
const accesos = () =>
  within(pagina().getByRole('region', { name: 'Sus secciones' }))
    .queryAllByRole('link')
    .map((a) => a.textContent)

function InicioDePrueba() {
  return <h1>Inicio de prueba</h1>
}

describe('inicio de F1', () => {
  it('a quien administra le muestra «Mi día» sin la grilla, y la cuenta, la organización y los roles por su rótulo en el menú del perfil', async () => {
    start(ADMINISTRACION, ADMIN_PERMISOS, [{ path: '/roles', body: [{ name: 'ADMIN', label: 'Administración de la organización' }] }])
    expect(await screen.findByRole('heading', { name: 'Inicio', level: 1 })).toBeInTheDocument()
    expect(pagina().getByText('Le damos la bienvenida, Administración de prueba.')).toBeInTheDocument()
    // quien administra crea y lee: ve «Mi día» (los atajos) y no la grilla de secciones, que repetiría la barra lateral
    expect(await pagina().findByRole('region', { name: 'Registrar' })).toBeInTheDocument()
    expect(pagina().queryByRole('region', { name: 'Sus secciones' })).not.toBeInTheDocument()
    // la cuenta ya no está en la página: en el menú del perfil
    expect(pagina().queryByText('Administración de prueba (admin@sgspe.test)')).not.toBeInTheDocument()
    const perfil = await cuenta()
    expect(perfil.getByText('Administración de prueba (admin@sgspe.test)')).toBeInTheDocument()
    expect(await perfil.findByText('Organización de prueba')).toBeInTheDocument()
    expect(await perfil.findByText('Administración de la organización')).toBeInTheDocument()
    expect(pagina().queryByText(/F[0-9]/)).not.toBeInTheDocument()
    expect(pagina().queryByText('ADMIN')).not.toBeInTheDocument()
  })

  it('a AUDITOR, sin el directorio de roles, le dice cuántos roles tiene sin su código, y no le ofrece Administración', async () => {
    start(AUDITORA, { admin: false, objects: {} })
    const perfil = await cuenta()
    expect(await perfil.findByText('1 rol asignado')).toBeInTheDocument()
    expect(perfil.queryByText('AUDITOR')).not.toBeInTheDocument()
    expect(accesos()).toEqual([])
    expect(pagina().getByText('1 de 13 secciones disponibles para su cuenta')).toBeInTheDocument()
  })

  it('dice que no pudo leer la organización en lugar de inventarla', async () => {
    start(AUDITORA, { admin: false, objects: {} }, [{ path: '/organizations/current', status: 404, body: { title: 'Not Found', status: 404 } }])
    expect(await (await cuenta()).findByText('No se pudo leer la organización')).toBeInTheDocument()
  })

  it('también lo dice cuando la organización contesta 403', async () => {
    start(AUDITORA, { admin: false, objects: {} }, [{ path: '/organizations/current', status: 403, body: { title: 'Forbidden', status: 403 } }])
    expect(await (await cuenta()).findByText('No se pudo leer la organización')).toBeInTheDocument()
  })

  // los permisos que no se pueden leer, o que aún no llegan, no son «sin acceso»: la tabla no inventa un estado (RQ-SEC-005)
  it('si los permisos no se pueden leer, lo dice y no calcula estados con permisos que no tiene', async () => {
    start(ADMINISTRACION, SIN_PERMISOS, [{ path: '/auth/me/permissions', status: 403, body: { title: 'Forbidden', status: 403 } }])
    await waitFor(() => expect(pagina().getAllByText('No se pudieron leer sus permisos').length).toBeGreaterThan(0))
    expect(pagina().queryByText(/secciones disponibles/)).not.toBeInTheDocument()
    expect(accesos()).toEqual([])
  })

  it('mientras los permisos se leen, dice «Cargando…» y no «Solo para administración»', async () => {
    const retencion = start(ADMINISTRACION, ADMIN_PERMISOS, [], true)
    // la petición de los permisos ya salió y su respuesta está retenida: lo que se ve es el estado de carga de verdad
    await retencion?.solicitada
    // las demás lecturas sí llegan: la página ya procesó respuestas y los permisos siguen retenidos
    const perfil = await cuenta()
    expect(await perfil.findByText('Organización de prueba')).toBeInTheDocument()
    expect(await perfil.findByText('1 rol asignado')).toBeInTheDocument()
    expect(accesos()).toEqual([])
    expect(pagina().queryByText(/secciones disponibles/)).not.toBeInTheDocument()
    // solo liberar la respuesta decide: quien administra pasa a «Mi día» y la grilla se va
    retencion?.liberar()
    expect(await pagina().findByRole('region', { name: 'Registrar' })).toBeInTheDocument()
    expect(pagina().queryByRole('region', { name: 'Sus secciones' })).not.toBeInTheDocument()
  })

  it('dice que no pudo leer la cuenta cuando /auth/me falla', async () => {
    start(AUDITORA, SIN_PERMISOS, [{ path: '/auth/me', status: 403, body: { title: 'Forbidden', status: 403 } }])
    expect(await (await cuenta()).findByText('No se pudo leer la cuenta')).toBeInTheDocument()
  })

  it('dice «Sin roles» cuando la cuenta no tiene ninguno', async () => {
    start(AUDITORA, SIN_PERMISOS, [{ path: '/auth/me', body: { ...yo(AUDITORA), roles: [] } }])
    expect(await (await cuenta()).findByText('Sin roles')).toBeInTheDocument()
  })
})

// F8 (sgspe-ui#32): sin la revisión ejecutiva, el monitoreo y el catálogo de indicadores también se alcanzan desde el inicio,
// con los permisos de indicator e indicator_measurement
describe('enlaces a los indicadores', () => {
  const monitoreo = () => pagina().queryByRole('link', { name: 'Monitoreo del plan de relaciones comunitarias' })
  const catalogo = () => pagina().queryByRole('link', { name: 'Catálogo de indicadores' })

  it('quien lee indicator ve el monitoreo y el catálogo', async () => {
    start(RELACIONISTA, { admin: false, objects: { indicator: ['READ'] } })
    expect(await pagina().findByRole('link', { name: 'Monitoreo del plan de relaciones comunitarias' })).toHaveAttribute('href', '/dashboards/monitoring')
    expect(catalogo()).toHaveAttribute('href', '/dashboards/indicators')
  })

  it('quien solo lee indicator_measurement ve el monitoreo y no el catálogo', async () => {
    start(RELACIONISTA, { admin: false, objects: { indicator_measurement: ['READ'] } })
    expect(await pagina().findByRole('link', { name: 'Monitoreo del plan de relaciones comunitarias' })).toBeInTheDocument()
    expect(catalogo()).not.toBeInTheDocument()
  })

  it('sin leer ninguno de los dos, ninguno', async () => {
    start(AUDITORA, SIN_PERMISOS)
    // los permisos ya se leyeron: la bienvenida cuenta las secciones disponibles
    expect(await pagina().findByText('1 de 13 secciones disponibles para su cuenta')).toBeInTheDocument()
    expect(monitoreo()).not.toBeInTheDocument()
    expect(catalogo()).not.toBeInTheDocument()
  })
})

// ASM-078 sin nombres de rol (RQ-SEC-005): la variante del inicio sale de los permisos de la cuenta
describe('inicio por rol', () => {
  it('sin variantes registradas, toda cuenta ve la bienvenida', async () => {
    start(RELACIONISTA, SIN_PERMISOS)
    expect(await screen.findByRole('heading', { name: 'Inicio', level: 1 })).toBeInTheDocument()
    expect(pagina().getByText('Le damos la bienvenida, Relacionista de prueba.')).toBeInTheDocument()
  })

  it('una variante registrada se ofrece a quien tiene sus permisos, y solo a quien los tiene', async () => {
    variantes.push({ clave: 'prueba', seOfreceCon: [[{ objeto: 'project', accion: 'READ' }]], Pantalla: InicioDePrueba })
    start(RELACIONISTA, { admin: false, objects: { project: ['READ'] } })
    expect(await screen.findByRole('heading', { name: 'Inicio de prueba' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Inicio', level: 1 })).not.toBeInTheDocument()
  })

  it('sin los permisos de ninguna variante, la bienvenida', async () => {
    variantes.push({ clave: 'prueba', seOfreceCon: [[{ objeto: 'project', accion: 'READ' }]], Pantalla: InicioDePrueba })
    start(RELACIONISTA, SIN_PERMISOS)
    expect(await screen.findByRole('heading', { name: 'Inicio', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Inicio de prueba' })).not.toBeInTheDocument()
  })
})

// U-01 del rediseño (DD-01): el inicio es «Mi día» para toda cuenta, aunque el catálogo ofrezca la revisión ejecutiva; la
// visión ejecutiva es un bloque con las cifras que la cuenta lee, su fecha de cálculo y el enlace a la revisión completa
describe('visión ejecutiva en el inicio', () => {
  const CATALOGO = { path: '/sgspe/dashboards/indicators', body: [{ code: 'KPI-EXE-01', label: 'Proyectos activos', dashboard: 'executive', available: true }] }
  const tablero = (indicators: unknown[]) => ({
    path: '/sgspe/dashboards/executive',
    body: { dashboard: 'executive', computedAt: '2026-10-20T15:00:00Z', filters: {}, indicators }
  })
  const pidioElTablero = () => fetch?.calls.some((c) => c.url.includes('/sgspe/dashboards/executive')) ?? false

  it('a quien no lee ninguna cifra ejecutiva le muestra «Mi día» sin ningún «No disponible»', async () => {
    start(RELACIONISTA, SIN_PERMISOS, [
      CATALOGO,
      tablero([
        { code: 'KPI-EXE-01', label: 'Proyectos activos', available: false, unavailableReason: 'FORBIDDEN' },
        { code: 'KPI-COM-02', label: 'Compromisos vencidos', available: false, unavailableReason: 'FORBIDDEN' }
      ])
    ])
    expect(await screen.findByRole('heading', { name: 'Inicio', level: 1 })).toBeInTheDocument()
    await waitFor(() => expect(pidioElTablero()).toBe(true))
    expect(screen.queryByRole('heading', { name: 'Revisión ejecutiva', level: 1 })).not.toBeInTheDocument()
    expect(pagina().queryByRole('region', { name: 'Visión ejecutiva' })).not.toBeInTheDocument()
    expect(pagina().queryByText('No disponible')).not.toBeInTheDocument()
  })

  it('a quien lee alguna, el bloque con esas cifras, su fecha de cálculo y el enlace a la revisión completa', async () => {
    start(RELACIONISTA, SIN_PERMISOS, [
      CATALOGO,
      tablero([
        { code: 'KPI-EXE-01', label: 'Proyectos activos', available: true, value: 3 },
        { code: 'KPI-COM-02', label: 'Compromisos vencidos', available: false, unavailableReason: 'FORBIDDEN' }
      ])
    ])
    expect(await screen.findByRole('heading', { name: 'Inicio', level: 1 })).toBeInTheDocument()
    const bloque = within(await pagina().findByRole('region', { name: 'Visión ejecutiva' }))
    expect(bloque.getByText('Proyectos activos')).toBeInTheDocument()
    expect(bloque.queryByText('Compromisos vencidos')).not.toBeInTheDocument()
    expect(bloque.getByText(/^Calculado el /)).toBeInTheDocument()
    expect(bloque.getByRole('link', { name: 'Ver la revisión ejecutiva' })).toHaveAttribute('href', '/dashboards/executive')
  })

  it('sin la revisión ejecutiva en el catálogo, no pide el tablero', async () => {
    start(RELACIONISTA, SIN_PERMISOS, [{ path: '/sgspe/dashboards/indicators', body: [] }])
    expect(await screen.findByRole('heading', { name: 'Inicio', level: 1 })).toBeInTheDocument()
    await waitFor(() => expect(fetch?.calls.some((c) => c.url.includes('/sgspe/dashboards/indicators'))).toBe(true))
    expect(pidioElTablero()).toBe(false)
  })
})
