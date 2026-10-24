import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { AtajosDePeriodo, periodoDelAtajo } from './AtajosDePeriodo'
import { CampoFecha } from './CampoFecha'

// design-system.md §5 (DatePicker y DateRangePicker): los atajos llenan «Desde» y «Hasta» según el día de hoy en Lima, con relojes
// falsos solo para Date
beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

function Periodo({ espia }: { espia: (p: { desde: string; hasta: string }) => void }) {
  const [desde, setDesde] = useState<string | null>(null)
  const [hasta, setHasta] = useState<string | null>(null)
  return (
    <>
      <CampoFecha etiqueta="Desde" valor={desde} alCambiar={setDesde} />
      <CampoFecha etiqueta="Hasta" valor={hasta} alCambiar={setHasta} />
      <AtajosDePeriodo
        desde={desde}
        hasta={hasta}
        alElegir={(p) => {
          setDesde(p.desde)
          setHasta(p.hasta)
          espia(p)
        }}
      />
    </>
  )
}

describe('periodoDelAtajo', () => {
  it('cuenta desde el día de hoy dado: el mes y el año en curso terminan hoy, los pasados son completos', () => {
    expect(periodoDelAtajo('esteMes', '2026-10-23')).toEqual({ desde: '2026-10-01', hasta: '2026-10-23' })
    expect(periodoDelAtajo('mesPasado', '2026-10-23')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
    expect(periodoDelAtajo('ultimos30', '2026-10-23')).toEqual({ desde: '2026-09-24', hasta: '2026-10-23' })
    expect(periodoDelAtajo('esteAno', '2026-10-23')).toEqual({ desde: '2026-01-01', hasta: '2026-10-23' })
    expect(periodoDelAtajo('anoPasado', '2026-10-23')).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' })
  })

  it('cruza el año en enero y respeta febrero y los bisiestos', () => {
    expect(periodoDelAtajo('mesPasado', '2027-01-05')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' })
    expect(periodoDelAtajo('ultimos30', '2027-01-05')).toEqual({ desde: '2026-12-07', hasta: '2027-01-05' })
    expect(periodoDelAtajo('mesPasado', '2028-03-10')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
    expect(periodoDelAtajo('ultimos30', '2026-03-01')).toEqual({ desde: '2026-01-31', hasta: '2026-03-01' })
  })
})

describe('AtajosDePeriodo', () => {
  it('llena las dos fechas con el día de Lima, no el de UTC, y marca con aria-pressed el atajo del periodo actual', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // las 21:00 de Lima del 31 de octubre: en UTC ya es 1 de noviembre, pero «Este mes» es octubre
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z'))
    const espia = vi.fn()
    montar(<Periodo espia={espia} />)
    const grupo = screen.getByRole('group', { name: 'Atajos de periodo' })
    const botones = within(grupo).getAllByRole('button')
    expect(botones.map((b) => b.textContent)).toEqual(['Este mes', 'Mes pasado', 'Últimos 30 días', 'Este año', 'Año pasado'])
    for (const b of botones) expect(b).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(within(grupo).getByRole('button', { name: 'Este mes' }))
    expect(espia).toHaveBeenLastCalledWith({ desde: '2026-10-01', hasta: '2026-10-31' })
    expect(screen.getByRole('textbox', { name: 'Desde' })).toHaveValue('01/10/2026')
    expect(screen.getByRole('textbox', { name: 'Hasta' })).toHaveValue('31/10/2026')
    expect(within(grupo).getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true')
    // el 1 al 31 de octubre es a la vez «Este mes» y, ese día, nada más
    expect(within(grupo).getByRole('button', { name: 'Mes pasado' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(within(grupo).getByRole('button', { name: 'Año pasado' }))
    expect(screen.getByRole('textbox', { name: 'Desde' })).toHaveValue('01/01/2025')
    expect(screen.getByRole('textbox', { name: 'Hasta' })).toHaveValue('31/12/2025')
    expect(within(grupo).getByRole('button', { name: 'Año pasado' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(grupo).getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('un periodo escrito a mano que coincide con un atajo lo marca; uno que no, ninguno', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T15:00:00Z'))
    montar(<Periodo espia={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Desde' }), '01/09/2026')
    await userEvent.type(screen.getByRole('textbox', { name: 'Hasta' }), '30/09/2026')
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Mes pasado' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.clear(screen.getByRole('textbox', { name: 'Hasta' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Hasta' }), '29/09/2026')
    await userEvent.tab()
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('ningún nombre accesible de los atajos dice «Desde» ni «Hasta», para que getByLabel de los campos no sea ambiguo', () => {
    montar(<Periodo espia={vi.fn()} />)
    expect(screen.getAllByLabelText('Desde', { exact: true })).toHaveLength(1)
    expect(screen.getAllByLabelText('Hasta', { exact: true })).toHaveLength(1)
    for (const b of within(screen.getByRole('group', { name: 'Atajos de periodo' })).getAllByRole('button')) expect(b).not.toHaveAccessibleName(/Desde|Hasta/)
  })
})
