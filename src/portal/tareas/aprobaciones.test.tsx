import { focusManager, useQuery } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APROBADORA, baseDeCompromisos, C1 } from '../../test/compromisos'
import { APORTE, PERMISOS_DE_APROBACION, PROGRAMA } from '../../test/inversion'
import { montar, pagina, registro, ubicacion } from '../../test/montar'
import { permisos } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import type { Aviso } from '../datos/avisos'
import { AprobacionesPage } from './AprobacionesPage'
import { AprobacionPage } from './AprobacionPage'

// S48 y S31 (flujo 8): la bandeja sale de los avisos de aprobación pendiente; «¿Puede decidir?» dice siempre por qué no (D4,
// D5, D7); la decisión pide motivo, se comprueba con transition-checks y se aplica con la versión leída
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  // la prueba de la relectura fuerza el foco: se suelta aunque falle
  focusManager.setFocused(undefined)
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const PENDIENTE = { ...C1, state: 'pending_approval', updatedAt: '2026-10-08T15:00:00Z' }
const OTRO = registro('c7', { project: 'p1', code: 'C-007', title: 'Botiquín', amount: 800, currency: 'PEN' }, { state: 'pending_approval' })
const aviso = (id: string, objeto: string, registroId: string, fuente = 'sgspe.approvals'): Aviso => ({
  id,
  kind: 'ACTION',
  title: `Pendiente ${registroId}`,
  body: null,
  link: { type: 'RECORD', object: objeto, recordId: registroId },
  publishAt: '2026-10-06T15:00:00Z',
  expiresAt: null,
  dueAt: null,
  overdue: false,
  source: fuente,
  read: false,
  snoozedUntil: null,
  dismissible: false
})
const APROBAR = { name: 'approve', label: 'Aprobar', to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null }
const DEVOLVER = { name: 'return_to_draft', label: 'Devolver a borrador', to: 'draft', toLabel: 'Borrador', allowed: true, reason: null }
const SUPERIOR = { name: 'approve_senior', label: 'Aprobar (nivel superior)', to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null }
// el mensaje del servidor lleva un ID de decisión (D4): la interfaz dice el texto del código (humo F4, D3)
const SEGREGACION = { code: 'SEGREGATION_OF_DUTIES', message: 'Usted registró este compromiso: lo aprueba otra persona (D4)', field: 'record' }
const NIVEL_SUPERIOR = { code: 'SENIOR_APPROVAL_REQUIRED', message: 'El monto pide la aprobación de nivel superior (D5)', field: 'amount' }

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(APROBADORA),
  {
    path: '/auth/me/notifications',
    body: {
      content: [aviso('n1', 'commitment', 'c1'), aviso('n2', 'commitment', 'c7'), aviso('n3', 'commitment', 'c1', 'sgspe.deadlines')],
      page: 0,
      size: 200,
      totalElements: 3,
      totalPages: 1
    }
  },
  { path: '/objects/commitment/records/c1', body: PENDIENTE },
  { path: '/objects/commitment/records/c7', body: OTRO },
  { path: /^\/objects\/commitment\/records\/c\d\/transitions/, body: [DEVOLVER, APROBAR] },
  { path: '/objects/engagement/records/e1', body: registro('e1', { title: 'Mesa de diálogo de agosto', engagement_type: 'MESA DE DIALOGO' }) },
  { path: '/objects/exploration_campaign/records/camp1', body: registro('camp1', { name: 'Campaña 2026' }) }
]
// D4 bloquea la aprobación de c1; devolver no tiene reglas
const reglas = () =>
  espiarRed([
    {
      method: 'POST',
      path: '/sgspe/transition-checks',
      responder: (l) => {
        const { recordId, transition } = l.cuerpo as { recordId: string; transition: string }
        return jsonResponse(
          recordId === 'c1' && transition === 'approve'
            ? { allowed: false, blocking: [SEGREGACION], warnings: [] }
            : { allowed: true, blocking: [], warnings: [] }
        )
      }
    }
  ])
