import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { TablaPriorizada, type ColumnaPriorizada } from './TablaPriorizada'

// hallazgo U-06 (DD-05): una tabla ancha decide qué columnas se ven por su prioridad, y la que dice lo mismo en todas las
// filas sale de la tabla y queda en una nota encima
interface Fila {
  id: string
  titulo: string
  estado: string
  responsable: string
  monto: string
  notas: string
}

const FILAS: Fila[] = [
  { id: 'c1', titulo: 'Reservorio de Tunas', estado: 'En ejecución', responsable: 'Gestión de compromisos (demo)', monto: '1,200.00', notas: 'a' },
  { id: 'c2', titulo: 'Posta de Huaylla', estado: 'En ejecución', responsable: 'Gestión de compromisos (demo)', monto: '800.00', notas: 'b' }
]

const COLUMNAS: ColumnaPriorizada[] = [
  { id: 'titulo', encabezado: 'Compromiso', prioridad: 'esencial' },
  { id: 'estado', encabezado: 'Estado', prioridad: 'esencial' },
  { id: 'responsable', encabezado: 'Responsable', prioridad: 'secundaria' },
  { id: 'monto', encabezado: 'Monto', prioridad: 'secundaria', numerica: true },
  { id: 'notas', encabezado: 'Notas', prioridad: 'opcional' }
]

const valor = (fila: Fila, columna: string) => String(fila[columna as keyof Fila])

function dibujar(extra: Partial<Parameters<typeof TablaPriorizada<Fila>>[0]> = {}) {
  return montar(
    <TablaPriorizada<Fila> etiqueta="Compromisos" columnas={COLUMNAS} filas={FILAS} clave={(f) => f.id} celda={valor} valorPlano={valor} {...extra} />
  )
}

const tabla = () => screen.getByRole('table', { name: 'Compromisos' })
const filas = () => within(tabla()).getAllByRole('row').slice(1)

