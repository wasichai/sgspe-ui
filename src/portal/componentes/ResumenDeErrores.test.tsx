import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { ResumenDeErrores } from './ResumenDeErrores'

// design-system.md §5.3, «Resumen de errores»: arriba del formulario al enviar con más de un error; su título dice cuántos y cada
// error es un enlace a su campo. recibe el foco al aparecer; con un solo error basta el del campo
function Formulario({ errores }: { errores: { id?: string; texto: string }[] }) {
  return (
    <>
      <ResumenDeErrores errores={errores} />
      <label htmlFor="motivo">Motivo</label>
      <input id="motivo" />
      <label htmlFor="fecha">Nueva fecha</label>
      <input id="fecha" />
    </>
  )
}

const DOS = [
  { id: 'motivo', texto: 'Motivo: Escriba el motivo' },
  { id: 'fecha', texto: 'Nueva fecha: Debe ser posterior a hoy' }
]

describe('ResumenDeErrores', () => {
  it('con dos errores dice cuántos hay y lista un enlace a cada campo', async () => {
    montar(<Formulario errores={DOS} />)
    const resumen = await screen.findByRole('alert')
    expect(within(resumen).getByRole('heading', { name: 'Hay 2 problemas por corregir' })).toBeInTheDocument()
    const enlaces = within(resumen).getAllByRole('link')
    expect(enlaces.map((a) => a.textContent)).toEqual(['Motivo: Escriba el motivo', 'Nueva fecha: Debe ser posterior a hoy'])
    expect(enlaces[0]).toHaveAttribute('href', '#motivo')
    expect(enlaces[1]).toHaveAttribute('href', '#fecha')
  })

  it('recibe el foco al aparecer', async () => {
    montar(<Formulario errores={DOS} />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
  })

  it('pulsar un enlace lleva el foco a su campo', async () => {
    montar(<Formulario errores={DOS} />)
    await userEvent.click(await screen.findByRole('link', { name: 'Nueva fecha: Debe ser posterior a hoy' }))
    expect(screen.getByLabelText('Nueva fecha')).toHaveFocus()
  })

  it('un error sin campo a la vista va sin enlace', async () => {
    montar(<Formulario errores={[DOS[0], { texto: 'Proyecto: El registro elegido no existe' }]} />)
    const resumen = await screen.findByRole('alert')
    expect(within(resumen).getAllByRole('link')).toHaveLength(1)
    expect(within(resumen).getByText('Proyecto: El registro elegido no existe')).toBeInTheDocument()
  })

  it('con un solo error, o ninguno, no aparece: basta el error en el campo', () => {
    const { unmount } = montar(<Formulario errores={[DOS[0]]} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    unmount()
    montar(<Formulario errores={[]} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('en inglés', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    try {
      montar(<Formulario errores={[...DOS, { id: 'fecha', texto: 'Otro' }]} />)
      expect(await screen.findByRole('heading', { name: 'There are 3 problems to fix' })).toBeInTheDocument()
    } finally {
      localStorage.removeItem('sgspe.lang')
    }
  })
})
