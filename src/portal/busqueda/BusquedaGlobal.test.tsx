import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pagina, registro } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'

// la búsqueda global (ux-architecture.md §7.3): ⌘K o Ctrl K desde cualquier pantalla, solo entre lo que la cuenta lee, con
// los resultados por categoría y el teclado para moverse y abrir
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
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
})
