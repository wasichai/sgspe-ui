import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { instanteDeLima } from '../datos/fechas'
import { CampoFecha } from './CampoFecha'

// hallazgo U-07, decisión DD-07: un campo de fecha que muestra y lee dd/mm/aaaa y la hora de 24 h en los dos idiomas, sea cual
// sea la configuración regional del navegador. con hora, el valor es el de un datetime-local de Lima (AAAA-MM-DDTHH:mm), el
// mismo que guardaba el formulario piloto: el instante lo arma instanteDeLima al mandar
beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

type Props = Omit<Parameters<typeof CampoFecha>[0], 'valor' | 'alCambiar'>
function Controlado({ inicial = null, espia, ...props }: Props & { inicial?: string | null; espia: (v: string | null) => void }) {
  const [valor, setValor] = useState<string | null>(inicial)
  return (
    <CampoFecha
      {...props}
      valor={valor}
      alCambiar={(v) => {
        setValor(v)
        espia(v)
      }}
    />
  )
}

const ultimo = (espia: ReturnType<typeof vi.fn>) => espia.mock.calls.at(-1)?.[0]
const FORMATO = 'Escriba la fecha como día/mes/año, por ejemplo 20/10/2026'

describe('CampoFecha', () => {
  it('con hora, 20/10/2026 y 10:15 dan el mismo valor que el datetime-local de Lima del formulario piloto (CA-1.5.1)', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Recepción" conHora espia={espia} />)
    await userEvent.type(screen.getByLabelText('Recepción'), '20/10/2026')
    await userEvent.type(screen.getByLabelText('Recepción (hora)'), '10:15')
    await userEvent.tab()
    expect(ultimo(espia)).toBe('2026-10-20T10:15')
    // lo que el formulario manda al servidor: el instante UTC de esa hora de Lima
    expect(instanteDeLima(ultimo(espia))).toBe(instanteDeLima('2026-10-20T10:15'))
    expect(instanteDeLima(ultimo(espia))).toBe('2026-10-20T15:15:00.000Z')
  })

  it.each([
    ['es', 'dd/mm/aaaa'],
    ['en', 'dd/mm/yyyy']
  ])('con el navegador en en-US, en %s muestra 20/10/2026 y la hora de 24 h, nunca 10/20/2026 (CA-1.5.2)', (idioma, marcador) => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    localStorage.setItem('sgspe.lang', idioma)
    montar(<CampoFecha etiqueta="Recepción" conHora valor="2026-10-20T15:15" alCambiar={() => {}} />)
    const dia = screen.getByLabelText('Recepción')
    expect(dia).toHaveValue('20/10/2026')
    expect(dia).toHaveAttribute('placeholder', marcador)
    expect(dia).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByLabelText(idioma === 'es' ? 'Recepción (hora)' : 'Recepción (time)')).toHaveValue('15:15')
    expect(screen.queryByDisplayValue('10/20/2026')).not.toBeInTheDocument()
  })

  it.each(['20102026', '20-10-2026'])('%s se normaliza a 20/10/2026 al salir del campo', async (escrito) => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Inicio" espia={espia} />)
    await userEvent.type(screen.getByLabelText('Inicio'), escrito)
    await userEvent.tab()
    expect(screen.getByLabelText('Inicio')).toHaveValue('20/10/2026')
    expect(ultimo(espia)).toBe('2026-10-20')
  })

  it('una hora 1015 se normaliza a 10:15', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Recepción" conHora espia={espia} />)
    await userEvent.type(screen.getByLabelText('Recepción'), '20102026')
    await userEvent.type(screen.getByLabelText('Recepción (hora)'), '1015')
    await userEvent.tab()
    expect(screen.getByLabelText('Recepción (hora)')).toHaveValue('10:15')
    expect(ultimo(espia)).toBe('2026-10-20T10:15')
  })

  it('31/02/2026 da el error de formato en el campo y no es un valor', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-01" espia={espia} />)
    const campo = screen.getByLabelText('Inicio')
    await userEvent.clear(campo)
    await userEvent.type(campo, '31/02/2026')
    await userEvent.tab()
    expect(screen.getByText(FORMATO)).toBeInTheDocument()
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAccessibleDescription(FORMATO)
    expect(ultimo(espia)).toBeNull()
  })

  it('el error de formato también en inglés', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    montar(<Controlado etiqueta="Start" espia={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Start'), '99/99/2026')
    await userEvent.tab()
    expect(screen.getByText('Write the date as day/month/year, for example 20/10/2026')).toBeInTheDocument()
  })

  it('una hora que no es de 24 h da su error', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Recepción" conHora espia={espia} />)
    await userEvent.type(screen.getByLabelText('Recepción'), '20/10/2026')
    await userEvent.type(screen.getByLabelText('Recepción (hora)'), '25:00')
    await userEvent.tab()
    expect(screen.getByText('Escriba la hora como horas:minutos, de 00:00 a 23:59, por ejemplo 15:30')).toBeInTheDocument()
    expect(screen.getByLabelText('Recepción (hora)')).toHaveAttribute('aria-invalid', 'true')
    // nunca avisó un valor: sigue sin fecha
    expect(espia).not.toHaveBeenCalledWith(expect.any(String))
  })

  it('vaciar el campo llama a alCambiar(null), sin error', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={espia} />)
    expect(screen.getByLabelText('Inicio')).toHaveValue('20/10/2026')
    await userEvent.clear(screen.getByLabelText('Inicio'))
    await userEvent.tab()
    expect(espia).toHaveBeenLastCalledWith(null)
    expect(screen.queryByText(FORMATO)).not.toBeInTheDocument()
  })

  it('una fecha fuera de min o max es un error de campo y no un valor', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Inicio" min="2026-10-01" max="2026-10-31" espia={espia} />)
    const campo = screen.getByLabelText('Inicio')
    await userEvent.type(campo, '30/09/2026')
    await userEvent.tab()
    expect(screen.getByText('La fecha no puede ser anterior al 01/10/2026')).toBeInTheDocument()
    expect(espia).not.toHaveBeenCalledWith(expect.any(String))
    await userEvent.clear(campo)
    await userEvent.type(campo, '01/11/2026')
    await userEvent.tab()
    expect(screen.getByText('La fecha no puede ser posterior al 31/10/2026')).toBeInTheDocument()
    expect(espia).not.toHaveBeenCalledWith(expect.any(String))
    await userEvent.clear(campo)
    await userEvent.type(campo, '31/10/2026')
    await userEvent.tab()
    expect(ultimo(espia)).toBe('2026-10-31')
    expect(screen.queryByText(/La fecha no puede ser/)).not.toBeInTheDocument()
  })

  it('muestra el error que le pasa el formulario, toma su id, se marca obligatorio y se deshabilita', () => {
    const { unmount } = montar(<CampoFecha etiqueta="Inicio" id="inicio" requerido error="Falta la fecha." valor={null} alCambiar={() => {}} />)
    const campo = screen.getByLabelText('Inicio')
    expect(campo).toHaveAttribute('id', 'inicio')
    expect(campo).toHaveAttribute('aria-required', 'true')
    expect(campo).toHaveAccessibleDescription('Falta la fecha.')
    unmount()
    montar(<CampoFecha etiqueta="Inicio" conHora deshabilitado valor={null} alCambiar={() => {}} />)
    expect(screen.getByLabelText('Inicio')).toBeDisabled()
    expect(screen.getByLabelText('Inicio (hora)')).toBeDisabled()
  })

  it('un valor nuevo que llega del formulario se muestra', async () => {
    function ConBoton() {
      const [valor, setValor] = useState<string | null>('2026-10-20T10:15')
      return (
        <>
          <CampoFecha etiqueta="Recepción" conHora valor={valor} alCambiar={setValor} />
          <button type="button" onClick={() => setValor('2026-11-05T08:00')}>
            Otra
          </button>
        </>
      )
    }
    montar(<ConBoton />)
    expect(screen.getByLabelText('Recepción')).toHaveValue('20/10/2026')
    await userEvent.click(screen.getByRole('button', { name: 'Otra' }))
    expect(screen.getByLabelText('Recepción')).toHaveValue('05/11/2026')
    expect(screen.getByLabelText('Recepción (hora)')).toHaveValue('08:00')
  })
})

