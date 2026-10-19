import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useTituloDeDocumento } from '../componentes/Pagina'
import { Rastro } from './Rastro'

// la revisión de UX, etapa 6: todo enlace a un registro suma al rastro la vista que deja, nombrada con el título de la página;
// cada paso vuelve a esa vista y volver a la misma no repite el paso
function Vista({ titulo, a }: { titulo: string; a?: string }) {
  useTituloDeDocumento(titulo)
  return (
    <>
      <Rastro />
      <h1>{titulo}</h1>
      {a ? <EnlaceDeRegistro codigo="C-1" titulo={`Ir a ${a}`} ruta={a} /> : null}
      <EnlaceDeRegistro titulo="Aquí mismo" ruta={useLocation().pathname} />
    </>
  )
}
function Paginas() {
  const { pathname } = useLocation()
  if (pathname === '/a') return <Vista titulo="Asamblea de agosto" a="/b" />
  if (pathname === '/b') return <Vista titulo="Canal de riego" a="/c" />
  return <Vista titulo="Acta firmada" />
}

describe('el rastro', () => {
  it('suma la vista que se deja con el título de la página, vuelve a ella y no repite la misma', async () => {
    montar(<Paginas />, { ruta: '/a' })
    expect(screen.queryByRole('navigation', { name: 'Recorrido' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Ir a /b' }))
    await userEvent.click(await screen.findByRole('link', { name: 'Ir a /c' }))
    const rastro = await screen.findByRole('navigation', { name: 'Recorrido' })
    expect(
      within(rastro)
        .getAllByRole('link')
        .map((l) => [l.textContent, l.getAttribute('href')])
    ).toEqual([
      ['Asamblea de agosto', '/a'],
      ['Canal de riego', '/b']
    ])
    await userEvent.click(screen.getByRole('link', { name: 'Aquí mismo' }))
    expect(within(screen.getByRole('navigation', { name: 'Recorrido' })).getAllByRole('link')).toHaveLength(2)
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Recorrido' })).getByRole('link', { name: 'Asamblea de agosto' }))
    expect(await screen.findByRole('heading', { name: 'Asamblea de agosto' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Recorrido' })).not.toBeInTheDocument()
  })
})
