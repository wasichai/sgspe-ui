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

  it('no parte un marcador de la IA: el énfasis lo rodea o queda literal', () => {
    const c = dibujar('**x [PERSONA_1]** y _x [PERSONA_1]_ y [PERSONA:p-1] y [DATO_SENSIBLE]')
    expect(c.querySelector('strong')?.textContent).toBe('x [PERSONA_1]')
    expect(c.querySelector('em')?.textContent).toBe('x [PERSONA_1]')
    expect(c.querySelector('p')?.textContent).toBe('x [PERSONA_1] y x [PERSONA_1] y [PERSONA:p-1] y [DATO_SENSIBLE]')
  })

  it('un marcador sin su corchete de cierre no es marcador ni cierra el énfasis', () => {
    const c = dibujar('**x [PERSONA_1**')
    expect(c.querySelector('p')?.textContent).toBe('x [PERSONA_1')
    expect(c.querySelector('strong')?.textContent).toBe('x [PERSONA_1')
  })

  it('una cursiva con espacio junto a la marca queda literal', () => {
    const c = dibujar('_ [CITA_1]_')
    expect(c.querySelector('em')).toBeNull()
    expect(c.querySelector('p')?.textContent).toBe('_ [CITA_1]_')
  })

  it('anida la cursiva dentro de la negrita', () => {
    const c = dibujar('**a *b* c**')
    expect(c.querySelector('strong em')?.textContent).toBe('b')
    expect(c.querySelector('strong')?.textContent).toBe('a b c')
  })

  it('***x*** no es negrita con cursiva: la negrita toma "*x" y el resto queda literal', () => {
    const c = dibujar('***x***')
    expect(c.querySelector('p')?.textContent).toBe('*x*')
    expect(c.querySelector('strong')?.textContent).toBe('*x')
  })

  it('un ítem "* **x**" es una lista con negrita', () => {
    const c = dibujar('* **x**')
    expect(c.querySelector('li strong')?.textContent).toBe('x')
  })

  it('no dibuja enlaces ni HTML: quedan como texto', () => {
    const c = dibujar('[x](javascript:alert(1)) y <b>hola</b>')
    expect(c.querySelector('a, b')).toBeNull()
    expect(c.querySelector('p')?.textContent).toBe('[x](javascript:alert(1)) y <b>hola</b>')
  })

  // el editor con formato (entregables/EditorMarkdown.tsx) guarda los escapes de CommonMark: se leen como texto, nunca como HTML
  it('decodifica los escapes de barra y las entidades como texto', () => {
    const c = dibujar('a &amp; b &lt; c \\*\\*x\\*\\*')
    expect(c.querySelector('strong, em')).toBeNull()
    expect(c.querySelector('p')?.textContent).toBe('a & b < c **x**')
  })

  it('decodifica &gt;, &quot;, &#39;, las numéricas y los escapes de cualquier puntuación ASCII', () => {
    const c = dibujar('&gt; &quot;x&quot; &#39;y&#39; &#241; &#xF1; &#X41; \\[\\] \\_z\\_ \\# \\\\ \\a &copy; &#0; &#xD800;')
    expect(c.querySelector('strong, em')).toBeNull()
    expect(c.querySelector('p')?.textContent).toBe(`> "x" 'y' ñ ñ A [] _z_ # \\ \\a &copy; \uFFFD \uFFFD`)
  })

  it('una entidad no es HTML ni abre énfasis', () => {
    const c = dibujar('&lt;b&gt;hola&lt;/b&gt; y &#42;&#42;x&#42;&#42;')
    expect(c.querySelector('b, strong')).toBeNull()
    expect(c.querySelector('p')?.textContent).toBe('<b>hola</b> y **x**')
  })

  it('un escape dentro de la negrita no la cierra', () => {
    const c = dibujar('**a \\*\\* b**')
    expect(c.querySelector('strong')?.textContent).toBe('a ** b')
  })
})
