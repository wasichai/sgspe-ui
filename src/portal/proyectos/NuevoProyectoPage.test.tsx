import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { definicion, pagina, registro, workflow } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ADMINISTRACION, ADMINISTRACION_DE_PROYECTO, permisos, RELACIONISTA } from '../../test/portal'
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

const PAD = permisos({
  project: ['READ', 'CREATE', 'UPDATE'],
  project_party: ['READ', 'CREATE'],
  exploration_campaign: ['READ', 'CREATE'],
  project_assignment: ['READ', 'CREATE'],
  organization: ['READ']
})
const DEF = definicion('project', [
  'code',
  'name',
  ['project_type', { type: 'ENUM', enumOptions: ['MINERIA'] }],
  ['stage', { type: 'ENUM', enumOptions: ['EXPLORACION'] }],
  ['exploration_phase', { type: 'ENUM', enumOptions: ['PERFORACION'] }],
  ['start_date', { type: 'DATE' }],
  'description',
  ['working_crs', { type: 'ENUM', enumOptions: ['EPSG 32717', 'EPSG 32718'] }],
  ['interest_threshold', { type: 'DECIMAL' }],
  ['power_threshold', { type: 'DECIMAL' }],
  ['stakeholder_review_days', { type: 'INTEGER' }],
  ['inactivity_days', { type: 'INTEGER' }],
  ['meetings_per_month_target', { type: 'INTEGER' }],
  ['policy_minutes_only_formal_types', { type: 'BOOLEAN' }],
  ['policy_activation_preconditions', { type: 'BOOLEAN' }],
  ['location', { type: 'GEOMETRY' }]
])
const MI_ASIGNACION = registro('as-pad', { project: 'p9', member_user_id: 'u-pad', active: true, role_name: 'ROL_DE_PRUEBA' })
const CREADO = registro('p9', { code: 'PRJ-09', name: 'Antakuna', working_crs: 'EPSG 32718' }, { state: 'draft' })

