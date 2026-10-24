import { describe, expect, it } from 'vitest'
import { laminaTrasTecla } from './teclas'

// el teclado del presentador (deliverables.md §16.2): adelante y atrás como un control remoto de diapositivas, sin salir de la
// primera ni de la última; otra tecla no cambia de lámina
describe('laminaTrasTecla', () => {
  it.each(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'])('%j pasa a la siguiente', (tecla) => {
    expect(laminaTrasTecla(tecla, 0, 3)).toBe(1)
    expect(laminaTrasTecla(tecla, 2, 3)).toBe(2)
  })

  it.each(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'])('%j vuelve a la anterior', (tecla) => {
    expect(laminaTrasTecla(tecla, 2, 3)).toBe(1)
    expect(laminaTrasTecla(tecla, 0, 3)).toBe(0)
  })

  it('Inicio y Fin van a la primera y a la última', () => {
    expect(laminaTrasTecla('Home', 2, 3)).toBe(0)
    expect(laminaTrasTecla('End', 0, 3)).toBe(2)
  })

  it('otra tecla, o una presentación sin láminas, no cambia nada', () => {
    expect(laminaTrasTecla('a', 1, 3)).toBeNull()
    expect(laminaTrasTecla('ArrowRight', 0, 0)).toBeNull()
  })
})
