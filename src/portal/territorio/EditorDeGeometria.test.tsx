import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { ANALISTA_SIG, COMUNIDAD, CUADRADO, EQUIPO_SIG, LAZO, LOCALIDAD, PUNTO, REVISION_LAZO } from '../../test/sig'
import { EditorDeGeometria } from './EditorDeGeometria'
import { FichaComunidadPage } from './FichaComunidadPage'
import { FichaLocalidadPage } from './FichaLocalidadPage'

vi.mock('../mapa/Dibujo', () => import('../../test/dibujoFalso'))
vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

// spec F6 §3.6 y gis.md §6.6: la geometría editada se revisa antes de guardarla; nada se guarda sin una elección explícita
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const TERRITORIO = { type: 'GEOMETRY', geometry: { type: 'MULTIPOLYGON', srid: 4326 } }
const DEF_COMUNIDAD = definicion('community', ['name', 'code', ['territory', TERRITORIO]])
const rutas = (revision: unknown) => [
  { path: '/metadata/objects/community', body: DEF_COMUNIDAD },
  { method: 'POST', path: '/sgspe/territory/geometry-checks', body: revision },
  { method: 'PUT', path: '/objects/community/records/c1', body: COMUNIDAD },
  { path: '/objects/community/records/c1', body: COMUNIDAD }
]
const editar = (terminar = vi.fn()) => {
  montar(<EditorDeGeometria objeto="community" registro={COMUNIDAD} campos={['territory']} alTerminar={terminar} />, {
    usuario: ANALISTA_SIG,
    permisos: EQUIPO_SIG
  })
  return terminar
}