const rutas = () => [
  { path: '/metadata/objects/project', body: DEF },
  {
    path: '/metadata/objects/project_party',
    body: definicion('project_party', [
      ['party_role', { type: 'ENUM', enumOptions: ['CLIENTE', 'OPERADOR', 'CONSULTORA'] }],
      ['project', { type: 'RELATION' }],
      ['organization', { type: 'RELATION' }]
    ])
  },
  { path: '/objects/project/workflow', body: workflow('project', [['draft', 'Borrador']]) },
  { method: 'POST', path: '/objects/project/records', body: CREADO },
  { method: 'PUT', path: '/objects/project/records/p9', body: CREADO },
  { path: '/objects/project/records/p9', body: CREADO },
  { path: '/objects/project_party/records', body: pagina([registro('pp1', { party_role: 'CLIENTE', organization: 'o1', project: 'p9' })]) },
  { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Minera Andina' }) },
  { path: '/objects/exploration_campaign/records', body: pagina([]) },
  // la cuenta ya está asignada al borrador p9 (P40): el asistente sigue sin pedir la asignación propia
  { path: /^\/objects\/project_assignment\/records\?.*member_user_id=/, body: pagina([MI_ASIGNACION]) },
  { path: '/objects/project_assignment/records', body: pagina([]) },
  {
    path: '/metadata/objects/project_assignment',
    body: definicion('project_assignment', ['project', 'member_user_id', 'member_user_email', 'role_name', 'start_date', 'end_date', 'active'])
  },
  { method: 'POST', path: '/objects/project_assignment/records', body: registro('a1', {}) },
  { path: '/users', status: 403, body: { title: 'Forbidden', status: 403 } },
  { path: '/roles', status: 403, body: { title: 'Forbidden', status: 403 } },
  { method: 'POST', path: '/objects/project/records/p9/transitions/submit_for_review', body: { ...CREADO, state: 'in_review' } }
]

async function identificar() {
  await userEvent.type(await screen.findByRole('textbox', { name: 'code' }), 'PRJ-09')
  await userEvent.type(screen.getByRole('textbox', { name: 'name' }), 'Antakuna')
}

describe('S07 · crear proyecto', () => {
  it('sin CREATE sobre project no se ofrece crear', async () => {
    fetch = abrirPortal('/projects/new', RELACIONISTA, permisos({ project: ['READ'] }), rutas())
    expect(await screen.findByText('Su cuenta no puede crear proyectos: abra un borrador existente para completarlo.')).toBeInTheDocument()
  })

  it('con "u" sobre project (todos los campos de solo lectura) un borrador se abre sin el asistente', async () => {
    const soloLectura = { ...DEF, fields: DEF.fields.map((f) => ({ ...f, editable: false })) }
    fetch = abrirPortal('/projects/new?draft=p9', RELACIONISTA, permisos({ project: ['READ', 'UPDATE'] }), [
      { path: '/metadata/objects/project', body: soloLectura },
      ...rutas()
    ])
    expect(await screen.findByText('Su cuenta puede ver este borrador, pero no cambiar sus datos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })

  it('el paso 1 exige código y nombre y crea el borrador al salir, con los parámetros por defecto', async () => {
    fetch = abrirPortal('/projects/new', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    expect(await screen.findAllByText('Obligatorio')).toHaveLength(2)
    await identificar()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: 'Ubicación y CRS de trabajo' })
    // el borrador ya existe: la URL recoge su id, sin recargar el asistente
    expect(rutaActual()).toBe('/projects/new?draft=p9')
    const [alta] = red.a('POST', '/objects/project/records')
    expect(alta.cuerpo).toMatchObject({
      attributes: {
        code: 'PRJ-09',
        name: 'Antakuna',
        interest_threshold: 3,
        power_threshold: 3,
        meetings_per_month_target: 2,
        policy_activation_preconditions: true
      }
    })
    expect(alta.cuerpo).not.toHaveProperty('attributes.location')
  })

  it('un código repetido (409) vuelve al paso 1 con el campo marcado', async () => {
    fetch = abrirPortal('/projects/new', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed([{ method: 'POST', path: '/objects/project/records', responder: () => problema(409, 'valor único repetido') }])
    await identificar()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Ya existe un proyecto con este código')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Identificación' })).toBeInTheDocument()
  })

  it('la ubicación viaja en geometries, aparte de attributes, y el CRS en attributes', async () => {
    fetch = abrirPortal('/projects/new', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    await identificar()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'CRS de trabajo' }), 'EPSG 32718')
    await userEvent.type(screen.getByRole('textbox', { name: 'Latitud de referencia (WGS 84)' }), '-7.9')
    await userEvent.type(screen.getByRole('textbox', { name: 'Longitud de referencia (WGS 84)' }), '-78.5')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: 'Partes' })
    const [cambio] = red.a('PUT', '/objects/project/records/p9')
    expect(cambio.cabeceras.get('If-Match')).toBe(`"${CREADO.updatedAt}"`)
    expect(cambio.cuerpo).toMatchObject({ attributes: { working_crs: 'EPSG 32718' }, geometries: { location: { type: 'Point', coordinates: [-78.5, -7.9] } } })
  })

  it('el paso 7 muestra las precondiciones y envía a revisión', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    for (let i = 0; i < 6; i++) {
      await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    }
    expect(await screen.findByText(/CRS de trabajo informado/)).toHaveAttribute('data-cumple', 'true')
    await waitFor(() => expect(screen.getByText(/Una parte CLIENTE u OPERADOR/)).toHaveAttribute('data-cumple', 'true'))
    await userEvent.click(screen.getByRole('button', { name: 'Crear y enviar a revisión' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p9/overview'))
    expect(red.a('POST', '/objects/project/records/p9/transitions/submit_for_review')).toHaveLength(1)
  })

  it('sin el directorio de usuarios, la asignación se escribe a mano', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    for (let i = 0; i < 4; i++) await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('textbox', { name: 'Correo del usuario' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Rol en el proyecto' })).toBeInTheDocument()
  })
})

const BORRADOR = registro(
  'p9',
  {
    code: 'PRJ-09',
    name: 'Antakuna',
    working_crs: 'EPSG 32718',
    interest_threshold: 3,
    power_threshold: 3,
    stakeholder_review_days: 30,
    inactivity_days: 90,
    meetings_per_month_target: 2,
    policy_minutes_only_formal_types: true,
    policy_activation_preconditions: true
  },
  { state: 'draft' }
)
const conBorrador = () => [
  { method: 'PUT', path: '/objects/project/records/p9', body: BORRADOR },
  { path: '/objects/project/records/p9', body: BORRADOR },
  ...rutas()
]
const ID_DE_USUARIO = '11111111-1111-4111-8111-111111111111'

// Enter en un campo: el navegador envía el formulario del campo por el botón «Siguiente» (asociado con form=), pero user-event
// no resuelve esa asociación; el envío es el mismo evento
const enviarConEnter = (campo: HTMLElement) => fireEvent.submit(campo.closest('form')!)

async function avanzar(pasos: number) {
  for (let i = 0; i < pasos; i++) await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
}

async function asignarAMano(codigo: string, campo: string) {
  fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
  red = espiarRed([
    { method: 'POST', path: '/objects/project_assignment/records', responder: () => problema(400, 'detalle', [{ field: campo, message: codigo }]) }
  ])
  await screen.findByRole('heading', { name: 'Completar proyecto' })
  await avanzar(4)
  await userEvent.type(await screen.findByRole('textbox', { name: 'Correo del usuario' }), 'ana@sgspe.test')
  await userEvent.type(screen.getByRole('textbox', { name: 'Identificador del usuario' }), ID_DE_USUARIO)
  await userEvent.type(screen.getByRole('textbox', { name: 'Rol en el proyecto' }), 'ROL_DE_PRUEBA')
  await userEvent.click(screen.getByRole('button', { name: 'Asignar' }))
}

describe('S07 · asignación del equipo', () => {
  it('USER_REFERENCE marca el identificador con su texto, nunca con el código', async () => {
    await asignarAMano('USER_REFERENCE', 'member_user_id')
    const texto = 'El correo y el identificador no nombran a un usuario de su organización.'
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Identificador del usuario' })).toHaveAccessibleDescription(texto)
    expect(screen.queryByText(/USER_REFERENCE/)).not.toBeInTheDocument()
    expect(red!.a('POST', '/objects/project_assignment/records')[0].cuerpo).toMatchObject({
      attributes: { member_user_id: ID_DE_USUARIO, member_user_email: 'ana@sgspe.test', role_name: 'ROL_DE_PRUEBA', project: 'p9', active: true }
    })
  })

  it('UNKNOWN_ROLE marca el rol con su texto, nunca con el código', async () => {
    await asignarAMano('UNKNOWN_ROLE', 'role_name')
    const texto = 'Ese rol no está declarado en la organización.'
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Rol en el proyecto' })).toHaveAccessibleDescription(texto)
    expect(screen.queryByText(/UNKNOWN_ROLE/)).not.toBeInTheDocument()
  })

  it('un error del servidor sobre la fecha de inicio se ve junto a «Desde»', async () => {
    await asignarAMano('no puede ser anterior al inicio del proyecto', 'start_date')
    const texto = 'no puede ser anterior al inicio del proyecto'
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.getByLabelText('Desde')).toHaveAccessibleDescription(texto)
    expect(screen.getByLabelText('Desde')).toBeInvalid()
  })

  it('con el directorio, tras asignar el usuario elegido se limpia', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/users', body: [{ id: ID_DE_USUARIO, email: 'ana@sgspe.test', displayName: 'Usuaria de prueba', enabled: true }] },
      { path: '/roles', body: [{ name: 'ROL_DE_PRUEBA', label: 'Rol de prueba' }] },
      ...rutas()
    ])
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(4)
    const usuario = await screen.findByRole('combobox', { name: 'Usuario' })
    await userEvent.selectOptions(usuario, ID_DE_USUARIO)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rol en el proyecto' }), 'ROL_DE_PRUEBA')
    await userEvent.click(screen.getByRole('button', { name: 'Asignar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/project_assignment/records')).toHaveLength(1))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Usuario' })).toHaveValue(''))
  })

  it('sin CREATE sobre las partes no se ofrece agregarlas, y una organización sin rol lo dice', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, permisos({ ...PAD.objects, project_party: ['READ'] }), rutas())
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(2)
    expect(await screen.findByText(/CLIENTE/)).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Organización' })).not.toBeInTheDocument()
  })

  it('un error de campo de la campaña queda junto a su control, no solo al pie', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, [
      {
        path: '/metadata/objects/exploration_campaign',
        body: definicion('exploration_campaign', ['project', 'name', 'activity_type', 'social_support_cap', 'currency'])
      },
      ...rutas()
    ])
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/exploration_campaign/records',
        responder: () => problema(400, 'detalle', [{ field: 'name', message: 'FIELD_REQUIRED' }])
      }
    ])
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(3)
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
    const texto = 'Falta un dato que este paso necesita.'
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nombre de la campaña' })).toHaveAccessibleDescription(texto))
    // un solo mensaje: junto al campo, no repetido al pie
    expect(screen.getAllByText(texto)).toHaveLength(1)
    expect(screen.queryByText(/FIELD_REQUIRED/)).not.toBeInTheDocument()
  })

  it('un error de campo de las partes queda junto al rol, no solo al pie', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/objects/organization/records', body: pagina([registro('o2', { name: 'Minera Dos' })]) },
      ...rutas()
    ])
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/project_party/records',
        responder: () => problema(400, 'detalle', [{ field: 'party_role', message: 'FIELD_REQUIRED' }])
      }
    ])
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(2)
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Rol' }), 'CONSULTORA')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Organización' }), 'Mi')
    await userEvent.click(await screen.findByRole('button', { name: 'Minera Dos' }))
    const texto = 'Falta un dato que este paso necesita.'
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Rol' })).toHaveAccessibleDescription(texto))
    expect(screen.getAllByText(texto)).toHaveLength(1)
  })

  it('elegir una organización sin elegir el rol lo dice y no escribe', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/objects/organization/records', body: pagina([registro('o2', { name: 'Minera Dos' })]) },
      ...rutas()
    ])
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(2)
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Organización' }), 'Mi')
    await userEvent.click(await screen.findByRole('button', { name: 'Minera Dos' }))
    expect(await screen.findByText('Elija el rol de la parte antes de agregar la organización.')).toBeInTheDocument()
    expect(red.a('POST', '/objects/project_party/records')).toHaveLength(0)
  })
})

