import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { definicion, pagina, registro, workflow } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ADMINISTRACION_DE_PROYECTO, permisos, RELACIONISTA } from '../../test/portal'
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
})
