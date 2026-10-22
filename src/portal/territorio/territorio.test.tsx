import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar, pagina, registro } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { useDefinicion } from '../datos/registros'
import { FichaComunidadPage } from './FichaComunidadPage'
import { FichaLocalidadPage } from './FichaLocalidadPage'

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

// una lectura que nunca responde (la carga) y una que falla, para ver qué dice la pantalla en medio
const nunca = (path: string | RegExp) => ({ path, responder: () => new Promise<Response>(() => {}) })
const falla = (path: string, status = 500) => ({ path, status, body: { title: 'Error', status, detail: 'Falló' } })
// las rutas sin las de un camino, para reemplazarlo
const sin = <T extends { path: string | RegExp }>(rutas: T[], ...caminos: string[]) => rutas.filter((r) => !caminos.includes(String(r.path)))

const coleccion = (elementos: [string, string, string][]) => ({
  type: 'FeatureCollection',
  features: elementos.map(([id, objeto, name]) => ({
    type: 'Feature',
    id: `${id}:g`,
    geometry: { type: 'Point', coordinates: [-78, -8] },
    properties: { __id: id, __object: objeto, name }
  }))
})
const LEE_TERRITORIO = permisos({
  locality: ['READ'],
  community: ['READ', 'UPDATE'],
  community_sector: ['READ', 'CREATE'],
  organization: ['READ'],
  position: ['READ'],
  stakeholder: ['READ'],
  area_of_influence: ['READ'],
  area_of_influence_member: ['READ'],
  locality_profile: ['READ', 'CREATE'],
  project: ['READ']
})
const base = [
  { path: '/objects/project/records', body: pagina([registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' })]) },
  { path: '/objects/project_assignment/records', body: pagina([registro('a1', { project: 'p1', active: true })]) }
]

describe('S12 · mapa territorial', () => {
  it('lista los lugares visibles; elegir uno en el mapa abre su ficha contextual y «Abrir la ficha» lleva a S13 con el rastro', async () => {
    fetch = abrirPortal('/territory', RELACIONISTA, LEE_TERRITORIO, [
      ...base,
      { path: '/sgspe/territory/layers/LYR-02', body: coleccion([['l1', 'locality', 'Tunas']]) },
      { path: '/sgspe/territory/layers/LYR-05', body: coleccion([['c1', 'community', 'CC Tunas Pampa']]) },
      { path: '/objects/community/records/c1', body: registro('c1', { name: 'CC Tunas Pampa' }) },
      { path: '/objects/organization/records', body: pagina([]) },
      { path: '/objects/community_sector/records', body: pagina([]) },
      { path: '/objects/area_of_influence_member/records', body: pagina([]) }
    ])
    const lugares = await screen.findByRole('navigation', { name: 'Lugares visibles' })
    expect(await within(lugares).findByRole('link', { name: 'Tunas' })).toHaveAttribute('href', '/territory/localities/l1')
    // un ícono por fila: el nombre accesible dice de qué lugar y el title, qué hace
    expect(within(lugares).getByRole('button', { name: 'Ver resumen de Tunas' })).toHaveAttribute('title', 'Ver resumen')
    await userEvent.click(within(screen.getByRole('list', { name: 'Mapa territorial' })).getByRole('button', { name: 'CC Tunas Pampa' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory?selected=community%3Ac1'))
    const panel = await screen.findByRole('complementary', { name: 'Ficha del lugar' })
    await userEvent.click(within(panel).getByRole('link', { name: 'Abrir la ficha' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory/communities/c1'))
    expect(await screen.findByRole('link', { name: 'Mapa territorial' })).toHaveAttribute('href', '/territory?selected=community%3Ac1')
  })

  it('con otro periodo, los registros del lugar vuelven a su primera página', async () => {
    fetch = abrirPortal('/territory?selected=locality%3Al1', RELACIONISTA, permisos({ ...LEE_TERRITORIO.objects, commitment: ['READ'] }), [
      ...base,
      { path: /^\/sgspe\/territory\/layers\//, body: coleccion([]) },
      {
        path: '/sgspe/territory/zones/locality/l1/records',
        body: { ...pagina([registro('cm1', { project: 'p1', code: 'C-001' })], { totalPages: 3, totalElements: 60 }), available: true }
      }
    ])
    red = espiarRed()
    const registros = await screen.findByRole('region', { name: 'Registros del lugar' })
    await userEvent.click(await within(registros).findByRole('button', { name: 'Siguiente' }))
    expect(await within(registros).findByText('Página 2 de 3')).toBeInTheDocument()
    await userEvent.type(within(screen.getByRole('group', { name: 'Filtros del mapa' })).getByLabelText('Desde'), '2026-07-01')
    await waitFor(() => expect(rutaActual()).toContain('periodStart=2026-07-01'))
    await waitFor(() =>
      expect(red!.a('GET', '/sgspe/territory/zones/locality/l1/records').map((l) => l.ruta)).toContain(
        '/sgspe/territory/zones/locality/l1/records?of=commitment&periodStart=2026-07-01&size=25'
      )
    )
    expect(await within(screen.getByRole('region', { name: 'Registros del lugar' })).findByText('Página 1 de 3')).toBeInTheDocument()
  })

  it('«Ver resumen» abre la ficha del lugar con el teclado y la ficha se cierra', async () => {
    fetch = abrirPortal('/territory', RELACIONISTA, LEE_TERRITORIO, [
      ...base,
      { path: '/sgspe/territory/layers/LYR-02', body: coleccion([['l1', 'locality', 'Tunas']]) },
      { path: '/sgspe/territory/layers/LYR-05', body: coleccion([]) }
    ])
    const lugares = await screen.findByRole('navigation', { name: 'Lugares visibles' })
    await userEvent.click(await within(lugares).findByRole('button', { name: 'Ver resumen de Tunas' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory?selected=locality%3Al1'))
    expect(screen.getByRole('list', { name: 'Mapa territorial' })).toHaveAttribute('data-seleccion', 'l1')
    const panel = await screen.findByRole('complementary', { name: 'Ficha del lugar' })
    await userEvent.click(within(panel).getByRole('button', { name: 'Cerrar la ficha del lugar' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory'))
    expect(screen.queryByRole('complementary', { name: 'Ficha del lugar' })).not.toBeInTheDocument()
  })

  it('"Nueva comunidad" solo con CREATE sobre community', async () => {
    fetch = abrirPortal('/territory', RELACIONISTA, LEE_TERRITORIO, [...base, { path: /^\/sgspe\/territory\/layers\//, body: coleccion([]) }])
    await screen.findByRole('navigation', { name: 'Lugares visibles' })
    expect(screen.queryByRole('button', { name: 'Nueva comunidad' })).not.toBeInTheDocument()
  })

  it('«Importar» solo con CREATE y UPDATE sobre algún destino, como la guarda de la importación (revisión final, M8)', async () => {
    const capas = { path: /^\/sgspe\/territory\/layers\//, body: coleccion([]) }
    fetch = abrirPortal('/territory', RELACIONISTA, permisos({ ...LEE_TERRITORIO.objects, land_parcel: ['READ', 'CREATE'] }), [...base, capas])
    // «Importar» va en «Más acciones» (DD-11)
    await screen.findByRole('navigation', { name: 'Lugares visibles' })
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    expect(screen.queryByRole('link', { name: 'Importar' })).not.toBeInTheDocument()
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/territory', RELACIONISTA, permisos({ ...LEE_TERRITORIO.objects, land_parcel: ['READ', 'CREATE', 'UPDATE'] }), [...base, capas])
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    expect(await screen.findByRole('link', { name: 'Importar' })).toHaveAttribute('href', '/territory/imports/new')
  })

  it('mientras las capas cargan la lista dice "Cargando", no que no hay lugares', async () => {
    fetch = abrirPortal('/territory', RELACIONISTA, LEE_TERRITORIO, [...base, { path: '/sgspe/territory/layers/LYR-05', body: coleccion([]) }])
    red = espiarRed([nunca('/sgspe/territory/layers/LYR-02')])
    const lugares = await screen.findByRole('navigation', { name: 'Lugares visibles' })
    expect(await within(lugares).findByText('Cargando…')).toBeInTheDocument()
    expect(within(lugares).queryByText(/Acerque el mapa/)).not.toBeInTheDocument()
  })

  it('si una capa falla la lista lo dice y no afirma que no hay lugares', async () => {
    fetch = abrirPortal('/territory', RELACIONISTA, LEE_TERRITORIO, [
      ...base,
      falla('/sgspe/territory/layers/LYR-02'),
      { path: '/sgspe/territory/layers/LYR-05', body: coleccion([['c1', 'community', 'CC Tunas Pampa']]) }
    ])
    const lugares = await screen.findByRole('navigation', { name: 'Lugares visibles' })
    expect(await within(lugares).findByRole('alert')).toHaveTextContent('No se pudo leer la capa')
    expect(within(lugares).getByRole('link', { name: 'CC Tunas Pampa' })).toBeInTheDocument()
    expect(within(lugares).queryByText(/Acerque el mapa/)).not.toBeInTheDocument()
  })

  it('con todas las capas leídas y vacías dice que no hay lugares en la vista', async () => {
    fetch = abrirPortal('/territory', RELACIONISTA, LEE_TERRITORIO, [...base, { path: /^\/sgspe\/territory\/layers\//, body: coleccion([]) }])
    const lugares = await screen.findByRole('navigation', { name: 'Lugares visibles' })
    expect(await within(lugares).findByText(/Acerque el mapa a una zona/)).toBeInTheDocument()
    expect(await screen.findByText(/No hay elementos de las capas encendidas en esta vista/)).toBeInTheDocument()
  })

  it('con una capa bloqueada y las demás vacías dice que la lista no la incluye, no que no hay lugares', async () => {
    fetch = abrirPortal('/territory', RELACIONISTA, LEE_TERRITORIO, [
      ...base,
      falla('/sgspe/territory/layers/LYR-02', 403),
      { path: '/sgspe/territory/layers/LYR-05', body: coleccion([]) }
    ])
    const lugares = await screen.findByRole('navigation', { name: 'Lugares visibles' })
    expect(await within(lugares).findByText('Hay capas que su cuenta no puede ver: la lista no las incluye.')).toBeInTheDocument()
    expect(within(lugares).queryByText(/Acerque el mapa/)).not.toBeInTheDocument()
  })

  it('un lugar en dos capas sale una vez, uno sin nombre dice "Lugar sin nombre" y un miembro de un área abre la ficha de su lugar', async () => {
    fetch = abrirPortal('/territory', RELACIONISTA, LEE_TERRITORIO, [
      ...base,
      {
        path: '/sgspe/territory/layers/LYR-02',
        body: {
          type: 'FeatureCollection',
          features: [
            ...coleccion([['l1', 'locality', 'Tunas']]).features,
            ...coleccion([['l2', 'locality', '']]).features,
            {
              type: 'Feature',
              id: 'm1:g',
              geometry: { type: 'Point', coordinates: [-78, -8] },
              properties: { __id: 'm1', __object: 'area_of_influence_member', __target: 'locality', __targetId: 'l3', name: 'Quinuas' }
            }
          ]
        }
      },
      { path: '/sgspe/territory/layers/LYR-05', body: coleccion([['l1', 'locality', 'Tunas']]) }
    ])
    const lugares = await screen.findByRole('navigation', { name: 'Lugares visibles' })
    expect(await within(lugares).findAllByRole('link', { name: 'Tunas' })).toHaveLength(1)
    expect(within(lugares).getByRole('link', { name: 'Lugar sin nombre' })).toHaveAttribute('href', '/territory/localities/l2')
    expect(within(lugares).getByRole('link', { name: 'Quinuas' })).toHaveAttribute('href', '/territory/localities/l3')
    await userEvent.click(within(screen.getByRole('list', { name: 'Mapa territorial' })).getByRole('button', { name: 'Quinuas' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory?selected=locality%3Al3'))
  })
})

describe('Trabajar en el proyecto con este lugar', () => {
  const ficha = [
    ...base,
    { path: '/objects/community/records/c1', body: registro('c1', { name: 'CC Tunas Pampa' }) },
    { path: /^\/objects\/(organization|community_sector|area_of_influence_member|position|stakeholder)\/records$/, body: pagina([]) }
  ]

  it('sin ?project= se elige entre los proyectos de la persona y se abre la lista con el chip de territorio', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, ficha)
    const selector = await screen.findByRole('combobox', { name: 'Trabajar en el proyecto con este lugar' })
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'PRJ-01 · Pukaqaqa' })).toBeInTheDocument())
    await userEvent.selectOptions(selector, 'p1')
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/stakeholders?territory=community%3Ac1'))
  })

  it('sin READ sobre los grupos de interés no se ofrece', async () => {
    fetch = abrirPortal('/territory/communities/c1?project=p1', RELACIONISTA, permisos({ ...LEE_TERRITORIO.objects, stakeholder: [] }), ficha)
    await screen.findByRole('heading', { name: 'CC Tunas Pampa' })
    expect(screen.queryByRole('link', { name: 'Trabajar en el proyecto con este lugar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Trabajar en el proyecto con este lugar' })).not.toBeInTheDocument()
  })

  it('si los proyectos no cargan lo dice', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, [
      falla('/objects/project/records'),
      ...sin(ficha, '/objects/project/records')
    ])
    // el encabezado común (revisión de UX, etapa 5) ya no es un <header>: el aviso va junto a sus acciones
    const cabecera = (await screen.findByRole('heading', { name: 'CC Tunas Pampa', level: 1 })).parentElement!.parentElement!
    expect(await within(cabecera).findByText('No se pudo cargar esta información. Los filtros se conservan.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Trabajar en el proyecto con este lugar' })).not.toBeInTheDocument()
  })
})

describe('S13 · ficha de comunidad', () => {
  const rutas = [
    ...base,
    {
      path: '/objects/community/records/c1',
      body: registro('c1', {
        name: 'CC Tunas Pampa',
        community_type: 'COMUNIDAD CAMPESINA',
        registry_records_unverified: true,
        registered_area_ha: 1200,
        calculated_area_ha: 1187.4
      })
    },
    { path: '/objects/organization/records', body: pagina([registro('o1', { name: 'Junta directiva comunal' })]) },
    { path: '/objects/position/records', body: pagina([registro('po1', { position_title: 'Presidente', position_status: 'VACANTE' })]) },
    { path: '/objects/community_sector/records', body: pagina([registro('cs1', { name: 'Sector alto', delegates_count: 3 })]) },
    { path: '/objects/stakeholder/records', body: pagina([registro('s1', { organization: 'o1', project: 'p1', influence_group: 'ESTRATEGICO' })]) },
    { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Junta directiva comunal' }) },
    {
      path: '/objects/area_of_influence_member/records',
      body: pagina([
        registro('m1', { area_of_influence: 'a1', member_condition: 'INCLUIDO' }),
        registro('m2', { area_of_influence: 'a9', member_condition: 'INCLUIDO' })
      ])
    },
    { path: '/objects/area_of_influence/records/a1', body: registro('a1', { project: 'p1', area_type: 'AIDS', version_number: 2 }) },
    { path: '/objects/area_of_influence/records/a9', status: 404, body: { title: 'Not Found' } }
  ]

  it('marca las partidas por verificar y muestra el área inscrita junto a la calculada', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, rutas)
    expect(await screen.findByText('PARTIDAS POR VERIFICAR')).toBeInTheDocument()
    expect(screen.getByText('1,200 ha')).toBeInTheDocument()
    expect(screen.getByText('1,187.4 ha')).toBeInTheDocument()
  })

  it('muestra la organización que la representa con sus cargos, sus sectores, sus grupos y solo las áreas legibles', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, rutas)
    expect(await screen.findByRole('link', { name: 'Junta directiva comunal' })).toHaveAttribute('href', '/actors/o1')
    expect(await screen.findByText('Presidente · Vacante')).toBeInTheDocument()
    expect(screen.getByText('Sector alto · 3 delegados')).toBeInTheDocument()
    const areas = screen.getByRole('complementary', { name: 'Áreas de influencia que la incluyen' })
    expect(await within(areas).findByRole('link', { name: 'AIDS · v2' })).toBeInTheDocument()
    expect(within(areas).getAllByRole('listitem')).toHaveLength(1)
    const grupos = screen.getByRole('region', { name: 'Grupos de interés del lugar' })
    expect(await within(grupos).findByRole('link', { name: 'Junta directiva comunal' })).toHaveAttribute('href', '/projects/p1/stakeholders/s1')
  })

  it('"Trabajar en el proyecto con este lugar" fija el chip de territorio', async () => {
    fetch = abrirPortal('/territory/communities/c1?project=p1', RELACIONISTA, LEE_TERRITORIO, rutas)
    expect(await screen.findByRole('link', { name: 'Trabajar en el proyecto con este lugar' })).toHaveAttribute(
      'href',
      '/projects/p1/stakeholders?territory=community%3Ac1'
    )
  })

  it('los sectores, los cargos y los grupos dicen "Cargando" y, si fallan, el error: nunca una lista vacía', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, rutas)
    red = espiarRed([nunca('/objects/community_sector/records'), nunca('/objects/position/records'), nunca('/objects/stakeholder/records')])
    const sectores = await screen.findByRole('region', { name: 'Sectores comunales' })
    expect(await within(sectores).findByText('Cargando…')).toBeInTheDocument()
    expect(within(sectores).queryByText('Aún no hay registros')).not.toBeInTheDocument()
    const grupos = screen.getByRole('region', { name: 'Grupos de interés del lugar' })
    expect(within(grupos).getByText('Cargando…')).toBeInTheDocument()
    expect(within(grupos).queryByText(/Ningún grupo/)).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Junta directiva comunal' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Cargos')).not.toBeInTheDocument()
  })

  it('si fallan los sectores, los grupos o las áreas, cada sección dice el error y no que está vacía', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, [
      falla('/objects/community_sector/records'),
      falla('/objects/stakeholder/records'),
      falla('/objects/area_of_influence_member/records'),
      ...sin(rutas, '/objects/community_sector/records', '/objects/stakeholder/records', '/objects/area_of_influence_member/records')
    ])
    for (const nombre of ['Sectores comunales', 'Grupos de interés del lugar']) {
      const seccion = await screen.findByRole('region', { name: nombre })
      expect(await within(seccion).findByText('No se pudo cargar esta información. Los filtros se conservan.')).toBeInTheDocument()
      expect(within(seccion).queryByText('Aún no hay registros')).not.toBeInTheDocument()
      expect(within(seccion).queryByText(/Ningún grupo/)).not.toBeInTheDocument()
    }
    const areas = screen.getByRole('complementary', { name: 'Áreas de influencia que la incluyen' })
    expect(await within(areas).findByText('No se pudo cargar esta información. Los filtros se conservan.')).toBeInTheDocument()
    expect(within(areas).queryByText(/Ningún área/)).not.toBeInTheDocument()
  })

  it('si no se pueden leer las organizaciones, los grupos del lugar dicen el error y no "Cargando" para siempre', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, [
      falla('/objects/organization/records', 403),
      ...sin(rutas, '/objects/organization/records')
    ])
    const grupos = await screen.findByRole('region', { name: 'Grupos de interés del lugar' })
    expect(await within(grupos).findByRole('alert')).toBeInTheDocument()
    expect(within(grupos).queryByText('Cargando…')).not.toBeInTheDocument()
    expect(within(grupos).queryByText(/Ningún grupo/)).not.toBeInTheDocument()
  })

  it('"Ningún área legible la incluye" solo cuando las áreas llegaron y ninguna se puede leer; "Ninguna organización" si no hay representante', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, [
      { path: '/objects/area_of_influence_member/records', body: pagina([registro('m2', { area_of_influence: 'a9', member_condition: 'INCLUIDO' })]) },
      { path: '/objects/organization/records', body: pagina([]) },
      ...sin(rutas, '/objects/area_of_influence_member/records', '/objects/organization/records')
    ])
    const areas = await screen.findByRole('complementary', { name: 'Áreas de influencia que la incluyen' })
    expect(await within(areas).findByText('Ningún área legible la incluye')).toBeInTheDocument()
    expect(await screen.findByText('Ninguna organización la representa todavía.')).toBeInTheDocument()
    expect(await screen.findByText('Ningún grupo de interés está vinculado a este lugar.')).toBeInTheDocument()
  })
})

describe('Editar y agregar', () => {
  const sinLista = { path: /^\/objects\/(organization|community_sector|area_of_influence_member|position|stakeholder)\/records$/, body: pagina([]) }
  const comunidad = (campos: Parameters<typeof definicion>[1]) => [
    ...base,
    { path: '/objects/community/records/c1', body: registro('c1', { name: 'CC Tunas Pampa' }) },
    { path: '/metadata/objects/community', body: definicion('community', campos) },
    sinLista
  ]
  const localidad = (campos: Parameters<typeof definicion>[1]) => [
    ...base,
    { path: '/objects/locality/records/l1', body: registro('l1', { name: 'Tunas' }) },
    { path: '/metadata/objects/locality', body: definicion('locality', campos) },
    { path: '/metadata/objects/locality_profile', body: definicion('locality_profile', ['population_count']) },
    { path: /^\/objects\/(locality_profile|school|health_facility|road_access|festivity)\/records$/, body: pagina([]) },
    { path: /\/related\//, body: pagina([]) }
  ]

  // la pestaña «Registros del lugar» de S13 y S14 son los registros de su zona (F6)
  it('la pestaña «Registros del lugar» de la comunidad y de la localidad lista los registros de su zona', async () => {
    const cuenta = permisos({ ...LEE_TERRITORIO.objects, commitment: ['READ'] })
    const registros = (zona: string, id: string) => ({
      path: `/sgspe/territory/zones/${zona}/${id}/records`,
      body: { ...pagina([registro('cm1', { project: 'p1', code: 'C-001', title: 'Reservorio' })]), available: true }
    })
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, cuenta, [...comunidad(['name']), registros('community', 'c1')])
    await userEvent.click(await screen.findByRole('tab', { name: 'Registros del lugar' }))
    expect(await screen.findByRole('link', { name: 'C-001 · Reservorio' })).toHaveAttribute('href', '/projects/p1/commitments/cm1')
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, cuenta, [...localidad(['name']), registros('locality', 'l1')])
    await userEvent.click(await screen.findByRole('tab', { name: 'Registros del lugar' }))
    expect(await screen.findByRole('link', { name: 'C-001 · Reservorio' })).toHaveAttribute('href', '/projects/p1/commitments/cm1')
  })

  it('la comunidad ofrece "Editar" con UPDATE y un campo escribible, y abre su formulario', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, comunidad(['name']))
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    expect(await screen.findByRole('dialog', { name: 'Editar' })).toBeInTheDocument()
  })

  // la definición llega después de la ficha: antes de afirmar que «Editar» no se ofrece, una sonda que lee la misma consulta
  // (misma clave, misma caché) dice que llegó; las dos se notifican en el mismo lote, así que la ficha ya la vio. sin esperas
  // fijas, que dependen de la carga de la máquina (revisión final, M13)
  function Sonda({ objeto }: { objeto: string }) {
    return useDefinicion(objeto).isSuccess ? <span>definición llegó</span> : null
  }
  const abrirFicha = async (Ficha: ComponentType, ruta: string, objeto: string, cuenta: CallerPermissions, rutas: MockRoute[]) => {
    fetch = mockFetch(rutas)
    montar(
      <>
        <Ficha />
        <Sonda objeto={objeto} />
      </>,
      { ruta, camino: ruta.replace(/[^/]+$/, ':id'), usuario: RELACIONISTA, permisos: cuenta }
    )
    await screen.findByText('definición llegó')
  }

  it('un rol con "u" (UPDATE sin ningún campo escribible) no recibe "Editar" en la comunidad', async () => {
    await abrirFicha(FichaComunidadPage, '/territory/communities/c1', 'community', LEE_TERRITORIO, comunidad([['name', { editable: false }]]))
    expect(screen.getByRole('heading', { name: 'CC Tunas Pampa' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('sin UPDATE no se ofrece "Editar" en la comunidad', async () => {
    await abrirFicha(
      FichaComunidadPage,
      '/territory/communities/c1',
      'community',
      permisos({ ...LEE_TERRITORIO.objects, community: ['READ'] }),
      comunidad(['name'])
    )
    expect(screen.getByRole('heading', { name: 'CC Tunas Pampa' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('el control de la sonda: con UPDATE y un campo escribible, «Editar» ya está cuando la sonda dice que llegó', async () => {
    await abrirFicha(FichaComunidadPage, '/territory/communities/c1', 'community', LEE_TERRITORIO, comunidad(['name']))
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })

  it('"Agregar sector" abre el formulario del sector', async () => {
    fetch = abrirPortal('/territory/communities/c1', RELACIONISTA, LEE_TERRITORIO, comunidad(['name']))
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar sector' }))
    expect(await screen.findByRole('dialog', { name: 'Agregar sector' })).toBeInTheDocument()
  })

  it('la localidad ofrece "Editar" con UPDATE y un campo escribible', async () => {
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, permisos({ ...LEE_TERRITORIO.objects, locality: ['READ', 'UPDATE'] }), localidad(['name']))
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    expect(await screen.findByRole('dialog', { name: 'Editar' })).toBeInTheDocument()
  })

  it('un rol con "u" no recibe "Editar" en la localidad', async () => {
    await abrirFicha(
      FichaLocalidadPage,
      '/territory/localities/l1',
      'locality',
      permisos({ ...LEE_TERRITORIO.objects, locality: ['READ', 'UPDATE'] }),
      localidad([['name', { editable: false }]])
    )
    expect(screen.getByRole('heading', { name: 'Tunas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('"Nuevo perfil" abre el formulario del perfil', async () => {
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, localidad(['name']))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo perfil' }))
    expect(await screen.findByRole('dialog', { name: 'Nuevo perfil' })).toBeInTheDocument()
  })
})

describe('S14 · ficha de localidad y línea base', () => {
  const perfil = (id: string, fecha: string, valores: Record<string, unknown>) =>
    registro(id, { data_date: fecha, data_source: 'Censo comunal', reliability: 'REFERENCIAL', ...valores })
  const rutas = (definicionPerfil: unknown) => [
    ...base,
    { path: '/objects/locality/records/l1', body: registro('l1', { name: 'Tunas', locality_type: 'CASERIO' }) },
    {
      path: '/objects/locality_profile/records',
      body: pagina([
        perfil('lp2', '2026-05-10', { population_count: 340, families_count: 80, religion: 'Católica' }),
        perfil('lp1', '2024-03-01', { population_count: 310 })
      ])
    },
    { path: '/metadata/objects/locality_profile', body: definicionPerfil },
    { path: '/objects/school/records', body: pagina([registro('sc', { name: 'IE 80123', education_level: 'PRIMARIA' })]) },
    { path: '/objects/health_facility/records', body: pagina([]) },
    { path: '/objects/road_access/records', body: pagina([]) },
    { path: '/objects/festivity/records', body: pagina([registro('f1', { name: 'Fiesta patronal', month: 8, date_text: '15 de agosto' })]) },
    { path: '/objects/locality/records/l1/related/state_program_locality', body: pagina([registro('sp', { name: 'Pensión 65' })]) },
    { path: '/objects/locality/records/l1/related/local_conflict_locality', body: pagina([]) }
  ]

  it('compara el perfil con el anterior y una cifra ausente antes dice "no disponible en <fecha>"', async () => {
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, rutas(definicion('locality_profile', ['population_count', 'families_count'])))
    const poblacion = await screen.findByRole('listitem', { name: 'Población' })
    expect(within(poblacion).getByText('340')).toBeInTheDocument()
    expect(within(poblacion).getByText('+30 frente al 2024-03-01')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Familias' })).getByText('no disponible en 2024-03-01')).toBeInTheDocument()
  })

  it('religión y proceso electoral salen restringidos para quien no los lee', async () => {
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, rutas(definicion('locality_profile', ['population_count'])))
    expect(await screen.findByText('Religión y proceso electoral son datos sensibles: su rol no los lee.')).toBeInTheDocument()
    expect(screen.getAllByText('Restringido')).toHaveLength(2)
    expect(screen.getByText('Religión')).toBeInTheDocument()
    expect(screen.getByText('Proceso electoral')).toBeInTheDocument()
    expect(screen.queryByText('religion')).not.toBeInTheDocument()
    expect(screen.queryByText('electoral_process')).not.toBeInTheDocument()
    expect(screen.queryByText('Católica')).not.toBeInTheDocument()
  })

  it('con acceso, la gerencia social los lee; y la localidad muestra servicios y festividades', async () => {
    fetch = abrirPortal(
      '/territory/localities/l1',
      GERENCIA_SOCIAL,
      LEE_TERRITORIO,
      rutas(definicion('locality_profile', ['population_count', ['religion', { label: 'Religión' }], ['electoral_process', { label: 'Proceso electoral' }]]))
    )
    expect(await screen.findByText('Católica')).toBeInTheDocument()
    expect(screen.getByText('IE 80123 · PRIMARIA')).toBeInTheDocument()
    expect(await screen.findByText(/Fiesta patronal/)).toBeInTheDocument()
    expect(await screen.findByText('Pensión 65')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo perfil' })).toBeInTheDocument()
  })

  it('el perfil dice "Cargando" y, si falla, el error: "Esta localidad aún no tiene perfil" solo con la lista vacía', async () => {
    const def = definicion('locality_profile', ['population_count'])
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, rutas(def))
    red = espiarRed([nunca('/objects/locality_profile/records')])
    expect(await screen.findByRole('heading', { name: 'Tunas' })).toBeInTheDocument()
    expect(await screen.findByText('Cargando…')).toBeInTheDocument()
    expect(screen.queryByText('Esta localidad aún no tiene perfil de línea base.')).not.toBeInTheDocument()
  })

  it('si el perfil falla, dice el error y no que aún no hay perfil', async () => {
    const def = definicion('locality_profile', ['population_count'])
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, [
      falla('/objects/locality_profile/records'),
      ...sin(rutas(def), '/objects/locality_profile/records')
    ])
    expect(await screen.findByText('No se pudo cargar esta información. Los filtros se conservan.')).toBeInTheDocument()
    expect(screen.queryByText('Esta localidad aún no tiene perfil de línea base.')).not.toBeInTheDocument()
  })

  it('"Esta localidad aún no tiene perfil" solo con la lista llegada y vacía', async () => {
    const def = definicion('locality_profile', ['population_count'])
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, [
      { path: '/objects/locality_profile/records', body: pagina([]) },
      ...sin(rutas(def), '/objects/locality_profile/records')
    ])
    expect(await screen.findByText('Esta localidad aún no tiene perfil de línea base.')).toBeInTheDocument()
  })

  it('mientras llega la definición religión y proceso electoral no dicen "Restringido" ni su nombre técnico', async () => {
    const def = definicion('locality_profile', ['population_count'])
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, rutas(def))
    red = espiarRed([nunca('/metadata/objects/locality_profile')])
    expect(await screen.findByRole('listitem', { name: 'Población' })).toBeInTheDocument()
    expect(screen.queryByText('Restringido')).not.toBeInTheDocument()
    expect(screen.queryByText('Religión y proceso electoral son datos sensibles: su rol no los lee.')).not.toBeInTheDocument()
    // sin la definición tampoco se muestra el nombre técnico del campo: la etiqueta es la del portal
    expect(screen.getByText('Religión')).toBeInTheDocument()
    expect(screen.getByText('Proceso electoral')).toBeInTheDocument()
    expect(screen.queryByText('religion')).not.toBeInTheDocument()
  })

  it('si la definición no llega, religión y proceso electoral dicen "No disponible" con su etiqueta', async () => {
    const def = definicion('locality_profile', ['population_count'])
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, [
      falla('/metadata/objects/locality_profile'),
      ...sin(rutas(def), '/metadata/objects/locality_profile')
    ])
    expect(await screen.findByRole('listitem', { name: 'Población' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('No disponible')).toHaveLength(2))
    expect(screen.getByText('Religión')).toBeInTheDocument()
    expect(screen.getByText('Proceso electoral')).toBeInTheDocument()
    expect(screen.queryByText('Restringido')).not.toBeInTheDocument()
  })

  it('cada lista de servicios dice su carga, su error o que no se puede leer, y "Aún no hay registros" solo si llegó vacía', async () => {
    const def = definicion('locality_profile', ['population_count'])
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, [
      falla('/objects/school/records', 403),
      falla('/objects/health_facility/records'),
      falla('/objects/festivity/records'),
      ...sin(rutas(def), '/objects/school/records', '/objects/health_facility/records', '/objects/festivity/records')
    ])
    const escuelas = await screen.findByRole('region', { name: 'Instituciones educativas' })
    // un 403 es «No disponible», como en FalloDeLectura (revisión final, M2)
    expect(await within(escuelas).findByText('No disponible')).toBeInTheDocument()
    expect(within(escuelas).queryByText('Aún no hay registros')).not.toBeInTheDocument()
    for (const nombre of ['Establecimientos de salud', 'Calendario de festividades']) {
      const seccion = screen.getByRole('region', { name: nombre })
      expect(await within(seccion).findByText('No se pudo cargar esta información. Los filtros se conservan.')).toBeInTheDocument()
      expect(within(seccion).queryByText('Aún no hay registros')).not.toBeInTheDocument()
    }
    expect(await within(screen.getByRole('region', { name: 'Vías de acceso' })).findByText('Aún no hay registros')).toBeInTheDocument()
  })

  it('el distrito y la localidad de la que es sector dicen "…" y luego su nombre, o por qué no se leen; sin ellos, un guion', async () => {
    const def = definicion('locality_profile', ['population_count'])
    fetch = abrirPortal('/territory/localities/l1', RELACIONISTA, LEE_TERRITORIO, [
      { path: '/objects/locality/records/l1', body: registro('l1', { name: 'Tunas', administrative_unit: 'd1', parent_locality: 'l0' }) },
      { path: '/objects/administrative_unit/records/d1', body: registro('d1', { name: 'Distrito de Prueba' }) },
      falla('/objects/locality/records/l0', 403),
      ...sin(rutas(def), '/objects/locality/records/l1')
    ])
    expect(await screen.findByText('Distrito de Prueba')).toBeInTheDocument()
    const padre = screen.getByText('Caserío del que es sector').nextElementSibling as HTMLElement
    expect(await within(padre).findByText('Restringido')).toBeInTheDocument()
  })
})