describe('TablaPriorizada', () => {
  it('CA-1.6.1: una columna no esencial con el mismo valor en todas las filas sale de la tabla y queda en una nota', () => {
    dibujar({ ocultarUniformes: true })
    expect(within(tabla()).queryByRole('columnheader', { name: 'Responsable' })).not.toBeInTheDocument()
    expect(within(tabla()).queryByText('Gestión de compromisos (demo)')).not.toBeInTheDocument()
    const nota = screen.getByRole('list', { name: 'Igual en todas las filas' })
    expect(within(nota).getAllByRole('listitem')).toHaveLength(1)
    expect(within(nota).getByRole('listitem')).toHaveTextContent(/^Responsable: Gestión de compromisos \(demo\)$/)
    // la columna que varía sigue en la tabla
    expect(within(tabla()).getByRole('columnheader', { name: 'Monto' })).toBeInTheDocument()
  })

  it('una columna esencial uniforme no se oculta ni lleva nota', () => {
    dibujar({ ocultarUniformes: true })
    expect(within(tabla()).getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument()
    expect(within(filas()[0]).getByRole('cell', { name: 'En ejecución' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Igual en todas las filas' })).not.toHaveTextContent('Estado')
  })

  it('sin ocultarUniformes, o con una sola fila, la columna uniforme se dibuja', () => {
    dibujar()
    expect(within(tabla()).getByRole('columnheader', { name: 'Responsable' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Igual en todas las filas' })).not.toBeInTheDocument()
    document.body.innerHTML = ''
    dibujar({ ocultarUniformes: true, filas: [FILAS[0]] })
    expect(within(tabla()).getByRole('columnheader', { name: 'Responsable' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Igual en todas las filas' })).not.toBeInTheDocument()
  })

  it('las secundarias se ven desde xl, en el encabezado y en cada celda; las esenciales siempre', () => {
    dibujar()
    const responsable = within(tabla()).getByRole('columnheader', { name: 'Responsable' })
    expect(responsable).toHaveClass('hidden', 'xl:table-cell')
    for (const fila of filas()) expect(within(fila).getByRole('cell', { name: 'Gestión de compromisos (demo)' })).toHaveClass('hidden', 'xl:table-cell')
    const compromiso = within(tabla()).getByRole('columnheader', { name: 'Compromiso' })
    expect(compromiso).not.toHaveClass('hidden')
    expect(within(filas()[0]).getByRole('cell', { name: 'Reservorio de Tunas' })).not.toHaveClass('hidden')
  })

  // sin una elección en «Columnas», una opcional se ve desde 1536 px (el 2xl de SGSPE es 1440 px)
  it('sin elección guardada, las opcionales se ven solo desde 1536 px', () => {
    dibujar()
    const notas = within(tabla()).getByRole('columnheader', { name: 'Notas' })
    expect(notas).toHaveClass('hidden', 'min-[96rem]:table-cell')
    expect(notas).not.toHaveClass('xl:table-cell')
    expect(notas).not.toHaveClass('2xl:table-cell')
    expect(within(tabla()).getAllByRole('columnheader')).toHaveLength(5)
    expect(within(filas()[0]).getAllByRole('cell')).toHaveLength(5)
  })

  it('una numérica va a la derecha y con cifras tabulares', () => {
    dibujar()
    expect(within(tabla()).getByRole('columnheader', { name: 'Monto' })).toHaveClass('text-right')
    expect(within(filas()[0]).getByRole('cell', { name: '1,200.00' })).toHaveClass('text-right', 'tabular-nums')
  })

  it('con alAbrir, cada fila se enfoca y Enter la abre', async () => {
    const alAbrir = vi.fn()
    dibujar({ alAbrir })
    expect(filas()[1]).toHaveAttribute('tabIndex', '0')
    filas()[1].focus()
    await userEvent.keyboard('{Enter}')
    expect(alAbrir).toHaveBeenCalledTimes(1)
    expect(alAbrir).toHaveBeenCalledWith(FILAS[1])
  })

  it('Enter en un control de la fila no abre la fila', async () => {
    const alAbrir = vi.fn()
    dibujar({ alAbrir, celda: (f, c) => (c === 'titulo' ? <a href={`/c/${f.id}`}>{f.titulo}</a> : valor(f, c)) })
    within(filas()[0]).getByRole('link', { name: 'Reservorio de Tunas' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(alAbrir).not.toHaveBeenCalled()
  })

  it('sin alAbrir, las filas no son enfocables', () => {
    dibujar()
    expect(filas()[0]).not.toHaveAttribute('tabIndex')
  })

  it('una columna con encabezado oculto lo deja solo a los lectores de pantalla', () => {
    dibujar({ columnas: [{ id: 'sel', encabezado: 'Seleccionar', prioridad: 'esencial', encabezadoOculto: true }, ...COLUMNAS] })
    const encabezado = within(tabla()).getByRole('columnheader', { name: 'Seleccionar' })
    expect(within(encabezado).getByText('Seleccionar')).toHaveClass('sr-only')
  })

  describe('«Columnas»', () => {
    const CLAVE = 'sgspe.columnas.compromisos'
    afterEach(() => {
      localStorage.removeItem(CLAVE)
      vi.restoreAllMocks()
    })
    const abrirColumnas = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Columnas' }))
      return screen.getByRole('group', { name: 'Columnas' })
    }

    it('ofrece solo las opcionales, cada una con su casilla', async () => {
      dibujar({ idDeTabla: 'compromisos' })
      const menu = await abrirColumnas()
      expect(
        within(menu)
          .getAllByRole('checkbox')
          .map((c) => c.closest('label')?.textContent)
      ).toEqual(['Notas'])
      expect(within(menu).getByRole('checkbox', { name: 'Notas' })).not.toBeChecked()
    })

    it('marcar una opcional la muestra en todos los anchos y la elección se recuerda por tabla', async () => {
      const { unmount } = dibujar({ idDeTabla: 'compromisos' })
      const menu = await abrirColumnas()
      await userEvent.click(within(menu).getByRole('checkbox', { name: 'Notas' }))
      const notas = within(tabla()).getByRole('columnheader', { name: 'Notas' })
      expect(notas).not.toHaveClass('hidden')
      expect(within(filas()[0]).getByRole('cell', { name: 'a' })).not.toHaveClass('hidden')
      expect(JSON.parse(localStorage.getItem(CLAVE) ?? '{}')).toEqual({ notas: true })
      unmount()
      dibujar({ idDeTabla: 'compromisos' })
      expect(within(tabla()).getByRole('columnheader', { name: 'Notas' })).not.toHaveClass('hidden')
      // otra tabla no hereda la elección
      document.body.innerHTML = ''
      dibujar({ idDeTabla: 'otra' })
      expect(within(tabla()).getByRole('columnheader', { name: 'Notas' })).toHaveClass('hidden', 'min-[96rem]:table-cell')
    })

    it('dos tablas con el mismo id (los grupos de una lista) comparten la elección al instante', async () => {
      montar(
        <>
          <TablaPriorizada<Fila> etiqueta="Uno" idDeTabla="compromisos" columnas={COLUMNAS} filas={FILAS} clave={(f) => f.id} celda={valor} />
          <TablaPriorizada<Fila> etiqueta="Dos" idDeTabla="compromisos" columnas={COLUMNAS} filas={FILAS} clave={(f) => f.id} celda={valor} />
        </>
      )
      await userEvent.click(screen.getAllByRole('button', { name: 'Columnas' })[0])
      await userEvent.click(within(screen.getByRole('group', { name: 'Columnas' })).getByRole('checkbox', { name: 'Notas' }))
      for (const nombre of ['Uno', 'Dos'])
        expect(within(screen.getByRole('table', { name: nombre })).getByRole('columnheader', { name: 'Notas' })).not.toHaveClass('hidden')
    })

    it('desmarcarla la oculta también en las pantallas anchas', async () => {
      localStorage.setItem(CLAVE, JSON.stringify({ notas: true }))
      dibujar({ idDeTabla: 'compromisos' })
      const menu = await abrirColumnas()
      const casilla = within(menu).getByRole('checkbox', { name: 'Notas' })
      expect(casilla).toBeChecked()
      await userEvent.click(casilla)
      const notas = within(tabla()).getByRole('columnheader', { name: 'Notas' })
      expect(notas).toHaveClass('hidden')
      expect(notas).not.toHaveClass('min-[96rem]:table-cell')
      expect(JSON.parse(localStorage.getItem(CLAVE) ?? '{}')).toEqual({ notas: false })
    })

    it('en una pantalla ancha, sin elección, la casilla dice que la columna se ve', async () => {
      const original = window.matchMedia
      window.matchMedia = ((consulta: string) => ({
        matches: consulta.includes('96rem'),
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined
      })) as unknown as typeof window.matchMedia
      try {
        dibujar({ idDeTabla: 'compromisos' })
        const menu = await abrirColumnas()
        expect(within(menu).getByRole('checkbox', { name: 'Notas' })).toBeChecked()
        await userEvent.click(within(menu).getByRole('checkbox', { name: 'Notas' }))
        expect(JSON.parse(localStorage.getItem(CLAVE) ?? '{}')).toEqual({ notas: false })
      } finally {
        window.matchMedia = original
      }
    })

    it('sin almacenamiento, o con uno ilegible, vale lo de siempre y la casilla sigue sirviendo en la página', async () => {
      localStorage.setItem(CLAVE, 'no es json')
      dibujar({ idDeTabla: 'compromisos' })
      expect(within(tabla()).getByRole('columnheader', { name: 'Notas' })).toHaveClass('hidden', 'min-[96rem]:table-cell')
      document.body.innerHTML = ''
      // el almacenamiento de las columnas falla; el de la sesión y el idioma, que montar y i18n usan, no
      const leer = Storage.prototype.getItem
      const escribir = Storage.prototype.setItem
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, clave: string) {
        if (clave.startsWith('sgspe.columnas.')) throw new Error('bloqueado')
        return leer.call(this, clave)
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, clave: string, valor: string) {
        if (clave.startsWith('sgspe.columnas.')) throw new Error('bloqueado')
        escribir.call(this, clave, valor)
      })
      dibujar({ idDeTabla: 'compromisos' })
      expect(within(tabla()).getByRole('columnheader', { name: 'Notas' })).toHaveClass('hidden', 'min-[96rem]:table-cell')
      const menu = await abrirColumnas()
      await userEvent.click(within(menu).getByRole('checkbox', { name: 'Notas' }))
      expect(within(tabla()).getByRole('columnheader', { name: 'Notas' })).not.toHaveClass('hidden')
    })

    it('sin opcionales no hay «Columnas»; una opcional uniforme, que ya está en la nota, no se ofrece', () => {
      dibujar({ columnas: COLUMNAS.filter((c) => c.prioridad !== 'opcional') })
      expect(screen.queryByRole('button', { name: 'Columnas' })).not.toBeInTheDocument()
      document.body.innerHTML = ''
      dibujar({ ocultarUniformes: true, filas: FILAS.map((f) => ({ ...f, notas: 'igual' })) })
      expect(screen.queryByRole('button', { name: 'Columnas' })).not.toBeInTheDocument()
    })

    it('en inglés', async () => {
      localStorage.setItem('sgspe.lang', 'en')
      try {
        dibujar({ idDeTabla: 'compromisos' })
        await userEvent.click(screen.getByRole('button', { name: 'Columns' }))
        expect(screen.getByRole('group', { name: 'Columns' })).toBeInTheDocument()
      } finally {
        localStorage.removeItem('sgspe.lang')
      }
    })
  })
})
