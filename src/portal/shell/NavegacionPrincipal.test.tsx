import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, pagina, ubicacion } from '../../test/montar'
import { permisos } from '../../test/portal'
import { NavegacionPrincipal } from './NavegacionPrincipal'

// la navegación principal horizontal de Civic Modern (ux-architecture.md §7.1, design-system.md §5.2): Inicio, un botón por bloque
// que abre un desplegable con sus secciones (patrón «disclosure navigation» de WAI-ARIA, no un menú) y Administración a la
// derecha. un bloque con una sola sección para la cuenta es un enlace; uno sin secciones no se dibuja
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const nav = () => screen.getByRole('navigation', { name: 'Secciones' })
// los enlaces y botones de la barra que se ven (fuera de un desplegable cerrado), en su orden
const aLaVista = () =>
  [...nav().querySelectorAll('a, button')].filter((e) => !e.closest('[hidden]')).map((e) => `${e.tagName === 'A' ? 'enlace' : 'botón'} ${e.textContent}`)

describe('NavegacionPrincipal', () => {
  it('Inicio, los cuatro bloques como botones y Administración, en su orden', () => {
    fetch = mockFetch([])
    montar(<NavegacionPrincipal />)
    const controles = aLaVista()
    expect(controles).toEqual([
      'enlace Inicio',
      'botón Proyectos y territorio',
      'botón Trabajo con las comunidades',
      'botón Riesgos e inversión social',
      'botón Documentos y seguimiento',
      'enlace Administración'
    ])
  })

  it('un bloque se abre con un clic y lista sus secciones; QCS se dice «Quejas y solicitudes» con el nombre completo en title', async () => {
    fetch = mockFetch([])
    montar(<NavegacionPrincipal />)
    const bloque = within(nav()).getByRole('button', { name: 'Trabajo con las comunidades' })
    expect(bloque).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(bloque)
    expect(bloque).toHaveAttribute('aria-expanded', 'true')
    const lista = screen.getByRole('list', { name: 'Trabajo con las comunidades' })
    expect(bloque).toHaveAttribute('aria-controls', lista.id)
    expect(
      within(lista)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')])
    ).toEqual([
      ['Grupos de interés', '/stakeholders'],
      ['Relacionamiento', '/engagements'],
      ['Compromisos', '/commitments'],
      ['Quejas y solicitudes', '/attention']
    ])
    expect(within(lista).getByRole('link', { name: 'Quejas y solicitudes' })).toHaveAttribute('title', 'Quejas, consultas y solicitudes')
  })

  it('Enter o la flecha abajo lo abren con el foco en la primera sección; las flechas recorren, Esc cierra y devuelve el foco', async () => {
    fetch = mockFetch([])
    montar(<NavegacionPrincipal />)
    const bloque = within(nav()).getByRole('button', { name: 'Riesgos e inversión social' })
    bloque.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('link', { name: 'Riesgos' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('link', { name: 'Programas sociales' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('link', { name: 'Riesgos' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('link', { name: 'Programas sociales' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(bloque).toHaveAttribute('aria-expanded', 'false')
    expect(bloque).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(bloque).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Riesgos' })).toHaveFocus()
  })

  it('abrir un bloque cierra el otro; un clic fuera y elegir una sección lo cierran', async () => {
    fetch = mockFetch([])
    montar(<NavegacionPrincipal />)
    const territorio = within(nav()).getByRole('button', { name: 'Proyectos y territorio' })
    const seguimiento = within(nav()).getByRole('button', { name: 'Documentos y seguimiento' })
    await userEvent.click(territorio)
    await userEvent.click(seguimiento)
    expect(territorio).toHaveAttribute('aria-expanded', 'false')
    expect(seguimiento).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(document.body)
    expect(seguimiento).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(territorio)
    await userEvent.click(screen.getByRole('link', { name: 'Territorio' }))
    expect(ubicacion.actual).toBe('/territory')
    expect(territorio).toHaveAttribute('aria-expanded', 'false')
  })

  // dentro de un proyecto se marca el bloque del módulo abierto, no «Proyectos y territorio»
  it('marca el bloque y la sección de la ruta: dentro de un proyecto, la del módulo abierto', async () => {
    fetch = mockFetch([])
    montar(<NavegacionPrincipal />, { ruta: '/projects/p1/commitments/c1' })
    const comunidades = within(nav()).getByRole('button', { name: 'Trabajo con las comunidades' })
    expect(comunidades).toHaveAttribute('aria-current', 'true')
    expect(comunidades).toHaveAccessibleDescription('Trabajo con las comunidades, sección abierta: Compromisos')
    expect(within(nav()).getByRole('button', { name: 'Proyectos y territorio' })).not.toHaveAttribute('aria-current')
    await userEvent.click(comunidades)
    expect(screen.getByRole('link', { name: 'Compromisos' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav()).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current')
  })

  it('un bloque con una sola sección para la cuenta es un enlace, y uno sin secciones no se dibuja', () => {
    fetch = mockFetch([])
    montar(<NavegacionPrincipal />, { permisos: permisos({ project: ['READ'], task: ['READ'] }) })
    const controles = aLaVista()
    expect(controles).toEqual(['enlace Inicio', 'enlace Proyectos', 'enlace Tareas'])
  })

  // las tareas pendientes, el único conteo barato que ya lee el shell, van como segunda línea de su sección
  it('la sección Tareas dice las suyas vencidas o por vencer debajo de su nombre', async () => {
    fetch = mockFetch([{ path: '/objects/task/records', body: pagina([], { totalElements: 2 }) }])
    montar(<NavegacionPrincipal />, { permisos: permisos({ task: ['READ'], evidence: ['READ'] }) })
    await userEvent.click(within(nav()).getByRole('button', { name: 'Documentos y seguimiento' }))
    const tareas = screen.getByRole('link', { name: 'Tareas' })
    await waitFor(() => expect(tareas).toHaveAccessibleDescription('4 tareas suyas vencidas o por vencer'))
    expect(tareas).toHaveTextContent('4 tareas suyas vencidas o por vencer')
  })
})
