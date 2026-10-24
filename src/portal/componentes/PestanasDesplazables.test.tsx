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

  // U-19: la pestaña activa nunca queda oculta; si la fila no cabe, se trae a la vista sin mover la página en vertical
  it('trae la pestaña activa a la vista', () => {
    const traer = vi.fn()
    Element.prototype.scrollIntoView = traer
    try {
      montar()
      expect(traer).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
      expect(traer.mock.contexts[0]).toBe(screen.getByRole('link', { name: 'Documentos' }))
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView
    }
  })
})

// U-19: las pestañas del proyecto llegan después de los permisos, y sus conteos después aún (y las ensanchan): la activa se
// trae a la vista cuando aparece y con cada cambio de la fila, hasta que la persona la desplace por su cuenta
describe('PestanasDesplazables, con pestañas que llegan después', () => {
  afterEach(() => vi.restoreAllMocks())

  function Fila({ conActiva, conteo = '' }: { conActiva: boolean; conteo?: string }) {
    return (
      <I18nextProvider i18n={crearI18n()}>
        <MemoryRouter>
          <PestanasDesplazables etiqueta="Secciones del proyecto">
            <a href="#a">Resumen {conteo}</a>
            {conActiva ? (
              <a href="#b" aria-current="page">
                Documentos
              </a>
            ) : null}
          </PestanasDesplazables>
        </MemoryRouter>
      </I18nextProvider>
    )
  }

  it('trae a la vista la pestaña activa que aparece después, y otra vez si la fila cambia, hasta que la persona la desplaza', async () => {
    const llevar = vi.fn()
    Element.prototype.scrollIntoView = llevar
    const { rerender } = render(<Fila conActiva={false} />)
    expect(llevar).not.toHaveBeenCalled()
    rerender(<Fila conActiva />)
    await vi.waitFor(() => expect(llevar).toHaveBeenCalledTimes(1))
    expect(llevar.mock.contexts[0]).toBe(screen.getByRole('link', { name: 'Documentos' }))
    // llega un conteo: la activa puede haberse corrido, se vuelve a traer
    rerender(<Fila conActiva conteo="12" />)
    await vi.waitFor(() => expect(llevar).toHaveBeenCalledTimes(2))
    // la persona desplaza la fila: lo que llegue después ya no la mueve
    act(() => screen.getByRole('navigation', { name: 'Secciones del proyecto' }).dispatchEvent(new WheelEvent('wheel', { bubbles: true })))
    rerender(<Fila conActiva conteo="13" />)
    await new Promise((r) => setTimeout(r, 20))
    expect(llevar).toHaveBeenCalledTimes(2)
  })
})
