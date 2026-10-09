import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro, workflow } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ADMINISTRACION, GERENCIA_SOCIAL, permisos } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'

vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

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

const V1 = registro('a1', { project: 'p1', area_type: 'AIDS', version_number: 1 }, { state: 'approved' })
const V2 = registro(
  'a2',
  { project: 'p1', area_type: 'AIDS', version_number: 2, criteria: 'Uso de agua compartido' },
  { state: 'draft', updatedAt: '2026-10-06T12:00:00.5Z' }
)
const miembro = (id: string, area: string, lugar: [string, string]) =>
  registro(id, { area_of_influence: area, [lugar[0]]: lugar[1], member_condition: 'INCLUIDO' })

const SMG = permisos({ project: ['READ'], area_of_influence: ['READ', 'CREATE', 'UPDATE', 'APPROVE'], area_of_influence_member: ['READ', 'CREATE'] })
const rutas = (miembrosV2 = [miembro('m1', 'a2', ['locality', 'l1']), miembro('m2', 'a2', ['community', 'c1'])]) => [
  { path: '/objects/project/records/p1', body: registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'active' }) },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  {
    path: '/objects/area_of_influence/workflow',
    body: workflow('area_of_influence', [
      ['draft', 'Borrador'],
      ['approved', 'Aprobada'],
      ['superseded', 'Reemplazada']
    ])
  },
  {
    path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
    body: pagina([registro('as1', { project: 'p1', member_user_id: GERENCIA_SOCIAL.id, active: true })])
  },
  { path: '/objects/area_of_influence/records/a2', body: V2 },
  { path: '/objects/area_of_influence/records/a1', body: V1 },
  { path: '/objects/area_of_influence/records', body: pagina([V2, V1]) },
  { path: /^\/objects\/area_of_influence_member\/records\?.*area_of_influence=a2/, body: pagina(miembrosV2) },
  {
    path: /^\/objects\/area_of_influence_member\/records\?.*area_of_influence=a1/,
    body: pagina([miembro('m0', 'a1', ['locality', 'l1']), miembro('m9', 'a1', ['locality', 'l9'])])
  },
  { path: '/objects/locality/records/l1', body: registro('l1', { name: 'Tunas' }) },
  { path: '/objects/locality/records/l9', body: registro('l9', { name: 'Sector en separación' }) },
  { path: '/objects/community/records/c1', body: registro('c1', { name: 'CC Tunas Pampa' }) },
  {
    path: '/metadata/objects/area_of_influence_member',
    body: { id: 'x', name: 'area_of_influence_member', fields: [{ name: 'member_condition', enumOptions: ['INCLUIDO', 'PROVISIONAL'] }] }
  },
  {
    method: 'POST',
    path: '/sgspe/areas-of-influence/a2/approve',
    body: { approved: { ...V2, state: 'approved' }, superseded: { ...V1, state: 'superseded' } }
  },
  {
    method: 'POST',
    path: '/objects/area_of_influence/records',
    body: registro('a3', { project: 'p1', area_type: 'AIDS', version_number: 3 }, { state: 'draft' })
  },
  { method: 'POST', path: '/objects/area_of_influence_member/records', body: registro('mx', {}) }
]

const filas = () =>
  within(screen.getByRole('table', { name: 'Miembros' }))
    .getAllByRole('row')
    .slice(1)

