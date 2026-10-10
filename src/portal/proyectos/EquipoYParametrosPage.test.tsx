import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar, pagina, registro, workflow } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { ADMINISTRACION, ADMINISTRACION_DE_PROYECTO, AUDITORA, permisos, permisosConCapacidades } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { useDefinicion } from '../datos/registros'
import { PartesDelProyecto } from './EquipoYPartes'
import { EquipoYParametrosPage } from './EquipoYParametrosPage'
import { problemasDeParametros } from './parametros'

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // ninguna prueba depende del reloj real: el instante es 03:00Z del 2 de octubre, cuando en Lima (UTC-5) todavía es el 1, que
  // es la fecha que cuenta. solo se finge Date: los temporizadores siguen reales
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T03:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
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
  start_date: '2026-01-01',
  end_date: null
})
const VENCIDA = registro('a2', {
  project: 'p1',
  member_user_id: 'u-x',
  member_user_email: 'antes@sgspe.test',
  role_name: 'FIELD_AGENT',
  active: true,
  end_date: '2026-01-31'
})

const PROGRAMADA = registro('a3', {
  project: 'p1',
  member_user_id: 'u-y',
  member_user_email: 'despues@sgspe.test',
  role_name: 'FIELD_AGENT',
  active: true,
  start_date: '2026-12-01',
  end_date: null
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
  { path: '/objects/project_assignment/records', body: pagina([VIGENTE, VENCIDA, PROGRAMADA]) },
  { method: 'PUT', path: '/objects/project_assignment/records/a1', body: VIGENTE },
  { method: 'PUT', path: '/objects/project_assignment/records/a3', body: PROGRAMADA },
  {
    path: '/metadata/objects/exploration_campaign',
    body: definicion('exploration_campaign', [
      ['campaign_status', { type: 'ENUM', label: 'Estado de la campaña', enumOptions: ['EN EJECUCION'] }],
      ['activity_type', { type: 'ENUM', label: 'Tipo de actividad', enumOptions: ['PERFORACION'] }],
      'name'
    ])
  },
  {
    path: '/objects/exploration_campaign/records',
    body: pagina([
      registro('c1', {
        name: 'Perforación 2026',
        campaign_status: 'EN EJECUCION',
        activity_type: 'PERFORACION',
        social_support_cap: 100000,
        executed_social_amount: 25000,
        currency: 'PEN',
        other_currency_items_count: 2
      })
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
  it('marca las asignaciones vencidas y programadas; termina una vigente con la fecha de Lima, tras confirmar', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    const tabla = await screen.findByRole('table', { name: 'Equipo' })
    const [, vigente, vencida, programada] = within(tabla).getAllByRole('row')
    expect(within(vencida).getByText('Vencida: no da acceso de escritura')).toBeInTheDocument()
    expect(within(vencida).queryByRole('button')).not.toBeInTheDocument()
    expect(within(programada).getByText('Programada: aún no da acceso de escritura')).toBeInTheDocument()
    await userEvent.click(within(vigente).getByRole('button', { name: 'Terminar asignación de pad@sgspe.test' }))
    // pide confirmar: nada se escribe todavía
    expect(red.a('PUT', '/objects/project_assignment/records/a1')).toHaveLength(0)
    await userEvent.click(within(vigente).getByRole('button', { name: 'Sí, terminar' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project_assignment/records/a1')).toHaveLength(1))
    // son las 22:00 del 1 de octubre en Lima, no el 2 de UTC
    expect(red.a('PUT', '/objects/project_assignment/records/a1')[0].cuerpo).toMatchObject({ attributes: { active: false, end_date: '2026-10-01' } })
  })

  it('el rol sale con su etiqueta si la cuenta lee los roles, y el período en es-PE (revisión final, M12)', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/roles', body: [{ name: 'PROJECT_ADMIN', label: 'Administración de proyectos' }] },
      ...rutas()
    ])
    const tabla = await screen.findByRole('table', { name: 'Equipo' })
    const [, vigente, vencida] = within(tabla).getAllByRole('row')
    expect(await within(vigente).findByText('Administración de proyectos')).toBeInTheDocument()
    expect(within(vigente).getByText('1 ene. 2026 – …')).toBeInTheDocument()
    // un rol que la lista no trae sale con su nombre
    expect(within(vencida).getByText('FIELD_AGENT')).toBeInTheDocument()
  })

  // WAS-ADR-0053: con capabilities sin MANAGE_ORGANIZATION no se pide GET /api/roles para que responda 403; con ella, sí
  const OBJETOS_PAD = {
    project: ['READ', 'UPDATE'],
    project_assignment: ['READ', 'CREATE', 'UPDATE'],
    exploration_campaign: ['READ', 'CREATE'],
    project_party: ['READ', 'CREATE']
  }
  const ROLES = { path: '/roles', body: [{ name: 'PROJECT_ADMIN', label: 'Administración de proyectos' }] }

  it('sin MANAGE_ORGANIZATION en capabilities no pide los roles: el rol sale con su nombre', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, permisosConCapacidades(OBJETOS_PAD, ['MANAGE_METADATA']), [ROLES, ...rutas()])
    red = espiarRed()
    const tabla = await screen.findByRole('table', { name: 'Equipo' })
    expect(await within(tabla).findByText('PROJECT_ADMIN')).toBeInTheDocument()
    expect(red.a('GET', '/roles')).toHaveLength(0)
  })

  it('con MANAGE_ORGANIZATION en capabilities pide los roles y los dice con su etiqueta', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, permisosConCapacidades(OBJETOS_PAD, ['MANAGE_ORGANIZATION']), [ROLES, ...rutas()])
    red = espiarRed()
    const tabla = await screen.findByRole('table', { name: 'Equipo' })
    expect(await within(tabla).findByText('Administración de proyectos')).toBeInTheDocument()
    expect(red.a('GET', '/roles')).toHaveLength(1)
  })

  it('«Asignar persona» con capabilities vacío no pide usuarios ni roles y muestra los campos a mano, sin pasar por la lista', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, permisosConCapacidades(OBJETOS_PAD, []), [
      { path: '/users', body: [{ id: 'u-1', email: 'ana@sgspe.test', displayName: 'Usuaria de prueba', enabled: true }] },
      ROLES,
      ...rutas()
    ])
    red = espiarRed()
    // la lista de usuarios no aparece en ningún momento: el modo manual no salta a ella
    const observador = new MutationObserver(() => {
      if (screen.queryByRole('combobox', { name: 'Usuario' })) throw new Error('apareció la lista de usuarios')
    })
    observador.observe(document.body, { childList: true, subtree: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Asignar persona' }))
    expect(await screen.findByLabelText('Correo del usuario')).toBeInTheDocument()
    expect(screen.getByLabelText('Identificador del usuario')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Rol en el proyecto' })).toBeInTheDocument()
    observador.disconnect()
    expect(red.a('GET', '/users')).toHaveLength(0)
    expect(red.a('GET', '/roles')).toHaveLength(0)
  })

  it('cancelar la confirmación no escribe, y terminar una programada no deja el fin antes del inicio', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    const tabla = await screen.findByRole('table', { name: 'Equipo' })
    const fila = () => within(tabla).getAllByRole('row')[3]
    await userEvent.click(within(fila()).getByRole('button', { name: 'Terminar asignación de despues@sgspe.test' }))
    await userEvent.click(within(fila()).getByRole('button', { name: 'Cancelar' }))
    expect(red.a('PUT', '/objects/project_assignment/records/a3')).toHaveLength(0)
    await userEvent.click(within(fila()).getByRole('button', { name: 'Terminar asignación de despues@sgspe.test' }))
    await userEvent.click(within(fila()).getByRole('button', { name: 'Sí, terminar' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project_assignment/records/a3')).toHaveLength(1))
    expect(red.a('PUT', '/objects/project_assignment/records/a3')[0].cuerpo).toMatchObject({ attributes: { active: false, end_date: '2026-12-01' } })
  })

  it('una asignación propia vencida por fecha, aunque siga activa, no ofrece escribir en el proyecto; el equipo sí (exento)', async () => {
    const propiaVencida = { ...VIGENTE, attributes: { ...VIGENTE.attributes, end_date: '2026-01-31' } }
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id=u-pad/, body: pagina([propiaVencida]) },
      ...rutas()
    ])
    await screen.findByRole('table', { name: 'Equipo' })
    expect(screen.getByText(/No está asignado a este proyecto/)).toBeInTheDocument()
    // revisión final, I3: las escrituras de project_assignment no pasan por ProjectScopeGuard (security.md §9.2, ítem 5)
    expect(screen.getByRole('button', { name: 'Asignar persona' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminar asignación de pad@sgspe.test' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Campañas' }))
    await screen.findByText('Perforación 2026')
    expect(screen.queryByRole('region', { name: 'Campaña de exploración' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Parámetros y políticas' }))
    expect(await screen.findByLabelText(/Umbral de poder/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar parámetros' })).not.toBeInTheDocument()
  })

  it('un PAD sin ninguna asignación forma el equipo: «Asignar persona» escribe la asignación (revisión final, I3)', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id=u-pad/, body: pagina([]) },
      { path: '/users', status: 403, body: { title: 'Forbidden', status: 403 } },
      { path: '/roles', status: 403, body: { title: 'Forbidden', status: 403 } },
      { method: 'POST', path: '/objects/project_assignment/records', body: registro('a9', {}) },
      ...rutas()
    ])
    red = espiarRed()
    await userEvent.click(await screen.findByRole('button', { name: 'Asignar persona' }))
    await userEvent.type(await screen.findByLabelText('Correo del usuario'), 'nueva@sgspe.test')
    await userEvent.type(screen.getByLabelText('Identificador del usuario'), '6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f')
    await userEvent.type(screen.getByLabelText('Rol en el proyecto'), 'ROL_DE_PRUEBA')
    await userEvent.click(screen.getByRole('button', { name: 'Asignar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/project_assignment/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/project_assignment/records')[0].cuerpo).toMatchObject({
      attributes: { project: 'p1', member_user_email: 'nueva@sgspe.test' }
    })
  })

  it('ADMIN sin asignación escribe en todo S11 (P38: solo ADMIN salta la asignación)', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION, { admin: true, objects: PAD.objects }, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id=u-admin/, body: pagina([]) },
      ...rutas()
    ])
    expect(await screen.findByRole('button', { name: 'Asignar persona' })).toBeInTheDocument()
    expect(screen.queryByText(/No está asignado a este proyecto/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Campañas' }))
    expect(await screen.findByRole('region', { name: 'Campaña de exploración' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Parámetros y políticas' }))
    expect(await screen.findByRole('button', { name: 'Guardar parámetros' })).toBeInTheDocument()
  })

  it('un 412 al terminar una asignación dice que otra persona la cambió y «Recargar» relee la lista', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed([{ method: 'PUT', path: '/objects/project_assignment/records/a1', responder: () => problema(412, 'Precondition Failed') }])
    const tabla = await screen.findByRole('table', { name: 'Equipo' })
    await userEvent.click(within(tabla).getByRole('button', { name: 'Terminar asignación de pad@sgspe.test' }))
    await userEvent.click(within(tabla).getByRole('button', { name: 'Sí, terminar' }))
    const antes = red.a('GET', '/objects/project_assignment/records').length
    const recargar = await screen.findByRole('button', { name: 'Recargar' })
    expect(screen.getByText(/pad@sgspe.test: /)).toBeInTheDocument()
    await userEvent.click(recargar)
    await waitFor(() => expect(red!.a('GET', '/objects/project_assignment/records').length).toBeGreaterThan(antes))
    expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument()
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
    expect(screen.getByText('2 registros en otra moneda no se suman')).toBeInTheDocument()
  })

  it('el estado y el tipo de actividad de una campaña salen con la etiqueta de su campo en la metadata, no solos', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    await userEvent.click(await screen.findByRole('tab', { name: 'Campañas' }))
    expect(await screen.findByText('Estado de la campaña: EN EJECUCION · Tipo de actividad: PERFORACION')).toBeInTheDocument()
  })

  it('los parámetros dicen si son por defecto o cambiados y se guardan con la versión leída', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    expect(await screen.findByText('(cambiado)', { exact: false })).toBeInTheDocument()
    const poder = screen.getByLabelText(/Umbral de poder/)
    expect(poder).toHaveValue('3')
    await userEvent.clear(poder)
    await userEvent.type(poder, '2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project/records/p1')).toHaveLength(1))
    const [guardado] = red.a('PUT', '/objects/project/records/p1')
    expect(guardado.cabeceras.get('If-Match')).toBe(`"${P1.updatedAt}"`)
    expect(guardado.cuerpo).toMatchObject({ attributes: { interest_threshold: 4, power_threshold: 2.5, name: 'Pukaqaqa' } })
  })

  it('las campañas y las concesiones dicen su error de carga, no una lista vacía; un 403 es «No disponible»', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/objects/exploration_campaign/records', status: 403, body: { title: 'Forbidden', status: 403 } },
      { path: '/objects/project/records/p1/related/project_concession', status: 500, body: { title: 'Error', status: 500 } },
      ...rutas()
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Campañas' }))
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Partes y concesiones' }))
    expect((await screen.findAllByText(/No se pudo cargar/)).length).toBeGreaterThan(0)
  })

  it('un parámetro numérico se vacía (vuelve al valor por defecto), acepta la coma y rechaza un negativo', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    const interes = await screen.findByLabelText(/Umbral de interés/)
    await userEvent.clear(interes)
    expect(interes).toHaveValue('')
    await userEvent.type(interes, '2,5')
    expect(interes).toHaveValue('2,5')
    await userEvent.clear(interes)
    await userEvent.type(interes, '-1')
    await userEvent.tab()
    expect(await screen.findByText('Escriba un número mayor o igual a 0, o deje el campo vacío para el valor por defecto.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    expect(red.a('PUT', '/objects/project/records/p1')).toHaveLength(0)
    await userEvent.clear(interes)
    await userEvent.type(interes, '2,5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project/records/p1')).toHaveLength(1))
    expect(red.a('PUT', '/objects/project/records/p1')[0].cuerpo).toMatchObject({ attributes: { interest_threshold: 2.5 } })
  })

  it('guarda solo lo que cambió: un parámetro vacío no se materializa con su valor por defecto', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    expect(await screen.findByRole('button', { name: 'Guardar parámetros' })).toBeDisabled()
    const interes = screen.getByLabelText(/Umbral de interés/)
    await userEvent.clear(interes)
    await userEvent.type(interes, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project/records/p1')).toHaveLength(1))
    const cuerpo = red.a('PUT', '/objects/project/records/p1')[0].cuerpo as { attributes: Record<string, unknown> }
    expect(cuerpo.attributes).toMatchObject({ interest_threshold: 5, power_threshold: null })
  })

  it('tras guardar, la versión nueva no reinicia el formulario y se ve «Parámetros guardados»', async () => {
    const guardado = { ...P1, updatedAt: '2026-10-06T10:00:00Z', attributes: { ...P1.attributes, interest_threshold: 5 } }
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [
      { method: 'PUT', path: '/objects/project/records/p1', body: guardado },
      ...rutas()
    ])
    red = espiarRed([
      {
        path: '/objects/project/records/p1',
        responder: () =>
          new Response(JSON.stringify(red!.a('PUT', '/objects/project/records/p1').length ? guardado : P1), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
      }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    const interes = await screen.findByLabelText(/Umbral de interés/)
    await userEvent.clear(interes)
    await userEvent.type(interes, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    expect(await screen.findByText('Parámetros guardados')).toBeInTheDocument()
    expect(screen.getByLabelText(/Umbral de interés/)).toHaveValue('5')
    expect(screen.getByRole('button', { name: 'Guardar parámetros' })).toBeDisabled()
  })

  it('un 412 dice que otra persona cambió el proyecto; «Recargar» relee, conserva lo tecleado y toma lo demás de la versión nueva', async () => {
    const deOtra = { ...P1, updatedAt: '2026-10-06T10:00:00Z', attributes: { ...P1.attributes, interest_threshold: 5 } }
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    let conflicto = false
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/project/records/p1',
        responder: () => {
          conflicto = true
          return problema(412, 'Precondition Failed')
        }
      },
      {
        path: '/objects/project/records/p1',
        responder: () => new Response(JSON.stringify(conflicto ? deOtra : P1), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    const poder = await screen.findByLabelText(/Umbral de poder/)
    await userEvent.clear(poder)
    await userEvent.type(poder, '2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    const recargar = await screen.findByRole('button', { name: 'Recargar' })
    expect(screen.getByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Umbral de poder/)).toHaveValue('2.5')
    await userEvent.click(recargar)
    await waitFor(() => expect(screen.getByLabelText(/Umbral de interés/)).toHaveValue('5'))
    expect(screen.getByLabelText(/Umbral de poder/)).toHaveValue('2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project/records/p1')).toHaveLength(2))
    const segundo = red.a('PUT', '/objects/project/records/p1')[1]
    expect(segundo.cabeceras.get('If-Match')).toBe(`"${deOtra.updatedAt}"`)
    expect(segundo.cuerpo).toMatchObject({ attributes: { interest_threshold: 5, power_threshold: 2.5 } })
  })

  it('si la relectura de «Recargar» falla, el formulario sigue con lo tecleado (revisión final, I1)', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    let conflicto = false
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/project/records/p1',
        responder: () => {
          conflicto = true
          return problema(412, 'Precondition Failed')
        }
      },
      {
        path: '/objects/project/records/p1',
        responder: () =>
          conflicto ? problema(404, 'No se encontró') : new Response(JSON.stringify(P1), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    const poder = await screen.findByLabelText(/Umbral de poder/)
    await userEvent.clear(poder)
    await userEvent.type(poder, '2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    const antes = red.a('GET', '/objects/project/records/p1').length
    await userEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(red!.a('GET', '/objects/project/records/p1').length).toBeGreaterThan(antes))
    // el aviso se queda con «Recargar» y dice que la relectura falló (M1: el aviso no se quita antes de la relectura)
    expect(await screen.findByText(/No se pudo recargar; lo escrito se conserva\. El registro no existe/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeEnabled()
    expect(screen.getByLabelText(/Umbral de poder/)).toHaveValue('2.5')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('un parámetro devuelto a su valor original deja de contar como tecleado: no se envía y no pisa el cambio de otra persona', async () => {
    // mientras tanto otra persona subió el umbral de interés a 6
    const deOtra = { ...P1, updatedAt: '2026-10-06T10:00:00Z', attributes: { ...P1.attributes, interest_threshold: 6 } }
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    let conflicto = false
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/project/records/p1',
        responder: () => {
          conflicto = true
          return problema(412, 'Precondition Failed')
        }
      },
      {
        path: '/objects/project/records/p1',
        responder: () => new Response(JSON.stringify(conflicto ? deOtra : P1), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    const interes = await screen.findByLabelText(/Umbral de interés/)
    const poder = screen.getByLabelText(/Umbral de poder/)
    await userEvent.clear(interes)
    await userEvent.type(interes, '5')
    await userEvent.clear(interes)
    await userEvent.type(interes, '4')
    // de vuelta en su valor original (4): sin cambios, «Guardar» sigue deshabilitado
    expect(screen.getByRole('button', { name: 'Guardar parámetros' })).toBeDisabled()
    await userEvent.clear(poder)
    await userEvent.type(poder, '2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
    // lo devuelto a su valor original toma la versión nueva; lo que sí se tecleó se conserva
    await waitFor(() => expect(screen.getByLabelText(/Umbral de interés/)).toHaveValue('6'))
    expect(screen.getByLabelText(/Umbral de poder/)).toHaveValue('2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project/records/p1')).toHaveLength(2))
    expect(red.a('PUT', '/objects/project/records/p1')[1].cuerpo).toMatchObject({ attributes: { interest_threshold: 6, power_threshold: 2.5 } })
  })

  it('con permiso para escribir solo algunos campos, solo esos se habilitan (la definición ya llegó)', async () => {
    const mixta = definicion('project', [['interest_threshold', { type: 'DECIMAL', editable: false }], ['power_threshold', { type: 'DECIMAL' }], 'name'])
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [{ path: '/metadata/objects/project', body: mixta }, ...rutas()])
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    await waitFor(() => expect(screen.getByLabelText(/Umbral de poder/)).toBeEnabled())
    expect(screen.getByLabelText(/Umbral de interés/)).toBeDisabled()
  })

  it('con "u" sobre project (todos los campos de solo lectura, como el analista SIG) los parámetros se ven pero no se guardan', async () => {
    const soloLectura = definicion('project', [
      ['interest_threshold', { type: 'DECIMAL', editable: false }],
      ['power_threshold', { type: 'DECIMAL', editable: false }],
      ['name', { editable: false }]
    ])
    // la sonda lee la misma consulta que la pantalla (misma clave, misma caché): cuando dice que la definición llegó, la
    // pantalla ya la vio, y la ausencia de «Guardar parámetros» es por la definición y no porque aún carga
    function Sonda() {
      return useDefinicion('project').isSuccess ? <span>definición llegó</span> : null
    }
    fetch = mockFetch([{ path: '/metadata/objects/project', body: soloLectura }, ...rutas()])
    montar(
      <>
        <EquipoYParametrosPage />
        <Sonda />
      </>,
      { ruta: '/projects/p1/settings', camino: '/projects/:projectId/settings', usuario: ADMINISTRACION_DE_PROYECTO, permisos: PAD }
    )
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    await screen.findByText('definición llegó')
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
    expect(screen.queryByRole('button', { name: /Terminar asignación/ })).not.toBeInTheDocument()
  })
})

// F4 (plan 4.2a): los ocho parámetros de quejas y riesgos, solo si el modelo del tenant los tiene, con su rango y el orden de los
// umbrales dichos antes de guardar; el 400 OUT_OF_RANGE del servidor se dice con su texto
describe('S11 · parámetros de F4', () => {
  const entero = (campo: string): [string, Record<string, unknown>] => [campo, { type: 'INTEGER' }]
  const CON_F4 = definicion('project', [
    ['interest_threshold', { type: 'DECIMAL' }],
    'name',
    entero('grievance_ack_days'),
    entero('grievance_resolution_days'),
    entero('inquiry_response_days'),
    ['policy_high_severity_requires_approver', { type: 'BOOLEAN' }],
    entero('risk_review_days'),
    entero('risk_medium_min_score'),
    entero('risk_high_min_score'),
    entero('risk_critical_min_score')
  ])
  // un proyecto creado antes de F4: el GET trae las claves de los ocho, vacías (vale el por defecto)
  const VACIOS = Object.fromEntries(CON_F4.fields.slice(2).map((f) => [f.name, null]))
  const conF4 = () => [
    { path: '/metadata/objects/project', body: CON_F4 },
    { path: '/objects/project/records/p1', body: { ...P1, attributes: { ...P1.attributes, ...VACIOS } } },
    ...rutas()
  ]

  it('un tenant sin F4 no ve los parámetros de quejas ni de riesgos', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    expect(await screen.findByText('Umbral de interés', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('Riesgos')).not.toBeInTheDocument()
  })

  it('con F4 muestra los ocho por defecto y guarda la cadencia cambiada con la versión leída', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, conF4())
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    expect(await screen.findByRole('group', { name: 'Quejas, consultas y solicitudes' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Días hábiles para acusar recibo/)).toHaveValue('5')
    expect(screen.getByLabelText(/Una queja ALTA o CRITICA la resuelve quien aprueba/)).toBeChecked()
    const cadencia = screen.getByLabelText(/Días entre revisiones de un riesgo/)
    await userEvent.clear(cadencia)
    await userEvent.type(cadencia, '14')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project/records/p1')).toHaveLength(1))
    expect(red.a('PUT', '/objects/project/records/p1')[0].cuerpo).toMatchObject({ attributes: { risk_review_days: 14 } })
  })

  it('un plazo fuera de 1 a 365 o umbrales que no crecen se dicen y no se guardan', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, conF4())
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    const acuse = await screen.findByLabelText(/Días hábiles para acusar recibo/)
    await userEvent.clear(acuse)
    await userEvent.type(acuse, '400')
    const alto = screen.getByLabelText(/Puntaje desde el que un riesgo es ALTO/)
    await userEvent.clear(alto)
    await userEvent.type(alto, '20')
    expect(await screen.findByText('Escriba un número entero de 1 a 365.')).toBeInTheDocument()
    expect(screen.getByText('Los umbrales deben crecer: medio menor que alto y alto menor que crítico.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    expect(red.a('PUT', '/objects/project/records/p1')).toHaveLength(0)
  })

  it('un valor viejo fuera de regla que nadie tocó no bloquea otra escritura: el PUT sale sin tocar los umbrales', async () => {
    const viejos = { ...VACIOS, risk_medium_min_score: 10, risk_high_min_score: 5, risk_critical_min_score: 15, grievance_ack_days: 400 }
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/metadata/objects/project', body: CON_F4 },
      { path: '/objects/project/records/p1', body: { ...P1, attributes: { ...P1.attributes, ...viejos } } },
      ...rutas()
    ])
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    const umbral = await screen.findByLabelText(/Umbral de interés/)
    await userEvent.clear(umbral)
    await userEvent.type(umbral, '2')
    expect(screen.queryByText('Los umbrales deben crecer: medio menor que alto y alto menor que crítico.')).not.toBeInTheDocument()
    expect(screen.queryByText('Escriba un número entero de 1 a 365.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/project/records/p1')).toHaveLength(1))
    const { attributes } = red.a('PUT', '/objects/project/records/p1')[0].cuerpo as { attributes: Record<string, unknown> }
    expect(attributes).toMatchObject({ interest_threshold: 2 })
    // los umbrales y el plazo viejos viajan tal como se leyeron (la forma del GET), sin cambio alguno
    expect(attributes).toMatchObject({ risk_medium_min_score: 10, risk_high_min_score: 5, risk_critical_min_score: 15, grievance_ack_days: 400 })
  })

  it('el rechazo del servidor (400 OUT_OF_RANGE) se dice con su texto, nunca el código', async () => {
    fetch = abrirPortal('/projects/p1/settings', ADMINISTRACION_DE_PROYECTO, PAD, [
      {
        method: 'PUT',
        path: '/objects/project/records/p1',
        status: 400,
        body: { title: 'Bad Request', status: 400, detail: 'fuera de rango', errors: [{ field: 'risk_review_days', message: 'OUT_OF_RANGE' }] }
      },
      ...conF4()
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Parámetros y políticas' }))
    const cadencia = await screen.findByLabelText(/Días entre revisiones de un riesgo/)
    await userEvent.clear(cadencia)
    await userEvent.type(cadencia, '30')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    expect(await screen.findByText('El número está fuera del rango permitido.')).toBeInTheDocument()
    expect(screen.queryByText('OUT_OF_RANGE')).not.toBeInTheDocument()
  })

  it('las reglas de rango y orden son las del servidor', () => {
    const valores: Record<string, number> = { grievance_ack_days: 5, risk_medium_min_score: 5, risk_high_min_score: 10, risk_critical_min_score: 15 }
    expect(
      problemasDeParametros(
        (c) => valores[c],
        () => true
      )
    ).toEqual([])
    expect(
      problemasDeParametros(
        (c) => ({ ...valores, grievance_ack_days: 0 })[c],
        () => true
      )
    ).toEqual([{ campo: 'grievance_ack_days', motivo: 'rango' }])
    expect(
      problemasDeParametros(
        (c) => ({ ...valores, risk_critical_min_score: 26 })[c],
        () => true
      )
    ).toContainEqual({ campo: 'risk_critical_min_score', motivo: 'rango' })
    expect(
      problemasDeParametros(
        (c) => ({ ...valores, risk_high_min_score: 5 })[c],
        () => true
      )
    ).toEqual([{ campo: 'risk_high_min_score', motivo: 'orden' }])
    expect(
      problemasDeParametros(
        (c) => ({ ...valores, grievance_ack_days: 2.5 })[c],
        () => true
      )
    ).toEqual([{ campo: 'grievance_ack_days', motivo: 'rango' }])
    // solo se juzga lo que cambia; el orden, solo si cambió un umbral, y no se suma al rango de un umbral
    expect(
      problemasDeParametros(
        (c) => ({ ...valores, grievance_ack_days: 0 })[c],
        () => false
      )
    ).toEqual([])
    expect(
      problemasDeParametros(
        (c) => ({ ...valores, risk_high_min_score: 5 })[c],
        (c) => c === 'grievance_ack_days'
      )
    ).toEqual([])
    expect(
      problemasDeParametros(
        (c) => ({ ...valores, risk_high_min_score: 5 })[c],
        (c) => c === 'risk_medium_min_score'
      )
    ).toEqual([{ campo: 'risk_high_min_score', motivo: 'orden' }])
    expect(
      problemasDeParametros(
        (c) => ({ ...valores, risk_critical_min_score: 26 })[c],
        () => true
      )
    ).toEqual([{ campo: 'risk_critical_min_score', motivo: 'rango' }])
  })
})

describe('partes del proyecto', () => {
  it('una organización que no se puede leer se dice «No disponible», nunca con su id', async () => {
    fetch = mockFetch([
      { path: '/metadata/objects/project_party', body: definicion('project_party', [['party_role', { type: 'ENUM', enumOptions: ['CLIENTE'] }]]) },
      {
        path: '/objects/project_party/records',
        body: pagina([registro('pp1', { party_role: 'CLIENTE', organization: '9b1d7e2a-0000-4000-8000-000000000001', project: 'p1' })])
      },
      {
        path: '/objects/organization/records/9b1d7e2a-0000-4000-8000-000000000001',
        status: 403,
        body: { title: 'Error', status: 403, detail: 'OBJECT_NOT_READABLE' }
      }
    ])
    montar(<PartesDelProyecto proyecto="p1" editable={false} />, { permisos: permisos({ project_party: ['READ'] }) })
    expect(await screen.findByText(/CLIENTE · No disponible/)).toBeInTheDocument()
    expect(screen.queryByText(/9b1d7e2a/)).not.toBeInTheDocument()
  })
})
