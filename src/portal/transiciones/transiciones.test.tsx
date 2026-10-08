import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { definicion, montar, registro, workflow } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { BotonesDeTransicion } from './BotonesDeTransicion'

// design-system.md §6.2 y screens.md §2: la lista sale de GET …/transitions (las que el rol no tiene no se muestran),
// antes de confirmar se consulta transition-checks, y la transición viaja con If-Match y X-Change-Reason
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const PROYECTO = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'active', updatedAt: '2026-10-05T15:00:00.123456Z' })
const WF = workflow('project', [
  ['draft', 'Borrador'],
  ['active', 'Activo'],
  ['suspended', 'Suspendido'],
  ['closed', 'Cerrado']
])
const transiciones = [
  { name: 'suspend', label: 'Suspender', to: 'suspended', toLabel: 'Suspendido', allowed: true, reason: null },
  { name: 'close', label: 'Cerrar', to: 'closed', toLabel: 'Cerrado', allowed: false, reason: 'requires role …' }
]

function start(extra: MockRoute[] = [], comprobacion: unknown = { allowed: true, blocking: [], warnings: [] }) {
  fetch = mockFetch([
    { path: '/objects/project/workflow', body: WF },
    { path: '/objects/project/records/p1/transitions', body: transiciones },
    { method: 'POST', path: '/sgspe/transition-checks', body: comprobacion },
    ...extra
  ])
}

describe('transiciones', () => {
  it('muestra solo las que la cuenta puede aplicar', async () => {
    start()
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    expect(await screen.findByRole('button', { name: 'Suspender' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()
  })

  it('suspender exige motivo y lo envía con la versión leída', async () => {
    start([{ method: 'POST', path: '/objects/project/records/p1/transitions/suspend', body: { ...PROYECTO, state: 'suspended' } }])
    red = espiarRed()
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Activo → Suspendido')).toBeInTheDocument()
    await within(dialogo).findByText('Se cumplen las reglas para este paso.')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    expect(await within(dialogo).findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('POST', '/objects/project/records/p1/transitions/suspend')).toHaveLength(0)
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Paralización por lluvias')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/project/records/p1/transitions/suspend')).toHaveLength(1))
    const [llamada] = red.a('POST', '/objects/project/records/p1/transitions/suspend')
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-05T15:00:00.123456Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Paralizaci%C3%B3n%20por%20lluvias")
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('una regla que bloquea no deja confirmar y dice qué falta y en qué campo', async () => {
    start([{ path: '/metadata/objects/project', body: definicion('project', [['working_crs', { label: 'CRS de trabajo', type: 'ENUM' }]]) }], {
      allowed: false,
      blocking: [{ code: 'WORKING_CRS_REQUIRED', message: 'El proyecto no tiene CRS de trabajo', field: 'working_crs' }],
      warnings: []
    })
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    expect(await screen.findByText('El proyecto no tiene CRS de trabajo')).toBeInTheDocument()
    expect(await screen.findByText('Campo: CRS de trabajo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
  })

  it('una advertencia vuelve obligatorio el motivo', async () => {
    start([], { allowed: true, blocking: [], warnings: [{ code: 'REASON_REQUIRED', message: 'Este paso pide un motivo', field: 'reason' }] })
    montar(<BotonesDeTransicion objeto="project" registro={{ ...PROYECTO }} ocultar={[]} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    expect(await screen.findByText('Este paso pide un motivo')).toBeInTheDocument()
    expect(screen.getByText('Campo: Motivo')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo (obligatorio)')).toBeInTheDocument()
  })

  // api.md §4.1: field puede ser un objeto que la regla revisa, `reason` o `state`, no solo un campo del registro
  it('un aviso sobre un objeto se nombra con su etiqueta de respaldo; uno sin campo o desconocido no se nombra', async () => {
    start([], {
      allowed: false,
      blocking: [
        { code: 'PENDING_QUESTIONS', message: 'Hay 1 pregunta sin respuesta ni derivación', field: 'engagement_question' },
        { code: 'NOT_OWN_RECORD', message: 'No creó este registro', field: null },
        { code: 'OTRA_REGLA', message: 'Otra regla', field: 'algo_nuevo' }
      ],
      warnings: []
    })
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    expect(await screen.findByText('Campo: Preguntas de la interacción')).toBeInTheDocument()
    expect(screen.getByText('No creó este registro')).toBeInTheDocument()
    expect(screen.getAllByText(/^Campo:/)).toHaveLength(1)
    expect(screen.queryByText(/engagement_question|algo_nuevo/)).not.toBeInTheDocument()
  })

  it('un 403 con código al aplicar dice qué falta, no el texto genérico', async () => {
    start()
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/project/records/p1/transitions/suspend',
        responder: () => problema(403, 'No creaste este registro', [{ field: 'record', message: 'NOT_OWN_RECORD' }])
      }
    ])
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    await screen.findByText('Se cumplen las reglas para este paso.')
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Paralización')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Solo quien registró este dato puede cambiarlo: su cuenta no edita registros de otras personas.')).toBeInTheDocument()
    expect(screen.queryByText('NOT_OWN_RECORD')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument()
  })

  it('un 412 dice que otra persona cambió el registro, ofrece recargar y conserva el motivo', async () => {
    start()
    red = espiarRed([{ method: 'POST', path: '/objects/project/records/p1/transitions/suspend', responder: () => problema(412, 'El proyecto cambió') }])
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    await screen.findByText('Se cumplen las reglas para este paso.')
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Paralización')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo (obligatorio)')).toHaveValue('Paralización')
  })

  it('las transiciones de comando no son botones', async () => {
    fetch = mockFetch([
      { path: '/objects/stakeholder/workflow', body: workflow('stakeholder', [['profiled', 'Caracterizado']]) },
      {
        path: '/objects/stakeholder/records/s1/transitions',
        body: [
          { name: 'assess', label: 'Evaluar', to: 'assessed', toLabel: 'Evaluado', allowed: true, reason: null },
          { name: 'retire_profiled', label: 'Retirar', to: 'retired', toLabel: 'Retirado', allowed: true, reason: null }
        ]
      }
    ])
    montar(<BotonesDeTransicion objeto="stakeholder" registro={registro('s1', {}, { state: 'profiled' })} />)
    expect(await screen.findByRole('button', { name: 'Retirar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Evaluar' })).not.toBeInTheDocument()
  })

  // screens.md S23: "Cerrar" sale deshabilitado con la razón mientras una regla lo bloquee (RN-ENG-005)
  it('una transición comprobada antes sale deshabilitada con la razón', async () => {
    start([], { allowed: false, blocking: [{ code: 'PENDING_QUESTIONS', message: 'Hay 1 pregunta pendiente', field: 'engagement_question' }], warnings: [] })
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} comprobarAntes={['suspend']} />)
    const boton = await screen.findByRole('button', { name: 'Suspender' })
    await waitFor(() => expect(boton).toBeDisabled())
    expect(boton).toHaveAccessibleDescription('Hay 1 pregunta pendiente')
  })
})
