import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearI18n } from '../i18n'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { PestanasDesplazables } from './PestanasDesplazables'

// las pestañas de un proyecto no caben en una pantalla mediana: se desplazan, dicen que hay más y traen la activa a la vista
function medir(nav: HTMLElement, { ancho, visible, izquierda }: { ancho: number; visible: number; izquierda: number }) {
  Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: ancho })
  Object.defineProperty(nav, 'clientWidth', { configurable: true, value: visible })
  Object.defineProperty(nav, 'scrollLeft', { configurable: true, writable: true, value: izquierda })
  act(() => nav.dispatchEvent(new Event('scroll')))
}

const montar = () =>
  render(
    <I18nextProvider i18n={crearI18n()}>
      <MemoryRouter>
        <PestanasDesplazables etiqueta="Secciones del proyecto">
          <a href="#a">Resumen</a>
          <a href="#b" aria-current="page">
            Documentos
          </a>
        </PestanasDesplazables>
      </MemoryRouter>
    </I18nextProvider>
  )

describe('PestanasDesplazables', () => {
  afterEach(() => vi.restoreAllMocks())

  it('si todo cabe, no ofrece desplazar', () => {
    montar()
    medir(screen.getByRole('navigation', { name: 'Secciones del proyecto' }), { ancho: 300, visible: 300, izquierda: 0 })
    expect(screen.queryByRole('button', { name: 'Ver más secciones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver las secciones anteriores' })).not.toBeInTheDocument()
  })

  it('si no cabe, ofrece desplazar hacia donde hay más y desplaza al pulsar', async () => {
    montar()
    const nav = screen.getByRole('navigation', { name: 'Secciones del proyecto' })
    const desplazar = vi.fn()
    nav.scrollBy = desplazar
    medir(nav, { ancho: 1000, visible: 300, izquierda: 0 })
    expect(screen.queryByRole('button', { name: 'Ver las secciones anteriores' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver más secciones' }))
    expect(desplazar).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) }))
    medir(nav, { ancho: 1000, visible: 300, izquierda: 700 })
    expect(screen.getByRole('button', { name: 'Ver las secciones anteriores' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más secciones' })).not.toBeInTheDocument()
  })
})
