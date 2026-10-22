import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