// la ayuda del campo y la invalidez que decide la pantalla (un periodo con «desde» después de «hasta»): las tenían los campos
// nativos que CampoFecha reemplaza, y un lector de pantalla las necesita
describe('CampoFecha, ayuda e invalidez de la pantalla', () => {
  it('enlaza la ayuda con aria-describedby y marca aria-invalid cuando la pantalla lo pide', () => {
    const { rerender } = montar(<CampoFecha etiqueta="Desde" valor="2026-10-20" ayuda="Fecha de recepción de la QCS" alCambiar={() => {}} />)
    const campo = screen.getByLabelText('Desde')
    expect(campo).toHaveAccessibleDescription('Fecha de recepción de la QCS')
    expect(campo).not.toHaveAttribute('aria-invalid')
    rerender(<CampoFecha etiqueta="Desde" valor="2026-10-20" ayuda="Fecha de recepción de la QCS" invalido alCambiar={() => {}} />)
    expect(screen.getByLabelText('Desde')).toHaveAttribute('aria-invalid', 'true')
  })
})

// el calendario del campo (05-especificacion §1.5, DD-07): el patrón «Date Picker Dialog» de WAI-ARIA APG. un botón junto al
// día abre una grilla de mes no modal, con lunes primero en los dos idiomas, que se recorre con el teclado y escribe el día
// elegido en el campo como si se hubiera tecleado
describe('CampoFecha, calendario', () => {
  // el botón dice qué campo abre: con dos campos de fecha en una pantalla (Desde y Hasta) no se confunden
  const ABRIR = /^Elegir .+ en el calendario$/
  const abrir = () => userEvent.click(screen.getByRole('button', { name: ABRIR }))
  const celda = (nombre: string) => screen.getByRole('gridcell', { name: nombre })
  const enfocada = () => document.activeElement?.getAttribute('aria-label')

  afterEach(() => vi.useRealTimers())

  it('con dos campos de fecha, cada botón nombra su campo', () => {
    montar(
      <>
        <CampoFecha etiqueta="Desde" valor={null} alCambiar={() => {}} />
        <CampoFecha etiqueta="Hasta" valor={null} alCambiar={() => {}} />
      </>
    )
    expect(screen.getByRole('button', { name: 'Elegir Desde en el calendario' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elegir Hasta en el calendario' })).toBeInTheDocument()
  })

  it('abre un diálogo no modal con el mes del valor y el foco en el día elegido', async () => {
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={vi.fn()} />)
    const boton = screen.getByRole('button', { name: ABRIR })
    expect(boton).toHaveAttribute('aria-haspopup', 'dialog')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    await abrir()
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    const dialogo = screen.getByRole('dialog', { name: 'Calendario de Inicio' })
    expect(dialogo).toHaveAttribute('aria-modal', 'false')
    expect(screen.getByText('Octubre de 2026')).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'Octubre de 2026' })).toBeInTheDocument()
    const elegido = celda('martes, 20 de octubre de 2026')
    expect(elegido).toHaveAttribute('aria-selected', 'true')
    expect(elegido).toHaveFocus()
    expect(celda('miércoles, 21 de octubre de 2026')).toHaveAttribute('aria-selected', 'false')
  })

  it('sin valor abre en el mes de hoy en Lima, con el foco y aria-current="date" en hoy', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // las 22:00 de Lima del 23 de octubre: en UTC ya es 24, pero el día de negocio es el de Lima
    vi.setSystemTime(new Date('2026-10-24T03:00:00Z'))
    montar(<Controlado etiqueta="Inicio" espia={vi.fn()} />)
    await abrir()
    const hoy = celda('viernes, 23 de octubre de 2026')
    expect(hoy).toHaveAttribute('aria-current', 'date')
    expect(hoy).toHaveFocus()
    expect(celda('sábado, 24 de octubre de 2026')).not.toHaveAttribute('aria-current')
    expect(screen.queryAllByRole('gridcell', { selected: true })).toHaveLength(0)
  })

  it('las flechas mueven un día o una semana, RePág y AvPág un mes, con Mayús un año, Inicio y Fin a lunes y domingo', async () => {
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={vi.fn()} />)
    await abrir()
    await userEvent.keyboard('{ArrowRight}')
    expect(enfocada()).toBe('miércoles, 21 de octubre de 2026')
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(enfocada()).toBe('lunes, 19 de octubre de 2026')
    await userEvent.keyboard('{ArrowDown}')
    expect(enfocada()).toBe('lunes, 26 de octubre de 2026')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(enfocada()).toBe('lunes, 12 de octubre de 2026')
    await userEvent.keyboard('{End}')
    expect(enfocada()).toBe('domingo, 18 de octubre de 2026')
    await userEvent.keyboard('{Home}')
    expect(enfocada()).toBe('lunes, 12 de octubre de 2026')
    await userEvent.keyboard('{PageDown}')
    expect(enfocada()).toBe('jueves, 12 de noviembre de 2026')
    expect(screen.getByText('Noviembre de 2026')).toBeInTheDocument()
    await userEvent.keyboard('{PageUp}{PageUp}')
    expect(enfocada()).toBe('sábado, 12 de setiembre de 2026')
    await userEvent.keyboard('{Shift>}{PageDown}{/Shift}')
    expect(enfocada()).toBe('domingo, 12 de setiembre de 2027')
    await userEvent.keyboard('{Shift>}{PageUp}{PageUp}{/Shift}')
    expect(enfocada()).toBe('viernes, 12 de setiembre de 2025')
  })

  it('las flechas cruzan de mes y RePág no se corre de mes en el 31', async () => {
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-31" espia={vi.fn()} />)
    await abrir()
    await userEvent.keyboard('{ArrowRight}')
    expect(enfocada()).toBe('domingo, 1 de noviembre de 2026')
    expect(screen.getByText('Noviembre de 2026')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}{PageUp}')
    expect(enfocada()).toBe('miércoles, 30 de setiembre de 2026')
  })

  it('los botones «Mes anterior» y «Mes siguiente» cambian el mes', async () => {
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={vi.fn()} />)
    await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByText('Noviembre de 2026')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(screen.getByText('Setiembre de 2026')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Enter elige el día enfocado, lo escribe en el campo, cierra y devuelve el foco al botón', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={espia} />)
    await abrir()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    expect(ultimo(espia)).toBe('2026-10-21')
    expect(screen.getByLabelText('Inicio')).toHaveValue('21/10/2026')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ABRIR })).toHaveFocus()
  })

  it('Espacio también elige', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={espia} />)
    await abrir()
    await userEvent.keyboard('{ArrowDown} ')
    expect(ultimo(espia)).toBe('2026-10-27')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un clic en un día lo elige y, con hora, conserva la hora escrita', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Recepción" conHora inicial="2026-10-20T10:15" espia={espia} />)
    await abrir()
    await userEvent.click(celda('jueves, 22 de octubre de 2026'))
    expect(ultimo(espia)).toBe('2026-10-22T10:15')
    expect(screen.getByLabelText('Recepción')).toHaveValue('22/10/2026')
    expect(screen.getByLabelText('Recepción (hora)')).toHaveValue('10:15')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('con hora todavía sin escribir, elegir el día lo escribe y no avisa un valor hasta que llegue la hora', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Recepción" conHora inicial={null} espia={espia} />)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T15:00:00Z'))
    await abrir()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByLabelText('Recepción')).toHaveValue('23/10/2026')
    expect(espia).not.toHaveBeenCalledWith(expect.any(String))
    await userEvent.type(screen.getByLabelText('Recepción (hora)'), '09:30')
    expect(ultimo(espia)).toBe('2026-10-23T09:30')
  })

  it('fuera de min y max los días están deshabilitados y no se eligen', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" min="2026-10-10" max="2026-10-25" espia={espia} />)
    await abrir()
    expect(celda('viernes, 9 de octubre de 2026')).toHaveAttribute('aria-disabled', 'true')
    expect(celda('sábado, 10 de octubre de 2026')).not.toHaveAttribute('aria-disabled')
    expect(celda('domingo, 25 de octubre de 2026')).not.toHaveAttribute('aria-disabled')
    expect(celda('lunes, 26 de octubre de 2026')).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(celda('lunes, 26 de octubre de 2026'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(enfocada()).toBe('martes, 27 de octubre de 2026')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(espia).not.toHaveBeenCalled()
  })

  it('con min y max con hora, los días se juzgan por su día', async () => {
    montar(<Controlado etiqueta="Recepción" conHora inicial="2026-10-20T10:15" min="2026-10-10T08:00" max="2026-10-25T18:00" espia={vi.fn()} />)
    await abrir()
    expect(celda('sábado, 10 de octubre de 2026')).not.toHaveAttribute('aria-disabled')
    expect(celda('domingo, 25 de octubre de 2026')).not.toHaveAttribute('aria-disabled')
    expect(celda('viernes, 9 de octubre de 2026')).toHaveAttribute('aria-disabled', 'true')
  })

  it('Esc cierra sin elegir, devuelve el foco al botón y no cierra el diálogo que lo contiene', async () => {
    const espia = vi.fn()
    const deFuera = vi.fn()
    const escuchar = (e: KeyboardEvent) => e.key === 'Escape' && deFuera()
    document.addEventListener('keydown', escuchar, { capture: true })
    try {
      montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={espia} />)
      await abrir()
      await userEvent.keyboard('{ArrowRight}{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: ABRIR })).toHaveFocus()
      expect(screen.getByLabelText('Inicio')).toHaveValue('20/10/2026')
      expect(espia).not.toHaveBeenCalled()
      expect(deFuera).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', escuchar, { capture: true })
    }
  })

  it('un clic fuera cierra sin elegir', async () => {
    const espia = vi.fn()
    montar(
      <>
        <Controlado etiqueta="Inicio" inicial="2026-10-20" espia={espia} />
        <p>Fuera</p>
      </>
    )
    await abrir()
    await userEvent.click(screen.getByText('Fuera'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(espia).not.toHaveBeenCalled()
  })

  it('el foco que sale con Tab cierra el calendario', async () => {
    montar(
      <>
        <Controlado etiqueta="Inicio" inicial="2026-10-20" espia={vi.fn()} />
        <button type="button">Después</button>
      </>
    )
    await abrir()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Después' })).toHaveFocus()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('el botón vuelve a cerrar el calendario abierto y se deshabilita con el campo', async () => {
    const { unmount } = montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={vi.fn()} />)
    await abrir()
    await abrir()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()
    montar(<CampoFecha etiqueta="Inicio" deshabilitado valor={null} alCambiar={() => {}} />)
    expect(screen.getByRole('button', { name: ABRIR })).toBeDisabled()
  })

  it.each([
    [
      'es',
      'Elegir Inicio en el calendario',
      'Calendario de Inicio',
      ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
      'Octubre de 2026',
      'martes, 20 de octubre de 2026'
    ],
    [
      'en',
      'Choose Inicio on the calendar',
      'Inicio calendar',
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      'October 2026',
      'Tuesday, October 20, 2026'
    ]
  ])('en %s la semana empieza el lunes y los nombres son del idioma del portal, no del navegador', async (idioma, abrirTexto, nombre, dias, mes, dia) => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue(idioma === 'es' ? 'en-US' : 'es-PE')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([idioma === 'es' ? 'en-US' : 'es-PE'])
    localStorage.setItem('sgspe.lang', idioma)
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: abrirTexto }))
    expect(screen.getByRole('dialog', { name: nombre })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual(dias.map((d) => expect.stringContaining(d)))
    expect(screen.getByText(mes)).toBeInTheDocument()
    expect(celda(dia)).toHaveFocus()
    // el 1 de octubre de 2026 es jueves: la primera fila tiene tres celdas vacías antes
    const primeraFila = screen.getAllByRole('row')[1]
    expect(primeraFila.querySelectorAll('[role="gridcell"]:not([aria-label])')).toHaveLength(3)
  })
})

