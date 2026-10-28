import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@wasichai/ui'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, registro } from '../../test/montar'
import type { Registro } from '../datos/registros'
import { CabeceraDeFicha, type AccionDeFicha } from './CabeceraDeFicha'

// la cabecera de una ficha con la regla de la acción principal (DD-02 y DD-06 del rediseño de UX): una sola primaria, la
// siguiente acción del flujo, con lo que falta debajo; dos secundarias a la vista como mucho; lo destructivo, en «Más acciones»
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const C1 = registro('c1', { project: 'p1', code: 'C-001', title: 'Reservorio de agua' }, { state: 'in_progress' }) as Registro
const tr = (name: string, label: string, to: string, toLabel: string) => ({ name, label, to, toLabel, allowed: true, reason: null })
const CUMPLIMIENTO = tr('register_fulfillment', 'Registrar cumplimiento', 'fulfilled', 'Cumplido')
const BLOQUEAR = tr('block', 'Bloquear', 'blocked', 'Bloqueado')
const VERIFICAR = tr('verify', 'Verificar', 'verified', 'Verificado')
const CANCELAR = tr('cancel', 'Cancelar', 'cancelled', 'Cancelado')

const rutas = (transiciones: unknown[], extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  { path: '/objects/commitment/records/c1/transitions', body: transiciones },
  { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } }
]

const accion = (clave: string, etiqueta: string): AccionDeFicha => ({
  clave,
  nodo: (
    <Button size="sm" variant="secondary">
      {etiqueta}
    </Button>
  )
})

const primarias = () => document.querySelectorAll('[data-variant="primary"]')
const acciones = () => screen.getByRole('group', { name: 'Acciones del registro' })
const abrirMas = async () => {
  await userEvent.click(within(acciones()).getByRole('button', { name: 'Más acciones' }))
  return screen.getByRole('group', { name: 'Más acciones' })
}
const transicionesLeidas = () => waitFor(() => expect(fetch!.calls.some((c) => c.path.endsWith('/records/c1/transitions'))).toBe(true))