const APROBACION = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  commitment: ['READ', 'UPDATE', 'APPROVE'],
  engagement: ['READ'],
  exploration_campaign: ['READ']
})
const abrirS31 = (id: string) =>
  montar(<AprobacionPage />, {
    ruta: `/tasks/approvals/commitment/${id}`,
    camino: '/tasks/approvals/commitment/:recordId',
    usuario: APROBADORA,
    permisos: APROBACION
  })

describe('S48 · aprobaciones', () => {
  it('lista solo las aprobaciones pendientes, con el monto, la espera y por qué no se puede decidir', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T15:00:00Z'))
    fetch = mockFetch(rutas())
    red = reglas()
    montar(<AprobacionesPage />, { ruta: '/tasks/approvals', camino: '/tasks/approvals', usuario: APROBADORA, permisos: APROBACION })
    const tabla = await screen.findByRole('table', { name: 'Por aprobar' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(3)
    const fila = (await within(tabla).findByText('C-001 · Reservorio de agua para Tunas Pampa')).closest('tr') as HTMLElement
    expect(within(fila).getByText('S/ 25,000.00')).toBeInTheDocument()
    expect(within(fila).getByText('3 días')).toBeInTheDocument()
    expect(
      await within(fila).findByText(
        'No: Por segregación de funciones, quien registró un compromiso, un aporte o un programa no lo aprueba, y el responsable de un compromiso no lo verifica.'
      )
    ).toBeInTheDocument()
    expect(within(fila).getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/tasks/approvals/commitment/c1')
    const otra = (await within(tabla).findByText('C-007 · Botiquín')).closest('tr') as HTMLElement
    expect(await within(otra).findByText('Sí')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Escalamientos' }))
    expect(await screen.findByRole('heading', { name: 'Pendiente c1' })).toBeInTheDocument()
  })

  it('dice «Sí» si alguna aprobación de su rol pasa, aunque otra se bloquee', async () => {
    fetch = mockFetch(rutas([{ path: /^\/objects\/commitment\/records\/c1\/transitions/, body: [DEVOLVER, APROBAR, SUPERIOR] }]))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/transition-checks',
        responder: (l) => {
          const { transition } = l.cuerpo as { transition: string }
          return jsonResponse(
            transition === 'approve' ? { allowed: false, blocking: [NIVEL_SUPERIOR], warnings: [] } : { allowed: true, blocking: [], warnings: [] }
          )
        }
      }
    ])
    montar(<AprobacionesPage />, { ruta: '/tasks/approvals', camino: '/tasks/approvals', usuario: APROBADORA, permisos: APROBACION })
    const tabla = await screen.findByRole('table', { name: 'Por aprobar' })
    const fila = (await within(tabla).findByText('C-001 · Reservorio de agua para Tunas Pampa')).closest('tr') as HTMLElement
    expect(await within(fila).findByText('Sí')).toBeInTheDocument()
    expect(within(fila).queryByText(/SENIOR_APPROVAL_REQUIRED|nivel superior/)).not.toBeInTheDocument()
  })

  it('los escalamientos avisan cuando se revisaron solo los primeros 200 avisos', async () => {
    fetch = mockFetch(
      rutas([
        {
          path: '/auth/me/notifications',
          body: { content: [aviso('n3', 'commitment', 'c1', 'sgspe.deadlines')], page: 0, size: 200, totalElements: 201, totalPages: 2 }
        }
      ])
    )
    montar(<AprobacionesPage />, { ruta: '/tasks/approvals?view=escalamientos', camino: '/tasks/approvals', usuario: APROBADORA, permisos: APROBACION })
    expect(await screen.findByRole('heading', { name: 'Pendiente c1' })).toBeInTheDocument()
    expect(screen.getByText('Se revisaron solo los primeros 200 avisos: puede haber más escalamientos que no se muestran.')).toBeInTheDocument()
  })

  it('una queja grave por resolver (F4) se revisa en su ficha; un riesgo que escala es un escalamiento', async () => {
    const QUEJA = registro('g1', { project: 'p1', code: 'Q-001', category: 'AGUA Y MEDIO AMBIENTE', severity: 'ALTA' }, { state: 'in_action' })
    fetch = mockFetch(
      rutas([
        {
          path: '/auth/me/notifications',
          body: {
            content: [aviso('n7', 'grievance', 'g1'), aviso('n8', 'social_risk', 'k1', 'sgspe.risks')],
            page: 0,
            size: 200,
            totalElements: 2,
            totalPages: 1
          }
        },
        { path: '/objects/grievance/records/g1', body: QUEJA },
        {
          path: '/objects/grievance/records/g1/transitions',
          body: [{ name: 'resolve_high_severity', label: 'Resolver con aprobación', to: 'resolved', toLabel: 'Resuelta', allowed: true, reason: null }]
        }
      ])
    )
    red = espiarRed([{ method: 'POST', path: '/sgspe/transition-checks', responder: () => jsonResponse({ allowed: true, blocking: [], warnings: [] }) }])
    montar(<AprobacionesPage />, {
      ruta: '/tasks/approvals',
      camino: '/tasks/approvals',
      usuario: APROBADORA,
      permisos: permisos({ grievance: ['READ', 'UPDATE', 'APPROVE'], social_risk: ['READ'] })
    })
    const tabla = await screen.findByRole('table', { name: 'Por aprobar' })
    const fila = (await within(tabla).findByText('Q-001 · AGUA Y MEDIO AMBIENTE')).closest('tr') as HTMLElement
    expect(within(fila).getByText('Queja grave por resolver')).toBeInTheDocument()
    expect(await within(fila).findByText('Sí')).toBeInTheDocument()
    expect(within(fila).getByRole('link', { name: 'Ver' })).toHaveAttribute('href', '/r/grievance/g1')
    expect(red.a('POST', '/sgspe/transition-checks')[0].cuerpo).toMatchObject({ object: 'grievance', transition: 'resolve_high_severity' })
    await userEvent.click(screen.getByRole('tab', { name: 'Escalamientos' }))
    expect(await screen.findByRole('heading', { name: 'Pendiente k1' })).toBeInTheDocument()
  })

  it('la queja de un aviso que responde 404 es «Registro reservado», no un fallo de lectura', async () => {
    fetch = mockFetch(
      rutas([
        {
          path: '/auth/me/notifications',
          body: { content: [aviso('n7', 'grievance', 'g1')], page: 0, size: 200, totalElements: 1, totalPages: 1 }
        },
        // una queja confidencial que la cuenta ya no lee responde 404: nadie borra una QCS
        { path: '/objects/grievance/records/g1', status: 404, body: { title: 'Not Found', status: 404, detail: 'x' } }
      ])
    )
    montar(<AprobacionesPage />, {
      ruta: '/tasks/approvals',
      camino: '/tasks/approvals',
      usuario: APROBADORA,
      permisos: permisos({ grievance: ['READ', 'UPDATE', 'APPROVE'] })
    })
    const tabla = await screen.findByRole('table', { name: 'Por aprobar' })
    expect(await within(tabla).findByText('Registro reservado')).toBeInTheDocument()
    expect(within(tabla).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    // sin enlace a una ficha que solo diría lo mismo y sin decir qué es ni de qué trata
    const fila = within(tabla).getByText('Registro reservado').closest('tr')!
    expect(within(fila).queryByRole('link')).not.toBeInTheDocument()
    expect(within(fila).queryByText(/^Queja/)).not.toBeInTheDocument()
  })

  // con el alcance por proyecto (ADR-0029) un compromiso de un proyecto que la cuenta dejó de leer también responde 404
  it('un compromiso de un aviso que responde 404 también es «Registro reservado», sin enlace ni monto', async () => {
    fetch = mockFetch(
      rutas([
        {
          path: '/auth/me/notifications',
          body: { content: [aviso('n9', 'commitment', 'c9')], page: 0, size: 200, totalElements: 1, totalPages: 1 }
        },
        { path: '/objects/commitment/records/c9', status: 404, body: { title: 'Not Found', status: 404, detail: 'x' } }
      ])
    )
    montar(<AprobacionesPage />, {
      ruta: '/tasks/approvals',
      camino: '/tasks/approvals',
      usuario: APROBADORA,
      permisos: permisos({ commitment: ['READ', 'UPDATE', 'APPROVE'] })
    })
    const tabla = await screen.findByRole('table', { name: 'Por aprobar' })
    expect(await within(tabla).findByText('Registro reservado')).toBeInTheDocument()
    const fila = within(tabla).getByText('Registro reservado').closest('tr')!
    expect(within(fila).queryByRole('link')).not.toBeInTheDocument()
    expect(within(fila).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    // la tercera columna es la del monto
    expect(within(fila).getAllByRole('cell')[2]).toHaveTextContent(/^—$/)
  })

  // una sonda sobre la consulta de la fila: dice cuándo terminó la relectura, sin esperar un tiempo fijo. enabled: false
  // observa la consulta sin pedir nada por su cuenta. repite la clave de useRegistro (datos/registros.ts)
  function Sonda() {
    const c7 = useQuery({ queryKey: ['record', 'commitment', 'c7'], enabled: false })
    return <output aria-label="errores de c7">{c7.errorUpdateCount}</output>
  }

  // la asignación vence con la bandeja abierta: la relectura da 404 pero la fila ya leída se conserva entera, sin mezclar
  // lo leído con «reservado» (como RegistroVinculado y AbrirRegistroPage, que también exigen que no haya datos)
  it('una relectura que responde 404 conserva la fila ya leída con su enlace', async () => {
    fetch = mockFetch(rutas())
    let lecturas = 0
    red = espiarRed([
      {
        path: '/objects/commitment/records/c7',
        responder: () => (++lecturas === 1 ? jsonResponse(OTRO) : problema(404, 'Record c7 does not exist'))
      }
    ])
    montar(
      <>
        <AprobacionesPage />
        <Sonda />
      </>,
      { ruta: '/tasks/approvals', camino: '/tasks/approvals', usuario: APROBADORA, permisos: APROBACION }
    )
    const tabla = await screen.findByRole('table', { name: 'Por aprobar' })
    const fila = (await within(tabla).findByText('C-007 · Botiquín')).closest('tr')!
    expect(within(fila).getByRole('link')).toBeInTheDocument()
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    // la sonda y la fila observan la misma consulta y se pintan en el mismo commit: al ver el error, la fila ya lo recibió
    await waitFor(() => expect(screen.getByLabelText('errores de c7')).toHaveTextContent('1'))
    expect(lecturas).toBe(2)
    expect(within(fila).getByText('C-007 · Botiquín')).toBeInTheDocument()
    expect(within(fila).getByText('Aprobación de compromiso')).toBeInTheDocument()
    expect(within(fila).getByRole('link')).toBeInTheDocument()
    expect(within(fila).queryByText('Registro reservado')).not.toBeInTheDocument()
  })

  it('sin el módulo de avisos lo dice en lugar de una bandeja vacía', async () => {
    fetch = mockFetch(rutas().filter((r) => r.path !== '/auth/me/notifications'))
    montar(<AprobacionesPage />, { ruta: '/tasks/approvals', camino: '/tasks/approvals', usuario: APROBADORA, permisos: APROBACION })
    expect(await screen.findByText(/Los avisos no están disponibles en esta instalación/)).toBeInTheDocument()
    expect(screen.queryByText('No tiene decisiones pendientes.')).not.toBeInTheDocument()
  })
})

describe('S31 · aprobación de compromiso', () => {
  it('la regla que bloquea deshabilita la decisión y dice por qué; devolver pide motivo y se aplica con la versión leída', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/objects/commitment/records/c1/transitions/return_to_draft', body: { ...PENDIENTE, state: 'draft' } }]))
    red = reglas()
    montar(<AprobacionPage />, {
      ruta: '/tasks/approvals/commitment/c1',
      camino: '/tasks/approvals/commitment/:recordId',
      usuario: APROBADORA,
      permisos: APROBACION
    })
    expect(await screen.findByRole('link', { name: 'Mesa de diálogo de agosto · MESA DE DIALOGO' })).toHaveAttribute('href', '/projects/p1/engagements/e1')
    const reglasDelPanel = screen.getByRole('complementary', { name: 'Reglas' })
    expect(
      await within(reglasDelPanel).findByText(
        'Por segregación de funciones, quien registró un compromiso, un aporte o un programa no lo aprueba, y el responsable de un compromiso no lo verifica.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar la decisión' })).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: 'Devolver a borrador' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar la decisión' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar la decisión' }))
    expect(await screen.findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Falta el acta firmada')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar la decisión' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/tasks/approvals'))
    const [llamada] = red.a('POST', '/objects/commitment/records/c1/transitions/return_to_draft')
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-08T15:00:00Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Falta%20el%20acta%20firmada")
  })

  it('un monto guardado inválido de la campaña es una advertencia de CAP_DATA_INVALID que se dice y no bloquea', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/transition-checks',
        responder: () =>
          jsonResponse({
            allowed: true,
            blocking: [],
            warnings: [{ code: 'CAP_DATA_INVALID', message: 'Un monto de la campaña no es válido: el tope no se verificó', field: 'exploration_campaign' }]
          })
      }
    ])
    montar(<AprobacionPage />, {
      ruta: '/tasks/approvals/commitment/c1',
      camino: '/tasks/approvals/commitment/:recordId',
      usuario: APROBADORA,
      permisos: APROBACION
    })
    const reglasDelPanel = await screen.findByRole('complementary', { name: 'Reglas' })
    expect(await within(reglasDelPanel).findByText('Un monto de la campaña no es válido: el tope no se verificó')).toBeInTheDocument()
    expect(within(reglasDelPanel).queryByText('CAP_DATA_INVALID')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar la decisión' })).toBeEnabled())
  })

  it('sin asignación vigente lee el compromiso y no decide', async () => {
    fetch = mockFetch([
      ...rutas().filter((r) => !(r.path instanceof RegExp && String(r.path).includes('project_assignment'))),
      { path: /^\/objects\/project_assignment\/records/, body: pagina([]) }
    ])
    red = reglas()
    montar(<AprobacionPage />, {
      ruta: '/tasks/approvals/commitment/c1',
      camino: '/tasks/approvals/commitment/:recordId',
      usuario: APROBADORA,
      permisos: APROBACION
    })
    expect(await screen.findByText('No tiene una asignación vigente a este proyecto: puede leer, no decidir.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByText(/Su rol no tiene decisiones/)).not.toBeInTheDocument()
  })

  it('al pasar por la bandeja a otro compromiso ya leído, el motivo y la decisión empiezan de cero', async () => {
    fetch = mockFetch(rutas())
    red = reglas()
    abrirS31('c7')
    const bandeja = () => screen.getByRole('navigation', { name: 'Por aprobar' })
    expect(await screen.findByRole('heading', { name: 'Botiquín' })).toBeInTheDocument()
    await userEvent.click(await within(bandeja()).findByRole('link', { name: 'Pendiente c1' }))
    expect(await screen.findByRole('heading', { name: 'Reservorio de agua para Tunas Pampa' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('radio', { name: 'Devolver a borrador' }))
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Motivo de c1')
    await userEvent.click(await within(bandeja()).findByRole('link', { name: 'Pendiente c7' }))
    expect(await screen.findByRole('heading', { name: 'Botiquín' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Motivo (obligatorio)')).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'Devolver a borrador' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Aprobar' })).toBeChecked()
  })

  it('un 412 al decidir dice que otra persona cambió el compromiso y ofrece recargar', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'POST', path: '/sgspe/transition-checks', responder: () => jsonResponse({ allowed: true, blocking: [], warnings: [] }) },
      { method: 'POST', path: '/objects/commitment/records/c7/transitions/approve', responder: () => problema(412, 'Versión vieja') }
    ])
    abrirS31('c7')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar la decisión' })).toBeEnabled())
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Conforme')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar la decisión' }))
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(ubicacion.actual).toBe('/tasks/approvals/commitment/c7')
  })

  it('una bandeja que falla lo dice, y la campaña que la cuenta no lee dice «No disponible»', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { path: '/auth/me/notifications', responder: () => problema(500, 'Falla') },
      { path: '/objects/exploration_campaign/records/camp1', responder: () => problema(403, 'Sin permiso') },
      { method: 'POST', path: '/sgspe/transition-checks', responder: () => jsonResponse({ allowed: true, blocking: [], warnings: [] }) }
    ])
    abrirS31('c1')
    const bandeja = await screen.findByRole('navigation', { name: 'Por aprobar' })
    expect(await within(bandeja).findByText('No se pudo cargar esta información. Los filtros se conservan.')).toBeInTheDocument()
    const resumen = screen.getByRole('region', { name: 'El compromiso' })
    expect(await within(resumen).findByText('No disponible')).toBeInTheDocument()
    expect(within(resumen).queryByText('…')).not.toBeInTheDocument()
  })
})

