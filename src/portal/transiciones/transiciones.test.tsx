import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar, pagina, registro, workflow } from '../../test/montar'
import { ADMIN_PERMISOS, ADMINISTRACION, permisos, RELACIONISTA } from '../../test/portal'
import { useAvailableTransitions } from '../datos/flujos'
import { useMisAsignaciones } from '../contexto/proyectos'
import { espiarRed, problema, type Red } from '../../test/red'
import { useRegistro, useRegistros } from '../datos/registros'
import { useResumenDeAvisos } from '../datos/avisos'
import { useTextoDeAviso } from './avisos'
import { BotonesDeTransicion } from './BotonesDeTransicion'

// design-system.md §6.2 y screens.md §2: la lista sale de GET …/transitions (las que el rol no tiene no se muestran),
// antes de confirmar se consulta transition-checks, y la transición viaja con If-Match y X-Change-Reason
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
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

// quien lee el registro de la pantalla: da un observador activo a ['record', …], como la ficha que monta los botones
function LectorDelRegistro() {
  const leido = useRegistro('project', 'p1')
  return <p>{leido.data ? 'registro leído' : 'sin leer'}</p>
}

describe('transiciones', () => {
  it('muestra solo las que la cuenta puede aplicar', async () => {
    start()
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    expect(await screen.findByRole('button', { name: 'Suspender' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()
  })

  it('la que anula va al final, con texto de peligro y nombrando el objeto; la primera de las demás es la primaria', async () => {
    fetch = mockFetch([
      { path: '/objects/project/workflow', body: WF },
      {
        path: '/objects/project/records/p1/transitions',
        body: [
          { name: 'void', label: 'Anular', to: 'cancelled', toLabel: 'Anulado', allowed: true, reason: null },
          { name: 'submit', label: 'Enviar a revisión', to: 'in_review', toLabel: 'En revisión', allowed: true, reason: null }
        ]
      }
    ])
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    const anular = await screen.findByRole('button', { name: 'Anular el proyecto' })
    const enviar = screen.getByRole('button', { name: 'Enviar a revisión' })
    expect(enviar.compareDocumentPosition(anular) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(anular).toHaveClass('text-sg-danger')
    expect(enviar).not.toHaveClass('text-sg-danger')
  })

  it('con sinPrimaria, ninguna transición compite con la acción primaria de la ficha', async () => {
    start()
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} sinPrimaria />)
    const suspender = await screen.findByRole('button', { name: 'Suspender' })
    const { container } = montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    const primaria = await within(container).findByRole('button', { name: 'Suspender' })
    expect(suspender.className).not.toBe(primaria.className)
  })

  // revisión de UX, etapa 8: el foco entra al motivo, el orden de tabulación termina en Cancelar y Confirmar, y Escape devuelve el
  // foco al botón que abrió el diálogo
  it('el diálogo pone el foco en el motivo y, al cerrarse, lo devuelve al botón que lo abrió', async () => {
    start()
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    const boton = await screen.findByRole('button', { name: 'Suspender' })
    await userEvent.click(boton)
    const dialogo = await screen.findByRole('dialog')
    await within(dialogo).findByText('Se cumplen las reglas para este paso.')
    await waitFor(() => expect(within(dialogo).getByLabelText('Motivo (obligatorio)')).toHaveFocus())
    await userEvent.tab()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await userEvent.tab()
    expect(within(dialogo).getByRole('button', { name: 'Confirmar' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(boton).toHaveFocus()
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

  // tercera pasada de UX: una transición puede cerrar o abrir tareas y avisos (acusar recibo cierra la tarea de acuse): se releen,
  // para que «Lo que me toca hoy» y las insignias no sigan mostrando lo que ya se hizo
  it('aplicar una transición relee las tareas y los avisos, que pueden haber cambiado', async () => {
    start([
      { method: 'POST', path: '/objects/project/records/p1/transitions/suspend', body: { ...PROYECTO, state: 'suspended' } },
      { path: '/objects/task/records', body: pagina([]) },
      {
        path: '/auth/me/notifications/summary',
        body: {
          kinds: { ACTION: { active: 0, unread: 0, overdue: 0 }, WARNING: { active: 0, unread: 0, overdue: 0 }, INFO: { active: 0, unread: 0, overdue: 0 } },
          latest: null
        }
      }
    ])
    red = espiarRed()
    function Lector() {
      const tareas = useRegistros('task', { assignee_user_id: 'u-relacionista' })
      const avisos = useResumenDeAvisos()
      return <p>{tareas.data && avisos.data ? 'tareas y avisos leídos' : 'leyendo'}</p>
    }
    montar(
      <>
        <Lector />
        <BotonesDeTransicion objeto="project" registro={PROYECTO} />
      </>
    )
    await screen.findByText('tareas y avisos leídos')
    const tareas = () => red!.a('GET', '/objects/task/records').length
    const avisos = () => red!.a('GET', '/auth/me/notifications/summary').length
    expect([tareas(), avisos()]).toEqual([1, 1])
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    const dialogo = await screen.findByRole('dialog')
    await within(dialogo).findByText('Se cumplen las reglas para este paso.')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Paralización por lluvias')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect([tareas(), avisos()]).toEqual([2, 2]))
  })

  it('una transición aplicada lo confirma, aunque ya no queden botones (revisión final, M6)', async () => {
    let aplicada = false
    fetch = mockFetch([
      { path: '/objects/project/workflow', body: WF },
      { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } }
    ])
    red = espiarRed([
      { path: '/objects/project/records/p1/transitions', responder: () => jsonResponse(aplicada ? [] : transiciones) },
      {
        method: 'POST',
        path: '/objects/project/records/p1/transitions/suspend',
        responder: () => {
          aplicada = true
          return jsonResponse({ ...PROYECTO, state: 'suspended' })
        }
      }
    ])
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    const dialogo = await screen.findByRole('dialog')
    await within(dialogo).findByText('Se cumplen las reglas para este paso.')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Paralización por lluvias')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Listo: el registro está en «Suspendido».')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Suspender' })).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Listo: el registro está en «Suspendido».')
  })

  it('la confirmación se va sola a los pocos segundos (re-revisión, menor 3)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    start([{ method: 'POST', path: '/objects/project/records/p1/transitions/suspend', body: { ...PROYECTO, state: 'suspended' } }])
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await usuario.click(await screen.findByRole('button', { name: 'Suspender' }))
    const dialogo = await screen.findByRole('dialog')
    await within(dialogo).findByText('Se cumplen las reglas para este paso.')
    await usuario.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Paralización por lluvias')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Listo: el registro está en «Suspendido».')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000)
    })
    expect(screen.queryByText('Listo: el registro está en «Suspendido».')).not.toBeInTheDocument()
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

  it('una regla que nombra la transición o el campo por su nombre de la API dice la acción y la etiqueta (humo F4, D3)', async () => {
    start(
      [
        {
          path: '/metadata/objects/project',
          body: definicion('project', [
            ['response', { label: 'Respuesta' }],
            ['attended', { label: 'Asistió' }]
          ])
        }
      ],
      {
        allowed: false,
        blocking: [
          { code: 'FIELD_REQUIRED', message: 'La transición suspend exige response', field: 'response' },
          { code: 'ATTENDANCE_REQUIRED', message: 'Registrar la realización exige al menos un participante que asistió (attended)', field: 'attended' },
          { code: 'OTRA_REGLA', message: 'Otra regla nueva (RN-ENG-005)', field: null }
        ],
        warnings: []
      }
    )
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    expect(await screen.findByText('Para «Suspender» falta «Respuesta»: complételo y vuelva a intentar.')).toBeInTheDocument()
    expect(screen.getByText('Registre al menos un participante que asistió.')).toBeInTheDocument()
    expect(screen.getByText('Una regla del sistema no permite este paso todavía.')).toBeInTheDocument()
    expect(screen.queryByText(/\bsuspend\b|\bresponse\b|\battended\b|RN-ENG/)).not.toBeInTheDocument()
  })

  it('sin el nombre de la acción (la bandeja de aprobaciones), un dato que falta no deja «Para «»» (revisión, importante 1)', async () => {
    start([{ path: '/metadata/objects/project', body: definicion('project', [['resolution', { label: 'Resolución' }]]) }])
    function Sonda() {
      const textoDe = useTextoDeAviso('project')
      const aviso = { code: 'FIELD_REQUIRED', message: 'La transición resolve_high_severity exige resolution', field: 'resolution' }
      return <p>{textoDe(aviso, { name: 'resolve_high_severity', label: '' }).texto}</p>
    }
    montar(<Sonda />)
    expect(await screen.findByText('Falta «Resolución» para este paso: complételo y vuelva a intentar.')).toBeInTheDocument()
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

  it('un 412 dice que otra persona cambió el registro, ofrece recargar, conserva el motivo y relee todo lo viejo', async () => {
    start([{ path: '/objects/project/records/p1', body: PROYECTO }])
    red = espiarRed([{ method: 'POST', path: '/objects/project/records/p1/transitions/suspend', responder: () => problema(412, 'El proyecto cambió') }])
    montar(
      <>
        <LectorDelRegistro />
        <BotonesDeTransicion objeto="project" registro={PROYECTO} />
      </>
    )
    await screen.findByText('registro leído')
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    await screen.findByText('Se cumplen las reglas para este paso.')
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Paralización')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo (obligatorio)')).toHaveValue('Paralización')
    const lecturas = () => red!.a('GET', '/objects/project/records/p1').length
    const botones = () => red!.a('GET', '/objects/project/records/p1/transitions').length
    const reglas = () => red!.a('POST', '/sgspe/transition-checks').length
    expect([lecturas(), botones(), reglas()]).toEqual([1, 1, 1])
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    // se relee el registro, la lista de botones y las reglas del diálogo abierto; el aviso del 412 se va
    await waitFor(() => expect([lecturas(), botones(), reglas()]).toEqual([2, 2, 2]))
    expect(screen.queryByText(/Otra persona cambió este registro/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Motivo (obligatorio)')).toHaveValue('Paralización')
  })

  it('«Recargar» se da por hecho cuando llega el registro, aunque falle la relectura de la lista de botones (re-revisión, menor 1)', async () => {
    start([{ path: '/objects/project/records/p1', body: PROYECTO }])
    let lecturasDeBotones = 0
    red = espiarRed([
      { method: 'POST', path: '/objects/project/records/p1/transitions/suspend', responder: () => problema(412, 'El proyecto cambió') },
      {
        path: '/objects/project/records/p1/transitions',
        responder: () => (++lecturasDeBotones === 1 ? jsonResponse(transiciones) : problema(503, 'No disponible'))
      }
    ])
    montar(
      <>
        <LectorDelRegistro />
        <BotonesDeTransicion objeto="project" registro={PROYECTO} />
      </>
    )
    await screen.findByText('registro leído')
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    await screen.findByText('Se cumplen las reglas para este paso.')
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Paralización')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(screen.queryByText(/Otra persona cambió este registro/)).not.toBeInTheDocument())
    expect(screen.queryByText(/No se pudo recargar/)).not.toBeInTheDocument()
    expect(lecturasDeBotones).toBe(2)
  })

  it('si las reglas no se pudieron comprobar, Confirmar queda deshabilitado y se puede reintentar', async () => {
    start()
    let intentos = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/transition-checks',
        responder: () =>
          ++intentos === 1
            ? problema(500, 'Falló la comprobación')
            : new Response(JSON.stringify({ allowed: true, blocking: [], warnings: [] }), { headers: { 'Content-Type': 'application/json' } })
      }
    ])
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    const reintentar = await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    await userEvent.click(reintentar)
    expect(await screen.findByText('Se cumplen las reglas para este paso.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(intentos).toBe(2)
  })

  it('allowed en falso sin bloqueos tampoco deja confirmar, y lo dice', async () => {
    start([], { allowed: false, blocking: [], warnings: [] })
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    expect(await screen.findByText(/Este paso no se puede dar ahora/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(screen.queryByText('Se cumplen las reglas para este paso.')).not.toBeInTheDocument()
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
    expect(await screen.findByRole('button', { name: 'Retirar el grupo de interés' })).toBeInTheDocument()
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

  it('un bloqueo sin mensaje y con un código conocido dice el texto del código', async () => {
    start([], { allowed: false, blocking: [{ code: 'PENDING_QUESTIONS', message: '', field: null }], warnings: [] })
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} comprobarAntes={['suspend']} />)
    const boton = await screen.findByRole('button', { name: 'Suspender' })
    await waitFor(() => expect(boton).toBeDisabled())
    expect(boton).toHaveAccessibleDescription('Hay preguntas sin respuesta ni derivación: respóndalas antes de cerrar.')
  })

  it('un bloqueo sin mensaje y con un código desconocido deshabilita igual el botón, sin inventar una razón', async () => {
    start([], { allowed: false, blocking: [{ code: 'OTRA_REGLA', message: '', field: null }], warnings: [] })
    montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} comprobarAntes={['suspend']} />)
    const boton = await screen.findByRole('button', { name: 'Suspender' })
    await waitFor(() => expect(boton).toBeDisabled())
    expect(boton).not.toHaveAttribute('aria-describedby')
  })

  describe('con alcance de proyecto (re-revisión, menor 4)', () => {
    // la sonda lee las mismas asignaciones y transiciones (mismas claves, misma caché): cuando las dos llegaron, los botones
    // ya las vieron, así que su ausencia no es una carga pendiente
    function Sonda() {
      const asignaciones = useMisAsignaciones()
      const disponibles = useAvailableTransitions('project', 'p1')
      return asignaciones.isSuccess && disponibles.isSuccess ? <span>asignaciones llegaron</span> : null
    }
    const PROPIA = registro('a1', { project: 'p1', member_user_id: RELACIONISTA.id, active: true })
    const conAsignaciones = (lista: unknown[]) => start([{ path: '/objects/project_assignment/records', body: pagina(lista) }])
    const ESCRIBE = permisos({ project: ['READ', 'UPDATE'], project_assignment: ['READ'] })

    it('sin asignación vigente ni ADMIN no ofrece transiciones que el servidor rechazaría con NOT_ASSIGNED', async () => {
      conAsignaciones([])
      montar(
        <>
          <BotonesDeTransicion objeto="project" registro={PROYECTO} proyecto="p1" />
          <Sonda />
        </>,
        { permisos: ESCRIBE }
      )
      await screen.findByText('asignaciones llegaron')
      expect(screen.queryByRole('button', { name: 'Suspender' })).not.toBeInTheDocument()
    })

    it('con asignación vigente, sí', async () => {
      conAsignaciones([PROPIA])
      montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} proyecto="p1" />, { permisos: ESCRIBE })
      expect(await screen.findByRole('button', { name: 'Suspender' })).toBeInTheDocument()
    })

    it('ADMIN no necesita asignación', async () => {
      conAsignaciones([])
      montar(<BotonesDeTransicion objeto="project" registro={PROYECTO} proyecto="p1" />, { usuario: ADMINISTRACION, permisos: ADMIN_PERMISOS })
      expect(await screen.findByRole('button', { name: 'Suspender' })).toBeInTheDocument()
    })
  })
})
