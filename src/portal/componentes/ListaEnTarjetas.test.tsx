import { renderHook, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ListaEnTarjetas, useEsTelefono } from './ListaEnTarjetas'

// la revisión de UX, etapa 8: en el teléfono, una lista de trabajo es de tarjetas con el título, el estado, el plazo y el proyecto
const original = window.matchMedia
afterEach(() => {
  window.matchMedia = original
})
const conAncho = (telefono: boolean) => {
  window.matchMedia = ((consulta: string) => ({
    matches: telefono,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  })) as unknown as typeof window.matchMedia
}

describe('ListaEnTarjetas', () => {
  it('useEsTelefono sigue la consulta por debajo de sm, y sin matchMedia es falso', () => {
    conAncho(true)
    expect(renderHook(() => useEsTelefono()).result.current).toBe(true)
    conAncho(false)
    expect(renderHook(() => useEsTelefono()).result.current).toBe(false)
    window.matchMedia = undefined as unknown as typeof window.matchMedia
    expect(renderHook(() => useEsTelefono()).result.current).toBe(false)
  })

  it('cada tarjeta dice su título, su estado, su plazo y su proyecto', () => {
    render(
      <ListaEnTarjetas
        etiqueta="Compromisos"
        tarjetas={[
          { id: 'c1', titulo: <a href="/c1">Reservorio</a>, estado: <span>En ejecución</span>, plazo: <span>Vencido</span>, proyecto: 'PRJ-01 · Pukaqaqa' }
        ]}
      />
    )
    const tarjeta = within(screen.getByRole('list', { name: 'Compromisos' })).getByRole('listitem')
    for (const texto of ['Reservorio', 'En ejecución', 'Vencido', 'PRJ-01 · Pukaqaqa']) expect(within(tarjeta).getByText(texto)).toBeInTheDocument()
  })
})
