import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar, workflow } from '../../test/montar'
import { ErrorDeSgspe } from '../datos/http'
import { EstadoChip } from './EstadoChip'
import { ErrorDeCarga, NoDisponible, Restringido } from './Estados'
import { KpiCard } from './KpiCard'
import { Pasos } from './Pasos'

let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('EstadoChip', () => {
  it('muestra la etiqueta del workflow con el tono y el ícono del estado (design-system.md §4.1)', async () => {
    fetch = mockFetch([
      {
        path: '/objects/project/workflow',
        body: workflow('project', [
          ['draft', 'Borrador'],
          ['in_review', 'En revisión']
        ])
      }
    ])
    montar(<EstadoChip objeto="project" estado="in_review" />)
    const chip = await screen.findByText('En revisión')
    expect(chip).toHaveAttribute('data-estado', 'in_review')
    expect(chip.className).toContain('bg-sg-info-soft')
    expect(chip.querySelector('svg')).not.toBeNull()
  })

  it('sin workflow legible, muestra el nombre técnico', async () => {
    fetch = mockFetch([])
    montar(<EstadoChip objeto="engagement" estado="held" />)
    expect(await screen.findByText('held')).toBeInTheDocument()
  })
})

describe('estados comunes', () => {
  it('un error de carga dice qué falló, el código de correlación y permite reintentar', async () => {
    const reintentar = vi.fn()
    montar(<ErrorDeCarga error={new ErrorDeSgspe(412, 'x', [], 'corr-77')} alReintentar={reintentar} />)
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(screen.getByText('Código para soporte: corr-77')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reintentar).toHaveBeenCalledOnce()
  })

  it('un 409 muestra el detail del dominio, no el código', async () => {
    montar(<ErrorDeCarga error={new ErrorDeSgspe(409, 'El grupo de interés está retirado', [], null)} />)
    expect(await screen.findByText('El grupo de interés está retirado')).toBeInTheDocument()
    expect(screen.queryByText(/409/)).not.toBeInTheDocument()
  })

  // ruling P15: errors[0].message de una guarda es un código; la interfaz dice su texto y cada 403 dice qué falta
  it.each([
    ['NOT_ASSIGNED', 'No tiene una asignación vigente a este proyecto: pídala a la administración del proyecto.'],
    ['NOT_OWN_RECORD', 'Solo quien registró este dato puede cambiarlo: su cuenta no edita registros de otras personas.'],
    ['ACTION_REQUIRED', 'Su cuenta no tiene la acción de aprobar (APPROVE) que este paso exige.'],
    ['ROLE_REQUIRED', 'Su rol no puede dar este paso del flujo.'],
    ['FIELD_NOT_WRITABLE', 'Este paso escribe un dato que su rol no puede escribir.'],
    ['OBJECT_NOT_READABLE', 'Su rol no puede leer datos que esta regla necesita revisar.'],
    ['COMMAND_ONLY', 'Este paso se hace desde su propia pantalla, no como una transición.']
  ])('un 403 %s dice su texto, no el código ni el texto genérico', async (codigo, texto) => {
    montar(<ErrorDeCarga error={new ErrorDeSgspe(403, 'Prohibido', [{ field: 'record', message: codigo }], null)} />)
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(codigo)).not.toBeInTheDocument()
    expect(screen.queryByText(/Su cuenta no tiene permiso para esta acción/)).not.toBeInTheDocument()
  })

  it('HAS_DEPENDENTS nombra el dependiente; un código que el portal no conoce muestra el detail', async () => {
    montar(
      <>
        <ErrorDeCarga error={new ErrorDeSgspe(409, 'x', [{ field: 'engagement.project', message: 'HAS_DEPENDENTS' }], null)} />
        <ErrorDeCarga error={new ErrorDeSgspe(409, 'La regla nueva del servidor', [{ field: 'record', message: 'SOME_NEW_RULE' }], null)} />
      </>
    )
    expect(
      await screen.findByText('No se puede borrar: otros registros dependen de este (engagement.project). Bórrelos o cámbielos primero.')
    ).toBeInTheDocument()
    expect(screen.getByText('La regla nueva del servidor')).toBeInTheDocument()
    expect(screen.queryByText('SOME_NEW_RULE')).not.toBeInTheDocument()
  })

  it('un campo restringido y una cifra no disponible lo dicen con candado, nunca vacío', async () => {
    montar(
      <>
        <Restringido />
        <NoDisponible />
      </>
    )
    expect(await screen.findByText('Restringido')).toHaveAttribute('title', 'Su rol no puede leer este dato')
    expect(screen.getByText('No disponible')).toBeInTheDocument()
  })
})

describe('KpiCard', () => {
  it.each([
    [{ code: 'KPI-STK-05', label: 'x', available: true, value: 40, numerator: 4, denominator: 10, unit: '%' }, ['40', '4 / 10 · %']],
    [{ code: 'KPI-STK-02', label: 'x', available: false, unavailableReason: 'FIELD_NOT_READABLE', missingFields: ['stakeholder.stance'] }, ['No disponible']]
  ])('%j se lee como %j', async (indicador, textos) => {
    montar(<KpiCard titulo="Cifra" indicador={indicador} />)
    for (const texto of textos) expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('una cifra no disponible dice por qué: sin permiso, candado; un solo proyecto, que lo elija', async () => {
    montar(
      <>
        <KpiCard titulo="Uno" indicador={{ code: 'KPI-ENG-01', label: 'x', available: false, unavailableReason: 'OBJECT_NOT_READABLE' }} />
        <KpiCard titulo="Dos" indicador={{ code: 'KPI-STK-03', label: 'x', available: false, unavailableReason: 'SINGLE_PROJECT_REQUIRED' }} />
      </>
    )
    expect(await screen.findByText('No disponible')).toHaveAttribute('title', 'Su rol no puede leer los registros de esta cifra')
    expect(screen.getByText('Elija un proyecto')).toHaveAttribute('title', 'Esta cifra se calcula para un solo proyecto: elija uno en el selector')
  })

  it('un módulo que no llegó dice en qué fase llega', async () => {
    montar(<KpiCard titulo="Compromisos vencidos" llegaEn="F3" />)
    expect(await screen.findByText('Llega en F3')).toBeInTheDocument()
  })
})

describe('Pasos', () => {
  it('marca el paso actual y solo deja volver a los visitados', async () => {
    const ir = vi.fn()
    montar(<Pasos pasos={['Uno', 'Dos', 'Tres']} actual={1} visitados={1} alIr={ir} />)
    expect(await screen.findByRole('button', { name: /Dos/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Tres/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /Uno/ }))
    await waitFor(() => expect(ir).toHaveBeenCalledWith(0))
  })
})