// los feriados del calendario (wasichai/sgspe#159): GET /api/sgspe/calendar/holidays?year=AAAA. un feriado del mes visible
// lleva una marca que no es solo color y « (feriado)» en el nombre del día; sin respuesta, el calendario es el de siempre
describe('CampoFecha, feriados', () => {
  let fetch: FetchMock | null = null
  afterEach(() => {
    fetch?.restore()
    fetch = null
  })
  const abrir = () => userEvent.click(screen.getByRole('button', { name: /^(Elegir .+ en el calendario|Choose .+ on the calendar)$/ }))
  const celda = (nombre: string) => screen.getByRole('gridcell', { name: nombre })
  const feriados = (holidays: string[]) => ({ year: 2026, configured: true, holidays })

  it('pide los feriados del año visible; en octubre, sin feriados ese mes, no marca nada', async () => {
    fetch = mockFetch([{ path: '/sgspe/calendar/holidays', body: feriados(['2026-01-01', '2026-12-08', '2026-12-25']) }])
    montar(<Controlado etiqueta="Inicio" inicial="2026-10-20" espia={vi.fn()} />)
    await abrir()
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/sgspe/calendar/holidays?year=2026')).toBe(true))
    expect(screen.queryAllByRole('gridcell', { name: / \(feriado\)$/ })).toHaveLength(0)
    expect(screen.queryAllByTestId('feriado')).toHaveLength(0)
  })

  it('en diciembre marca el 8 y el 25 con « (feriado)» en su nombre y una marca visible', async () => {
    fetch = mockFetch([{ path: '/sgspe/calendar/holidays', body: feriados(['2026-01-01', '2026-12-08', '2026-12-25']) }])
    montar(<Controlado etiqueta="Inicio" inicial="2026-12-01" espia={vi.fn()} />)
    await abrir()
    const ocho = await screen.findByRole('gridcell', { name: 'martes, 8 de diciembre de 2026 (feriado)' })
    expect(celda('viernes, 25 de diciembre de 2026 (feriado)')).toBeInTheDocument()
    expect(celda('miércoles, 9 de diciembre de 2026')).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell', { name: / \(feriado\)$/ })).toHaveLength(2)
    expect(screen.getAllByTestId('feriado')).toHaveLength(2)
    expect(ocho).toContainElement(screen.getAllByTestId('feriado')[0])
  })

  it('en inglés el nombre dice « (holiday)»', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    fetch = mockFetch([{ path: '/sgspe/calendar/holidays', body: feriados(['2026-12-25']) }])
    montar(<Controlado etiqueta="Inicio" inicial="2026-12-01" espia={vi.fn()} />)
    await abrir()
    expect(await screen.findByRole('gridcell', { name: /25.* \(holiday\)$/ })).toBeInTheDocument()
  })

  it('si la ruta responde 500, el calendario abre y elige como siempre, sin marcas', async () => {
    fetch = mockFetch([{ path: '/sgspe/calendar/holidays', status: 500, body: { title: 'Error', status: 500 } }])
    const espia = vi.fn()
    montar(<Controlado etiqueta="Inicio" inicial="2026-12-01" espia={espia} />)
    await abrir()
    await waitFor(() => expect(fetch!.calls.some((c) => c.path.startsWith('/sgspe/calendar/holidays'))).toBe(true))
    expect(screen.queryAllByTestId('feriado')).toHaveLength(0)
    await userEvent.click(celda('martes, 8 de diciembre de 2026'))
    expect(ultimo(espia)).toBe('2026-12-08')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('al pasar a otro año pide sus feriados', async () => {
    fetch = mockFetch([{ path: '/sgspe/calendar/holidays', body: feriados([]) }])
    montar(<Controlado etiqueta="Inicio" inicial="2026-12-20" espia={vi.fn()} />)
    await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/sgspe/calendar/holidays?year=2027')).toBe(true))
  })
})
