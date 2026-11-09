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

  // DD-15: lo que flota (menús, diálogos, cajones) va sobre --sg-surface-raised, que en oscuro se distingue del fondo sin sombra
  it('el menú abierto flota sobre la superficie elevada', async () => {
    montar(
      <MasAcciones>
        <button type="button">Cerrados</button>
      </MasAcciones>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    expect(screen.getByRole('group', { name: 'Más acciones' })).toHaveClass('bg-sg-surface-raised')
  })

  // el menú de una fila (P-08): solo el ícono, con un nombre accesible que dice de quién son las acciones
  it('con nombre, el botón de solo ícono y su grupo se llaman así; sin él, «Más acciones»', async () => {
    const { unmount } = montar(
      <MasAcciones nombre="Acciones de pad@sgspe.test">
        <button type="button">Terminar</button>
      </MasAcciones>
    )
    const boton = screen.getByRole('button', { name: 'Acciones de pad@sgspe.test' })
    expect(boton).toHaveAttribute('title', 'Acciones de pad@sgspe.test')
    expect(boton).not.toHaveTextContent(/\S/)
    await userEvent.click(boton)
    expect(screen.getByRole('group', { name: 'Acciones de pad@sgspe.test' })).toBeInTheDocument()
    unmount()
    montar(
      <MasAcciones>
        <button type="button">Terminar</button>
      </MasAcciones>
    )
    expect(screen.getByRole('button', { name: 'Más acciones' })).toBeInTheDocument()
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

  // .pg del lienzo (design-system.md §5.3): una columna con 20 px entre bloques
  it('apila los bloques en una columna con 20 px entre ellos y puede ser la sección o el artículo de la página', () => {
    const { unmount } = montar(<ContenedorDePagina>Contenido</ContenedorDePagina>)
    const contenedor = screen.getByText('Contenido')
    expect(contenedor).toHaveClass('space-y-5', 'mx-auto', 'max-w-[1440px]')
    expect(contenedor.tagName).toBe('DIV')
    unmount()
    montar(<ContenedorDePagina elemento="article">Ficha</ContenedorDePagina>)
    expect(screen.getByText('Ficha').tagName).toBe('ARTICLE')
  })

  // los márgenes de página de design-system.md §3.5 (16 en el teléfono, 24 en tableta, 32 desde lg) y los 24 de arriba los pone
  // el contenedor, no el <main> del shell; uno dentro de otro no los repite
  it('pone los márgenes de la página una sola vez', () => {
    montar(
      <ContenedorDePagina>
        <ContenedorDePagina variante="lectura">Dentro</ContenedorDePagina>
      </ContenedorDePagina>
    )
    const dentro = screen.getByText('Dentro')
    expect(dentro.parentElement).toHaveClass('px-4', 'md:px-6', 'lg:px-8', 'pt-6')
    expect(dentro).not.toHaveClass('px-4')
    expect(dentro).not.toHaveClass('pt-6')
  })
})

describe('la barra de acciones de una ficha en el teléfono', () => {
  // va sobre la barra inferior de 64 px (design-system.md §5.2): su borde inferior a 64 px del pie
  it('queda fija a 64 px del pie', () => {
    montar(<EncabezadoDePagina titulo="Reservorio" ficha primaria={<button type="button">Registrar avance</button>} />)
    // la primaria va en su envoltorio del teléfono (M17b): la barra es el contenedor con data-barra-de-acciones
    const barra = screen.getByRole('button', { name: 'Registrar avance' }).closest('[data-barra-de-acciones]')!
    expect(barra).toBeInTheDocument()
    expect(barra).toHaveClass('max-sm:fixed', 'max-sm:bottom-16')
    expect(barra).not.toHaveClass('max-sm:bottom-12')
  })
})

// M17b: en el teléfono, la primaria a todo el ancho arriba y debajo las secundarias, que se reparten el ancho (con «Más» al lado)
describe('la barra de acciones de una ficha en el teléfono (M17b)', () => {
  it('pone la primaria primero y a todo el ancho, y reparte el ancho entre las secundarias', () => {
    montar(
      <EncabezadoDePagina
        titulo="Reservorio"
        ficha
        primaria={<button type="button">Desbloquear</button>}
        secundarias={<button type="button">Adjuntar foto</button>}
      />
    )
    const primaria = screen.getByRole('button', { name: 'Desbloquear' }).parentElement!
    expect(primaria).toHaveClass('contents', 'max-sm:order-first', 'max-sm:basis-full', 'max-sm:[&>*]:w-full')
    const secundarias = screen.getByRole('button', { name: 'Adjuntar foto' }).parentElement!
    expect(secundarias).toHaveClass('contents', 'max-sm:flex', 'max-sm:flex-1', 'max-sm:[&>*]:flex-1')
    expect(secundarias.parentElement).toHaveAttribute('data-barra-de-acciones')
  })

  it('sin secundarias, la primaria se reparte la fila con «Más»', () => {
    montar(<EncabezadoDePagina titulo="Aporte" ficha primaria={<button type="button">Aprobar</button>} mas={<button type="button">Anular</button>} />)
    const primaria = screen.getByRole('button', { name: 'Aprobar' }).parentElement!
    expect(primaria).toHaveClass('max-sm:flex-1')
    expect(primaria).not.toHaveClass('max-sm:basis-full')
  })

  it('fuera de una ficha, las acciones van tal cual', () => {
    montar(<EncabezadoDePagina titulo="Compromisos" primaria={<button type="button">Registrar</button>} />)
    expect(screen.getByRole('button', { name: 'Registrar' }).parentElement).not.toHaveClass('contents')
  })
})

describe('EncabezadoDePagina en Civic Modern', () => {
  it('el antetítulo es un overline, el título un h1 de 28/36 y la descripción va en text-secondary', () => {
    montar(<EncabezadoDePagina titulo="Compromisos" antetitulo="Proyecto · DEMO-T1" antetituloEnSans descripcion="Lo prometido." />)
    expect(screen.getByText('Proyecto · DEMO-T1')).toHaveClass('text-sg-overline', 'uppercase', 'text-sg-text-secondary')
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-sg-h1', 'text-sg-text')
    expect(screen.getByText('Lo prometido.')).toHaveClass('text-sg-body', 'text-sg-text-secondary')
  })
})
