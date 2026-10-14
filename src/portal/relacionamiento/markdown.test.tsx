import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { VistaMarkdown } from './markdown'

const dibujar = (texto: string, enLinea?: (linea: string) => ReactNode) => render(<VistaMarkdown texto={texto} enLinea={enLinea} />).container

describe('VistaMarkdown: énfasis en línea', () => {
  it('dibuja **negrita** como strong', () => {
    const c = dibujar('**Código**: C-1')
    expect(c.querySelector('strong')?.textContent).toBe('Código')
    expect(c.querySelector('p')?.textContent).toBe('Código: C-1')
  })

  it('dibuja *cursiva* y _cursiva_ como em', () => {
    const c = dibujar('una *idea* y _otra_ más')
    expect([...c.querySelectorAll('em')].map((e) => e.textContent)).toEqual(['idea', 'otra'])
    expect(c.querySelector('p')?.textContent).toBe('una idea y otra más')
  })

  it('dibuja `código` como code', () => {
    expect(dibujar('usa `ABC` ahora').querySelector('code')?.textContent).toBe('ABC')
  })

  it('dibuja el énfasis dentro de una lista y de un título', () => {
    const c = dibujar('- **1 compromiso** vence\n- otro *dato*\n## Un **título**')
    expect(c.querySelectorAll('li strong')[0].textContent).toBe('1 compromiso')
    expect(c.querySelector('li:nth-child(2) em')?.textContent).toBe('dato')
    expect(c.querySelector('h3 strong')?.textContent).toBe('título')
  })

  it('deja literales los marcadores sin pareja', () => {
    const c = dibujar('**sin cierre y 2 * 3 y snake_case_name y a*b')
    expect(c.querySelector('strong, em')).toBeNull()
    expect(c.querySelector('p')?.textContent).toBe('**sin cierre y 2 * 3 y snake_case_name y a*b')
  })

  it('pasa por enLinea el texto dentro del énfasis, para re-identificar marcadores', () => {
    const c = dibujar('**[PERSONA:p1]** firmó', (l) => l.replace('[PERSONA:p1]', 'Ana Quispe'))
    expect(c.querySelector('strong')?.textContent).toBe('Ana Quispe')
  })

  it('no toma como énfasis lo que hay dentro de un marcador', () => {
    const c = dibujar('[PERSONA:a_b_c] y *x*')
    expect(c.querySelectorAll('em')).toHaveLength(1)
    expect(c.querySelector('p')?.textContent).toBe('[PERSONA:a_b_c] y x')
  })

  it('no dibuja enlaces ni HTML: quedan como texto', () => {
    const c = dibujar('[x](javascript:alert(1)) y <b>hola</b>')
    expect(c.querySelector('a, b')).toBeNull()
    expect(c.querySelector('p')?.textContent).toBe('[x](javascript:alert(1)) y <b>hola</b>')
  })
})
