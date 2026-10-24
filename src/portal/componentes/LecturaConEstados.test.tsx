import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@wasichai/core'
import { describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { DeLista, FalloDeLectura } from './LecturaConEstados'

const codigo = (message: string) => new ApiError(403, 'Sin acceso', [{ field: 'record', message }])

// rediseño de UX (2026-10-20): una lista cuyo objeto el servidor no tiene (un despliegue sin el módulo) respondía 404 y se decía
// en rojo «El registro no existe o no es de sus proyectos», con un «Reintentar» que no servía
describe('DeLista', () => {
  it('un 404 de la lista dice que la información no está disponible en su organización, sin reintento ni alarma', () => {
    const consulta = { isPending: false, isError: true, data: undefined, error: new ApiError(404, 'Not Found', []), refetch: vi.fn() }
    montar(<DeLista consulta={consulta as never}>{() => <p>datos</p>}</DeLista>)
    expect(screen.getByText('Esta información no está disponible en su organización.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByText(/no es de sus proyectos/)).not.toBeInTheDocument()
  })
})

describe('FalloDeLectura', () => {
  it('un 403 con código dice su motivo, nunca el código', () => {
    montar(<FalloDeLectura error={codigo('NOT_ASSIGNED')} alReintentar={vi.fn()} />)
    expect(screen.getByText('No disponible')).toHaveAttribute(
      'title',
      'No tiene una asignación vigente a este proyecto: pídala a la administración del proyecto.'
    )
    expect(screen.queryByText('NOT_ASSIGNED')).not.toBeInTheDocument()
  })

  it('el motivo de un objeto o un campo ilegible en una lista no habla de «cifra»', () => {
    montar(
      <>
        <FalloDeLectura error={codigo('OBJECT_NOT_READABLE')} alReintentar={vi.fn()} />
        <FalloDeLectura error={codigo('FIELD_NOT_READABLE')} alReintentar={vi.fn()} />
      </>
    )
    const [objeto, campo] = screen.getAllByText('No disponible')
    expect(objeto).toHaveAttribute('title', 'Su rol no puede leer estos registros')
    expect(campo).toHaveAttribute('title', 'Su rol no puede leer un dato de esta información')
    expect(document.body.textContent).not.toMatch(/cifra/)
  })

  it('un 403 sin código o con un código desconocido dice el texto neutro', () => {
    montar(
      <>
        <FalloDeLectura error={new ApiError(403, 'Sin acceso', [])} alReintentar={vi.fn()} />
        <FalloDeLectura error={codigo('CODIGO_NUEVO')} alReintentar={vi.fn()} />
      </>
    )
    for (const celda of screen.getAllByText('No disponible')) expect(celda).toHaveAttribute('title', 'Su cuenta no puede leer estos datos')
  })

  it('cualquier otro error es una alerta con reintento', async () => {
    const reintentar = vi.fn()
    montar(<FalloDeLectura error={new ApiError(404, 'No existe', [])} alReintentar={reintentar} />)
    expect(screen.queryByText('No disponible')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reintentar).toHaveBeenCalledOnce()
  })
})
