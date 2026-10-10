import { createApiClient, type ObjectDefinition } from '@wasichai/core'
import { mockFetch } from '@wasichai/testing'
import { describe, expect, it, vi } from 'vitest'
import { espiarRed, problema } from '../../test/red'
import { crearPedido, type Pedido } from './http'
import { atributosDeEscritura, consulta, escribeAlgunCampo, geometriasDeEscritura, guardarCambio, leerConTope, leerTodos, type Registro } from './registros'

const campo = (name: string, extra: Partial<ObjectDefinition['fields'][number]> = {}) => ({
  id: name,
  name,
  label: name,
  type: 'TEXT',
  required: false,
  unique: false,
  defaultValue: null,
  description: null,
  position: 0,
  enumOptions: null,
  relationTarget: null,
  visible: true,
  editable: true,
  ...extra
})

// la definición de stakeholder que ve un relacionista: stance no aparece (no la lee), owner_user_id no se escribe
const STAKEHOLDER: ObjectDefinition = {
  id: 'o-stk',
  name: 'stakeholder',
  label: 'Grupo de interés',
  pluralLabel: 'Grupos de interés',
  description: null,
  enabled: true,
  fields: [
    campo('stakeholder_type', { type: 'ENUM' }),
    campo('inclusion_reason'),
    campo('owner_user_id', { editable: false }),
    campo('influence_group', { type: 'ENUM' }),
    campo('last_contact_date', { type: 'DATE' }),
    campo('project', { type: 'RELATION' })
  ]
}

const registro: Registro = {
  id: 's1',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
  attributes: { stakeholder_type: 'LIDER LOCAL', inclusion_reason: 'Teniente gobernador', owner_user_id: 'u-9', influence_group: 'POLITICO', project: 'p1' }
}

