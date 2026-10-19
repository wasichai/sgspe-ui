import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { VacioDeLista, VistasGuardadas } from './Lista'

// la revisión de UX, etapa 3: las vistas dicen cuántos tienen y el vacío por filtros dice cuántos habría sin ellos
describe('VistasGuardadas', () => {
  it('cada vista con su conteo en la descripción; el nombre de la pestaña no cambia', async () => {
    const alCambiar = vi.fn()
    montar(
      <VistasGuardadas
        vistas={[
          { id: 'abiertos', etiqueta: 'Abiertos', conteo: 12 },
          { id: 'vencidos', etiqueta: 'Vencidos', conteo: 3 },
          { id: 'candidatos', etiqueta: 'Candidatos' }
        ]}
        actual="abiertos"
        alCambiar={alCambiar}
      />
    )
    expect(screen.getByRole('tab', { name: 'Abiertos' })).toHaveAccessibleDescription('12 registros')
    expect(screen.getByRole('tab', { name: 'Vencidos' })).toHaveTextContent('Vencidos3')
    expect(screen.getByRole('tab', { name: 'Candidatos' })).not.toHaveAccessibleDescription()
    await userEvent.click(screen.getByRole('tab', { name: 'Vencidos' }))
    expect(alCambiar).toHaveBeenCalledWith('vencidos')
  })
})

describe('VacioDeLista', () => {
  it('con filtros, dice cuántos hay sin ellos y ofrece limpiarlos', async () => {
    const alLimpiar = vi.fn()
    montar(<VacioDeLista conFiltros alLimpiar={alLimpiar} sinFiltros={3} />)
    expect(screen.getByText('Nada coincide con los filtros')).toBeInTheDocument()
    expect(screen.getByText('Sin los filtros hay 3.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(alLimpiar).toHaveBeenCalled()
  })
})
