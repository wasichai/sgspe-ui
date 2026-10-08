import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { Grafico } from './Grafico'

// el chunk de ECharts no baja (una pestaña vieja tras un despliegue, la red caída): la importación diferida rechaza
vi.mock('./GraficoImpl', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('Grafico sin el chunk de ECharts', () => {
  it('dice que no pudo dibujar, no tira la pantalla y deja abierta la tabla "Ver datos"', async () => {
    montar(
      <main>
        <h1>Tablero</h1>
        <Grafico etiqueta="Reuniones al mes" opciones={{}} datos={{ columnas: ['Mes', 'Reuniones'], filas: [['2026-09', '1']] }} />
      </main>
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo dibujar el gráfico')
    expect(screen.getByRole('heading', { name: 'Tablero' })).toBeInTheDocument()
    expect(screen.getByText('Ver datos').closest('details')).toHaveAttribute('open')
    expect(screen.getByRole('table', { name: 'Reuniones al mes' })).toHaveTextContent('2026-09')
  })
})