describe('atributosDeEscritura', () => {
  it('al crear manda solo lo cambiado que la persona puede escribir, sin derivados', () => {
    expect(
      atributosDeEscritura('stakeholder', STAKEHOLDER, { stakeholder_type: 'IGLESIA', influence_group: 'POLITICO', owner_user_id: 'u-1', stance: 'A FAVOR' })
    ).toEqual({
      stakeholder_type: 'IGLESIA'
    })
  })

  it('al cambiar manda las claves del GET que la persona puede escribir, con lo leído y lo cambiado: el PUT reemplaza', () => {
    expect(atributosDeEscritura('stakeholder', STAKEHOLDER, { inclusion_reason: 'Alcalde' }, registro)).toEqual({
      stakeholder_type: 'LIDER LOCAL',
      inclusion_reason: 'Alcalde',
      project: 'p1'
    })
  })

  it('un derivado leído no viaja: DerivedFieldsKeeper lo conserva', () => {
    const conDerivado = { ...registro, attributes: { ...registro.attributes, last_contact_date: '2026-09-30' } }
    expect(atributosDeEscritura('stakeholder', STAKEHOLDER, {}, conDerivado)).not.toHaveProperty('last_contact_date')
  })

  it('el relacionista no manda la postura: no llega en el GET ni en su definición', () => {
    expect(atributosDeEscritura('stakeholder', STAKEHOLDER, { stance: 'EN CONTRA', inclusion_reason: 'Alcalde' }, registro)).not.toHaveProperty('stance')
  })

  it('una clave que el GET no trajo es un campo restringido y no viaja, aunque la definición o el formulario la nombren', () => {
    // el perfil de localidad que lee el relacionista: religion y electoral_process no llegan en el GET (security.md §7.9)
    const PERFIL: ObjectDefinition = {
      ...STAKEHOLDER,
      name: 'locality_profile',
      fields: [campo('data_source'), campo('population_count', { type: 'INTEGER' }), campo('religion'), campo('electoral_process')]
    }
    const perfil: Registro = { ...registro, id: 'lp1', attributes: { data_source: 'Censo 2017', population_count: 340 } }
    expect(atributosDeEscritura('locality_profile', PERFIL, { population_count: 352, religion: 'Católica', electoral_process: 'Junta' }, perfil)).toEqual({
      data_source: 'Censo 2017',
      population_count: 352
    })
  })

  it('un rol con u (todos los campos de solo lectura) no manda ningún campo de negocio', () => {
    const soloLectura = { ...STAKEHOLDER, fields: STAKEHOLDER.fields.map((f) => ({ ...f, editable: false })) }
    expect(atributosDeEscritura('stakeholder', soloLectura, { inclusion_reason: 'Alcalde' }, registro)).toEqual({})
    expect(escribeAlgunCampo('stakeholder', soloLectura)).toBe(false)
    expect(escribeAlgunCampo('stakeholder', STAKEHOLDER)).toBe(true)
  })

  it('un cambio con valor undefined no es un cambio: sale lo leído y no se vacía el campo', () => {
    expect(atributosDeEscritura('stakeholder', STAKEHOLDER, { inclusion_reason: undefined }, registro).inclusion_reason).toBe('Teniente gobernador')
    expect(atributosDeEscritura('stakeholder', STAKEHOLDER, { inclusion_reason: undefined, stakeholder_type: 'IGLESIA' })).toEqual({
      stakeholder_type: 'IGLESIA'
    })
  })

  it('un texto vacío se manda como null', () => {
    expect(atributosDeEscritura('stakeholder', STAKEHOLDER, { inclusion_reason: '' }, registro).inclusion_reason).toBeNull()
  })

  // plan 4.2a: los vínculos que solo escriben sus comandos (la reclasificación y la aceptación) y la clave de origen que solo escribe
  // la plataforma: fijarlos, cambiarlos o vaciarlos es 403, también con un PUT que los omite. al cambiar viajan tal como se leyeron
  // aunque el formulario traiga otro valor; al crear no viajan nunca
  const SOLICITUD: ObjectDefinition = {
    ...STAKEHOLDER,
    id: 'o-req',
    name: 'stakeholder_request',
    fields: [
      campo('description'),
      campo('created_commitment', { type: 'RELATION' }),
      campo('reclassified_from_grievance', { type: 'RELATION' }),
      campo('reclassified_from_inquiry', { type: 'RELATION' })
    ]
  }
  const solicitud: Registro = {
    ...registro,
    id: 'r1',
    attributes: { description: 'Calaminas', created_commitment: 'c9', reclassified_from_grievance: 'g0', reclassified_from_inquiry: null }
  }

  it('los vínculos de solo comando viajan tal como se leyeron, aunque el formulario los cambie o los vacíe', () => {
    expect(
      atributosDeEscritura(
        'stakeholder_request',
        SOLICITUD,
        { description: 'Calaminas y clavos', created_commitment: '', reclassified_from_grievance: 'g7', reclassified_from_inquiry: 'i3' },
        solicitud
      )
    ).toEqual({ description: 'Calaminas y clavos', created_commitment: 'c9', reclassified_from_grievance: 'g0', reclassified_from_inquiry: null })
  })

  it('al crear, los vínculos de solo comando no viajan', () => {
    expect(
      atributosDeEscritura('stakeholder_request', SOLICITUD, { description: 'Calaminas', created_commitment: 'c9', reclassified_from_grievance: 'g0' })
    ).toEqual({
      description: 'Calaminas'
    })
  })

  it('la clave de origen de una tarea, escribible o no para el rol, viaja tal como se leyó', () => {
    const TAREA: ObjectDefinition = { ...STAKEHOLDER, id: 'o-task', name: 'task', fields: [campo('assignee_user_id'), campo('generator_key')] }
    const tarea: Registro = { ...registro, id: 't1', attributes: { assignee_user_id: null, generator_key: 'escalation:grievance:abc:2026-10-09:2' } }
    expect(atributosDeEscritura('task', TAREA, { assignee_user_id: 'u-1', generator_key: null }, tarea)).toEqual({
      assignee_user_id: 'u-1',
      generator_key: 'escalation:grievance:abc:2026-10-09:2'
    })
  })

  it('una geometría nunca va en attributes', () => {
    const conGeometria = { ...STAKEHOLDER, fields: [...STAKEHOLDER.fields, campo('location', { type: 'GEOMETRY' })] }
    expect(atributosDeEscritura('stakeholder', conGeometria, { location: { type: 'Point' } })).toEqual({})
  })
})

describe('guardarCambio', () => {
  it('relee el registro después del PUT: la respuesta del PUT genérico trae los derivados en null', async () => {
    const conDerivado = { ...registro, attributes: { ...registro.attributes, last_contact_date: '2026-09-30' } }
    const fetch = mockFetch([
      { method: 'PUT', path: '/objects/stakeholder/records/s1', body: { ...conDerivado, attributes: { ...conDerivado.attributes, last_contact_date: null } } },
      { path: '/objects/stakeholder/records/s1', body: { ...conDerivado, updatedAt: '2026-10-03T10:00:00Z' } }
    ])
    const red = espiarRed()
    try {
      const cliente = createApiClient({ baseUrl: '/api', storagePrefix: 'sgspe' })
      const releido = await guardarCambio(crearPedido(cliente, vi.fn()), STAKEHOLDER, 'stakeholder', {
        registro: conDerivado,
        cambios: { inclusion_reason: 'Alcalde' }
      })
      expect(red.llamadas.map((l) => l.metodo)).toEqual(['PUT', 'GET'])
      expect(red.llamadas[0].cabeceras.get('If-Match')).toBe('"2026-10-02T10:00:00Z"')
      expect(releido.attributes.last_contact_date).toBe('2026-09-30')
      expect(releido.updatedAt).toBe('2026-10-03T10:00:00Z')
    } finally {
      red.restaurar()
      fetch.restore()
    }
  })
})

