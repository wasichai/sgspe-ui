import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation, useParams } from 'react-router'
import { describe, expect, it } from 'vitest'
import { montar, ubicacion } from '../../test/montar'
import { conFichaReubicada, indiceDeFicha } from '../contexto/Origen'
import { Rastro } from '../contexto/Rastro'
import { EnlaceDeRegistro } from './EnlaceDeRegistro'
import { ListaEnTarjetas } from './ListaEnTarjetas'
import { EncabezadoDePagina, useTituloDeDocumento } from './Pagina'
import { PorRuta } from './PorRuta'
import { TablaPriorizada } from './TablaPriorizada'

// el flujo F-C del rediseño de UX (02-arquitectura-de-informacion §5): la ficha abierta desde una lista ofrece «‹ Volver a <lista>
// (N)» con sus filtros, y «Anterior» y «Siguiente» (K y J) entre las fichas visibles de su página; abierta directamente, nada
const COMPROMISOS = [
  { id: 'c1', titulo: 'Reservorio de agua' },
  { id: 'c2', titulo: 'Canal de riego' },
  { id: 'c3', titulo: 'Posta médica' }
]

function ListaDeCompromisos({ total }: { total?: number }) {
  useTituloDeDocumento('Compromisos')
  return (
    <>
      <h1>Lista</h1>
      <TablaPriorizada
        etiqueta="Compromisos"
        columnas={[{ id: 'titulo', encabezado: 'Compromiso', prioridad: 'esencial' }]}
        filas={COMPROMISOS}
        clave={(c) => c.id}
        celda={(c) => <EnlaceDeRegistro titulo={c.titulo} ruta={`/c/${c.id}`} />}
        alAbrir={() => undefined}
        total={total}
      />
    </>
  )
}

// una ficha cuenta sus montajes: al pasar a otra, PorRuta la vuelve a montar
const montajes: string[] = []
function Ficha() {
  const { id = '' } = useParams()
  const titulo = COMPROMISOS.find((c) => c.id === id)?.titulo ?? id
  useTituloDeDocumento(titulo)
  if (!montajes.includes(`montada:${id}`)) montajes.push(`montada:${id}`)
  return (
    <>
      <Rastro />
      <EncabezadoDePagina ficha antetitulo={`Compromiso · ${id}`} titulo={titulo} />
      <input aria-label="Nota" />
      <div role="dialog" aria-label="Un diálogo">
        <button type="button">Dentro del diálogo</button>
      </div>
    </>
  )
}

function Aplicacion({ total }: { total?: number }) {
  const { search } = useLocation()
  return (
    <Routes>
      <Route path="/commitments" element={<ListaDeCompromisos key={search} total={total} />} />
      <Route path="/c/:id" element={<PorRuta parametros={['id']} Pantalla={Ficha} />} />
    </Routes>
  )
}

const volver = () => screen.queryByRole('link', { name: /^Volver a/ })
const anterior = () => screen.getByRole('button', { name: 'Anterior' })
const siguiente = () => screen.getByRole('button', { name: 'Siguiente' })

async function abrirDesdeLaLista(titulo: string, total?: number) {
  montar(<Aplicacion total={total} />, { ruta: '/commitments?view=vencidos&q=agua' })
  await userEvent.click(screen.getByRole('link', { name: titulo }))
  await screen.findByRole('heading', { level: 1, name: titulo })
}

