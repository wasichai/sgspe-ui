import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, registro } from '../../test/montar'
import { ContenedorDePagina, EncabezadoDePagina, MasAcciones, useTituloDeDocumento } from './Pagina'

// la revisión de UX, etapa 0: un solo encabezado de página (título, antetítulo, chips, conteo, una acción primaria,
// secundarias y «Más») y el título del documento con la pantalla y el proyecto (D7)
let fetch: FetchMock | null = null
beforeEach(() => {
  document.title = 'SGSPE'
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' }, { state: 'active' })

describe('EncabezadoDePagina', () => {
  it('dibuja el título, el antetítulo, los chips, el conteo y las acciones', () => {
    montar(
      <EncabezadoDePagina
        titulo="Reservorio de agua"
        antetitulo="Compromiso · COM-2026-031"
        chips={<span>Aprobado</span>}
        descripcion="Lo prometido a la comunidad."
        conteo="12 compromisos"
        primaria={<button type="button">Registrar avance</button>}
        secundarias={<button type="button">Editar</button>}
      />
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Reservorio de agua' })).toBeInTheDocument()
    expect(screen.getByText('Compromiso · COM-2026-031')).toBeInTheDocument()
    expect(screen.getByText('Aprobado')).toBeInTheDocument()
    expect(screen.getByText('Lo prometido a la comunidad.')).toBeInTheDocument()
    expect(screen.getByText('12 compromisos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar avance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Más acciones' })).not.toBeInTheDocument()
  })

  it('«Más acciones» despliega las demás y se cierra con Escape, devolviendo el foco', async () => {
    montar(<EncabezadoDePagina titulo="Compromisos" mas={<button type="button">Exportar</button>} />)
    const mas = screen.getByRole('button', { name: 'Más acciones' })
    expect(mas).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
    await userEvent.click(mas)
    expect(mas).toHaveAttribute('aria-expanded', 'true')
    const grupo = screen.getByRole('group', { name: 'Más acciones' })
    expect(within(grupo).getByRole('button', { name: 'Exportar' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
    expect(mas).toHaveFocus()
  })

  it('pone el título del documento con la pantalla y la aplicación, y lo devuelve al salir', () => {
    const { unmount } = montar(<EncabezadoDePagina titulo="Compromisos" />)
    expect(document.title).toBe('Compromisos · SGSPE')
    unmount()
    expect(document.title).toBe('SGSPE')
  })

  it('dentro de un proyecto, el título del documento lleva su nombre', async () => {
    fetch = mockFetch([{ path: '/objects/project/records/p1', body: P1 }])
    montar(<EncabezadoDePagina titulo="Compromisos" />, { ruta: '/projects/p1/commitments', camino: '/projects/:projectId/commitments' })
    expect(document.title).toBe('Compromisos · SGSPE')
    await waitFor(() => expect(document.title).toBe('Compromisos · Proyecto Ejemplo A · SGSPE'))
  })

  it('la capa de mayor prioridad gana aunque se monte antes, y al salir vuelve la siguiente', async () => {
    function Capas() {
      useTituloDeDocumento('Proyectos', 0)
      const [conPantalla, fijar] = useState(true)
      return (
        <>
          <button onClick={() => fijar(false)}>Salir</button>
          {conPantalla ? <EncabezadoDePagina titulo="Compromisos" /> : null}
        </>
      )
    }
    montar(<Capas />)
    expect(document.title).toBe('Compromisos · SGSPE')
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(document.title).toBe('Proyectos · SGSPE')
  })

  it('el título del documento puede ser otro que el visible', () => {
    montar(<EncabezadoDePagina titulo="Reservorio de agua" tituloDelDocumento="COM-2026-031 Reservorio de agua" />)
    expect(document.title).toBe('COM-2026-031 Reservorio de agua · SGSPE')
  })
})

// un menú se cierra al elegir una de sus opciones (un botón o un enlace) y devuelve el foco a su botón; un clic en otra cosa
// del menú no lo cierra
describe('MasAcciones', () => {
  it('se cierra al elegir una opción y no al pulsar otra cosa del menú', async () => {
    let elegidas = 0
    montar(
      <MasAcciones etiqueta="Más vistas">
        <button type="button" onClick={() => (elegidas += 1)}>
          Cerrados
        </button>
        <p>Una nota</p>
      </MasAcciones>
    )
    const boton = screen.getByRole('button', { name: 'Más vistas' })
    await userEvent.click(boton)
    await userEvent.click(screen.getByText('Una nota'))
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrados' }))
    expect(elegidas).toBe(1)
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(boton).toHaveFocus()
  })
})

describe('ContenedorDePagina', () => {
  it('tiene un ancho único y una variante de lectura más angosta', () => {
    const { unmount } = montar(<ContenedorDePagina>Contenido</ContenedorDePagina>)
    expect(screen.getByText('Contenido')).toHaveAttribute('data-ancho', 'pagina')
    unmount()
    montar(<ContenedorDePagina variante="lectura">Texto largo</ContenedorDePagina>)
    expect(screen.getByText('Texto largo')).toHaveAttribute('data-ancho', 'lectura')
  })
})
