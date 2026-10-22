import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { SelectorDePagina, SelectorDeVista } from './SelectorDeVista'

// hallazgo U-18 (DD-03): las vistas de un módulo van en una sola fila, con su conteo, dentro de la barra de filtros; las que
// no caben van en «Más vistas»
const SIETE = [
  { id: 'abiertos', etiqueta: 'Abiertos', n: 3 },
  { id: 'vencidos', etiqueta: 'Vencidos', n: 1 },
  { id: 'porVencer', etiqueta: 'Por vencer', n: 1 },
  { id: 'bloqueados', etiqueta: 'Bloqueados', n: 0 },
  { id: 'mios', etiqueta: 'Míos', n: 2 },
  { id: 'cerrados', etiqueta: 'Cerrados', n: 1 },
  { id: 'candidatos', etiqueta: 'Candidatos' }
]

const montarSelector = (props: Partial<Parameters<typeof SelectorDeVista>[0]> = {}) => {
  const alElegir = vi.fn()
  montar(<SelectorDeVista etiqueta="Vistas de compromisos" vistas={SIETE.slice(0, 4)} actual="abiertos" alElegir={alElegir} {...props} />)
  return alElegir
}

describe('SelectorDeVista', () => {
  it('es un radiogroup con su nombre; la actual lleva aria-checked y el conteo va en el nombre accesible', () => {
    montarSelector()
    const grupo = screen.getByRole('radiogroup', { name: 'Vistas de compromisos' })
    const radios = within(grupo).getAllByRole('radio')
    expect(radios).toHaveLength(4)
    expect(within(grupo).getByRole('radio', { name: 'Abiertos, 3' })).toHaveAttribute('aria-checked', 'true')
    expect(within(grupo).getByRole('radio', { name: 'Vencidos, 1' })).toHaveAttribute('aria-checked', 'false')
    // un cero se dice; el conteo también se ve
    expect(within(grupo).getByRole('radio', { name: 'Bloqueados, 0' })).toHaveTextContent('Bloqueados0')
    // sin segunda fila de pestañas
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('CA-1.3.1: elegir «Vencidos» llama a alElegir con su id', async () => {
    const alElegir = montarSelector()
    await userEvent.click(screen.getByRole('radio', { name: 'Vencidos, 1' }))
    expect(alElegir).toHaveBeenCalledWith('vencidos')
  })

  it('un conteo nulo o ausente no se dibuja', () => {
    montarSelector({
      vistas: [
        { id: 'a', etiqueta: 'Abiertos', n: null },
        { id: 'b', etiqueta: 'Candidatos' }
      ],
      actual: 'a'
    })
    expect(screen.getByRole('radio', { name: 'Abiertos' })).toHaveTextContent(/^Abiertos$/)
    expect(screen.getByRole('radio', { name: 'Candidatos' })).toHaveTextContent(/^Candidatos$/)
  })

  it('CA-1.3.2: con 7 vistas y visibles=4, tres van en «Más vistas» con sus conteos', async () => {
    const alElegir = montarSelector({ vistas: SIETE, visibles: 4 })
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Míos, 2' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Más vistas' }))
    const menu = screen.getByRole('group', { name: 'Más vistas' })
    const enMenu = within(menu).getAllByRole('button')
    expect(enMenu.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Míos, 2', 'Cerrados, 1', 'Candidatos'])
    await userEvent.click(within(menu).getByRole('button', { name: 'Cerrados, 1' }))
    expect(alElegir).toHaveBeenCalledWith('cerrados')
  })

  it('por defecto se ven cuatro; la actual nunca queda escondida en el menú', () => {
    montarSelector({ vistas: SIETE, actual: 'cerrados' })
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(4)
    // entra en lugar de la última visible, que pasa al menú
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(['Abiertos, 3', 'Vencidos, 1', 'Por vencer, 1', 'Cerrados, 1'])
    expect(screen.getByRole('radio', { name: 'Cerrados, 1' })).toHaveAttribute('aria-checked', 'true')
  })

  it('sin vistas de sobra no hay «Más vistas»', () => {
    montarSelector()
    expect(screen.queryByRole('button', { name: 'Más vistas' })).not.toBeInTheDocument()
  })

  it('teclado: un solo radio en el orden de tabulación; las flechas mueven y eligen, Home y End van a los extremos', async () => {
    const alElegir = montarSelector({ actual: 'vencidos' })
    const radio = (nombre: string) => screen.getByRole('radio', { name: nombre })
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1])
    await userEvent.tab()
    expect(radio('Vencidos, 1')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(radio('Por vencer, 1')).toHaveFocus()
    expect(alElegir).toHaveBeenLastCalledWith('porVencer')
    await userEvent.keyboard('{End}')
    expect(radio('Bloqueados, 0')).toHaveFocus()
    expect(alElegir).toHaveBeenLastCalledWith('bloqueados')
    // al final, la flecha derecha vuelve al principio
    await userEvent.keyboard('{ArrowRight}')
    expect(radio('Abiertos, 3')).toHaveFocus()
    expect(alElegir).toHaveBeenLastCalledWith('abiertos')
    await userEvent.keyboard('{ArrowLeft}')
    expect(radio('Bloqueados, 0')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(radio('Abiertos, 3')).toHaveFocus()
    expect(alElegir).toHaveBeenLastCalledWith('abiertos')
  })

  it('en inglés, el menú se llama «More views»', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    try {
      montarSelector({ vistas: SIETE })
      expect(screen.getByRole('button', { name: 'More views' })).toBeInTheDocument()
    } finally {
      localStorage.removeItem('sgspe.lang')
    }
  })
})

