import { renderHook, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { UseQueryResult } from '@tanstack/react-query'
import { montar, registro } from '../../test/montar'
import type { Pagina } from '../datos/registros'
import { TablaDeRegistros } from './Lista'
import { ListaEnTarjetas, useEsTelefono } from './ListaEnTarjetas'

// la revisión de UX, etapa 8: en el teléfono, una lista de trabajo es de tarjetas con el título, el estado, el plazo y el proyecto
const original = window.matchMedia
afterEach(() => {
  window.matchMedia = original
})
const conAncho = (telefono: boolean) => {
  window.matchMedia = ((consulta: string) => ({
    matches: telefono,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  })) as unknown as typeof window.matchMedia
}

describe('ListaEnTarjetas', () => {
  it('useEsTelefono sigue la consulta por debajo de sm, y sin matchMedia es falso', () => {
    conAncho(true)
    expect(renderHook(() => useEsTelefono()).result.current).toBe(true)
    conAncho(false)
    expect(renderHook(() => useEsTelefono()).result.current).toBe(false)
    window.matchMedia = undefined as unknown as typeof window.matchMedia
    expect(renderHook(() => useEsTelefono()).result.current).toBe(false)
  })

  it('cada tarjeta dice su título, su estado, su plazo y su proyecto', () => {
    render(
      <ListaEnTarjetas
        etiqueta="Compromisos"
        tarjetas={[
          { id: 'c1', titulo: <a href="/c1">Reservorio</a>, estado: <span>En ejecución</span>, plazo: <span>Vencido</span>, proyecto: 'PRJ-01 · Pukaqaqa' }
        ]}
      />
    )
    const tarjeta = within(screen.getByRole('list', { name: 'Compromisos' })).getByRole('listitem')
    for (const texto of ['Reservorio', 'En ejecución', 'Vencido', 'PRJ-01 · Pukaqaqa']) expect(within(tarjeta).getByText(texto)).toBeInTheDocument()
  })

  it('la tabla común, en el teléfono, dibuja cada fila como tarjeta con la primera columna de título y las demás como datos', () => {
    conAncho(true)
    const consulta = {
      isPending: false,
      isError: false,
      data: { content: [registro('e1', { title: 'Acta firmada', evidence_type: 'ACTA' })], page: 0, size: 1, totalElements: 1, totalPages: 1 }
    } as unknown as UseQueryResult<Pagina>
    montar(
      <TablaDeRegistros
        consulta={consulta}
        etiqueta="Documentos"
        vacio={null}
        alPagina={() => undefined}
        columnas={[
          { id: 'titulo', encabezado: 'Título', celda: (r) => String(r.attributes.title) },
          { id: 'tipo', encabezado: 'Tipo', celda: (r) => String(r.attributes.evidence_type) }
        ]}
      />
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const tarjeta = within(screen.getByRole('list', { name: 'Documentos' })).getByRole('listitem')
    expect(within(tarjeta).getByText('Acta firmada')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Tipo')).toBeInTheDocument()
    expect(within(tarjeta).getByText('ACTA')).toBeInTheDocument()
  })
})
