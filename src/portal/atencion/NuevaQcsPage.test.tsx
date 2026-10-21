import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeAtencion, EQUIPO_DE_RELACIONES, sinPersona, DEF_QUEJA } from '../../test/atencion'
import { montar, pagina, registro, ubicacion } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { ahoraEnLima, instanteDeLima, textoDeDia } from '../datos/fechas'
import { NuevaQcsPage } from './NuevaQcsPage'

// S37 (screens.md §8): el tipo con su definición y la regla de sus plazos, quien registra como quien recibe, la anónima sin
// persona ni grupo, la explicación de la confidencialidad, el motivo obligatorio y la Idempotency-Key nativa del alta
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const GRUPO = registro('s1', { project: 'p1', organization: 'o1' })
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeAtencion(RELACIONISTA),
  { path: '/objects/stakeholder/records', body: pagina([GRUPO]) },
  { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Junta de regantes' }) },
  { path: '/objects/person/records', body: pagina([registro('pe1', { given_names: 'Persona', surnames: 'Ejemplo 1' })]) },
  { path: '/auth/users', status: 403, body: { title: 'Forbidden', status: 403 } },
  { path: '/users', status: 403, body: { title: 'Forbidden', status: 403 } },
  { method: 'POST', path: '/objects/grievance/records', status: 201, body: registro('g9', { project: 'p1', code: 'Q-009' }) },
  { method: 'POST', path: '/objects/stakeholder_request/records', status: 201, body: registro('r9', { project: 'p1', code: 'S-009' }) }
]
const abrir = (ruta = '/projects/p1/attention/new', p = EQUIPO_DE_RELACIONES) =>
  montar(<NuevaQcsPage />, { ruta, camino: '/projects/:projectId/attention/new', usuario: RELACIONISTA, permisos: p })

const llenar = async (codigo: string) => {
  await userEvent.type(await screen.findByLabelText('Código'), codigo)
  await userEvent.type(screen.getByLabelText('Descripción'), 'Polvo en la vía')
  await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'recibida en la oficina')
}

