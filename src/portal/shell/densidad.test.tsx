import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { useTranslation } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { ADMIN_PERMISOS, ADMINISTRACION } from '../../test/portal'
import { guardarDensidad, leerDensidad, SelectorDeDensidad } from './densidad'

// la densidad compacta de cada persona (ADR-0032, design-system.md §3.5): normal o compacta, guardada en el navegador
// (sgspe.densidad) y escrita como data-density="compact" en <html>, que reemplaza las medidas de tokens.css

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.density
})
afterEach(() => {
  vi.restoreAllMocks()
  fetch?.restore()
  fetch = null
  guardarDensidad('normal')
  localStorage.clear()
})

describe('densidad', () => {
  it('es normal por defecto y con un valor que no entiende', () => {
    expect(leerDensidad()).toBe('normal')
    localStorage.setItem('sgspe.densidad', 'compact')
    expect(leerDensidad()).toBe('normal')
    localStorage.setItem('sgspe.densidad', 'compacta')
    expect(leerDensidad()).toBe('compacta')
  })

  it('guarda la elección y pone o quita el atributo de <html>', () => {
    guardarDensidad('compacta')
    expect(localStorage.getItem('sgspe.densidad')).toBe('compacta')
    expect(document.documentElement.dataset.density).toBe('compact')
    guardarDensidad('normal')
    expect(localStorage.getItem('sgspe.densidad')).toBe('normal')
    expect(document.documentElement).not.toHaveAttribute('data-density')
  })

  it('sin almacenamiento (ventana privada, datos bloqueados) la elección dura la visita y no rompe nada', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(leerDensidad()).toBe('normal')
    guardarDensidad('compacta')
    expect(leerDensidad()).toBe('compacta')
    expect(document.documentElement.dataset.density).toBe('compact')
  })

  it('el selector es un grupo de radio con su nombre, marca la guardada y aplica la que se elige', async () => {
    localStorage.setItem('sgspe.densidad', 'compacta')
    montar(<SelectorDeDensidad />)
    const grupo = await screen.findByRole('radiogroup', { name: 'Densidad' })
    expect(within(grupo).getByRole('radio', { name: 'Compacta' })).toBeChecked()
    // al montar, React deja <html> como dice lo guardado
    expect(document.documentElement.dataset.density).toBe('compact')
    await userEvent.click(within(grupo).getByRole('radio', { name: 'Normal' }))
    expect(within(grupo).getByRole('radio', { name: 'Normal' })).toBeChecked()
    expect(document.documentElement).not.toHaveAttribute('data-density')
    expect(localStorage.getItem('sgspe.densidad')).toBe('normal')
  })

  it('se entera de lo que cambia otra pestaña del mismo navegador', async () => {
    montar(<SelectorDeDensidad />)
    const grupo = await screen.findByRole('radiogroup', { name: 'Densidad' })
    expect(within(grupo).getByRole('radio', { name: 'Normal' })).toBeChecked()
    act(() => {
      localStorage.setItem('sgspe.densidad', 'compacta')
      window.dispatchEvent(new StorageEvent('storage', { key: 'sgspe.densidad' }))
    })
    expect(within(grupo).getByRole('radio', { name: 'Compacta' })).toBeChecked()
    expect(document.documentElement.dataset.density).toBe('compact')
  })

  it('en inglés: «Density: Comfortable · Compact»', async () => {
    function EnIngles() {
      const { i18n } = useTranslation()
      if (i18n.language !== 'en') void i18n.changeLanguage('en')
      return <SelectorDeDensidad />
    }
    montar(<EnIngles />)
    const grupo = await screen.findByRole('radiogroup', { name: 'Density' })
    expect(
      within(grupo)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent)
    ).toEqual(['Comfortable', 'Compact'])
  })

  it('está en el menú de la cuenta junto al idioma y el tema, y en el panel «Más» del teléfono', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    await userEvent.click(await within(await screen.findByRole('banner')).findByRole('button', { name: 'Su cuenta' }))
    const cuenta = screen.getByRole('group', { name: 'Su cuenta' })
    await userEvent.click(within(within(cuenta).getByRole('radiogroup', { name: 'Densidad' })).getByRole('radio', { name: 'Compacta' }))
    expect(document.documentElement.dataset.density).toBe('compact')
    await userEvent.keyboard('{Escape}')

    await userEvent.click(screen.getByRole('button', { name: 'Menú' }))
    const panel = await screen.findByRole('dialog', { name: 'Menú' })
    const grupo = within(panel).getByRole('radiogroup', { name: 'Densidad' })
    expect(within(grupo).getByRole('radio', { name: 'Compacta' })).toBeChecked()
    await userEvent.click(within(grupo).getByRole('radio', { name: 'Normal' }))
    await waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-density'))
  })
})