describe('guardarCambio con la relectura caída', () => {
  it('si el GET falla tras un PUT exitoso, devuelve el registro de la respuesta del PUT en lugar de lanzar', async () => {
    const guardado = { ...registro, updatedAt: '2026-10-03T10:00:00Z', attributes: { ...registro.attributes, inclusion_reason: 'Alcalde' } }
    const fetch = mockFetch([{ method: 'PUT', path: '/objects/stakeholder/records/s1', body: guardado }])
    const red = espiarRed([{ path: '/objects/stakeholder/records/s1', responder: () => problema(503, 'Servicio no disponible') }])
    try {
      const cliente = createApiClient({ baseUrl: '/api', storagePrefix: 'sgspe' })
      const devuelto = await guardarCambio(crearPedido(cliente, vi.fn()), STAKEHOLDER, 'stakeholder', { registro, cambios: { inclusion_reason: 'Alcalde' } })
      expect(red.llamadas.map((l) => l.metodo)).toEqual(['PUT', 'GET'])
      expect(devuelto.updatedAt).toBe('2026-10-03T10:00:00Z')
      expect(devuelto.attributes.inclusion_reason).toBe('Alcalde')
    } finally {
      red.restaurar()
      fetch.restore()
    }
  })
})

describe('geometriasDeEscritura', () => {
  it('manda solo las geometrías que la persona puede escribir', () => {
    const punto = { type: 'Point', coordinates: [-78.5, -7.1] }
    const PROYECTO = {
      ...STAKEHOLDER,
      name: 'project',
      fields: [campo('location', { type: 'GEOMETRY' }), campo('interest_area', { type: 'GEOMETRY', editable: false })]
    }
    expect(geometriasDeEscritura(PROYECTO, { location: punto, interest_area: punto })).toEqual({ location: punto })
    expect(geometriasDeEscritura(PROYECTO, { interest_area: punto })).toBeUndefined()
    expect(geometriasDeEscritura(PROYECTO, undefined)).toBeUndefined()
  })
})

describe('consulta', () => {
  it('omite los vacíos y repite los filtros de varios valores', () => {
    expect(consulta({ project: ['p1', 'p2'], state: '', q: undefined, size: 25, count: false })).toBe('project=p1&project=p2&size=25&count=false')
  })
})

// un servidor de páginas de 200 con cursor: la página n lleva n elementos y, mientras haya más, el cursor de la siguiente
const servidorDePaginas = (paginas: number) => {
  const pedidas: string[] = []
  const pedir = (async (ruta: string) => {
    pedidas.push(ruta)
    const n = Number(new URLSearchParams(ruta.split('?')[1]).get('after') ?? 0)
    const content = Array.from({ length: 200 }, (_, i) => ({
      id: `r${n * 200 + i}`,
      createdAt: '',
      updatedAt: '',
      state: null,
      attributes: {},
      geometries: {}
    }))
    return { content, nextCursor: n + 1 < paginas ? String(n + 1) : null }
  }) as unknown as Pedido
  return { pedir, pedidas }
}

describe('leerConTope', () => {
  it('lee todas las páginas y no marca truncado si la última no trae cursor', async () => {
    const { pedir, pedidas } = servidorDePaginas(3)
    const lectura = await leerConTope(pedir, 'engagement', {})
    expect(lectura.registros).toHaveLength(600)
    expect(lectura.truncado).toBe(false)
    expect(pedidas).toHaveLength(3)
  })

  it('con el tope cumplido y más páginas pendientes, devuelve lo leído y dice que truncó', async () => {
    const { pedir, pedidas } = servidorDePaginas(8)
    const lectura = await leerConTope(pedir, 'engagement', {})
    expect(lectura.registros).toHaveLength(1000)
    expect(lectura.truncado).toBe(true)
    expect(pedidas).toHaveLength(5)
  })

  it('mil registros exactos sin cursor pendiente no es un truncamiento', async () => {
    const { pedir } = servidorDePaginas(5)
    expect((await leerConTope(pedir, 'engagement', {})).truncado).toBe(false)
  })

  it('el tope se puede bajar, y leerTodos sigue devolviendo solo la lista', async () => {
    const { pedir } = servidorDePaginas(8)
    expect((await leerConTope(pedir, 'engagement', {}, 400)).registros).toHaveLength(400)
    const lista = await leerTodos(pedir, 'engagement', {})
    expect(Array.isArray(lista)).toBe(true)
    expect(lista).toHaveLength(1000)
  })
})
