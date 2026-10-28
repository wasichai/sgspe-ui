import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pagina, registro } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ADMIN_PERMISOS, ADMINISTRACION } from '../../test/portal'

// la barra superior del rediseño (DD-09, U-12): seis controles a la vista desde md (la marca, el proyecto, Buscar, Preguntar,
// la campana y la cuenta). el idioma, el tema y la salida van en el menú de la cuenta, con el mismo comportamiento. jsdom no
// evalúa las media queries: los controles solo del teléfono (el botón del menú y el chip del proyecto, md:hidden) se apartan
// por su clase
const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' }, { state: 'active' })
const CON_IA = { path: '/sgspe/ai/status', body: { enabled: true, providerAvailable: true, useCases: ['AI-05'] } }
// la campana se dibuja si la bandeja de wasichai-notifications responde
const BANDEJA = {
  path: '/auth/me/notifications/summary',
  body: {
    kinds: { ACTION: { active: 0, unread: 0, overdue: 0 }, WARNING: { active: 0, unread: 0, overdue: 0 }, INFO: { active: 0, unread: 0, overdue: 0 } },
    latest: null
  }
}
const PROYECTOS = [
  { path: '/objects/project/records', body: pagina([P1]) },
  { path: '/objects/project_assignment/records', body: pagina([]) }
]

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

// los controles de la barra en su orden, sin los del teléfono
const controles = (barra: HTMLElement) =>
  Array.from(barra.querySelectorAll<HTMLElement>('a, button, select, input, [role="combobox"]')).filter(
    (el, i, todos) => !el.closest('.md\\:hidden') && todos.indexOf(el) === i
  )

describe('barra superior', () => {
  it('tiene seis controles: marca, proyecto, Buscar, Preguntar, campana y cuenta', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [CON_IA, BANDEJA, ...PROYECTOS])
    const barra = await screen.findByRole('banner')
    await within(barra).findByRole('button', { name: 'Preguntar' })
    await within(barra).findByRole('combobox', { name: 'Proyecto' })
    await within(barra).findByRole('button', { name: /^Avisos/ })
    const lista = controles(barra)
    expect(lista).toHaveLength(6)
    const [marca, proyecto, buscar, preguntar, campana, cuenta] = lista
    expect(marca).toHaveAccessibleName('SGSPE')
    expect(proyecto).toHaveAccessibleName('Proyecto')
    expect(buscar).toHaveAccessibleName(/^Buscar/)
    expect(preguntar).toHaveAccessibleName('Preguntar')
    expect(campana).toHaveAccessibleName(/^Avisos/)
    expect(cuenta).toHaveAccessibleName('Su cuenta')
    // ni el idioma, ni el tema, ni la salida quedan sueltos en la barra
    expect(within(barra).queryByRole('combobox', { name: 'Idioma' })).not.toBeInTheDocument()
    expect(within(barra).queryByRole('button', { name: /^Tema/ })).not.toBeInTheDocument()
    expect(within(barra).queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('el lema de la marca se oculta por debajo de 1536 px', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    const lema = await within(await screen.findByRole('banner')).findByText('Gestión social de proyectos extractivos')
    expect(lema).toHaveClass('hidden', 'min-[96rem]:inline')
  })

  it('el menú de la cuenta trae el idioma, el tema, los atajos y la salida', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    await userEvent.click(await within(await screen.findByRole('banner')).findByRole('button', { name: 'Su cuenta' }))
    const menu = screen.getByRole('group', { name: 'Su cuenta' })
    expect(within(menu).getByRole('combobox', { name: 'Idioma' })).toHaveValue('es')
    expect(within(menu).getByRole('button', { name: /^Tema: Sistema/ })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    // tercera pasada de UX, 4.7: la hoja de atajos también se ofrece aquí, y el menú se cierra al abrirla
    await userEvent.click(within(menu).getByRole('button', { name: 'Atajos de teclado' }))
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Su cuenta' })).not.toBeInTheDocument()
  })

  it('Escape en el menú de tema lo cierra sin cerrar el de la cuenta', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    await userEvent.click(await within(await screen.findByRole('banner')).findByRole('button', { name: 'Su cuenta' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Su cuenta' })).getByRole('button', { name: /^Tema/ }))
    expect(screen.getByRole('menu', { name: 'Tema' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu', { name: 'Tema' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Su cuenta' })).toBeInTheDocument()
  })

  // tercera pasada de UX, 2.4: los borradores de altas no quedan en el navegador para quien lo use después
  it('«Cerrar sesión» del menú de la cuenta cierra la sesión y borra los borradores de este navegador', async () => {
    localStorage.setItem('sgspe.borrador.compromiso.p1.u-otra', JSON.stringify({ valores: { title: 'x' }, guardado: '2026-10-19T15:00:00Z' }))
    localStorage.setItem('sgspe.navegacion', 'abierta')
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    await userEvent.click(await within(await screen.findByRole('banner')).findByRole('button', { name: 'Su cuenta' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Su cuenta' })).getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(rutaActual()).toMatch(/^\/login/))
    expect(localStorage.getItem('sgspe.borrador.compromiso.p1.u-otra')).toBeNull()
    expect(localStorage.getItem('sgspe.navegacion')).toBe('abierta')
  })
})
