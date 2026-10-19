import { screen, within } from '@testing-library/react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useTituloDeDocumento } from '../componentes/Pagina'
import { EnlaceConRastro, Rastro } from './Rastro'

// la revisión de UX, etapa 6: todo enlace a un registro suma al rastro la vista que deja, nombrada con el título de la página;
// cada paso vuelve a esa vista y volver a la misma no repite el paso
function Vista({ titulo, a }: { titulo: string; a?: string }) {
  useTituloDeDocumento(titulo)
  return (
    <>
      <Rastro />
      <h1>{titulo}</h1>
      {a ? <EnlaceDeRegistro codigo="C-1" titulo={`Ir a ${a}`} ruta={a} /> : null}
      {a ? <EnlaceConRastro to={a}>{`Enlace a ${a}`}</EnlaceConRastro> : null}
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

  it('EnlaceConRastro suma el paso como EnlaceDeRegistro', async () => {
    montar(<Paginas />, { ruta: '/a' })
    await userEvent.click(screen.getByRole('link', { name: 'Enlace a /b' }))
    const rastro = await screen.findByRole('navigation', { name: 'Recorrido' })
    expect(within(rastro).getByRole('link', { name: 'Asamblea de agosto' })).toHaveAttribute('href', '/a')
  })

  // ninguna fuente del portal enlaza la ficha de un registro con un Link sin el paso del rastro: usa EnlaceConRastro,
  // EnlaceDeRegistro, RegistroVinculado o EnlaceDeFicha (revisión de UX, etapa 6)
  it('ningún Link a una ficha se queda sin el paso del rastro', () => {
    const PORTAL = join(import.meta.dirname, '..')
    const fuentes = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const ruta = join(dir, n)
        return statSync(ruta).isDirectory() ? fuentes(ruta) : ruta.endsWith('.tsx') && !ruta.endsWith('.test.tsx') ? [ruta] : []
      })
    const A_UNA_FICHA =
      /\/(commitments|engagements|stakeholders|agreements|grievances|inquiries|requests|risks|programs|contributions|documents|field-visits|areas|actors|incidents)\/\$\{encodeURIComponent|rutaDeFicha|rutaParaAbrir/
    const sinRastro = fuentes(PORTAL).flatMap((archivo) =>
      [...readFileSync(archivo, 'utf8').matchAll(/<Link\b(?:[^>]|\n)*?>/g)]
        .map((m) => m[0])
        .filter((tag) => !tag.includes('state=') && A_UNA_FICHA.test(tag))
        .map((tag) => `${relative(PORTAL, archivo)}: ${tag.slice(0, 80)}`)
    )
    expect(sinRastro).toEqual([])
  })
})
