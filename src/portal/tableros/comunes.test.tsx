import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { useIndicador, type Indicador } from '../datos/indicadores'
import { Barras, ConsultaDeTablero, diezYOtros, FiltrosIgnorados, SerieConMeta, useFiltrosDeTablero, useTableroDisponible, Zona } from './comunes'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const indicador = (extra: Partial<Indicador> = {}): Indicador => ({ code: 'KPI-STK-01', label: 'Grupos', available: true, value: 4, ...extra })

function Tablero() {
  const consulta = useIndicador('KPI-STK-01', {})
  return (
    <ConsultaDeTablero consulta={consulta}>
      {(i) => (
        <Zona titulo="Grupos de interés" indicador={i}>
          {(d) => <p>{`valor ${String(d.value)}`}</p>}
        </Zona>
      )}
    </ConsultaDeTablero>
  )
}

describe('Zona y filtros ignorados', () => {
  it('un indicador disponible dice los filtros que no aplica, con el nombre del filtro y no su clave', () => {
    montar(
      <Zona titulo="Grupos" indicador={indicador({ ignoredFilters: ['community', 'explorationCampaign'] })}>
        {(i) => <p>{`valor ${String(i.value)}`}</p>}
      </Zona>
    )
    expect(screen.getByText('valor 4')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Esta cifra no aplica el filtro de comunidad, campaña de exploración')
  })

  it('sin filtros ignorados no dibuja el aviso, y un valor nulo disponible sigue siendo una cifra', () => {
    montar(
      <Zona titulo="Grupos" indicador={indicador({ value: null })}>
        {(i) => <p>{`valor ${String(i.value)}`}</p>}
      </Zona>
    )
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByText('valor null')).toBeInTheDocument()
  })

  it('un indicador no disponible dice su motivo y no dibuja nada más, ni cero', () => {
    montar(
      <Zona
        titulo="Grupos"
        indicador={indicador({ available: false, value: undefined, unavailableReason: 'SINGLE_PROJECT_REQUIRED', ignoredFilters: ['community'] })}
      >
        {() => <p>no debe verse</p>}
      </Zona>
    )
    expect(screen.getByText('Elija un proyecto')).toBeInTheDocument()
    expect(screen.queryByText('no debe verse')).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('un filtro desconocido se dice con su clave', () => {
    montar(<FiltrosIgnorados indicador={indicador({ ignoredFilters: ['nuevo'] })} />)
    expect(screen.getByRole('note')).toHaveTextContent('filtro de nuevo')
  })
})

describe('ConsultaDeTablero', () => {
  it('400 TOO_MANY_RECORDS es el estado "Acote los filtros", no un error de carga', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/dashboards/indicators/KPI-STK-01',
        status: 400,
        body: { title: 'Bad Request', status: 400, detail: 'Demasiados registros', errors: [{ field: 'project', message: 'TOO_MANY_RECORDS' }] }
      }
    ])
    montar(<Tablero />)
    expect(await screen.findByText('Acote los filtros')).toBeInTheDocument()
    expect(screen.queryByText('No se pudo cargar')).toBeNull()
    expect(screen.queryByText(/valor/)).toBeNull()
  })

  it('cualquier otro error sí es un error de carga, con reintento', async () => {
    fetch = mockFetch([{ path: '/sgspe/dashboards/indicators/KPI-STK-01', status: 403, body: { title: 'Forbidden', status: 403, detail: 'x', errors: [] } }])
    montar(<Tablero />)
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('Acote los filtros')).toBeNull()
  })

  it('con datos dibuja la zona', async () => {
    fetch = mockFetch([{ path: '/sgspe/dashboards/indicators/KPI-STK-01', body: indicador() }])
    montar(<Tablero />)
    expect(await screen.findByText('valor 4')).toBeInTheDocument()
  })
})

describe('filtros y catálogo', () => {
  function Filtros() {
    return <pre>{JSON.stringify(useFiltrosDeTablero())}</pre>
  }

  it('los filtros salen del proyecto del contexto, la URL y el chip de territorio', () => {
    montar(<Filtros />, { ruta: '/projects/p1/dashboard?periodStart=2026-01-01&scope=LOCAL&territory=locality:l9' })
    expect(JSON.parse(screen.getByText(/project/).textContent ?? '')).toEqual({ project: ['p1'], periodStart: '2026-01-01', scope: 'LOCAL', locality: 'l9' })
  })

  it('en el alcance global no manda proyecto', () => {
    montar(<Filtros />, { ruta: '/dashboard?territory=area:a1' })
    expect(JSON.parse(screen.getByText(/area/).textContent ?? '')).toEqual({ areaOfInfluence: 'a1' })
  })

  it('un tablero se ofrece si el catálogo trae un indicador suyo disponible', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/dashboards/indicators',
        body: [
          { code: 'KPI-STK-01', label: 'a', dashboard: 'stakeholders', available: false },
          { code: 'KPI-ENG-01', label: 'b', dashboard: 'engagement', available: true }
        ]
      }
    ])
    function Ofrece({ tablero }: { tablero: string }) {
      return <p>{useTableroDisponible(tablero) ? `${tablero} sí` : `${tablero} no`}</p>
    }
    montar(
      <>
        <Ofrece tablero="stakeholders" />
        <Ofrece tablero="engagement" />
      </>
    )
    expect(await screen.findByText('engagement sí')).toBeInTheDocument()
    expect(screen.getByText('stakeholders no')).toBeInTheDocument()
  })
})

describe('diezYOtros, Barras y SerieConMeta', () => {
  it('deja las diez de mayor valor y suma el resto en Otros', () => {
    const filas = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, value: i + 1 }))
    const r = diezYOtros(filas, 'Otros')
    expect(r).toHaveLength(11)
    expect(r[0]).toEqual({ nombre: 'k11', valor: 12 })
    expect(r[10]).toEqual({ nombre: 'Otros', valor: 3 })
  })

  it('con diez o menos no agrupa, usa la etiqueta y trata null como cero', () => {
    expect(diezYOtros([{ key: 'a', label: 'Alfa', value: null }], 'Otros')).toEqual([{ nombre: 'Alfa', valor: 0 }])
  })

  it('Barras escribe su tabla "Ver datos" con el número en formato es-PE', () => {
    montar(<Barras titulo="Por tipo" filas={[{ nombre: 'Taller', valor: 1200 }]} />)
    const tabla = screen.getByRole('table', { name: 'Por tipo' })
    expect(tabla).toHaveTextContent('Taller')
    expect(tabla).toHaveTextContent(/1\D?200/)
  })

  it('SerieConMeta agrega la columna Meta solo si alguna fila trae meta', () => {
    const { unmount } = montar(<SerieConMeta titulo="Reuniones" tipo="bar" serie={[{ period: '2026-09', value: 2 }]} />)
    expect(screen.queryByRole('columnheader', { name: 'Meta' })).toBeNull()
    unmount()
    montar(
      <SerieConMeta
        titulo="Reuniones"
        tipo="bar"
        serie={[
          { period: '2026-09', value: 2, target: 4 },
          { period: '2026-10', value: null, target: null }
        ]}
      />
    )
    expect(screen.getByRole('columnheader', { name: 'Meta' })).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