describe('S10 · área de influencia', () => {
  it('compara los miembros con la versión vigente: igual, nuevo y sale', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
    await waitFor(() => expect(filas()).toHaveLength(3))
    await waitFor(() => expect(filas()[2].textContent).toContain('Sector en separación'))
    const texto = filas().map((f) => f.textContent)
    expect(texto[0]).toContain('Tunas')
    expect(texto[0]).toContain('Igual')
    expect(texto[1]).toContain('CC Tunas Pampa')
    expect(texto[1]).toContain('Nuevo')
    expect(texto[2]).toContain('Sector en separación')
    expect(texto[2]).toContain('Sale')
  })

  it('aprobar exige motivo y llama al comando con la versión leída', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
    red = espiarRed()
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar versión 2' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/la aprobada anterior de este tipo pasa a Reemplazada/)).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aprobar versión 2' }))
    expect(await within(dialogo).findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Estudio de línea base aprobado')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aprobar versión 2' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/areas-of-influence/a2/approve')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/areas-of-influence/a2/approve')
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-06T12:00:00.5Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Estudio%20de%20l%C3%ADnea%20base%20aprobado")
  })

  // los códigos del comando (api.md §3.3): dos aprobaciones a la vez se serializan y la segunda recibe 412 o STATE_MISMATCH
  const aprobarCon = async (respuesta: () => Response) => {
    red = espiarRed([{ method: 'POST', path: '/sgspe/areas-of-influence/a2/approve', responder: respuesta }])
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar versión 2' }))
    await userEvent.type(await screen.findByLabelText('Motivo (obligatorio)'), 'Estudio aprobado')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aprobar versión 2' }))
  }

  it('409 STATE_MISMATCH dice que la versión ya no está en borrador y Recargar relee el área', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
    await aprobarCon(() => problema(409, 'La versión no está en draft', [{ field: 'state', message: 'STATE_MISMATCH' }]))
    expect(await screen.findByText(/Esta versión ya no está en borrador: otra persona la aprobó o la reemplazó/)).toBeInTheDocument()
    const antes = red!.a('GET', '/objects/area_of_influence/records/a2').length
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(red!.a('GET', '/objects/area_of_influence/records/a2').length).toBeGreaterThan(antes))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('409 MEMBERS_REQUIRED ofrece agregar miembros', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
    await aprobarCon(() => problema(409, 'Sin miembros', [{ field: 'area_of_influence_member', message: 'MEMBERS_REQUIRED' }]))
    expect(await screen.findByText(/El servidor no encuentra miembros en esta versión/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar miembros' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('region', { name: 'Agregar miembro' })).toHaveFocus())
  })

  it('403 ROLE_REQUIRED dice qué falta, no el código', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
    await aprobarCon(() => problema(403, 'Falta el rol', [{ field: 'record', message: 'ROLE_REQUIRED' }]))
    expect(await screen.findByText('Su rol no puede dar este paso del flujo.')).toBeInTheDocument()
    expect(screen.queryByText('ROLE_REQUIRED')).not.toBeInTheDocument()
  })

  it('un 412 dice que otra persona cambió el área, ofrece recargar y conserva el motivo', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
    await aprobarCon(() => problema(412, 'El área cambió', [{ field: 'updatedAt', message: 'valor actual 2026-10-06T12:30:00Z' }]))
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo (obligatorio)')).toHaveValue('Estudio aprobado')
  })

  it('sin miembros, aprobar está deshabilitado con la razón', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas([]))
    const boton = await screen.findByRole('button', { name: 'Aprobar versión 2' })
    await waitFor(() => expect(boton).toBeDisabled())
    expect(boton).toHaveAttribute('title', 'Agregue al menos un miembro antes de aprobar')
  })

  it('una versión aprobada no cambia sus miembros: se crea una versión nueva con su copia', async () => {
    fetch = abrirPortal('/projects/p1/areas/a1', GERENCIA_SOCIAL, SMG, rutas())
    red = espiarRed()
    expect(await screen.findByText(/sus miembros ya no cambian/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Agregar miembro' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nueva versión' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/areas/a3'))
    expect(red.a('POST', '/objects/area_of_influence/records')[0].cuerpo).toMatchObject({ attributes: { area_type: 'AIDS', version_number: 3 } })
    expect(red.a('POST', '/objects/area_of_influence_member/records')).toHaveLength(2)
  })

  it('un 428 ofrece recargar y conserva el motivo', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
    await aprobarCon(() => problema(428, 'Falta If-Match', [{ field: 'If-Match', message: 'valor requerido' }]))
    await userEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo (obligatorio)')).toHaveValue('Estudio aprobado')
  })

  it('sin asignación vigente al proyecto no ofrece aprobar ni agregar miembros', async () => {
    const sinAsignacion = rutas().map((r) =>
      'path' in r && r.path instanceof RegExp && r.path.source.includes('project_assignment') ? { ...r, body: pagina([]) } : r
    )
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, sinAsignacion)
    expect(await screen.findByRole('table', { name: 'Miembros' })).toBeInTheDocument()
    await waitFor(() => expect(filas()).toHaveLength(3))
    expect(screen.queryByRole('button', { name: 'Aprobar versión 2' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Agregar miembro' })).not.toBeInTheDocument()
  })

  describe('la comparación y las lecturas que fallan', () => {
    const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
    const deLaVigente = /^\/objects\/area_of_influence_member\/records\?.*area_of_influence=a1/
    const miembrosDeLaVigente = [miembro('m0', 'a1', ['locality', 'l1']), miembro('m9', 'a1', ['locality', 'l9'])]

    it('mientras lee los miembros de la vigente dice «Comparando…», no «Nuevo»', async () => {
      let liberar: () => void = () => {}
      fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
      red = espiarRed([
        {
          path: deLaVigente,
          responder: () =>
            new Promise((resolver) => {
              liberar = () => resolver(json(pagina(miembrosDeLaVigente)))
            })
        }
      ])
      await waitFor(() => expect(filas()).toHaveLength(2))
      await waitFor(() => expect(filas()[0].textContent).toContain('Tunas'))
      expect(filas().map((f) => f.textContent)).toEqual([expect.stringContaining('Comparando…'), expect.stringContaining('Comparando…')])
      expect(screen.queryByText('Nuevo')).not.toBeInTheDocument()
      liberar()
      await waitFor(() => expect(filas()).toHaveLength(3))
      expect(filas()[0].textContent).toContain('Igual')
      expect(filas()[1].textContent).toContain('Nuevo')
    })

    it('si falla la lectura de la vigente, lo dice con «Reintentar» y no marca «Nuevo» en todas las filas', async () => {
      let falla = true
      fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
      red = espiarRed([{ path: deLaVigente, responder: () => (falla ? problema(500, 'Falló la lectura') : json(pagina(miembrosDeLaVigente))) }])
      expect(await screen.findByText(/No se pudo cargar esta información/)).toBeInTheDocument()
      await waitFor(() => expect(filas()).toHaveLength(2))
      expect(screen.queryByText('Nuevo')).not.toBeInTheDocument()
      expect(screen.queryByText('Igual')).not.toBeInTheDocument()
      falla = false
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
      await waitFor(() => expect(filas()).toHaveLength(3))
      expect(filas()[0].textContent).toContain('Igual')
      expect(filas()[1].textContent).toContain('Nuevo')
    })

    it('si fallan los miembros del área, lo dice y «Aprobar» explica por qué no se puede', async () => {
      fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
      red = espiarRed([{ path: /^\/objects\/area_of_influence_member\/records\?.*area_of_influence=a2/, responder: () => problema(500, 'Falló la lectura') }])
      expect(await screen.findByText(/No se pudo cargar esta información/)).toBeInTheDocument()
      const boton = screen.getByRole('button', { name: 'Aprobar versión 2' })
      expect(boton).toBeDisabled()
      expect(boton).toHaveAttribute('title', 'No se pudieron leer los miembros de esta versión: sin ellos no se puede aprobar.')
    })

    it('si falla la lista de versiones, lo dice y no ofrece una versión nueva a ciegas', async () => {
      fetch = abrirPortal('/projects/p1/areas/a1', GERENCIA_SOCIAL, SMG, rutas())
      red = espiarRed([{ path: /^\/objects\/area_of_influence\/records\?/, responder: () => problema(500, 'Falló la lectura') }])
      expect(await screen.findByText(/No se pudo cargar esta información/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Nueva versión' })).toBeDisabled()
    })

    it('un lugar ilegible dice «No disponible», no su identificador', async () => {
      fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
      red = espiarRed([{ path: '/objects/locality/records/l9', responder: () => problema(500, 'Falló la lectura') }])
      await waitFor(() => expect(filas()).toHaveLength(3))
      await waitFor(() => expect(filas()[2].textContent).toContain('No disponible'))
      expect(filas()[2].textContent).not.toContain('l9')
      // sin un botón de ayuda por fila: el motivo es el de la columna y los lectores de pantalla lo reciben una sola vez
      const celda = within(filas()[2]).getByText('No disponible')
      expect(within(filas()[2]).queryByRole('button', { name: 'Por qué no se muestra' })).not.toBeInTheDocument()
      expect(celda).toHaveAccessibleDescription('Su cuenta no puede leer estos datos')
      // la explicación de la columna no entra en el nombre del encabezado
      expect(screen.getByRole('columnheader', { name: 'Lugar' })).toBeInTheDocument()
    })
  })

  describe('los códigos de la aprobación y de las escrituras', () => {
    it.each([
      ['ACTION_REQUIRED', 403, 'Su cuenta no tiene la acción de aprobar (APPROVE) que este paso exige.'],
      ['NOT_ASSIGNED', 403, 'No tiene una asignación vigente a este proyecto: pídala a la administración del proyecto.']
    ])('%s dice su texto, no el código', async (codigo, estado, esperado) => {
      fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
      await aprobarCon(() => problema(estado, 'Prohibido', [{ field: 'record', message: codigo }]))
      expect(await screen.findByText(esperado)).toBeInTheDocument()
      expect(screen.queryByText(codigo)).not.toBeInTheDocument()
    })

    it('MEMBERS_REQUIRED sin permiso para agregar miembros lo dice, sin ofrecer el botón', async () => {
      const sinAlta = permisos({ project: ['READ'], area_of_influence: ['READ', 'APPROVE'], area_of_influence_member: ['READ'] })
      fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, sinAlta, rutas())
      await aprobarCon(() => problema(409, 'Sin miembros', [{ field: 'area_of_influence_member', message: 'MEMBERS_REQUIRED' }]))
      expect(await screen.findByText(/Su cuenta no puede agregar miembros/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Agregar miembros' })).not.toBeInTheDocument()
    })

    it('FROZEN_MEMBERS al agregar un miembro dice su texto y relee el área', async () => {
      fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, [
        ...rutas(),
        { path: '/objects/locality/records', body: pagina([registro('l5', { name: 'Chacra Nueva' })]) }
      ])
      red = espiarRed([
        {
          method: 'POST',
          path: '/objects/area_of_influence_member/records',
          responder: () => problema(409, 'Congelada', [{ field: 'area_of_influence', message: 'FROZEN_MEMBERS' }])
        }
      ])
      await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar el lugar' }), 'Chac')
      const antes = red.a('GET', '/objects/area_of_influence/records/a2').length
      await userEvent.click(await screen.findByRole('button', { name: 'Chacra Nueva' }))
      expect(await screen.findByText(/sus miembros no cambian/)).toBeInTheDocument()
      await waitFor(() => expect(red!.a('GET', '/objects/area_of_influence/records/a2').length).toBeGreaterThan(antes))
    })
  })

  it('tras «Recargar», aprobar espera la lectura del área y reenvía el If-Match nuevo', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, rutas())
    const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
    let lecturas = 0
    let liberar: () => void = () => {}
    let aprobaciones = 0
    red = espiarRed([
      {
        path: '/objects/area_of_influence/records/a2',
        responder: () => {
          lecturas += 1
          if (lecturas === 1) return json(V2)
          return new Promise((resolver) => {
            liberar = () => resolver(json({ ...V2, updatedAt: '2026-10-06T13:00:00Z' }))
          })
        }
      },
      {
        method: 'POST',
        path: '/sgspe/areas-of-influence/a2/approve',
        responder: () => {
          aprobaciones += 1
          return aprobaciones === 1
            ? problema(412, 'El área cambió', [{ field: 'updatedAt', message: 'valor actual 2026-10-06T13:00:00Z' }])
            : json({ approved: { ...V2, state: 'approved' }, superseded: null })
        }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar versión 2' }))
    await userEvent.type(await screen.findByLabelText('Motivo (obligatorio)'), 'Estudio aprobado')
    const dialogo = screen.getByRole('dialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aprobar versión 2' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(lecturas).toBe(2))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aprobar versión 2' })).toBeDisabled()
    liberar()
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aprobar versión 2' })).toBeEnabled())
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aprobar versión 2' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/areas-of-influence/a2/approve')).toHaveLength(2))
    const [, segunda] = red.a('POST', '/sgspe/areas-of-influence/a2/approve')
    expect(segunda.cabeceras.get('If-Match')).toBe('"2026-10-06T13:00:00Z"')
  })

  describe('una versión nueva a medias', () => {
    const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
    const A3 = registro('a3', { project: 'p1', area_type: 'AIDS', version_number: 3 }, { state: 'draft' })

    it('si falla la copia de un miembro, enlaza a la versión creada y el reintento toma el número siguiente', async () => {
      fetch = abrirPortal('/projects/p1/areas/a1', GERENCIA_SOCIAL, SMG, rutas())
      let creadas = 0
      let miembrosCopiados = 0
      red = espiarRed([
        { path: /^\/objects\/area_of_influence\/records\?/, responder: () => json(pagina(creadas > 0 ? [A3, V2, V1] : [V2, V1])) },
        {
          method: 'POST',
          path: '/objects/area_of_influence/records',
          responder: () => {
            creadas += 1
            return json(A3)
          }
        },
        {
          method: 'POST',
          path: '/objects/area_of_influence_member/records',
          responder: () => {
            miembrosCopiados += 1
            return miembrosCopiados === 2 ? problema(500, 'No se pudo guardar el miembro') : json(registro('mx', {}))
          }
        }
      ])
      await userEvent.click(await screen.findByRole('button', { name: 'Nueva versión' }))
      expect(await screen.findByText(/La versión 3 ya se creó, pero la copia de sus miembros quedó incompleta/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Continuar en la versión creada' })).toHaveAttribute('href', '/projects/p1/areas/a3')
      expect(rutaActual()).toBe('/projects/p1/areas/a1')
      await userEvent.click(screen.getByRole('button', { name: 'Nueva versión' }))
      await waitFor(() => expect(red!.a('POST', '/objects/area_of_influence/records')).toHaveLength(2))
      expect(red.a('POST', '/objects/area_of_influence/records')[1].cuerpo).toMatchObject({ attributes: { version_number: 4 } })
    })

    it('FROZEN_AREA al crear la versión dice su texto', async () => {
      fetch = abrirPortal('/projects/p1/areas/a1', GERENCIA_SOCIAL, SMG, rutas())
      red = espiarRed([
        {
          method: 'POST',
          path: '/objects/area_of_influence/records',
          responder: () => problema(409, 'Congelada', [{ field: 'area_of_influence', message: 'FROZEN_AREA' }])
        }
      ])
      await userEvent.click(await screen.findByRole('button', { name: 'Nueva versión' }))
      expect(await screen.findByText(/El proyecto, el tipo y el número de una versión aprobada o reemplazada no cambian/)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Continuar en la versión creada' })).not.toBeInTheDocument()
    })
  })
})

// P38: solo ADMIN escribe sin asignación (revisión final, I3)
describe('S13 · escritura sin asignación', () => {
  it('ADMIN sin asignación aprueba la versión en borrador', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', ADMINISTRACION, { admin: true, objects: SMG.objects }, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...rutas()
    ])
    expect(await screen.findByRole('button', { name: 'Aprobar versión 2' })).toBeInTheDocument()
  })

  it('otra cuenta sin asignación no lo ve', async () => {
    fetch = abrirPortal('/projects/p1/areas/a2', GERENCIA_SOCIAL, SMG, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...rutas()
    ])
    await screen.findByText(/No está asignado a este proyecto/)
    await screen.findByRole('table', { name: 'Miembros' })
    expect(screen.queryByRole('button', { name: 'Aprobar versión 2' })).not.toBeInTheDocument()
  })
})
