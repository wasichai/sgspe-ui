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