describe('S07 · borradores y errores', () => {
  it('un borrador que no existe dice que no se encontró y no abre el asistente', async () => {
    fetch = abrirPortal('/projects/new?draft=nope', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/objects/project/records/nope', status: 404, body: { title: 'Not Found', status: 404 } },
      ...rutas()
    ])
    expect(await screen.findByText('No se encontró este borrador. Puede que otra persona lo haya borrado.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })

  it('un borrador que no carga por otro error muestra el error de carga y no el asistente', async () => {
    fetch = abrirPortal('/projects/new?draft=roto', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/objects/project/records/roto', status: 500, body: { title: 'Error', status: 500 } },
      ...rutas()
    ])
    expect(await screen.findByText('No se pudo cargar esta información. Los filtros se conservan.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })

  it('un proyecto que ya no es borrador no abre el asistente', async () => {
    const enRevision = { ...BORRADOR, state: 'in_review' }
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, [{ path: '/objects/project/records/p9', body: enRevision }, ...rutas()])
    expect(await screen.findByText('Este proyecto ya salió de borrador: el asistente solo completa borradores.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })

  it('«Guardar y salir» con un código repetido vuelve al paso 1 con el campo marcado', async () => {
    fetch = abrirPortal('/projects/new', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/project/records',
        responder: () => problema(409, 'valor único repetido', [{ field: 'code', message: 'valor único repetido' }])
      }
    ])
    await identificar()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }))
    expect(await screen.findByText('Ya existe un proyecto con este código')).toBeInTheDocument()
    expect(rutaActual()).toBe('/projects/new')
    expect(red.a('POST', '/objects/project/records')).toHaveLength(1)
  })

  it('«Guardar y salir» crea el borrador una sola vez y abre su resumen', async () => {
    fetch = abrirPortal('/projects/new', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed()
    await identificar()
    await userEvent.dblClick(screen.getByRole('button', { name: 'Guardar y salir' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p9/overview'))
    expect(red.a('POST', '/objects/project/records')).toHaveLength(1)
  })

  it('un fallo al guardar el paso 2 conserva lo tecleado y lo dice', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, [
      {
        method: 'PUT',
        path: '/objects/project/records/p9',
        status: 400,
        body: { title: 'Bad Request', status: 400, detail: 'El servidor rechazó el cambio', errors: [] }
      },
      ...conBorrador()
    ])
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(1)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Latitud de referencia (WGS 84)' }), '-7.9')
    await userEvent.type(screen.getByRole('textbox', { name: 'Longitud de referencia (WGS 84)' }), '-78.5')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('El servidor rechazó el cambio')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ubicación y CRS de trabajo' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Latitud de referencia (WGS 84)' })).toHaveValue('-7.9')
    expect(screen.getByRole('textbox', { name: 'Longitud de referencia (WGS 84)' })).toHaveValue('-78.5')
  })

  it('un 412 al guardar un paso ofrece «Recargar»: relee el borrador, conserva lo tecleado y el siguiente PUT lleva la versión nueva (revisión final, I2)', async () => {
    const deOtra = { ...BORRADOR, updatedAt: '2026-10-06T11:00:00Z' }
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    let lecturas = 0
    let cambios = 0
    red = espiarRed([
      { path: '/objects/project/records/p9', responder: () => jsonResponse(++lecturas === 1 ? BORRADOR : deOtra) },
      { method: 'PUT', path: '/objects/project/records/p9', responder: () => (++cambios === 1 ? problema(412, 'Precondition Failed') : jsonResponse(deOtra)) }
    ])
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(1)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Latitud de referencia (WGS 84)' }), '-7.9')
    await userEvent.type(screen.getByRole('textbox', { name: 'Longitud de referencia (WGS 84)' }), '-78.5')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Latitud de referencia (WGS 84)' })).toHaveValue('-7.9')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: 'Partes' })
    const [primero, segundo] = red.a('PUT', '/objects/project/records/p9')
    expect(primero.cabeceras.get('If-Match')).toBe(`"${BORRADOR.updatedAt}"`)
    expect(segundo.cabeceras.get('If-Match')).toBe('"2026-10-06T11:00:00Z"')
    expect(segundo.cuerpo).toMatchObject({ geometries: { location: { coordinates: [-78.5, -7.9] } } })
  })

  it('tras «Recargar», guardar no pisa lo que la otra persona cambió en un campo que no se tocó (re-revisión, N1)', async () => {
    // B renombró el borrador y cambió un parámetro; A solo teclea la ubicación
    const deOtra = { ...BORRADOR, updatedAt: '2026-10-06T11:00:00Z', attributes: { ...BORRADOR.attributes, name: 'Antakuna Norte', inactivity_days: 120 } }
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    let lecturas = 0
    let cambios = 0
    red = espiarRed([
      { path: '/objects/project/records/p9', responder: () => jsonResponse(++lecturas === 1 ? BORRADOR : deOtra) },
      { method: 'PUT', path: '/objects/project/records/p9', responder: () => (++cambios === 1 ? problema(412, 'Precondition Failed') : jsonResponse(deOtra)) }
    ])
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(1)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Latitud de referencia (WGS 84)' }), '-7.9')
    await userEvent.type(screen.getByRole('textbox', { name: 'Longitud de referencia (WGS 84)' }), '-78.5')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: 'Partes' })
    const segundo = red.a('PUT', '/objects/project/records/p9')[1]
    expect(segundo.cabeceras.get('If-Match')).toBe('"2026-10-06T11:00:00Z"')
    expect(segundo.cuerpo).toMatchObject({
      attributes: { name: 'Antakuna Norte', inactivity_days: 120 },
      geometries: { location: { coordinates: [-78.5, -7.9] } }
    })
  })

  it('«Anterior» y el indicador de pasos guardan lo que cambió', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(1)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Latitud de referencia (WGS 84)' }), '-7.9')
    await userEvent.type(screen.getByRole('textbox', { name: 'Longitud de referencia (WGS 84)' }), '-78.5')
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await screen.findByRole('heading', { name: 'Identificación' })
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(1)
    expect(red.a('PUT', '/objects/project/records/p9')[0].cuerpo).toMatchObject({ geometries: { location: { coordinates: [-78.5, -7.9] } } })
    // sin cambios, moverse no escribe
    await avanzar(1)
    await userEvent.click(await screen.findByRole('button', { name: 'Anterior' }))
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(1)
    // y por el indicador, tras cambiar el CRS
    await avanzar(1)
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'CRS de trabajo' }), 'EPSG 32717')
    await userEvent.click(screen.getByRole('button', { name: /Identificación/ }))
    await screen.findByRole('heading', { name: 'Identificación' })
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(2)
  })

  it('los parámetros numéricos conservan lo tecleado y se convierten al salir del campo', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(5)
    await screen.findByRole('heading', { name: 'Parámetros y políticas' })
    const umbral = screen.getByRole('textbox', { name: /Umbral de interés/ })
    await userEvent.clear(umbral)
    expect(umbral).toHaveValue('')
    await userEvent.type(umbral, '2.')
    expect(umbral).toHaveValue('2.')
    await userEvent.type(umbral, '5')
    expect(umbral).toHaveValue('2.5')
    // vacío vuelve al valor por defecto
    await userEvent.clear(umbral)
    await userEvent.tab()
    expect(umbral).toHaveValue('3')
    await userEvent.clear(umbral)
    await userEvent.type(umbral, '2,5')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: 'Revisar y enviar' })
    expect(red.a('PUT', '/objects/project/records/p9')[0].cuerpo).toMatchObject({ attributes: { interest_threshold: 2.5, power_threshold: 3 } })
  })

  it('una ubicación incompleta o fuera de rango dice el rango y no escribe', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(1)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Latitud de referencia (WGS 84)' }), '-7.9')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Escriba latitud y longitud, o deje ambas vacías.')).toBeInTheDocument()
    await userEvent.clear(screen.getByRole('textbox', { name: 'Latitud de referencia (WGS 84)' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Latitud de referencia (WGS 84)' }), '95')
    await userEvent.type(screen.getByRole('textbox', { name: 'Longitud de referencia (WGS 84)' }), ' ')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Escriba la latitud como número entre -90 y 90.')).toBeInTheDocument()
    expect(screen.getByText('Escriba la longitud como número entre -180 y 180.')).toBeInTheDocument()
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Ubicación y CRS de trabajo' })).toBeInTheDocument()
  })

  const TEXTO_ENTERO = 'Escriba un número entero mayor o igual a 0, o deje el campo vacío para el valor por defecto.'

  it('un parámetro entero no acepta decimales: lo dice junto al campo y no guarda hasta corregirlo', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(5)
    await screen.findByRole('heading', { name: 'Parámetros y políticas' })
    const dias = screen.getByRole('textbox', { name: /Días entre evaluaciones/ })
    await userEvent.clear(dias)
    await userEvent.type(dias, '30.5')
    await userEvent.tab()
    expect(await screen.findByText(TEXTO_ENTERO)).toBeInTheDocument()
    expect(dias).toHaveAccessibleDescription(TEXTO_ENTERO)
    // los decimales sí valen en los umbrales
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('heading', { name: 'Parámetros y políticas' })).toBeInTheDocument()
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(0)
    await userEvent.clear(dias)
    await userEvent.type(dias, '31')
    expect(screen.queryByText(TEXTO_ENTERO)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: 'Revisar y enviar' })
    expect(red.a('PUT', '/objects/project/records/p9')[0].cuerpo).toMatchObject({ attributes: { stakeholder_review_days: 31 } })
  })

  it('Enter en un parámetro inválido no guarda el valor anterior: muestra el error y se queda', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(5)
    await screen.findByRole('heading', { name: 'Parámetros y políticas' })
    const umbral = screen.getByRole('textbox', { name: /Umbral de interés/ })
    await userEvent.clear(umbral)
    await userEvent.type(umbral, '2')
    await userEvent.type(umbral, 'x')
    enviarConEnter(umbral)
    expect(await screen.findByText('Escriba un número mayor o igual a 0, o deje el campo vacío para el valor por defecto.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Parámetros y políticas' })).toBeInTheDocument()
    expect(umbral).toHaveValue('2x')
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(0)
  })

  it('Enter en un parámetro vacío usa el valor por defecto, no el último tecleado', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(5)
    await screen.findByRole('heading', { name: 'Parámetros y políticas' })
    const umbral = screen.getByRole('textbox', { name: /Umbral de interés/ })
    await userEvent.clear(umbral)
    await userEvent.type(umbral, '2.5')
    await userEvent.clear(umbral)
    enviarConEnter(umbral)
    await screen.findByRole('heading', { name: 'Revisar y enviar' })
    // el 2.5 se descartó al vaciar el campo y el valor por defecto (3) es el guardado: no hay nada que escribir
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(0)
  })

  it('«Anterior» y el indicador no quedan bloqueados por un dato inválido: se mueven sin guardar y lo avisan', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(1)
    const latitud = await screen.findByRole('textbox', { name: 'Latitud de referencia (WGS 84)' })
    await userEvent.type(latitud, '-7.9')
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await screen.findByRole('heading', { name: 'Identificación' })
    const aviso = 'Hay datos no válidos que no se guardaron: siguen en el formulario con su error. Corríjalos para que el borrador los guarde.'
    expect(screen.getByText(aviso)).toBeInTheDocument()
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(0)
    // Siguiente sí exige el dato válido: vuelve al paso con el error y lo escrito sigue ahí
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: 'Ubicación y CRS de trabajo' })
    expect(screen.queryByText(aviso)).not.toBeInTheDocument()
    expect(screen.getByText('Escriba latitud y longitud, o deje ambas vacías.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Latitud de referencia (WGS 84)' })).toHaveValue('-7.9')
    // y el indicador de pasos también deja salir
    await userEvent.click(screen.getByRole('button', { name: /Identificación/ }))
    await screen.findByRole('heading', { name: 'Identificación' })
    expect(screen.getByText(aviso)).toBeInTheDocument()
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(0)
  })

  it('un parámetro inválido sobrevive a «Anterior»: al volver sigue el texto tecleado y su error, nunca «NaN»', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, conBorrador())
    red = espiarRed()
    await screen.findByRole('heading', { name: 'Completar proyecto' })
    await avanzar(5)
    await screen.findByRole('heading', { name: 'Parámetros y políticas' })
    const umbral = screen.getByRole('textbox', { name: /Umbral de interés/ })
    await userEvent.clear(umbral)
    await userEvent.type(umbral, '2x')
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await screen.findByRole('heading', { name: 'Equipo' })
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: 'Parámetros y políticas' })
    const vuelto = screen.getByRole('textbox', { name: /Umbral de interés/ })
    expect(vuelto).toHaveValue('2x')
    expect(screen.getByText('Escriba un número mayor o igual a 0, o deje el campo vacío para el valor por defecto.')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('NaN')).not.toBeInTheDocument()
  })
})

