import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { PanelDeTrazabilidad } from './PanelDeTrazabilidad'

// design-system.md §6.1 y ux-architecture.md §8.1: toda ficha dice de dónde viene, qué generó y qué lo sustenta, siempre en
// ese orden y con los mismos nombres; un grupo sin nada lo dice
describe('PanelDeTrazabilidad', () => {
  it('dibuja los tres grupos fijos en orden, con sus secciones', () => {
    montar(
      <PanelDeTrazabilidad
        loSustenta={[{ clave: 'evidencias', titulo: 'Evidencias', contenido: <a href="/e1">Acta firmada</a> }]}
        deDondeViene={[
          { clave: 'interaccion', titulo: 'Interacción', contenido: <a href="/i1">Asamblea de agosto</a> },
          { clave: 'queja', titulo: 'Queja', contenido: null }
        ]}
        queGenero={[{ clave: 'tareas', titulo: 'Tareas', contenido: '2 tareas abiertas' }]}
      />
    )
    const panel = screen.getByRole('complementary', { name: 'Trazabilidad' })
    const grupos = within(panel).getAllByRole('region')
    expect(grupos.map((g) => g.getAttribute('aria-label') ?? within(g).getByRole('heading').textContent)).toEqual([
      'De dónde viene',
      'Qué generó',
      'Lo sustenta'
    ])
    const origen = within(panel).getByRole('region', { name: 'De dónde viene' })
    expect(within(origen).getByText('Interacción')).toBeInTheDocument()
    expect(within(origen).getByRole('link', { name: 'Asamblea de agosto' })).toBeInTheDocument()
    // una sección sin contenido no se dibuja
    expect(within(origen).queryByText('Queja')).not.toBeInTheDocument()
    expect(within(panel).getByRole('region', { name: 'Qué generó' })).toHaveTextContent('2 tareas abiertas')
    expect(within(panel).getByRole('region', { name: 'Lo sustenta' })).toHaveTextContent('Acta firmada')
  })

  // design-system.md §5.3 «Trazabilidad»: tres columnas iguales en una caja de 1 px con separadores de 1 px, relleno de
  // 10 × 14 px y el título en 700; en una ficha estrecha, cada grupo es una fila con el título en 150 px y el resto
  it('es una caja de 1 px con tres celdas separadas, que en lo ancho son tres columnas y en lo estrecho filas de 150 px (apiladas en una columna lateral)', () => {
    montar(<PanelDeTrazabilidad queGenero={[{ clave: 'tareas', titulo: 'Tareas', contenido: '2 tareas abiertas' }]} />)
    const panel = screen.getByRole('complementary', { name: 'Trazabilidad' })
    const caja = panel.querySelector('[data-rejilla-de-trazabilidad]') as HTMLElement
    expect(caja).toHaveClass('grid', '@2xl:grid-cols-3', 'border', 'border-sg-border', 'rounded-sg-md', 'bg-sg-surface')
    for (const grupo of within(panel).getAllByRole('region')) {
      // fase 13a: en una columna lateral de menos de 448 px (la de una ficha), el título va encima de su contenido
      expect(grupo).toHaveClass('border-r', 'border-b', 'border-sg-border', 'px-3.5', 'py-2.5', 'grid-cols-1', '@md:grid-cols-[150px_minmax(0,1fr)]')
      // los vínculos de sus listas no van subrayados (U-05): solo al pasar o con el foco
      expect(grupo).toHaveClass('[&_a]:no-underline', '[&_a:hover]:underline', '[&_a:focus-visible]:underline')
      expect(within(grupo).getByRole('heading', { level: 2 })).toHaveClass('font-bold', 'text-sm')
    }
  })

  it('un grupo sin secciones con contenido dice «Sin registros», o lo que la ficha diga', () => {
    montar(
      <PanelDeTrazabilidad
        deDondeViene={[{ clave: 'x', titulo: 'Interacción', contenido: null }]}
        queGenero={[]}
        vacios={{ loSustenta: 'Sin evidencias todavía.' }}
      />
    )
    expect(within(screen.getByRole('region', { name: 'De dónde viene' })).getByText('Sin registros')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Qué generó' })).getByText('Sin registros')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Lo sustenta' })).getByText('Sin evidencias todavía.')).toBeInTheDocument()
  })

  it('lo que la ficha agrega al pie (un aviso de lectura fallida) va dentro del panel', () => {
    montar(<PanelDeTrazabilidad pie={<p>No se pudo leer el acuerdo.</p>} />)
    expect(within(screen.getByRole('complementary', { name: 'Trazabilidad' })).getByText('No se pudo leer el acuerdo.')).toBeInTheDocument()
  })
})