describe('NavegacionDeOrigen', () => {
  it('abierta desde la lista, vuelve a ella con sus filtros y el conteo de su resultado', async () => {
    await abrirDesdeLaLista('Canal de riego', 11)
    const enlace = volver()
    expect(enlace).toHaveTextContent('‹Volver a Compromisos (11)')
    expect(enlace).toHaveAccessibleName('Volver a Compromisos (11)')
    expect(enlace).toHaveAttribute('href', '/commitments?view=vencidos&q=agua')
    // el enlace va sobre el antetítulo
    expect(enlace!.compareDocumentPosition(screen.getByText('Compromiso · c2')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.click(enlace!)
    expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
    expect(ubicacion.actual).toBe('/commitments?view=vencidos&q=agua')
    // volver deja el rastro como estaba en la lista
    expect(screen.queryByRole('navigation', { name: 'Recorrido' })).not.toBeInTheDocument()
  })

  it('sin el conteo del resultado, «Volver» va sin número', async () => {
    await abrirDesdeLaLista('Canal de riego')
    expect(volver()).toHaveAccessibleName('Volver a Compromisos')
  })

  it('abierta directamente, sin origen, no ofrece volver ni anterior ni siguiente', async () => {
    montar(<Aplicacion />, { ruta: '/c/c2' })
    await screen.findByRole('heading', { level: 1, name: 'Canal de riego' })
    expect(volver()).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
    await userEvent.keyboard('j')
    expect(ubicacion.actual).toBe('/c/c2')
  })

  it('«Anterior» y «Siguiente» recorren la página en su orden, con el origen, y la ficha se vuelve a montar', async () => {
    montajes.length = 0
    await abrirDesdeLaLista('Canal de riego', 11)
    expect(within(screen.getByRole('group', { name: 'Registros de Compromisos' })).getAllByRole('button')).toHaveLength(2)
    expect(siguiente()).toHaveAttribute('aria-keyshortcuts', 'J')
    await userEvent.click(siguiente())
    expect(await screen.findByRole('heading', { level: 1, name: 'Posta médica' })).toBeInTheDocument()
    expect(ubicacion.actual).toBe('/c/c3')
    expect(montajes).toEqual(['montada:c2', 'montada:c3'])
    // el origen sigue: volver lleva a la misma lista filtrada
    expect(volver()).toHaveAttribute('href', '/commitments?view=vencidos&q=agua')
    expect(volver()).toHaveAccessibleName('Volver a Compromisos (11)')
    // el rastro no suma la ficha que se deja: sigue nombrando la lista
    expect(
      within(screen.getByRole('navigation', { name: 'Recorrido' }))
        .getAllByRole('link')
        .map((l) => l.textContent)
    ).toEqual(['Compromisos'])
    await userEvent.click(anterior())
    expect(await screen.findByRole('heading', { level: 1, name: 'Canal de riego' })).toBeInTheDocument()
  })

  it('en el primero, «Anterior» está deshabilitado; en el último, «Siguiente»', async () => {
    await abrirDesdeLaLista('Reservorio de agua')
    expect(anterior()).toBeDisabled()
    expect(siguiente()).toBeEnabled()
    await userEvent.keyboard('k')
    expect(ubicacion.actual).toBe('/c/c1')
    await userEvent.click(siguiente())
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { level: 1, name: 'Posta médica' })
    expect(siguiente()).toBeDisabled()
    expect(anterior()).toBeEnabled()
    await userEvent.keyboard('j')
    expect(ubicacion.actual).toBe('/c/c3')
  })

  it('J lleva a la siguiente y K a la anterior', async () => {
    await abrirDesdeLaLista('Canal de riego')
    await userEvent.keyboard('j')
    expect(await screen.findByRole('heading', { level: 1, name: 'Posta médica' })).toBeInTheDocument()
    await userEvent.keyboard('k')
    expect(await screen.findByRole('heading', { level: 1, name: 'Canal de riego' })).toBeInTheDocument()
    await userEvent.keyboard('K')
    expect(await screen.findByRole('heading', { level: 1, name: 'Reservorio de agua' })).toBeInTheDocument()
  })

  it('las teclas no actúan en un campo, en un diálogo ni con modificadores', async () => {
    await abrirDesdeLaLista('Canal de riego')
    const nota = screen.getByRole('textbox', { name: 'Nota' })
    await userEvent.type(nota, 'jk')
    expect(nota).toHaveValue('jk')
    expect(ubicacion.actual).toBe('/c/c2')
    screen.getByRole('button', { name: 'Dentro del diálogo' }).focus()
    await userEvent.keyboard('j')
    expect(ubicacion.actual).toBe('/c/c2')
    siguiente().focus()
    await userEvent.keyboard('{Control>}j{/Control}{Meta>}j{/Meta}{Alt>}j{/Alt}{Shift>}j{/Shift}')
    expect(ubicacion.actual).toBe('/c/c2')
  })

  it('Enter en una fila de la tabla abre su ficha con el origen, como su enlace', async () => {
    montar(<Aplicacion total={3} />, { ruta: '/commitments' })
    const filas = screen.getAllByRole('row').slice(1)
    filas[2].focus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Posta médica' })).toBeInTheDocument()
    expect(volver()).toHaveAccessibleName('Volver a Compromisos (3)')
    expect(siguiente()).toBeDisabled()
  })

  it('desde las tarjetas del teléfono, también', async () => {
    function Tarjetas() {
      useTituloDeDocumento('Riesgos')
      return (
        <ListaEnTarjetas
          etiqueta="Riesgos"
          total={2}
          tarjetas={COMPROMISOS.slice(0, 2).map((c) => ({ id: c.id, titulo: <EnlaceDeRegistro titulo={c.titulo} ruta={`/c/${c.id}`} /> }))}
        />
      )
    }
    montar(
      <Routes>
        <Route path="/risks" element={<Tarjetas />} />
        <Route path="/c/:id" element={<PorRuta parametros={['id']} Pantalla={Ficha} />} />
      </Routes>,
      { ruta: '/risks' }
    )
    await userEvent.click(screen.getByRole('link', { name: 'Canal de riego' }))
    await screen.findByRole('heading', { level: 1, name: 'Canal de riego' })
    expect(volver()).toHaveAccessibleName('Volver a Riesgos (2)')
    expect(anterior()).toBeEnabled()
    expect(siguiente()).toBeDisabled()
  })
})

describe('indiceDeFicha', () => {
  it('reconoce la ficha por su camino o el de un hijo, con sus parámetros y sin los demás', () => {
    const fichas = ['/p/1/commitments/a', '/p/1/tasks?task=t1', '/p/1/tasks?task=t2']
    expect(indiceDeFicha(fichas, '/p/1/commitments/a', '?tab=seguimiento')).toBe(0)
    expect(indiceDeFicha(fichas, '/p/1/commitments/a/edit', '')).toBe(0)
    expect(indiceDeFicha(fichas, '/p/1/commitments/ab', '')).toBe(-1)
    expect(indiceDeFicha(fichas, '/p/1/tasks', '?task=t2&page=1')).toBe(2)
    expect(indiceDeFicha(fichas, '/p/1/tasks', '')).toBe(-1)
  })
})

describe('conFichaReubicada', () => {
  it('cambia /r/… por la ficha a la que salta, sin tocar el rastro', () => {
    const rastro = [{ etiqueta: 'Avisos', ruta: '/notifications' }]
    const estado = { rastro, origen: { ruta: '/notifications', etiqueta: 'Avisos', total: 2, fichas: ['/r/commitment/a', '/r/risk/b'] } }
    expect(conFichaReubicada(estado, '/r/commitment/a', '/projects/p/commitments/a')).toEqual({
      rastro,
      origen: { ...estado.origen, fichas: ['/projects/p/commitments/a', '/r/risk/b'] }
    })
    expect(conFichaReubicada({ rastro }, '/r/commitment/a', '/x')).toEqual({ rastro })
    expect(conFichaReubicada(null, '/r/commitment/a', '/x')).toBeNull()
  })
})