// F5 (spec §3.8): el aviso de aprobación de un aporte llega al alta y el de un programa al enviarlo; los dos se deciden en su ficha
describe('S48 · aprobaciones de programas y aportes', () => {
  it('dicen su monto, si se puede decidir con la razón, y «Revisar» lleva a su ficha', async () => {
    fetch = mockFetch([
      {
        path: '/auth/me/notifications',
        body: {
          content: [aviso('n1', 'social_contribution', 'a1'), aviso('n2', 'social_program', 'sp1')],
          page: 0,
          size: 200,
          totalElements: 2,
          totalPages: 1
        }
      },
      { path: '/objects/social_contribution/records/a1', body: APORTE },
      { path: '/objects/social_program/records/sp1', body: { ...PROGRAMA, state: 'pending_approval' } },
      { path: /^\/objects\/(social_contribution|social_program)\/records\/[a-z0-9]+\/transitions/, body: [APROBAR] }
    ])
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/transition-checks',
        responder: (l) => {
          const { recordId } = l.cuerpo as { recordId: string }
          return jsonResponse(
            recordId === 'a1'
              ? { allowed: false, blocking: [{ code: 'SEGREGATION_OF_DUTIES', message: 'Usted registró este aporte (P5)', field: 'record' }], warnings: [] }
              : { allowed: true, blocking: [], warnings: [] }
          )
        }
      }
    ])
    montar(<AprobacionesPage />, { ruta: '/tasks/approvals', camino: '/tasks/approvals', usuario: APROBADORA, permisos: PERMISOS_DE_APROBACION })
    const tabla = await screen.findByRole('table', { name: 'Por aprobar' })
    const aporte = (await within(tabla).findByText('AP-001')).closest('tr') as HTMLElement
    expect(within(aporte).getByText('Aprobación de aporte')).toBeInTheDocument()
    expect(within(aporte).getByText('S/ 1,750.50')).toBeInTheDocument()
    expect(
      await within(aporte).findByText(
        'No: Por segregación de funciones, quien registró un compromiso, un aporte o un programa no lo aprueba, y el responsable de un compromiso no lo verifica.'
      )
    ).toBeInTheDocument()
    expect(within(aporte).getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/r/social_contribution/a1')
    const programa = (await within(tabla).findByText('PS-001 · Programa Ejemplo de agua segura')).closest('tr') as HTMLElement
    expect(within(programa).getByText('Aprobación de programa')).toBeInTheDocument()
    expect(await within(programa).findByText('Sí')).toBeInTheDocument()
    expect(within(programa).getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/r/social_program/sp1')
  })
})
