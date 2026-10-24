import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { CampoMes } from './CampoMes'

// wasichai/sgspe#136: un campo de mes que muestra y lee el mes en es-PE en los dos idiomas, sea cual sea la configuración
// regional del navegador («Setiembre» y «2026», nunca «September 2026»), con el valor AAAA-MM del campo nativo
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

type Props = Omit<Parameters<typeof CampoMes>[0], 'valor' | 'alCambiar'>
function Controlado({ inicial, espia, ...props }: Props & { inicial: string; espia: (v: string) => void }) {
  const [valor, setValor] = useState(inicial)
  return (
    <CampoMes
      {...props}
      valor={valor}
      alCambiar={(v) => {
        setValor(v)
        espia(v)
      }}
    />
  )
}

const grupo = (etiqueta: string) => screen.getByRole('group', { name: etiqueta })
const opciones = (lista: HTMLElement) =>
  within(lista)
    .getAllByRole('option')
    .map((o) => o.textContent)

describe('CampoMes', () => {
  it.each([
    ['es', 'Mes', 'Año'],
    ['en', 'Month', 'Year']
  ])('con el navegador en en-US, en %s muestra el mes por su nombre es-PE y el año', (idioma, mes, anio) => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    localStorage.setItem('sgspe.lang', idioma)
    montar(<CampoMes etiqueta="Periodo" valor="2026-09" alCambiar={() => {}} />)
    const meses = within(grupo('Periodo')).getByRole('combobox', { name: mes })
    expect(meses).toHaveDisplayValue('Setiembre')
    expect(within(grupo('Periodo')).getByRole('combobox', { name: anio })).toHaveDisplayValue('2026')
    expect(opciones(meses)).toEqual([
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Setiembre',
      'Octubre',
      'Noviembre',
      'Diciembre'
    ])
    expect(screen.queryByText(/September/)).not.toBeInTheDocument()
  })

  it('elegir el mes o el año avisa el mes AAAA-MM', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Periodo" inicial="2026-09" espia={espia} />)
    await userEvent.selectOptions(within(grupo('Periodo')).getByRole('combobox', { name: 'Mes' }), 'Marzo')
    expect(espia).toHaveBeenLastCalledWith('2026-03')
    await userEvent.selectOptions(within(grupo('Periodo')).getByRole('combobox', { name: 'Año' }), '2024')
    expect(espia).toHaveBeenLastCalledWith('2024-03')
    expect(within(grupo('Periodo')).getByRole('combobox', { name: 'Mes' })).toHaveDisplayValue('Marzo')
  })

  it('sin min ni max ofrece los diez años anteriores y el siguiente al de hoy en Lima', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T15:00:00Z'))
    montar(<CampoMes etiqueta="Periodo" valor="2026-09" alCambiar={() => {}} />)
    const anios = opciones(within(grupo('Periodo')).getByRole('combobox', { name: 'Año' }))
    expect(anios[0]).toBe('2016')
    expect(anios.at(-1)).toBe('2027')
  })

  it('con min y max ofrece solo sus años, apaga los meses de fuera y ajusta el mes al cambiar de año', async () => {
    const espia = vi.fn()
    montar(<Controlado etiqueta="Periodo" inicial="2025-02" min="2024-06" max="2025-03" espia={espia} />)
    const meses = within(grupo('Periodo')).getByRole('combobox', { name: 'Mes' })
    const anios = within(grupo('Periodo')).getByRole('combobox', { name: 'Año' })
    expect(opciones(anios)).toEqual(['2024', '2025'])
    expect(within(meses).getByRole('option', { name: 'Marzo' })).toBeEnabled()
    expect(within(meses).getByRole('option', { name: 'Abril' })).toBeDisabled()
    await userEvent.selectOptions(anios, '2024')
    // febrero de 2024 es anterior al mínimo: vale junio de 2024
    expect(espia).toHaveBeenLastCalledWith('2024-06')
    expect(meses).toHaveDisplayValue('Junio')
    expect(within(meses).getByRole('option', { name: 'Mayo' })).toBeDisabled()
  })

  it('deshabilitado no deja elegir', () => {
    montar(<CampoMes etiqueta="Periodo" valor="2026-09" alCambiar={() => {}} deshabilitado />)
    expect(within(grupo('Periodo')).getByRole('combobox', { name: 'Mes' })).toBeDisabled()
    expect(within(grupo('Periodo')).getByRole('combobox', { name: 'Año' })).toBeDisabled()
  })
})
