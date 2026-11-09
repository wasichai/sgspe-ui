import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeF8, EJECUTIVA, SOLO_LECTURA_F8, TABLERO_EJECUTIVO } from '../../test/f8'
import { montar } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { espiarRed, problema, type Red } from '../../test/red'
import { opcionesRecibidas } from '../../test/graficoFalso'
import { RevisionEjecutivaPage } from './RevisionEjecutivaPage'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

// S51 (screens.md, dashboards.md §5.1): el tablero executive en una sola llamada, la atención por regla fija, las tiles, la
// inversión por moneda, la tendencia en tres gráficos y la tabla por proyecto con su tope
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const abrir = (tablero: unknown = TABLERO_EJECUTIVO, ruta = '/') => {
  fetch = mockFetch([{ path: '/sgspe/dashboards/executive', body: tablero }, ...baseDeF8(EJECUTIVA)])
  red = espiarRed()
  montar(<RevisionEjecutivaPage />, { ruta, usuario: EJECUTIVA, permisos: SOLO_LECTURA_F8 })
}

describe('S51 · revisión ejecutiva', () => {
  // 4.8 (P-07, U-11) y S03: lo crítico es una lista corta, cada fila con el código del proyecto, el asunto con su cifra, el proyecto
  // y el módulo donde se atiende, en el orden de la regla fija
  it('dice qué es crítico en una lista corta por regla fija, las tiles y que la postura no se muestra', async () => {
    abrir()
    const critico = await screen.findByRole('region', { name: 'Qué es crítico y dónde se atiende' })
    const filas = within(critico).getAllByRole('listitem')
    expect(
      filas.map((f) => [f.querySelector('.font-sg-mono')?.textContent, f.querySelector('p')?.textContent, within(f).getByRole('link').textContent])
    ).toEqual([
      ['PRJ-01', '2 alertas activas', 'Alerta temprana'],
      ['PRJ-01', '1 riesgo alto o crítico', 'Gestión de riesgos'],
      ['PRJ-01', '3 compromisos vencidos', 'Compromisos'],
      ['PRJ-02', '3 QCS abiertas', 'QCS · Atención'],
      ['PRJ-01', '1 QCS abierta', 'QCS · Atención']
    ])
    expect(filas[3]).toHaveTextContent('Proyecto Ejemplo B')
    // lo vencido lleva su situación
    expect(within(filas[2]).getByLabelText('Situación de plazo: Vencido')).toBeInTheDocument()
    expect(within(filas[0]).getByRole('link', { name: 'Alertas activas · Proyecto Ejemplo A' })).toHaveAttribute(
      'href',
      '/projects/p1/risks/warnings?view=activas'
    )
    const tiles = screen.getByRole('region', { name: 'Indicadores de la cartera' })
    expect(within(within(tiles).getByRole('region', { name: 'Proyectos activos' })).getByText('2')).toBeInTheDocument()
    expect(within(within(tiles).getByRole('region', { name: 'Alertas activas' })).getByText('2')).toBeInTheDocument()
    const postura = within(tiles).getByRole('region', { name: 'Postura de los grupos de interés' })
    expect(within(postura).getByText('No disponible')).toBeInTheDocument()
    // S03: ocho celdas en dos filas de cuatro, cada cifra con su código
    expect(within(tiles).getAllByRole('region')).toHaveLength(8)
    expect(within(within(tiles).getByRole('region', { name: 'Proyectos activos' })).getByText('KPI-EXE-01')).toHaveClass('font-sg-mono')
    expect(red!.a('GET', '/sgspe/dashboards/executive')).toHaveLength(1)
  })

  // U-11: la página abre con las cifras, no con los filtros; S03: el periodo es el título y la hora de cálculo va bajo él, con lo que
  // abarca (préstamo de D, U-23); el periodo se elige en un selector
  it('abre con el periodo y la fecha de cálculo bajo el título y los filtros plegados', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T18:00:00Z'))
    try {
      abrir()
      expect(await screen.findByRole('heading', { level: 1, name: 'Octubre de 2026' })).toBeInTheDocument()
      expect(screen.getByText('Revisión ejecutiva')).toBeInTheDocument()
      expect(await screen.findByText('Calculado hoy 10:00 con los datos de todos sus proyectos')).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Periodo' })).toHaveDisplayValue('Octubre de 2026')
      expect(screen.queryByRole('group', { name: 'Filtros del tablero' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Desde')).not.toBeInTheDocument()
      expect(screen.queryByText(/más de 24 horas/)).not.toBeInTheDocument()
      const cambiar = screen.getByRole('button', { name: 'Cambiar el periodo y los filtros' })
      expect(cambiar).toHaveAttribute('aria-expanded', 'false')
      await userEvent.click(cambiar)
      expect(cambiar).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('group', { name: 'Filtros del tablero' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  // U-07: las fechas del periodo se escriben dd/mm/aaaa y viajan como hoy, ?periodStart= y ?periodEnd=
  it('el periodo se escribe dd/mm/aaaa y se pide con periodStart y periodEnd; un mes entero se dice por su nombre', async () => {
    abrir(TABLERO_EJECUTIVO, '/?periodEnd=2026-09-30')
    await screen.findByRole('table', { name: 'Por proyecto' })
    expect(screen.getByRole('heading', { level: 1, name: 'Hasta el 30 set. 2026' })).toBeInTheDocument()
    // el selector dice que el periodo no es un mes entero
    expect(screen.getByRole('combobox', { name: 'Periodo' })).toHaveDisplayValue('Otro periodo: Hasta el 30 set. 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar el periodo y los filtros' }))
    expect(screen.getByLabelText('Hasta')).toHaveValue('30/09/2026')
    const desde = screen.getByLabelText('Desde')
    expect(desde).toHaveAttribute('placeholder', 'dd/mm/aaaa')
    await userEvent.type(desde, '01/09/2026')
    await waitFor(() =>
      expect(
        red!.a('GET', '/sgspe/dashboards/executive').some((l) => l.ruta.includes('periodStart=2026-09-01') && l.ruta.includes('periodEnd=2026-09-30'))
      ).toBe(true)
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Setiembre de 2026' })).toBeInTheDocument()
  })

  // S03: el periodo como selector de los últimos doce meses; el mes en curso es sin fechas (dashboards.md §3.1)
  it('elegir un mes en el selector pide ese mes entero, y el mes en curso vuelve a pedir sin fechas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T18:00:00Z'))
    try {
      abrir()
      const periodo = await screen.findByRole('combobox', { name: 'Periodo' })
      expect(within(periodo).getAllByRole('option')).toHaveLength(12)
      await userEvent.selectOptions(periodo, 'Agosto de 2026')
      await waitFor(() =>
        expect(
          red!.a('GET', '/sgspe/dashboards/executive').some((l) => l.ruta.includes('periodStart=2026-08-01') && l.ruta.includes('periodEnd=2026-08-31'))
        ).toBe(true)
      )
      expect(await screen.findByRole('heading', { level: 1, name: 'Agosto de 2026' })).toBeInTheDocument()
      await userEvent.selectOptions(periodo, 'Octubre de 2026')
      expect(await screen.findByRole('heading', { level: 1, name: 'Octubre de 2026' })).toBeInTheDocument()
      // el mes en curso es la lectura sin fechas: la misma que abrió la página, ya en caché
      expect(periodo).toHaveDisplayValue('Octubre de 2026')
    } finally {
      vi.useRealTimers()
    }
  })

  // U-23: un cálculo de más de 24 horas se dice, con la forma de rehacerlo
  it('un cálculo de más de 24 horas lo dice y ofrece actualizar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-18T15:00:00Z'))
    try {
      abrir()
      expect(await screen.findByText('Calculado el 16 oct. 2026 a las 10:00 con los datos de todos sus proyectos')).toBeInTheDocument()
      expect(screen.getByRole('note', { name: 'Cálculo antiguo' })).toHaveTextContent('Estas cifras se calcularon hace más de 24 horas')
      await userEvent.click(screen.getByRole('button', { name: 'Actualizar ahora' }))
      await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/executive')).toHaveLength(2))
    } finally {
      vi.useRealTimers()
    }
  })

  // P-07 (u): toda cifra lleva su periodo y su fecha de cálculo, también la tendencia, que es de 12 meses
  it('cada zona de cifras dice su periodo y su fecha de cálculo', async () => {
    // el periodo por omisión es el mes de hoy: se fija el día del cálculo para que la prueba no dependa de la fecha de la corrida
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T18:00:00Z'))
    try {
      abrir()
      await screen.findByRole('table', { name: 'Por proyecto' })
      // las cifras de arriba van bajo el encabezado, que dice el periodo (el título) y la hora de cálculo
      expect(screen.getByRole('heading', { level: 1, name: 'Octubre de 2026' })).toBeInTheDocument()
      expect(screen.getByText('Calculado hoy 10:00 con los datos de todos sus proyectos')).toBeInTheDocument()
      for (const zona of ['Qué es crítico y dónde se atiende', 'Inversión ejecutada frente a presupuesto y topes', 'Por proyecto'])
        expect(within(screen.getByRole('region', { name: zona })).getByText(/^Octubre de 2026 · calculado (hace|el) /)).toBeInTheDocument()
      const tendencia = screen.getByRole('region', { name: 'Tendencia de 12 meses' })
      expect(within(tendencia).getByText(/^set\. 2026 a oct\. 2026 · calculado (hace|el) /)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  // una cifra no disponible no ocupa el centro: las disponibles van primero
  it('las cifras no disponibles van al final, después de las disponibles', async () => {
    const sinAbiertos = {
      ...TABLERO_EJECUTIVO,
      indicators: TABLERO_EJECUTIVO.indicators.map((i) =>
        i.code === 'KPI-COM-02' || i.code === 'KPI-INV-03' ? { code: i.code, label: i.label, available: false, unavailableReason: 'FIELD_NOT_READABLE' } : i
      )
    }
    abrir(sinAbiertos)
    const tiles = await screen.findByRole('region', { name: 'Indicadores de la cartera' })
    const nombres = within(tiles)
      .getAllByRole('region')
      .map((r) => r.getAttribute('aria-label'))
    // tercera pasada de UX, 3.11: cada tile se nombra con el diccionario de cifras, el mismo del resto del portal, y no con el
    // rótulo que trae el servidor («Quejas abiertas» en el fixture)
    expect(nombres).toEqual([
      'Proyectos activos',
      'Compromisos vencidos',
      'QCS abiertas',
      'Riesgos altos',
      'Interacciones realizadas',
      'Alertas activas',
      'Compromisos abiertos',
      'Postura de los grupos de interés'
    ])
    const zonas = screen
      .getAllByRole('region')
      // el nombre de una Seccion con título sale de su encabezado (aria-labelledby), el de las demás de aria-label
      .map((r) => r.getAttribute('aria-label') ?? document.getElementById(r.getAttribute('aria-labelledby') ?? '')?.textContent)
    expect(zonas.indexOf('Tendencia de 12 meses')).toBeLessThan(zonas.indexOf('Inversión ejecutada frente a presupuesto y topes'))
  })

  // tercera pasada de UX, 4.1: cada tile que tiene una lista que cuenta lo mismo la enlaza, ya filtrada; con varios proyectos
  // elegidos, que la lista no aplica, no se enlaza
  it('las tiles llevan a su lista filtrada, salvo con varios proyectos elegidos o sin una lista que cuente lo mismo', async () => {
    abrir()
    const tiles = await screen.findByRole('region', { name: 'Indicadores de la cartera' })
    expect(within(tiles).getByRole('link', { name: 'Compromisos vencidos: 3' })).toHaveAttribute('href', '/commitments?view=vencidos')
    expect(within(tiles).getByRole('link', { name: 'Riesgos altos: 1' })).toHaveAttribute('href', '/risks/register?level=alto')
    expect(within(tiles).getByRole('link', { name: /^Proyectos activos: / })).toHaveAttribute('href', '/projects?view=active')
    // la lista de interacciones no filtra por periodo ni por realizadas: la cifra no se enlaza
    expect(within(within(tiles).getByRole('region', { name: 'Interacciones realizadas' })).queryByRole('link')).not.toBeInTheDocument()
  })

  it('con varios proyectos elegidos las tiles no se enlazan', async () => {
    abrir(TABLERO_EJECUTIVO, '/?project=p1&project=p2')
    const tiles = await screen.findByRole('region', { name: 'Indicadores de la cartera' })
    await within(tiles).findByRole('region', { name: 'Compromisos vencidos' })
    expect(within(tiles).queryAllByRole('link')).toHaveLength(0)
  })

  // una cifra de QCS con confidenciales ocultas lo dice, sin contarlas
  it('la tile de quejas con confidenciales ocultas lleva su nota', async () => {
    abrir({
      ...TABLERO_EJECUTIVO,
      indicators: TABLERO_EJECUTIVO.indicators.map((i) => (i.code === 'KPI-GRV-02' ? { ...i, confidentialHidden: true } : i))
    })
    const tiles = await screen.findByRole('region', { name: 'Indicadores de la cartera' })
    expect(within(within(tiles).getByRole('region', { name: 'QCS abiertas' })).getByRole('note')).toBeInTheDocument()
    expect(within(within(tiles).getByRole('region', { name: 'Proyectos activos' })).queryByRole('note')).not.toBeInTheDocument()
  })

  // P-07 (i): barras sólidas, sin trama; una medida por gráfico y una columna por medida en la tabla por proyecto
  it('la tendencia dibuja los flujos en barras y el saldo en línea, sin trama ni dos medidas en un eje', async () => {
    abrir()
    await screen.findByRole('region', { name: 'Tendencia de 12 meses' })
    const tipos = (etiqueta: string) =>
      ((opcionesRecibidas.get(etiqueta) as { series: { type: string; decal?: unknown }[] }).series ?? []).map((s) => [s.type, s.decal])
    expect(tipos('Interacciones realizadas')).toEqual([['bar', undefined]])
    expect(tipos('Quejas recibidas y cerradas')).toEqual([
      ['bar', undefined],
      ['bar', undefined]
    ])
    expect(tipos('Compromisos vencidos al cierre del mes')).toEqual([['line', undefined]])
    for (const etiqueta of ['Interacciones realizadas', 'Quejas recibidas y cerradas', 'Compromisos vencidos al cierre del mes'])
      expect(JSON.stringify(opcionesRecibidas.get(etiqueta))).not.toMatch(/decal|pattern/)
    const tabla = screen.getByRole('table', { name: 'Por proyecto' })
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual([
      'Proyecto',
      'Proyectos activos',
      'Compromisos abiertos',
      'Compromisos vencidos',
      'QCS abiertas',
      'Riesgos altos',
      'Interacciones realizadas',
      'Alertas activas',
      'Inversión social ejecutada'
    ])
  })

  it('la inversión se dice por moneda, sin sumar monedas, y la tendencia en tres gráficos', async () => {
    abrir()
    const inversion = await screen.findByRole('region', { name: 'Inversión ejecutada frente a presupuesto y topes' })
    const pen = within(inversion).getByRole('group', { name: 'PEN' })
    expect(within(pen).getByText('S/ 15,000.00 de S/ 40,000.00')).toBeInTheDocument()
    expect(within(pen).getByText('37.5 %')).toBeInTheDocument()
    expect(within(pen).getByText('Topes de campaña: S/ 50,000.00')).toBeInTheDocument()
    expect(within(pen).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37.5')
    const usd = within(inversion).getByRole('group', { name: 'USD' })
    expect(within(usd).getByText(/500\.00/)).toBeInTheDocument()
    expect(within(usd).getByText(/500\.00 de —$/)).toBeInTheDocument()
    // la nota al pie (préstamo de C): las monedas no se suman, y qué es «—»
    expect(within(inversion).getByText(/^Las monedas no se suman/)).toHaveTextContent('— = sin presupuesto registrado.')
    const tendencia = screen.getByRole('region', { name: 'Tendencia de 12 meses' })
    expect(within(tendencia).getByRole('table', { name: 'Interacciones realizadas' })).toHaveTextContent('oct. 2026')
    expect(within(tendencia).getByRole('table', { name: 'Quejas recibidas y cerradas' })).toHaveTextContent('Cerradas')
    expect(within(tendencia).getByRole('table', { name: 'Compromisos vencidos al cierre del mes' })).toHaveTextContent('3')
  })

  it('la tabla por proyecto enlaza cada proyecto y dice no disponible donde la cuenta no lee; omitida, lo explica', async () => {
    abrir()
    const tabla = await screen.findByRole('table', { name: 'Por proyecto' })
    expect(within(tabla).getByRole('link', { name: 'PRJ-01 · Proyecto Ejemplo A' })).toHaveAttribute('href', '/projects/p1/overview')
    expect(within(tabla).getAllByText('No disponible')).toHaveLength(2)
    fetch!.restore()
    red!.restaurar()
    document.body.innerHTML = ''
    abrir({ ...TABLERO_EJECUTIVO, byProject: undefined, byProjectOmitted: true })
    expect(await screen.findByText('Tiene más de 25 proyectos: elija hasta 25 para ver la tabla por proyecto.')).toBeInTheDocument()
  })

  it('elegir proyectos pide el tablero con ellos; pasarse del tope pide acotar los filtros', async () => {
    abrir()
    await screen.findByRole('table', { name: 'Por proyecto' })
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar el periodo y los filtros' }))
    await userEvent.click(screen.getByText('Proyectos que compara la tabla «Por proyecto»: todos sus proyectos'))
    await userEvent.click(screen.getByRole('checkbox', { name: 'PRJ-02 · Proyecto Ejemplo B' }))
    await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/executive').some((l) => l.ruta.includes('project=p2'))).toBe(true))
    expect(screen.getByText('Proyectos que compara la tabla «Por proyecto»: 1 elegido')).toBeInTheDocument()
    fetch!.restore()
    red!.restaurar()
    document.body.innerHTML = ''
    fetch = mockFetch(baseDeF8(EJECUTIVA))
    red = espiarRed([{ path: '/sgspe/dashboards/executive', responder: () => problema(400, 'x', [{ field: 'project', message: 'TOO_MANY_RECORDS' }]) }])
    montar(<RevisionEjecutivaPage />, { usuario: EJECUTIVA, permisos: SOLO_LECTURA_F8 })
    expect(await screen.findByText('Acote los filtros')).toBeInTheDocument()
  })

  it('sin proyectos asignados dice que no tiene y lleva a Proyectos', async () => {
    abrir({ ...TABLERO_EJECUTIVO, filters: { project: [] }, byProject: [] })
    expect(await screen.findByText('No tiene proyectos asignados.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Proyectos' })).toHaveAttribute('href', '/projects')
  })

  // desde el rediseño de UX (DD-01) S51 vive en /dashboards/executive y el inicio es «Mi día», con la visión ejecutiva
  it('/dashboards/executive dibuja la revisión ejecutiva', async () => {
    fetch = abrirPortal('/dashboards/executive', EJECUTIVA, SOLO_LECTURA_F8, [
      { path: '/sgspe/dashboards/executive', body: TABLERO_EJECUTIVO },
      ...baseDeF8(EJECUTIVA)
    ])
    // S03: «Revisión ejecutiva» es la sobrelínea y el nombre del documento; el título es el periodo
    expect(await screen.findByRole('heading', { level: 1, name: /^[A-Z][a-z]+ de \d{4}$/ })).toBeInTheDocument()
    expect(screen.getByText('Revisión ejecutiva', { selector: 'main p' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toMatch(/^Revisión ejecutiva/))
    expect(screen.getByRole('link', { name: 'Monitoreo del plan de relaciones comunitarias' })).toHaveAttribute('href', '/dashboards/monitoring')
  })

  it('/ ya no es la revisión ejecutiva aunque el catálogo la ofrezca: es «Mi día» con su visión ejecutiva', async () => {
    fetch = abrirPortal('/', EJECUTIVA, SOLO_LECTURA_F8, [{ path: '/sgspe/dashboards/executive', body: TABLERO_EJECUTIVO }, ...baseDeF8(EJECUTIVA)])
    expect(await screen.findByRole('heading', { level: 1, name: /^Buen(os|as) (días|tardes|noches), / })).toBeInTheDocument()
    expect(screen.queryByText('Revisión ejecutiva', { selector: 'main p' })).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Ver la revisión ejecutiva' })).toHaveAttribute('href', '/dashboards/executive')
  })
})
