import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { montar, ubicacion } from '../../test/montar'
import { BarraDeFiltros } from './BarraDeFiltros'
import { FiltroDeLista } from './FiltroDeLista'
import { useParametrosDeLista } from './Lista'

// hallazgo U-22 (DD-04): una barra de filtros común con la búsqueda, hasta tres filtros a la vista, «Más filtros» en un
// drawer, los chips de lo aplicado y «Limpiar filtros». los filtros siguen en la URL

// una lista de prueba que lee y escribe sus filtros en la URL, como las pantallas
function ListaDePrueba({ conTodos = true }: { conTodos?: boolean }) {
  const lista = useParametrosDeLista('abiertos')
  const estado = lista.filtro('state')
  const campana = lista.filtro('campaign')
  const q = lista.filtro('q')
  const aplicados = [
    ...(estado ? [{ clave: 'state', etiqueta: `Estado: ${estado}` }] : []),
    ...(campana ? [{ clave: 'campaign', etiqueta: `Campaña: ${campana}` }] : []),
    ...(q ? [{ clave: 'q', etiqueta: `Contiene «${q}»` }] : [])
  ].map((a) => ({ ...a, alQuitar: () => lista.cambiar({ [a.clave]: null }) }))
  return (
    <BarraDeFiltros
      vista={<p>Selector de vista</p>}
      busqueda={{ etiqueta: 'Buscar', valor: q, alCambiar: (v) => lista.cambiar({ q: v }) }}
      frecuentes={
        <FiltroDeLista
          etiqueta="Estado"
          value={estado}
          onChange={(e) => lista.cambiar({ state: e.target.value })}
          opciones={[
            { valor: 'blocked', etiqueta: 'Bloqueado' },
            { valor: 'closed', etiqueta: 'Cerrado' }
          ]}
        />
      }
      todos={
        conTodos ? (
          <FiltroDeLista
            etiqueta="Campaña"
            value={campana}
            onChange={(e) => lista.cambiar({ campaign: e.target.value })}
            opciones={[{ valor: 'perforacion', etiqueta: 'Perforación 2026' }]}
          />
        ) : undefined
      }
      aplicados={aplicados}
      alLimpiar={() => lista.cambiar({ state: null, campaign: null, q: null })}
    />
  )
}

const enLista = (ruta: string, conTodos = true) => montar(<ListaDePrueba conTodos={conTodos} />, { ruta: `/commitments${ruta}`, camino: '/commitments' })