// la variante que navega entre rutas (DD-03, U-20): las páginas de un módulo con rutas distintas (las de Riesgos, Compromisos y
// Acuerdos) van en el mismo selector, como enlaces con aria-current; las que no caben, en «Más páginas»
describe('SelectorDePagina', () => {
  const PAGINAS = [
    { id: 'registro', etiqueta: 'Registro y matriz', a: '/projects/p1/risks' },
    { id: 'warnings', etiqueta: 'Alerta temprana', a: '/projects/p1/risks/warnings' },
    { id: 'incidents', etiqueta: 'Incidentes', a: '/projects/p1/incidents' },
    { id: 'signals', etiqueta: 'Señales de alerta', a: '/projects/p1/risks/signals' },
    { id: 'mentions', etiqueta: 'Menciones en medios', a: '/projects/p1/risks/mentions' }
  ]

  it('es una navegación de enlaces con la actual marcada, sin radios ni pestañas', () => {
    montar(<SelectorDePagina etiqueta="Páginas de Riesgos" paginas={PAGINAS} actual="warnings" />)
    const nav = screen.getByRole('navigation', { name: 'Páginas de Riesgos' })
    expect(within(nav).getByRole('link', { name: 'Alerta temprana' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Registro y matriz' })).toHaveAttribute('href', '/projects/p1/risks')
    expect(within(nav).getByRole('link', { name: 'Registro y matriz' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('las que no caben van en «Más páginas»; la actual nunca queda escondida', async () => {
    montar(<SelectorDePagina etiqueta="Páginas de Riesgos" paginas={PAGINAS} actual="mentions" visibles={3} />)
    const nav = screen.getByRole('navigation', { name: 'Páginas de Riesgos' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent)
    ).toEqual(['Registro y matriz', 'Alerta temprana', 'Menciones en medios'])
    expect(within(nav).getByRole('link', { name: 'Menciones en medios' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(within(nav).getByRole('button', { name: 'Más páginas' }))
    const menu = within(nav).getByRole('group', { name: 'Más páginas' })
    expect(
      within(menu)
        .getAllByRole('link')
        .map((l) => l.textContent)
    ).toEqual(['Incidentes', 'Señales de alerta'])
    expect(within(menu).getByRole('link', { name: 'Incidentes' })).toHaveAttribute('href', '/projects/p1/incidents')
  })

  it('con una sola página no se dibuja', () => {
    montar(<SelectorDePagina etiqueta="Páginas de Riesgos" paginas={PAGINAS.slice(0, 1)} actual="registro" />)
    expect(screen.queryByRole('navigation', { name: 'Páginas de Riesgos' })).not.toBeInTheDocument()
  })
})