describe('edición de geometrías', () => {
  it('un lazo inválido muestra el motivo y guarda la reparación solo al elegirla', async () => {
    fetch = mockFetch(rutas(REVISION_LAZO))
    red = espiarRed()
    const terminar = editar()
    await userEvent.click(await screen.findByRole('button', { name: 'Dibujar un lazo de prueba' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('La geometría no es válida.')).toBeInTheDocument()
    // el motivo ya viene en español del servidor: se dice tal cual (enmienda 13.2)
    expect(screen.getByText('Motivo: autointersección')).toBeInTheDocument()
    expect(screen.getByText('La reparación propuesta cambia el área de 4.9 ha a 2.45 ha.')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/territory/geometry-checks')[0].cuerpo).toEqual({ geometry: LAZO, object: 'community', field: 'territory' })
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect(red.a('PUT', '/objects/community/records/c1')).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Guardar la reparación' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/community/records/c1')).toHaveLength(1))
    const [guardado] = red.a('PUT', '/objects/community/records/c1')
    expect((guardado.cuerpo as { geometries: unknown }).geometries).toEqual({ territory: REVISION_LAZO.repaired })
    expect(guardado.cabeceras.get('If-Match')).toBe(`"${COMUNIDAD.updatedAt}"`)
    await waitFor(() => expect(terminar).toHaveBeenCalled())
  })

  it('un tipo que no coincide no se puede guardar', async () => {
    // typeMatches false ⇔ normalized null (enmienda 13.1)
    fetch = mockFetch(rutas({ ...REVISION_LAZO, valid: true, reason: null, typeMatches: false, normalized: null, repaired: null }))
    red = espiarRed()
    editar()
    await userEvent.click(await screen.findByRole('button', { name: 'Dibujar un punto de prueba' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('La geometría dibujada no es del tipo que pide este dato: dibuje un polígono.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Guardar/ })).not.toBeInTheDocument()
    expect(red.a('PUT', '/objects/community/records/c1')).toEqual([])
  })

  it('fuera de zona pide confirmar antes de guardar, y guarda la normalizada en el tipo del campo', async () => {
    // el cuadrado dibujado es un Polygon; community.territory es MULTIPOLYGON: se guarda normalized, nunca el dibujo crudo
    const normalizada = { type: 'MultiPolygon', coordinates: [CUADRADO.coordinates] }
    fetch = mockFetch(
      rutas({
        valid: true,
        reason: null,
        typeMatches: true,
        normalized: normalizada,
        repaired: null,
        areaHaBefore: 4.9,
        areaHaAfter: 4.9,
        zone: { srid: 32717, outOfZone: true, outOfRegion: false }
      })
    )
    red = espiarRed()
    editar()
    await userEvent.click(await screen.findByRole('button', { name: 'Dibujar un cuadrado de prueba' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('La geometría cae fuera de la zona UTM esperada.')).toBeInTheDocument()
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    expect(guardar).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Confirmo que la ubicación es correcta' }))
    await userEvent.click(guardar)
    await waitFor(() => expect(red!.a('PUT', '/objects/community/records/c1')).toHaveLength(1))
    expect((red.a('PUT', '/objects/community/records/c1')[0].cuerpo as { geometries: unknown }).geometries).toEqual({ territory: normalizada })
  })

  it('dibujar otra vez deja sin efecto la revisión anterior', async () => {
    fetch = mockFetch(rutas(REVISION_LAZO))
    editar()
    await userEvent.click(await screen.findByRole('button', { name: 'Dibujar un lazo de prueba' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    await screen.findByText('La geometría no es válida.')
    await userEvent.click(screen.getByRole('button', { name: 'Dibujar un cuadrado de prueba' }))
    expect(screen.queryByText('La geometría no es válida.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar la reparación' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Territorio' })).getByRole('button', { name: 'Dibujar un cuadrado de prueba' })).toBeInTheDocument()
  })

  it('una reparación de otro tipo que el del campo no se ofrece ni se guarda', async () => {
    // un lazo en locality.boundary (POLYGON) se repara en un MultiPolygon de dos partes que no cabe en el tipo del campo: el
    // servidor la devuelve cruda (GeometryChecks) y el portal no la guarda
    const dosPartes = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-78.501, -7.901],
            [-78.5, -7.9],
            [-78.501, -7.899],
            [-78.501, -7.901]
          ]
        ],
        [
          [
            [-78.499, -7.901],
            [-78.499, -7.899],
            [-78.5, -7.9],
            [-78.499, -7.901]
          ]
        ]
      ]
    }
    fetch = mockFetch([
      {
        path: '/metadata/objects/locality',
        body: definicion('locality', ['name', ['boundary', { type: 'GEOMETRY', geometry: { type: 'POLYGON', srid: 4326 } }]])
      },
      {
        method: 'POST',
        path: '/sgspe/territory/geometry-checks',
        body: { ...REVISION_LAZO, normalized: LAZO, repaired: dosPartes, areaHaBefore: 4.9, areaHaAfter: 2.45 }
      },
      { method: 'PUT', path: '/objects/locality/records/l1', body: LOCALIDAD }
    ])
    red = espiarRed()
    montar(<EditorDeGeometria objeto="locality" registro={LOCALIDAD} campos={['boundary']} alTerminar={vi.fn()} />, {
      usuario: ANALISTA_SIG,
      permisos: EQUIPO_SIG
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Dibujar un lazo de prueba' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('La geometría no es válida.')).toBeInTheDocument()
    expect(screen.getByText('La reparación automática cambia el tipo de la geometría y no se puede guardar: corrija el dibujo.')).toBeInTheDocument()
    expect(screen.queryByText(/La reparación propuesta cambia el área/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Guardar/ })).not.toBeInTheDocument()
    expect(red.a('PUT', '/objects/locality/records/l1')).toEqual([])
  })

  it('el dibujo no va en una caja de altura fija y «Revisar» queda debajo de él', async () => {
    // GeometryField trae su propia altura (cabecera, mapa y ayuda): una caja más baja lo desborda y tapa «Revisar»
    fetch = mockFetch(rutas(REVISION_LAZO))
    editar()
    const dibujo = await screen.findByRole('group', { name: 'Territorio' })
    const revisar = screen.getByRole('button', { name: 'Revisar' })
    for (let caja = dibujo.parentElement; caja && caja !== document.body; caja = caja.parentElement) {
      expect(caja.className).not.toMatch(/(^|\s)(h|max-h)-/)
    }
    expect(dibujo.compareDocumentPosition(revisar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sin dibujo no se revisa', async () => {
    fetch = mockFetch(rutas(REVISION_LAZO))
    editar()
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar el dibujo de prueba' }))
    expect(screen.getByRole('button', { name: 'Revisar' })).toBeDisabled()
    expect(screen.getByText('Dibuje una geometría para revisarla.')).toBeInTheDocument()
  })

  it('un error de la revisión se dice con su detalle y no bloquea «Cancelar»', async () => {
    fetch = mockFetch(rutas(REVISION_LAZO))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/geometry-checks',
        // el detail y el texto libre de errors[] distintos: se dice el detail (enmienda 13.3)
        responder: () => problema(400, 'La geometría tiene demasiados vértices.', [{ field: 'geometry', message: 'too many vertices' }])
      }
    ])
    const terminar = editar()
    await userEvent.click(await screen.findByRole('button', { name: 'Dibujar un lazo de prueba' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('La geometría tiene demasiados vértices.')).toBeInTheDocument()
    expect(screen.queryByText(/too many vertices/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Guardar/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(terminar).toHaveBeenCalled()
    expect(red.a('PUT', '/objects/community/records/c1')).toEqual([])
  })
})

describe('S13 y S14 · «Editar la geometría»', () => {
  const comunidad = (territorio: Record<string, unknown>) => [
    { path: '/objects/community/records/c1', body: COMUNIDAD },
    { path: '/metadata/objects/community', body: definicion('community', ['name', ['territory', { ...TERRITORIO, ...territorio }]]) }
  ]
  const abrirComunidad = () =>
    montar(<FichaComunidadPage />, {
      ruta: '/territory/communities/c1',
      camino: '/territory/communities/:id',
      usuario: ANALISTA_SIG,
      permisos: EQUIPO_SIG
    })

  it('la comunidad abre el editor de su territorio con UPDATE y el campo escribible', async () => {
    fetch = mockFetch(comunidad({}))
    abrirComunidad()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar la geometría' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar la geometría' })
    expect(await within(dialogo).findByRole('group', { name: 'Territorio' })).toBeInTheDocument()
    expect(within(dialogo).queryByRole('combobox', { name: 'Qué geometría' })).not.toBeInTheDocument()
  })

  it('sin el territorio escribible la comunidad no ofrece «Editar la geometría»', async () => {
    fetch = mockFetch(comunidad({ editable: false }))
    abrirComunidad()
    // «Editar» llega con la definición (name es escribible): para entonces la ficha ya decidió
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar la geometría' })).not.toBeInTheDocument()
  })

  it('la localidad ofrece solo sus geometrías escribibles y dibuja el tipo de cada una', async () => {
    fetch = mockFetch([
      { path: '/objects/locality/records/l1', body: LOCALIDAD },
      {
        path: '/metadata/objects/locality',
        body: definicion('locality', [
          'name',
          ['location', { type: 'GEOMETRY', geometry: { type: 'POINT', srid: 4326 } }],
          ['boundary', { type: 'GEOMETRY', geometry: { type: 'POLYGON', srid: 4326 } }]
        ])
      }
    ])
    montar(<FichaLocalidadPage />, { ruta: '/territory/localities/l1', camino: '/territory/localities/:id', usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    await userEvent.click(await screen.findByRole('button', { name: 'Editar la geometría' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar la geometría' })
    const ubicacion = await within(dialogo).findByRole('group', { name: 'Ubicación' })
    expect(ubicacion).toHaveAttribute('data-tipo', 'POINT')
    // el dibujo parte de la geometría guardada
    expect(JSON.parse(ubicacion.getAttribute('data-valor') ?? '')).toEqual(PUNTO)
    await userEvent.selectOptions(within(dialogo).getByRole('combobox', { name: 'Qué geometría' }), 'boundary')
    expect(await within(dialogo).findByRole('group', { name: 'Límite' })).toHaveAttribute('data-tipo', 'POLYGON')
  })

  it('la localidad con solo la ubicación escribible no pregunta cuál', async () => {
    fetch = mockFetch([
      { path: '/objects/locality/records/l1', body: LOCALIDAD },
      {
        path: '/metadata/objects/locality',
        body: definicion('locality', [
          'name',
          ['location', { type: 'GEOMETRY', geometry: { type: 'POINT', srid: 4326 } }],
          ['boundary', { type: 'GEOMETRY', editable: false, geometry: { type: 'POLYGON', srid: 4326 } }]
        ])
      }
    ])
    montar(<FichaLocalidadPage />, { ruta: '/territory/localities/l1', camino: '/territory/localities/:id', usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
    await userEvent.click(await screen.findByRole('button', { name: 'Editar la geometría' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar la geometría' })
    expect(await within(dialogo).findByRole('group', { name: 'Ubicación' })).toBeInTheDocument()
    expect(within(dialogo).queryByRole('combobox', { name: 'Qué geometría' })).not.toBeInTheDocument()
  })
})
