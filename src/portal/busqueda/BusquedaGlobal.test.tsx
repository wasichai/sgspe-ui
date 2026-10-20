import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pagina, registro, workflow } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'

// la búsqueda global (ux-architecture.md §7.3): ⌘K o Ctrl K desde cualquier pantalla, solo entre lo que la cuenta lee, con
// los resultados por categoría y el teclado para moverse y abrir
let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const CANAL = registro('c1', { code: 'C-001', title: 'Mejora del canal', project: 'p1' }, { state: 'in_progress' })

describe('búsqueda global', () => {
  it('Ctrl K la abre; busca en lo que la cuenta lee y Enter abre la ficha', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ commitment: ['READ'], project: ['READ'] }), [
      { path: /^\/objects\/commitment\/records\?.*q=canal/, body: pagina([CANAL]) },
      { path: /^\/objects\/project\/records\?.*q=canal/, body: pagina([]) }
    ])
    await screen.findByRole('banner')
    await userEvent.keyboard('{Control>}k{/Control}')
    const dialogo = await screen.findByRole('dialog', { name: 'Buscar' })
    await userEvent.type(within(dialogo).getByRole('combobox', { name: 'Buscar' }), 'canal')
    const resultados = await within(dialogo).findByRole('listbox')
    expect(await within(resultados).findByRole('option', { name: /C-001 · Mejora del canal/ })).toBeInTheDocument()
    expect(within(dialogo).getByText('Compromisos (1)')).toBeInTheDocument()
    // no busca en lo que la cuenta no lee
    expect(fetch.calls.some((c) => c.path.startsWith('/objects/grievance/records'))).toBe(false)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/commitments/c1'))
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument()
  })

  it('con menos de dos letras pide más; sin coincidencias, lo dice', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ commitment: ['READ'] }), [{ path: /^\/objects\/commitment\/records\?.*q=zz/, body: pagina([]) }])
    await userEvent.click(await screen.findByRole('button', { name: /Buscar/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Buscar' })
    const campo = within(dialogo).getByRole('combobox', { name: 'Buscar' })
    await userEvent.type(campo, 'z')
    expect(within(dialogo).getByText('Escriba al menos dos letras.')).toBeInTheDocument()
    await userEvent.type(campo, 'z')
    expect(await within(dialogo).findByText('Nada coincide con «zz».')).toBeInTheDocument()
  })

  // rediseño de UX (2026-10-20): el contexto mínimo para reconocer un resultado antes de abrirlo, la ayuda sin resultados, la
  // consulta que se conserva al volver y, dentro de un proyecto, el proyecto primero con «en todos» a un clic
  it('cada resultado dice su proyecto y su estado', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ commitment: ['READ'], project: ['READ'] }), [
      { path: /^\/objects\/commitment\/records\?.*q=canal/, body: pagina([CANAL]) },
      { path: /^\/objects\/project\/records\?.*q=canal/, body: pagina([]) },
      { path: /^\/objects\/project\/records(\?|$)/, body: pagina([registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' })]) },
      { path: '/objects/commitment/workflow', body: workflow('commitment', [['in_progress', 'En ejecución']]) }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Buscar' })
    await userEvent.type(within(dialogo).getByRole('combobox', { name: 'Buscar' }), 'canal')
    const opcion = await within(dialogo).findByRole('option', { name: /C-001 · Mejora del canal/ })
    expect(await within(opcion).findByText('PRJ-01 · Pukaqaqa')).toBeInTheDocument()
    expect(await within(opcion).findByText('En ejecución')).toBeInTheDocument()
  })

  it('sin resultados dice cómo ampliar la búsqueda y que solo aparece lo que la cuenta lee', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ commitment: ['READ'] }), [{ path: /^\/objects\/commitment\/records\?.*q=zz/, body: pagina([]) }])
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Buscar' })
    await userEvent.type(within(dialogo).getByRole('combobox', { name: 'Buscar' }), 'zz')
    expect(await within(dialogo).findByText(/Pruebe con el código, con una palabra más corta/)).toBeInTheDocument()
  })

  it('al volver a abrirla conserva la consulta anterior, seleccionada para escribir otra', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ commitment: ['READ'] }), [{ path: /^\/objects\/commitment\/records\?.*q=canal/, body: pagina([CANAL]) }])
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar' }))
    let dialogo = await screen.findByRole('dialog', { name: 'Buscar' })
    await userEvent.type(within(dialogo).getByRole('combobox', { name: 'Buscar' }), 'canal')
    await within(dialogo).findByRole('option', { name: /C-001/ })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    dialogo = await screen.findByRole('dialog', { name: 'Buscar' })
    const campo = within(dialogo).getByRole('combobox', { name: 'Buscar' }) as HTMLInputElement
    expect(campo).toHaveValue('canal')
    expect(await within(dialogo).findByRole('option', { name: /C-001/ })).toBeInTheDocument()
    await waitFor(() => expect([campo.selectionStart, campo.selectionEnd]).toEqual([0, 5]))
  })

  it('dentro de un proyecto busca primero en él y ofrece buscar en todos', async () => {
    fetch = abrirPortal('/projects/p1/commitments', RELACIONISTA, permisos({ commitment: ['READ'], project: ['READ'] }), [
      { path: /^\/objects\/commitment\/records\?.*q=canal/, body: pagina([CANAL]) },
      { path: /^\/objects\/project\/records\?.*q=canal/, body: pagina([]) }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Buscar' })
    await userEvent.type(within(dialogo).getByRole('combobox', { name: 'Buscar' }), 'canal')
    await within(dialogo).findByRole('option', { name: /C-001/ })
    const pedidas = () => fetch!.calls.filter((c) => c.path.startsWith('/objects/commitment/records?') && c.path.includes('q=canal'))
    expect(pedidas().every((c) => c.path.includes('project=p1'))).toBe(true)
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'En todos sus proyectos' }))
    await waitFor(() => expect(pedidas().some((c) => !c.path.includes('project='))).toBe(true))
  })

  // en el teléfono el texto del botón no se ve: su nombre no puede depender de él
  it('el botón tiene nombre aunque su texto no se vea', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ commitment: ['READ'] }), [])
    expect(await screen.findByRole('button', { name: 'Buscar' })).toHaveAttribute('aria-label', 'Buscar')
  })
})