// P40 (revisión final, C1): ProjectScopeGuard exige una asignación vigente para escribir en un proyecto, también en su borrador,
// y un proyecto nuevo no tiene equipo. el asistente pide asignarse a quien lo crea antes de cualquier otra escritura; esa
// escritura está exenta (security.md §9.2, ítem 5). ADMIN, o quien ya está asignado, no la ve
describe('S07 · asignación de quien crea (P40)', () => {
  // las asignaciones de la cuenta: ninguna hasta que se asigna; después, la suya
  const misAsignaciones = () => ({
    path: /^\/objects\/project_assignment\/records\?.*member_user_id=/,
    responder: () => jsonResponse(pagina(red!.a('POST', '/objects/project_assignment/records').length > 0 ? [MI_ASIGNACION] : []))
  })
  const PIDE = 'Asígnese a este proyecto para seguir'

  it('sin asignación, crea el borrador, pide asignarse y recién después sale el PUT del paso 2', async () => {
    fetch = abrirPortal('/projects/new', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed([misAsignaciones()])
    await identificar()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('heading', { name: PIDE })).toBeInTheDocument()
    expect(screen.getByText(/solo acepta cambios de quien está asignado/)).toBeInTheDocument()
    // sin el directorio de roles, el rol se escribe; el usuario es la cuenta, no se elige
    expect(screen.queryByRole('textbox', { name: 'Correo del usuario' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Rol en el proyecto' }), 'ROL_DE_PRUEBA')
    await userEvent.click(screen.getByRole('button', { name: 'Asignarme al proyecto' }))
    await waitFor(() => expect(red!.a('POST', '/objects/project_assignment/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/project_assignment/records')[0].cuerpo).toMatchObject({
      attributes: { project: 'p9', member_user_id: 'u-pad', member_user_email: 'pad@sgspe.test', role_name: 'ROL_DE_PRUEBA', active: true }
    })
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(0)
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'CRS de trabajo' }), 'EPSG 32718')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: 'Partes' })
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(1)
  })

  it('con el directorio de roles, el rol se elige de la lista', async () => {
    fetch = abrirPortal('/projects/new', ADMINISTRACION_DE_PROYECTO, PAD, [
      { path: '/roles', body: [{ name: 'ROL_DE_PRUEBA', label: 'Rol de prueba' }] },
      ...rutas()
    ])
    red = espiarRed([misAsignaciones()])
    await identificar()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Rol en el proyecto' }), 'ROL_DE_PRUEBA')
    await userEvent.click(screen.getByRole('button', { name: 'Asignarme al proyecto' }))
    await waitFor(() => expect(red!.a('POST', '/objects/project_assignment/records')).toHaveLength(1))
    expect(await screen.findByRole('combobox', { name: 'CRS de trabajo' })).toBeInTheDocument()
  })

  it('sin la asignación no sale ningún PUT: ni «Siguiente», ni el indicador, ni «Guardar y salir»', async () => {
    fetch = abrirPortal('/projects/new', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed([misAsignaciones()])
    await identificar()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('heading', { name: PIDE })
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Partes/ }))
    expect(screen.getByRole('heading', { name: PIDE })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p9/overview'))
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(0)
  })

  it('un borrador abierto con ?draft= sin asignación pide lo mismo antes de cualquier escritura', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed([misAsignaciones()])
    expect(await screen.findByRole('heading', { name: PIDE })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'code' })).not.toBeInTheDocument()
    expect(red.a('PUT', '/objects/project/records/p9')).toHaveLength(0)
  })

  it('sin CREATE sobre project_assignment lo dice: pida a quien administra que lo asigne', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, permisos({ ...PAD.objects, project_assignment: ['READ'] }), rutas())
    red = espiarRed([misAsignaciones()])
    expect(await screen.findByText(/Su cuenta no puede asignarse/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignarme al proyecto' })).not.toBeInTheDocument()
  })

  it('un error sobre el usuario de la sesión (campos ocultos) se ve al pie, no se calla (re-revisión, menor 2)', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    red = espiarRed([
      misAsignaciones(),
      {
        method: 'POST',
        path: '/objects/project_assignment/records',
        responder: () => problema(400, 'detalle', [{ field: 'member_user_id', message: 'USER_REFERENCE' }])
      }
    ])
    await userEvent.type(await screen.findByRole('textbox', { name: 'Rol en el proyecto' }), 'ROL_DE_PRUEBA')
    await userEvent.click(screen.getByRole('button', { name: 'Asignarme al proyecto' }))
    expect(await screen.findByText('El correo y el identificador no nombran a un usuario de su organización.')).toBeVisible()
    expect(screen.queryByText(/USER_REFERENCE/)).not.toBeInTheDocument()
  })

  it('si la relectura de las asignaciones falla tras asignarse, no ofrece asignarse de nuevo: pide reintentar la lectura (re-revisión, menor 2)', async () => {
    fetch = abrirPortal('/projects/new?draft=p9', ADMINISTRACION_DE_PROYECTO, PAD, rutas())
    // antes del alta, sin asignación; la primera lectura después del alta falla; la del reintento trae la asignación
    let trasElAlta = 0
    red = espiarRed([
      {
        path: /^\/objects\/project_assignment\/records\?.*member_user_id=/,
        responder: () => {
          if (red!.a('POST', '/objects/project_assignment/records').length === 0) return jsonResponse(pagina([]))
          return ++trasElAlta === 1 ? problema(400, 'La lectura falló') : jsonResponse(pagina([MI_ASIGNACION]))
        }
      }
    ])
    await userEvent.type(await screen.findByRole('textbox', { name: 'Rol en el proyecto' }), 'ROL_DE_PRUEBA')
    await userEvent.click(screen.getByRole('button', { name: 'Asignarme al proyecto' }))
    expect(await screen.findByText(/Ya se asignó a este proyecto, pero no se pudo leer su asignación/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignarme al proyecto' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('textbox', { name: 'code' })).toBeInTheDocument()
    expect(red.a('POST', '/objects/project_assignment/records')).toHaveLength(1)
  })

  it('ADMIN no la ve: del paso 1 pasa directo a la ubicación', async () => {
    fetch = abrirPortal('/projects/new', ADMINISTRACION, { admin: true, objects: PAD.objects }, rutas())
    red = espiarRed([misAsignaciones()])
    await identificar()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('combobox', { name: 'CRS de trabajo' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: PIDE })).not.toBeInTheDocument()
    expect(red.a('POST', '/objects/project_assignment/records')).toHaveLength(0)
  })
})
