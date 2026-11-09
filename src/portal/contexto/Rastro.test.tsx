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

// en la banda de contexto el rastro es «‹ Volver a <último paso>» y, con más de un paso, el recorrido entero a pedido: se
// verifica lo mismo que antes (los pasos, su orden, sus rutas y la vuelta) en esa forma nueva
const rastro = () => screen.getByRole('navigation', { name: 'Recorrido' })
const pasosDelRecorrido = async () => {
  const boton = within(rastro()).getByRole('button', { name: /^Recorrido/ })
  if (boton.getAttribute('aria-expanded') !== 'true') await userEvent.click(boton)
  return within(rastro())
    .getAllByRole('listitem')
    .map((li) => {
      const enlace = within(li).getByRole('link')
      return [enlace.textContent?.replace(/^\d+/, ''), enlace.getAttribute('href')]
    })
}

describe('el rastro', () => {
  it('suma la vista que se deja con el título de la página, vuelve a ella y no repite la misma', async () => {
    montar(<Paginas />, { ruta: '/a' })
    expect(screen.queryByRole('navigation', { name: 'Recorrido' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Ir a /b' }))
    // con un paso, solo «Volver a»
    expect(await within(rastro()).findByRole('link', { name: 'Volver a Asamblea de agosto' })).toHaveAttribute('href', '/a')
    expect(within(rastro()).queryByRole('button')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('link', { name: 'Ir a /c' }))
    await screen.findByRole('heading', { name: 'Acta firmada' })
    expect(within(rastro()).getByRole('link', { name: 'Volver a Canal de riego' })).toHaveAttribute('href', '/b')
    expect(within(rastro()).getByRole('button', { name: 'Recorrido (2 pasos)' })).toHaveAttribute('aria-expanded', 'false')
    expect(await pasosDelRecorrido()).toEqual([
      ['Asamblea de agosto', '/a'],
      ['Canal de riego', '/b']
    ])
    await userEvent.click(screen.getByRole('link', { name: 'Aquí mismo' }))
    expect(await pasosDelRecorrido()).toHaveLength(2)
    await userEvent.click(within(rastro()).getByRole('link', { name: 'Canal de riego' }))
    expect(await screen.findByRole('heading', { name: 'Canal de riego' })).toBeInTheDocument()
    // volver a un paso deja el rastro hasta él
    expect(within(rastro()).getByRole('link', { name: 'Volver a Asamblea de agosto' })).toBeInTheDocument()
    await userEvent.click(within(rastro()).getByRole('link', { name: 'Volver a Asamblea de agosto' }))
    expect(await screen.findByRole('heading', { name: 'Asamblea de agosto' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Recorrido' })).not.toBeInTheDocument()
  })

  it('EnlaceConRastro suma el paso como EnlaceDeRegistro', async () => {
    montar(<Paginas />, { ruta: '/a' })
    await userEvent.click(screen.getByRole('link', { name: 'Enlace a /b' }))
    expect(await within(rastro()).findByRole('link', { name: 'Volver a Asamblea de agosto' })).toHaveAttribute('href', '/a')
  })

  // la ficha abierta desde una lista ya ofrece volver a ella (NavegacionDeOrigen): el rastro no repite ese «Volver»
  it('no repite el «Volver» que ya da el origen de la ficha', async () => {
    montar(<Paginas />, {
      ruta: '/c',
      estado: {
        rastro: [
          { etiqueta: 'Asamblea de agosto', ruta: '/a' },
          { etiqueta: 'Canal de riego', ruta: '/b' }
        ],
        origen: { ruta: '/b', etiqueta: 'Canal de riego', total: 2, fichas: [] }
      }
    })
    expect(within(rastro()).queryByRole('link', { name: /^Volver/ })).not.toBeInTheDocument()
    expect(await pasosDelRecorrido()).toHaveLength(2)
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