describe('CabeceraDeFicha', () => {
  it('dibuja el antetítulo en sans, el título y los chips', async () => {
    fetch = mockFetch(rutas([]))
    montar(
      <CabeceraDeFicha antetitulo="Compromiso · C-001 · Material" titulo="Reservorio de agua" objeto="commitment" registro={C1} chips={<span>Al día</span>} />
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Reservorio de agua' })).toBeInTheDocument()
    // U-27: el antetítulo en la letra del texto, no en la monoespaciada
    const antetitulo = screen.getByText('Compromiso · C-001 · Material')
    expect(antetitulo).not.toHaveClass('font-sg-mono')
    expect(antetitulo).toHaveClass('text-sg-caption', 'text-sg-text-muted')
    expect(screen.getByText('Al día')).toBeInTheDocument()
    await transicionesLeidas()
  })

  it('CA-1.2.1: la única primaria es la siguiente acción del flujo, aunque haya otras tres transiciones', async () => {
    fetch = mockFetch(rutas([BLOQUEAR, CANCELAR, VERIFICAR, CUMPLIMIENTO]))
    montar(<CabeceraDeFicha antetitulo="Compromiso · C-001" titulo="Reservorio de agua" objeto="commitment" registro={C1} />)
    const cumplimiento = await screen.findByRole('button', { name: 'Registrar cumplimiento' })
    expect(cumplimiento).toHaveAttribute('data-variant', 'primary')
    expect(primarias()).toHaveLength(1)
    await abrirMas()
    expect(primarias()).toHaveLength(1)
    expect(primarias()[0]).toBe(cumplimiento)
  })

  it('CA-1.2.2: lo que falta se ve bajo las acciones y la primaria lo referencia', async () => {
    fetch = mockFetch(rutas([CUMPLIMIENTO]))
    montar(
      <CabeceraDeFicha antetitulo="Compromiso · C-001" titulo="Reservorio de agua" objeto="commitment" registro={C1} falta="Falta el acta de entrega firmada" />
    )
    const cumplimiento = await screen.findByRole('button', { name: 'Registrar cumplimiento' })
    const falta = screen.getByText('Falta el acta de entrega firmada')
    expect(falta).toBeVisible()
    expect(falta).toHaveClass('text-sg-caption', 'text-sg-text-secondary')
    expect(cumplimiento.getAttribute('aria-describedby')?.split(' ')).toContain(falta.id)
    expect(cumplimiento).toHaveAccessibleDescription('Falta el acta de entrega firmada')
    // DD-02: la primaria bloqueada se muestra deshabilitada, con su motivo debajo
    expect(cumplimiento).toBeDisabled()
  })

  it('CA-1.2.2: si la comprobación ya describe la primaria, combina las dos descripciones', async () => {
    fetch = mockFetch(
      rutas(
        [CUMPLIMIENTO],
        [
          {
            method: 'POST',
            path: '/sgspe/transition-checks',
            body: { allowed: false, blocking: [{ code: 'DELIVERY_REQUIRED', message: 'Falta una entrega con conformidad', field: 'delivery' }], warnings: [] }
          }
        ]
      )
    )
    montar(
      <CabeceraDeFicha
        antetitulo="Compromiso · C-001"
        titulo="Reservorio de agua"
        objeto="commitment"
        registro={C1}
        comprobarAntes={['register_fulfillment']}
        falta="Falta el acta de entrega firmada"
      />
    )
    const cumplimiento = await screen.findByRole('button', { name: 'Registrar cumplimiento' })
    await waitFor(() => expect(cumplimiento.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2))
    expect(cumplimiento).toHaveAccessibleDescription(/Falta una entrega con conformidad/)
    expect(cumplimiento).toHaveAccessibleDescription(/Falta el acta de entrega firmada/)
  })

  it('CA-1.2.2: si lo que falta es la misma razón de la comprobación, no la repite', async () => {
    fetch = mockFetch(
      rutas(
        [CUMPLIMIENTO],
        [
          {
            method: 'POST',
            path: '/sgspe/transition-checks',
            body: { allowed: false, blocking: [{ code: 'DELIVERY_REQUIRED', message: 'Falta una entrega con conformidad', field: 'delivery' }], warnings: [] }
          }
        ]
      )
    )
    montar(
      <CabeceraDeFicha
        antetitulo="Compromiso · C-001"
        titulo="Reservorio de agua"
        objeto="commitment"
        registro={C1}
        comprobarAntes={['register_fulfillment']}
        falta="Falta una entrega con conformidad"
      />
    )
    const cumplimiento = await screen.findByRole('button', { name: 'Registrar cumplimiento' })
    await waitFor(() => expect(cumplimiento).toBeDisabled())
    await waitFor(() => expect(cumplimiento).toHaveAccessibleDescription('Falta una entrega con conformidad'))
  })

  // tercera pasada de UX (A3 de la segunda, perdido al integrar): en «Más acciones», una transición bloqueada dice por qué a la
  // vista, bajo su nombre; en un title o solo para lectores de pantalla no la ve nadie, y en el teléfono no hay title
  it('una transición bloqueada en «Más acciones» dice su razón a la vista, bajo su nombre', async () => {
    fetch = mockFetch(
      rutas(
        [CUMPLIMIENTO, BLOQUEAR],
        [
          {
            method: 'POST',
            path: '/sgspe/transition-checks',
            body: { allowed: false, blocking: [{ code: 'OPEN_DEPENDENCY', message: 'Hay una dependencia abierta', field: null }], warnings: [] }
          }
        ]
      )
    )
    montar(
      <CabeceraDeFicha
        antetitulo="Compromiso · C-001"
        titulo="Reservorio de agua"
        objeto="commitment"
        registro={C1}
        comprobarAntes={['block']}
        secundarias={[accion('a', 'Uno'), accion('b', 'Dos')]}
      />
    )
    await screen.findByRole('button', { name: 'Registrar cumplimiento' })
    const mas = await abrirMas()
    const bloquear = within(mas).getByRole('button', { name: 'Bloquear' })
    await waitFor(() => expect(bloquear).toBeDisabled())
    const razon = within(mas).getByText('Hay una dependencia abierta')
    expect(razon).not.toHaveClass('sr-only')
    expect(bloquear).toHaveAccessibleDescription('Hay una dependencia abierta')
  })

  it('CA-1.2.3: la que cancela solo está en «Más acciones», y elegirla abre el diálogo de transición', async () => {
    fetch = mockFetch(rutas([CUMPLIMIENTO, BLOQUEAR, CANCELAR]))
    montar(<CabeceraDeFicha antetitulo="Compromiso · C-001" titulo="Reservorio de agua" objeto="commitment" registro={C1} />)
    await screen.findByRole('button', { name: 'Registrar cumplimiento' })
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).not.toBeInTheDocument()
    const mas = await abrirMas()
    await userEvent.click(within(mas).getByRole('button', { name: /^Cancelar/ }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getAllByText(/Cancelado/).length).toBeGreaterThan(0)
  })

  it('CA-1.2.4: con cuatro secundarias, dos se ven y dos están en «Más acciones»', async () => {
    fetch = mockFetch(rutas([]))
    montar(
      <CabeceraDeFicha
        antetitulo="Compromiso · C-001"
        titulo="Reservorio de agua"
        objeto="commitment"
        registro={C1}
        secundarias={[accion('a', 'Uno'), accion('b', 'Dos'), accion('c', 'Tres'), accion('d', 'Cuatro')]}
      />
    )
    await transicionesLeidas()
    expect(within(acciones()).getByRole('button', { name: 'Uno' })).toBeInTheDocument()
    expect(within(acciones()).getByRole('button', { name: 'Dos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tres' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cuatro' })).not.toBeInTheDocument()
    const mas = await abrirMas()
    expect(within(mas).getByRole('button', { name: 'Tres' })).toBeInTheDocument()
    expect(within(mas).getByRole('button', { name: 'Cuatro' })).toBeInTheDocument()
  })

  it('nunca más de dos secundarias a la vista, sumando las otras transiciones; el orden es secundarias, «Más», primaria', async () => {
    fetch = mockFetch(rutas([BLOQUEAR, VERIFICAR, CUMPLIMIENTO]))
    montar(
      <CabeceraDeFicha
        antetitulo="Compromiso · C-001"
        titulo="Reservorio de agua"
        objeto="commitment"
        registro={C1}
        secundarias={[accion('editar', 'Editar')]}
      />
    )
    const cumplimiento = await screen.findByRole('button', { name: 'Registrar cumplimiento' })
    await screen.findByRole('button', { name: 'Bloquear' })
    const botones = within(acciones()).getAllByRole('button')
    expect(botones.map((b) => b.textContent || b.getAttribute('aria-label'))).toEqual(['Editar', 'Bloquear', 'Más acciones', 'Registrar cumplimiento'])
    expect(botones.at(-1)).toBe(cumplimiento)
    const mas = await abrirMas()
    expect(within(mas).getByRole('button', { name: 'Verificar' })).toHaveAttribute('data-variant', 'secondary')
  })

  it('sin transición del camino, la acción propia es la primaria', async () => {
    fetch = mockFetch(rutas([]))
    montar(
      <CabeceraDeFicha
        antetitulo="Riesgo · R-001"
        titulo="Bloqueo de la vía"
        objeto="commitment"
        registro={C1}
        primariaPropia={<Button size="sm">Nueva revisión</Button>}
      />
    )
    await transicionesLeidas()
    expect(screen.getByRole('button', { name: 'Nueva revisión' })).toHaveAttribute('data-variant', 'primary')
    expect(primarias()).toHaveLength(1)
  })

  it('con transición del camino, la acción propia pasa a ser la primera secundaria', async () => {
    fetch = mockFetch(rutas([CUMPLIMIENTO]))
    montar(
      <CabeceraDeFicha
        antetitulo="Compromiso · C-001"
        titulo="Reservorio de agua"
        objeto="commitment"
        registro={C1}
        secundarias={[accion('editar', 'Editar'), accion('mapa', 'Ver en el mapa')]}
        primariaPropia={<Button size="sm">Nueva revisión</Button>}
      />
    )
    const cumplimiento = await screen.findByRole('button', { name: 'Registrar cumplimiento' })
    await waitFor(() => expect(cumplimiento).toHaveAttribute('data-variant', 'primary'))
    expect(screen.getByRole('button', { name: 'Nueva revisión' })).toHaveAttribute('data-variant', 'secondary')
    expect(primarias()).toHaveLength(1)
    const botones = within(acciones()).getAllByRole('button')
    expect(botones.map((b) => b.textContent || b.getAttribute('aria-label'))).toEqual(['Nueva revisión', 'Editar', 'Más acciones', 'Registrar cumplimiento'])
  })
})
