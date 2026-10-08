import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { definicion, pagina, registro, workflow } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { ADMINISTRACION_DE_PROYECTO, AUDITORA, permisos } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const P1 = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa', interest_threshold: 4, power_threshold: null }, { state: 'active' })
const VIGENTE = registro('a1', {
  project: 'p1',
  member_user_id: 'u-pad',
  member_user_email: 'pad@sgspe.test',
  role_name: 'PROJECT_ADMIN',
  active: true,
  start_date: '2026-01-01'
})
const VENCIDA = registro('a2', {
  project: 'p1',
  member_user_id: 'u-x',
  member_user_email: 'antes@sgspe.test',
  role_name: 'FIELD_AGENT',
  active: true,
  end_date: '2026-01-31'
})

const rutas = () => [
  { path: '/objects/project/records/p1', body: P1 },
  { method: 'PUT', path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  {
    path: '/metadata/objects/project',
    body: definicion('project', [['interest_threshold', { type: 'DECIMAL' }], ['power_threshold', { type: 'DECIMAL' }], 'name'])
  },
  {
    path: '/metadata/objects/project_assignment',
    body: definicion('project_assignment', ['active', 'end_date', 'member_user_id', 'member_user_email', 'role_name', 'start_date', 'project'])
  },
  { path: /^\/objects\/project_assignment\/records\?.*member_user_id=u-pad/, body: pagina([VIGENTE]) },
  { path: '/objects/project_assignment/records', body: pagina([VIGENTE, VENCIDA]) },
  { method: 'PUT', path: '/objects/project_assignment/records/a1', body: VIGENTE },
  {
    path: '/objects/exploration_campaign/records',
    body: pagina([
      registro('c1', { name: 'Perforación 2026', social_support_cap: 100000, executed_social_amount: 25000, currency: 'PEN', other_currency_items_count: 2 })
    ])
  },
  { path: '/objects/project_party/records', body: pagina([]) },
  { path: '/objects/project/records/p1/related/project_concession', body: pagina([registro('mc1', { code: 'CM-77', name: 'Tunas 1' })]) }
]

const PAD = permisos({
  project: ['READ', 'UPDATE'],
  project_assignment: ['READ', 'CREATE', 'UPDATE'],
  exploration_campaign: ['READ', 'CREATE'],
  project_party: ['READ', 'CREATE']
})

describe('S11 · equipo y parámetros', () => {
  it('marca las asignaciones vencidas y termina una vigente', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    const tabla = await screen.findByRole('table', { name: 'Equipo' })
    const [, vigente, vencida] = within(tabla).getAllByRole('row')
    expect(within(vencida).getByText('Vencida: no da acceso de escritura')).toBeInTheDocument()
    await userEvent.click(within(vigente).getByRole('button', { name: 'Terminar asignación' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project_assignment/records/a1')).toHaveLength(1))
    expect(red.a('PUT', '/objects/project_assignment/records/a1')[0].cuerpo).toMatchObject({ attributes: { active: false } })
  })

  it('un usuario que no es de la organización (400 USER_REFERENCE) marca el correo con el texto del código, nunca el código', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/users', status: 403, body: { title: 'Forbidden', status: 403 } },
      { path: '/roles', status: 403, body: { title: 'Forbidden', status: 403 } },
      ...rutas()
    ])
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/project_assignment/records',
        responder: () => problema(400, 'El usuario no es de la organización', [{ field: 'member_user_email', message: 'USER_REFERENCE' }])
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Asignar persona' }))
    await userEvent.type(await screen.findByLabelText('Correo del usuario'), 'otra@ejemplo.test')
    await userEvent.type(screen.getByLabelText('Identificador del usuario'), '6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f')
    await userEvent.type(screen.getByLabelText('Rol en el proyecto'), 'FIELD_AGENT')
    await userEvent.click(screen.getByRole('button', { name: 'Asignar' }))
    const texto = 'El correo y el identificador no nombran a un usuario de su organización.'
    expect((await screen.findAllByText(texto)).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Correo del usuario')).toHaveAccessibleDescription(texto)
    expect(screen.queryByText('USER_REFERENCE')).not.toBeInTheDocument()
  })

  it('las campañas muestran lo ejecutado frente al tope y avisan de otra moneda', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    await userEvent.click(await screen.findByRole('tab', { name: 'Campañas' }))
    expect(await screen.findByRole('progressbar', { name: 'Perforación 2026' })).toHaveAttribute('aria-valuenow', '25000')
    expect(screen.getAllByText('25,000 de 100,000 PEN').length).toBeGreaterThan(0)
    expect(screen.getByText('2 registros en otra moneda no se suman (ASM-063)')).toBeInTheDocument()
  })

  it('los parámetros dicen si son por defecto o cambiados y se guardan con la versión leída', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    expect(await screen.findByText('(cambiado)', { exact: false })).toBeInTheDocument()
    const poder = screen.getByLabelText(/Umbral de poder/)
    expect(poder).toHaveValue(3)
    await userEvent.clear(poder)
    await userEvent.type(poder, '2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project/records/p1')).toHaveLength(1))
    const [guardado] = red.a('PUT', '/objects/project/records/p1')
    expect(guardado.cabeceras.get('If-Match')).toBe(`"${P1.updatedAt}"`)
    expect(guardado.cuerpo).toMatchObject({ attributes: { interest_threshold: 4, power_threshold: 2.5, name: 'Pukaqaqa' } })
  })

  it('con "u" sobre project (todos los campos de solo lectura, como el analista SIG) los parámetros se ven pero no se guardan', async () => {
    const soloLectura = definicion('project', [
      ['interest_threshold', { type: 'DECIMAL', editable: false }],
      ['power_threshold', { type: 'DECIMAL', editable: false }],
      ['name', { editable: false }]
    ])
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [{ path: '/metadata/objects/project', body: soloLectura }, ...rutas()])
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    await waitFor(() => expect(red!.a('GET', '/metadata/objects/project').length).toBeGreaterThan(0))
    expect(await screen.findByLabelText(/Umbral de poder/)).toBeDisabled()
    expect(screen.getByLabelText(/Umbral de interés/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar parámetros' })).not.toBeInTheDocument()
  })

  it('sin permisos de escritura, todo es de solo lectura', async () => {
    fetch = abrirPortal(
      '/projects/p1/settings',
      AUDITORA,
      permisos({ project: ['READ'], project_assignment: ['READ'], exploration_campaign: ['READ'], project_party: ['READ'] }),
      rutas()
    )
    await screen.findByRole('table', { name: 'Equipo' })
    expect(screen.queryByRole('button', { name: 'Asignar persona' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Terminar asignación' })).not.toBeInTheDocument()
  })
})