describe('BarraDeFiltros', () => {
  // 05-especificacion §1.4: lo escrito se ve al instante, pero la búsqueda llega a la URL (y a la consulta) 300 ms después de la
  // última tecla; Enter la manda en el acto. antes se escribía en la URL con cada tecla: esta prueba esperaba la URL al instante
  describe('la búsqueda', () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    })
    // relojes falsos solo para los temporizadores y sin que avancen solos (con shouldAdvanceTime, una prueba lenta vería pasar
    // los 300 ms): la barra no pide nada a la red, sin TanStack Query de por medio. Testing Library solo reconoce los relojes
    // falsos de jest y, sin él, espera un setTimeout que nunca llega: se le da el avance de vitest con ese nombre
    const conReloj = () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
      return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    }

    it('tiene su rótulo, muestra lo escrito al instante y lo escribe en la URL 300 ms después de la última tecla', async () => {
      const usuario = conReloj()
      enLista('?view=vencidos')
      expect(screen.getByText('Selector de vista')).toBeInTheDocument()
      const caja = screen.getByRole('searchbox', { name: 'Buscar' })
      await usuario.type(caja, 'agu')
      act(() => vi.advanceTimersByTime(200))
      await usuario.type(caja, 'a')
      expect(caja).toHaveValue('agua')
      expect(ubicacion.actual).toBe('/commitments?view=vencidos')
      act(() => vi.advanceTimersByTime(299))
      expect(ubicacion.actual).toBe('/commitments?view=vencidos')
      act(() => vi.advanceTimersByTime(1))
      expect(ubicacion.actual).toBe('/commitments?view=vencidos&q=agua')
      expect(caja).toHaveValue('agua')
      // el filtro frecuente está a la vista y escribe en el acto
      await usuario.selectOptions(screen.getByLabelText('Estado'), 'blocked')
      expect(ubicacion.actual).toBe('/commitments?view=vencidos&q=agua&state=blocked')
    })

    it('Enter la manda en el acto, sin esperar', async () => {
      const usuario = conReloj()
      enLista('?view=vencidos')
      await usuario.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'agua{Enter}')
      expect(ubicacion.actual).toBe('/commitments?view=vencidos&q=agua')
      // la espera pendiente ya no vuelve a escribir
      act(() => vi.advanceTimersByTime(1000))
      expect(ubicacion.actual).toBe('/commitments?view=vencidos&q=agua')
    })

    it('varias teclas seguidas son una sola búsqueda', async () => {
      const usuario = conReloj()
      const alCambiar = vi.fn()
      montar(<BarraDeFiltros busqueda={{ etiqueta: 'Buscar', valor: '', alCambiar }} aplicados={[]} />)
      await usuario.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'taller')
      expect(alCambiar).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(300))
      expect(alCambiar).toHaveBeenCalledTimes(1)
      expect(alCambiar).toHaveBeenCalledWith('taller')
    })

    it('si la búsqueda cambia desde fuera (su chip, «Limpiar filtros»), la caja lo refleja', async () => {
      enLista('?view=vencidos&q=agua')
      const caja = screen.getByRole('searchbox', { name: 'Buscar' })
      expect(caja).toHaveValue('agua')
      await userEvent.click(screen.getByRole('button', { name: 'Quitar el filtro Contiene «agua»' }))
      expect(ubicacion.actual).toBe('/commitments?view=vencidos')
      expect(caja).toHaveValue('')
    })
  })

  it('«Más filtros» abre un drawer con los demás filtros', async () => {
    enLista('?view=vencidos')
    expect(screen.queryByLabelText('Campaña')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Más filtros' }))
    const drawer = await screen.findByRole('dialog', { name: 'Más filtros' })
    await userEvent.selectOptions(within(drawer).getByLabelText('Campaña'), 'perforacion')
    expect(ubicacion.actual).toBe('/commitments?view=vencidos&campaign=perforacion')
    // el frecuente ya está en la barra: en «Más filtros» no se repite
    expect(within(drawer).queryByLabelText('Estado')).not.toBeInTheDocument()
  })

  it('sin filtros de más no hay «Más filtros»', () => {
    enLista('', false)
    expect(screen.queryByRole('button', { name: 'Más filtros' })).not.toBeInTheDocument()
  })

  it('un chip por filtro aplicado, con un «×» que dice qué quita', () => {
    enLista('?view=vencidos&state=blocked&campaign=perforacion')
    const chips = screen.getByRole('list', { name: 'Filtros aplicados' })
    expect(
      within(chips)
        .getAllByRole('listitem')
        .map((c) => c.textContent)
    ).toEqual(['Estado: blocked', 'Campaña: perforacion'])
    expect(within(chips).getByRole('button', { name: 'Quitar el filtro Campaña: perforacion' })).toBeInTheDocument()
  })

  it('CA-1.4.1: quitar un chip quita ese parámetro de la URL y no los demás', async () => {
    enLista('?view=vencidos&state=blocked&campaign=perforacion&q=agua')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el filtro Campaña: perforacion' }))
    expect(ubicacion.actual).toBe('/commitments?view=vencidos&state=blocked&q=agua')
    expect(screen.queryByRole('button', { name: 'Quitar el filtro Campaña: perforacion' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar el filtro Estado: blocked' })).toBeInTheDocument()
  })

  it('CA-1.4.2: «Limpiar filtros» deja la URL solo con la vista', async () => {
    enLista('?view=vencidos&state=blocked&campaign=perforacion&q=agua')
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(ubicacion.actual).toBe('/commitments?view=vencidos')
    expect(screen.queryByRole('list', { name: 'Filtros aplicados' })).not.toBeInTheDocument()
  })

  it('sin filtros aplicados no hay fila de chips ni «Limpiar filtros»', () => {
    enLista('?view=vencidos')
    expect(screen.queryByRole('list', { name: 'Filtros aplicados' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
    // en el teléfono, el botón no dice un cero
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeInTheDocument()
  })

  it('CA-1.4.3: en el teléfono, «Filtros (N)» dice cuántos chips hay y su drawer trae los frecuentes y los demás', async () => {
    enLista('?view=vencidos&state=blocked&q=agua')
    const chips = within(screen.getByRole('list', { name: 'Filtros aplicados' })).getAllByRole('listitem')
    const boton = screen.getByRole('button', { name: `Filtros (${chips.length})` })
    expect(boton).toHaveTextContent('Filtros (2)')
    await userEvent.click(boton)
    const drawer = await screen.findByRole('dialog', { name: 'Filtros' })
    expect(within(drawer).getByLabelText('Estado')).toHaveValue('blocked')
    expect(within(drawer).getByLabelText('Campaña')).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Ver resultados' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sin alLimpiar no hay «Limpiar filtros»; sin búsqueda ni filtros, solo la vista', () => {
    const quitar = vi.fn()
    montar(<BarraDeFiltros vista={<p>Selector de vista</p>} aplicados={[{ clave: 'q', etiqueta: 'Contiene «x»', alQuitar: quitar }]} />)
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Filtros/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Más filtros' })).not.toBeInTheDocument()
  })

  it('en inglés', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    try {
      enLista('?state=blocked')
      expect(screen.getByRole('button', { name: 'Remove the filter Estado: blocked' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'More filters' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      expect(ubicacion.actual).toBe('/commitments')
    } finally {
      localStorage.removeItem('sgspe.lang')
    }
  })
})