describe('S37 · registrar QCS', () => {
  it('«Cancelar» vuelve a la interacción de origen o a la lista de atención, sin escribir (revisión de UX, etapa 5)', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    const { unmount } = abrir('/projects/p1/attention/new?origin_engagement=e7')
    expect(await screen.findByRole('heading', { level: 1, name: 'Registrar queja, consulta o solicitud' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/engagements/e7'))
    unmount()
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/attention'))
    expect(red.llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0)
  })

  it('registra una queja con quien registra como quien la recibe, el motivo y la clave, y abre su ficha', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    expect(await screen.findByText(/El acuse vence 5 días hábiles después de la recepción/)).toBeInTheDocument()
    await llenar('Q-009')
    await userEvent.selectOptions(screen.getByLabelText('Severidad'), 'CRITICA')
    expect(screen.getByText('Una queja «Alta» o «Crítica» la resuelve otra persona: quien aprueba.')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Grupo de interés'), 's1')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar queja' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/grievances/g9'))
    const [alta] = red.a('POST', '/objects/grievance/records')
    expect(alta.cuerpo).toMatchObject({
      attributes: {
        project: 'p1',
        code: 'Q-009',
        description: 'Polvo en la vía',
        severity: 'CRITICA',
        anonymous: false,
        confidential: false,
        received_by_user_id: 'u-relacionista',
        received_by_user_email: 'relacionista@sgspe.test',
        stakeholder: 's1'
      }
    })
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''recibida%20en%20la%20oficina")
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  // hallazgo U-07: la recepción se escribe como dd/mm/aaaa y hora de 24 h, y viaja el mismo instante que con el datetime-local
  it('la fecha y hora de recepción se escriben en dd/mm/aaaa y 24 h, y viaja el instante de esa hora de Lima', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    const dia = await screen.findByLabelText('Fecha y hora de recepción')
    const hora = screen.getByLabelText('Fecha y hora de recepción (hora)')
    // propone la hora de Lima de ahora, ya en dd/mm/aaaa
    expect(dia).toHaveValue(textoDeDia(ahoraEnLima()))
    await userEvent.clear(dia)
    await userEvent.type(dia, '20102026')
    await userEvent.clear(hora)
    await userEvent.type(hora, '1015')
    await llenar('Q-011')
    expect(dia).toHaveValue('20/10/2026')
    expect(hora).toHaveValue('10:15')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar queja' }))
    await waitFor(() => expect(red!.a('POST', '/objects/grievance/records')).toHaveLength(1))
    const { attributes } = red.a('POST', '/objects/grievance/records')[0].cuerpo as { attributes: Record<string, unknown> }
    expect(attributes.received_at).toBe(instanteDeLima('2026-10-20T10:15'))
    expect(attributes.received_at).toBe('2026-10-20T15:15:00.000Z')
  })

  it('una fecha de recepción que no es una fecha no se registra y lo dice en el campo', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    const dia = await screen.findByLabelText('Fecha y hora de recepción')
    await userEvent.clear(dia)
    await userEvent.type(dia, '31/02/2026')
    await llenar('Q-012')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar queja' }))
    expect(await screen.findByText('Escriba la fecha como día/mes/año, por ejemplo 20/10/2026')).toBeInTheDocument()
    expect(red.a('POST', '/objects/grievance/records')).toHaveLength(0)
  })

  it('una anónima no ofrece ni manda grupo ni persona; la confidencial explica quién la leerá', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    await llenar('Q-010')
    await userEvent.selectOptions(screen.getByLabelText('Grupo de interés'), 's1')
    await userEvent.click(screen.getByLabelText(/^Anónima/))
    expect(screen.queryByLabelText('Grupo de interés')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar persona')).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText(/^Confidencial/))
    expect(screen.getAllByText(/Solo la leerán la gestión de quejas, su responsable, usted, que la recibe/).length).toBeGreaterThan(0)
    // sgspe#20: la tarea de acuse de una confidencial es genérica, sin vínculo con la queja
    expect(screen.getByText('Se crea una tarea genérica de acusar recibo, sin vínculo con la queja, para no revelarla.')).toBeInTheDocument()
    expect(screen.queryByText('Se crea la tarea de acusar recibo.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar queja' }))
    await waitFor(() => expect(red!.a('POST', '/objects/grievance/records')).toHaveLength(1))
    const { attributes } = red.a('POST', '/objects/grievance/records')[0].cuerpo as { attributes: Record<string, unknown> }
    expect(attributes).toMatchObject({ anonymous: true, confidential: true, received_by_user_id: 'u-relacionista' })
    expect(attributes).not.toHaveProperty('stakeholder')
    expect(attributes).not.toHaveProperty('person')
  })

  // revisión de UX, decisión 6: el código propuesto sigue al tipo mientras no se toque, y uno escrito no se pisa
  it('propone el código del tipo elegido y no pisa uno escrito', async () => {
    fetch = mockFetch(
      rutas([
        { path: /^\/sgspe\/codes\/next\?object=grievance&/, body: { code: 'QUE-2026-003' } },
        { path: /^\/sgspe\/codes\/next\?object=inquiry&/, body: { code: 'CON-2026-001' } },
        { path: /^\/sgspe\/codes\/next\?object=stakeholder_request&/, body: { code: 'SOL-2026-007' } }
      ])
    )
    abrir()
    const codigo = await screen.findByLabelText('Código')
    await waitFor(() => expect(codigo).toHaveValue('QUE-2026-003'))
    await userEvent.click(screen.getByRole('radio', { name: /Consulta/ }))
    await waitFor(() => expect(screen.getByLabelText('Código')).toHaveValue('CON-2026-001'))
    await userEvent.clear(screen.getByLabelText('Código'))
    await userEvent.type(screen.getByLabelText('Código'), 'C-PROPIO')
    await userEvent.click(screen.getByRole('radio', { name: /Solicitud/ }))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByLabelText('Código')).toHaveValue('C-PROPIO')
  })

  it('el tipo de la URL, sus datos propios y su regla de plazos; sin plazo en las solicitudes', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir('/projects/p1/attention/new?type=stakeholder_request&origin_engagement=e1')
    expect(await screen.findByRole('radio', { name: /Solicitud/ })).toBeChecked()
    expect(screen.getByText('Las solicitudes no tienen plazo de respuesta.')).toBeInTheDocument()
    await llenar('S-009')
    await userEvent.type(screen.getByLabelText('Recurso pedido'), 'Calaminas')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar solicitud' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/requests/r9'))
    expect(red.a('POST', '/objects/stakeholder_request/records')[0].cuerpo).toMatchObject({
      attributes: { requested_resource: 'Calaminas', origin_engagement: 'e1' }
    })
  })

  it('no manda nada sin código, descripción ni motivo, y un error del servidor va junto a su campo', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/grievance/records',
        responder: () => problema(400, 'anónima con identidad', [{ field: 'stakeholder', message: 'ANONYMOUS_WITH_IDENTITY' }])
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar queja' }))
    expect(screen.getAllByText('Complete este dato.')).toHaveLength(2)
    expect(screen.getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('POST', '/objects/grievance/records')).toHaveLength(0)
    await llenar('Q-011')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar queja' }))
    expect(await screen.findByText(/quítelos o desmarque/)).toBeInTheDocument()
  })

  // el selector lista solo los grupos que la cuenta lee; si uno dejó de leerse antes de guardar, wasichai responde 400 sobre la
  // relación (spec 4.4 §3.12)
  it('el grupo de interés que el servidor no deja vincular (400 sobre la relación) se dice junto a su campo, sin el texto en inglés', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/grievance/records',
        responder: () => problema(400, "Invalid value for 'stakeholder'", [{ field: 'stakeholder', message: 'no record with this id' }])
      }
    ])
    abrir()
    await llenar('Q-012')
    const grupo = screen.getByLabelText('Grupo de interés')
    await waitFor(() => expect(grupo.querySelector('option[value="s1"]')).not.toBeNull())
    await userEvent.selectOptions(grupo, 's1')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar queja' }))
    await waitFor(() => expect(screen.getByLabelText('Grupo de interés')).toHaveAccessibleDescription('El registro elegido no existe o es de otro proyecto.'))
    expect(screen.queryByText(/no record with this id|Invalid value/)).not.toBeInTheDocument()
    // el alta salió una vez y fue el servidor quien la rechazó
    expect(red.a('POST', '/objects/grievance/records')).toHaveLength(1)
  })

  it('la persona solo se ofrece a quien la lee; sin asignación vigente el alta no se ofrece', async () => {
    fetch = mockFetch(rutas([{ path: '/metadata/objects/grievance', body: sinPersona(DEF_QUEJA) }]))
    abrir()
    expect(await screen.findByLabelText('Código')).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar persona')).not.toBeInTheDocument()
    fetch.restore()
    fetch = mockFetch(rutas([{ path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) }]))
    abrir('/projects/p1/attention/new', permisos({ ...EQUIPO_DE_RELACIONES.objects }))
    expect(await screen.findByText('No está asignado a este proyecto: puede leerlo, pero no cambiarlo.')).toBeInTheDocument()
  })
})
