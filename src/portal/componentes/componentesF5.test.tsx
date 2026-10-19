import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { P1 } from '../../test/compromisos'
import { selectNativo } from '../../test/formulario'
import { DEF_ITEM, EQUIPO_DE_INVERSION, INVERSION, ITEM_BIEN, WF_APORTE, WF_PROGRAMA } from '../../test/inversion'
import { montar, pagina, registro } from '../../test/montar'
import { aparienciaDe } from './apariencias'
import { EstadoChip } from './EstadoChip'
import { RegistrosSimples } from './RegistrosSimples'

// las piezas comunes de F5: los estados de WF-G y WF-P con tono e ícono, nunca solo color (design-system.md §4.1)
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('piezas comunes de F5', () => {
  it('los estados de un aporte y de un programa llevan la etiqueta de su workflow', async () => {
    fetch = mockFetch([
      { path: '/objects/social_contribution/workflow', body: WF_APORTE },
      { path: '/objects/social_program/workflow', body: WF_PROGRAMA }
    ])
    montar(
      <>
        <EstadoChip objeto="social_contribution" estado="procured" />
        <EstadoChip objeto="social_program" estado="monitoring" />
      </>
    )
    expect(await screen.findByText('Adquirido')).toBeInTheDocument()
    expect(await screen.findByText('En monitoreo')).toBeInTheDocument()
  })

  it.each([
    ['social_contribution', 'requested', 'neutral'],
    ['social_contribution', 'procured', 'progress'],
    ['social_contribution', 'delivered', 'success'],
    ['social_contribution', 'rejected', 'final'],
    ['social_program', 'pending_approval', 'info'],
    ['social_program', 'executing', 'progress'],
    ['social_program', 'suspended', 'warning'],
    ['social_program', 'cancelled', 'final']
  ])('%s · %s tiene el tono %s', (objeto, estado, tono) => {
    expect(aparienciaDe(objeto, estado).tono).toBe(tono)
  })
})

describe('apariencia de los estados de F7 y F8', () => {
  it.each([
    ['deliverable', 'draft', 'neutral', 'CircleDashed'],
    ['deliverable', 'in_review', 'info', 'Clock'],
    ['deliverable', 'observed', 'warning', 'Eye'],
    ['deliverable', 'approved', 'success', 'CircleCheck'],
    ['deliverable', 'issued', 'success', 'BadgeCheck'],
    ['deliverable', 'voided', 'final', 'X'],
    ['ai_suggestion', 'proposed', 'info', 'Inbox'],
    ['ai_suggestion', 'accepted', 'success', 'CircleCheck'],
    ['ai_suggestion', 'rejected', 'final', 'X'],
    ['ai_suggestion', 'duplicate', 'final', 'Copy']
  ])('%s · %s tiene el tono %s y el ícono %s', (objeto, estado, tono, icono) => {
    const apariencia = aparienciaDe(objeto, estado)
    expect(apariencia.tono).toBe(tono)
    expect(apariencia.Icono.displayName).toBe(icono)
  })

  it('un estado que no conoce no lleva el ícono de prohibido', () => {
    expect(aparienciaDe('inventado', 'x').Icono.displayName).toBe('CircleDashed')
  })
})

// F5: una lista hija que ya no cambia (los ítems de un aporte aprobado) lo dice y no ofrece escribir; lo que la pantalla deja viejo
// tras escribir (el total del aporte, la consulta en seco) se avisa con alCambiar
describe('registros simples de F5', () => {
  const columnas = [
    { id: 'descripcion', encabezado: 'Bien o servicio', celda: (r: { attributes: Record<string, unknown> }) => String(r.attributes.description) }
  ]
  const rutas = () => [
    { path: '/objects/contribution_item/records', body: pagina([ITEM_BIEN]) },
    {
      path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
      body: pagina([registro('as', { project: 'p1', member_user_id: 'u-sim', active: true })])
    },
    { path: '/objects/project/records/p1', body: P1 },
    { path: '/metadata/objects/contribution_item', body: DEF_ITEM }
  ]
  const abrir = (props: { congelado?: string; alCambiar?: () => void; abierto?: string | null; alAbrir?: (id: string | null) => void } = {}) =>
    montar(
      <RegistrosSimples
        objeto="contribution_item"
        titulo="Ítems"
        filtros={{ social_contribution: 'a1' }}
        fijos={{ social_contribution: 'a1' }}
        columnas={columnas}
        campos={['description', 'item_kind', 'line_amount']}
        proyecto="p1"
        textoNuevo="Nuevo ítem"
        textoVacio="Sin ítems"
        {...props}
      />,
      { usuario: INVERSION, permisos: EQUIPO_DE_INVERSION }
    )

  it('congelado dice por qué y no ofrece Nuevo, el formulario ni Borrar: el registro se ve en solo lectura', async () => {
    fetch = mockFetch(rutas())
    abrir({ congelado: 'El aporte ya salió de «Solicitado»: sus ítems no cambian.' })
    expect(await screen.findByText('El aporte ya salió de «Solicitado»: sus ítems no cambian.')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Estantes de madera' }))
    const drawer = await screen.findByRole('dialog', { name: 'Ítems' })
    expect(await within(drawer).findByText('Bien')).toBeInTheDocument()
    expect(within(drawer).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo ítem' })).not.toBeInTheDocument()
  })

  it('congelado no abre el alta aunque la ruta la pida (abierto="__nuevo__")', async () => {
    fetch = mockFetch(rutas())
    abrir({ congelado: 'El aporte ya salió de «Solicitado»: sus ítems no cambian.', abierto: '__nuevo__', alAbrir: vi.fn() })
    expect(await screen.findByRole('button', { name: 'Estantes de madera' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Nuevo ítem' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^description/)).not.toBeInTheDocument()
  })

  it('alCambiar corre tras crear y tras borrar', async () => {
    fetch = mockFetch([
      ...rutas(),
      { method: 'POST', path: '/objects/contribution_item/records', status: 201, body: registro('it9', { social_contribution: 'a1' }) },
      { method: 'DELETE', path: '/objects/contribution_item/records/it1', body: {} }
    ])
    const alCambiar = vi.fn()
    abrir({ alCambiar })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo ítem' }))
    const alta = await screen.findByRole('dialog', { name: 'Nuevo ítem' })
    await userEvent.type(await within(alta).findByLabelText(/^description/), 'Cuadernos')
    await userEvent.selectOptions(selectNativo(within(alta).getByLabelText(/^item_kind/)), 'BIEN')
    await userEvent.type(within(alta).getByLabelText(/^line_amount/), '80')
    await userEvent.click(within(alta).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(alCambiar).toHaveBeenCalledTimes(1))
    await userEvent.click(await screen.findByRole('button', { name: 'Estantes de madera' }))
    const drawer = await screen.findByRole('dialog', { name: 'Ítems' })
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Borrar' }))
    await userEvent.click(within(drawer).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(alCambiar).toHaveBeenCalledTimes(2))
  })
})
