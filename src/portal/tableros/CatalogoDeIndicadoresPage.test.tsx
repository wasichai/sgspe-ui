import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeF8, CIERRE, EJECUTIVA, INDICADORES_DEL_CATALOGO, SOLO_LECTURA_F8 } from '../../test/f8'
import { montar, pagina } from '../../test/montar'
import { GERENCIA_SOCIAL } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { CatalogoDeIndicadoresPage } from './CatalogoDeIndicadoresPage'

// el catálogo indicator (dashboards.md §10): la meta y la frecuencia se editan con If-Match; la meta es un decimal sin signo
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const ENG02 = INDICADORES_DEL_CATALOGO[2]
const abrir = (usuario = GERENCIA_SOCIAL, permisos = CIERRE) => {
  fetch = mockFetch([
    { path: '/objects/indicator/records', body: pagina(INDICADORES_DEL_CATALOGO) },
    { path: '/objects/indicator/records/i-eng02', body: { ...ENG02, attributes: { ...ENG02.attributes, target_value: 3, frequency: 'Semanal' } } },
    ...baseDeF8(usuario)
  ])
  red = espiarRed([{ method: 'PUT', path: '/objects/indicator/records/i-eng02', responder: () => jsonResponse(ENG02) }])
  montar(<CatalogoDeIndicadoresPage />, { usuario, permisos })
}

describe('Catálogo de indicadores', () => {
  it('lista los indicadores con su meta, o «Sin meta»', async () => {
    abrir()
    const tabla = await screen.findByRole('table', { name: 'Catálogo de indicadores' })
    const fila = within(tabla).getByText('KPI-ENG-02').closest('tr')!
    expect(within(fila).getByText('2')).toBeInTheDocument()
    expect(within(within(tabla).getByText('KPI-STK-04').closest('tr')!).getByText('Sin meta')).toBeInTheDocument()
  })

  it('edita la meta y la frecuencia con la versión leída', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar la meta de Reuniones sostenidas al mes' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.clear(within(dialogo).getByLabelText('Meta'))
    await userEvent.type(within(dialogo).getByLabelText('Meta'), '3')
    await userEvent.clear(within(dialogo).getByLabelText('Frecuencia'))
    await userEvent.type(within(dialogo).getByLabelText('Frecuencia'), 'Semanal')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Meta guardada.')).toBeInTheDocument()
    const [cambio] = red!.a('PUT', '/objects/indicator/records/i-eng02')
    expect(cambio.cuerpo).toMatchObject({ attributes: { code: 'KPI-ENG-02', target_value: '3', frequency: 'Semanal' } })
    expect(cambio.cabeceras.get('If-Match')).toBe('"2026-10-05T15:00:00Z"')
  })

  it('una meta que no es un número no se envía; vacía, quita la meta', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar la meta de Reuniones sostenidas al mes' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.clear(within(dialogo).getByLabelText('Meta'))
    await userEvent.type(within(dialogo).getByLabelText('Meta'), '-2')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(within(dialogo).getByText('Escriba un número sin signo, con hasta 4 decimales.')).toBeInTheDocument()
    expect(red!.a('PUT', '/objects/indicator/records/i-eng02')).toHaveLength(0)
    await userEvent.clear(within(dialogo).getByLabelText('Meta'))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Meta guardada.')).toBeInTheDocument()
    expect(red!.a('PUT', '/objects/indicator/records/i-eng02')[0].cuerpo).toMatchObject({ attributes: { target_value: null } })
  })

  it('sin UPDATE no ofrece editar', async () => {
    abrir(EJECUTIVA, SOLO_LECTURA_F8)
    await screen.findByRole('table', { name: 'Catálogo de indicadores' })
    expect(screen.queryByRole('button', { name: /Editar la meta/ })).not.toBeInTheDocument()
  })
})
