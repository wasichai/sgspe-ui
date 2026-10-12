import { expect, test, type Page, type Request } from '@playwright/test'
import { prepararApi, registro } from './api'

// los recorridos de F6 en un navegador de verdad: el WMS por el proxy con el token (transformRequest) y su vuelta al GeoJSON ante
// un 503, la ficha contextual de un lugar y la exportación de una capa. la API se simula como en f5.spec.ts; estas rutas se
// registran después y ganan a las comunes. las formas son las de src/test/sig.ts (no se importa: arrastra vitest)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const CAPACIDADES = `<?xml version="1.0" encoding="UTF-8"?><WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms"><Service><Name>WMS</Name><Title>SGSPE</Title></Service><Capability><Layer><Title>SGSPE</Title>
<Layer queryable="0"><Name>t_locality__location</Name><Style><Name>sgspe-lyr-02-location</Name></Style><Style><Name>sgspe-lyr-03</Name></Style></Layer>
<Layer queryable="0"><Name>t_community__territory</Name><Style><Name>sgspe-lyr-05</Name></Style></Layer>
</Layer></Capability></WMS_Capabilities>`

const PUNTO = { type: 'Point', coordinates: [-78.4, -8.1] }
const LOCALIDAD = registro('l1', { name: 'Tunas', locality_type: 'CASERIO', administrative_unit: 'au1' })
const FICHA_LOCALIDAD = {
  locality: LOCALIDAD,
  geometry: { location: PUNTO, boundary: null },
  administrativeUnit: { id: 'au1', name: 'Distrito Ejemplo', level: 'DISTRITO' },
  communities: [],
  areasOfInfluence: [],
  unavailable: []
}
// KPI-TER-01 (TerritorySummary): sus cifras van en breakdowns[by=components]; quien no lee la postura pierde solo KPI-STK-02
const KPI_TER_01 = {
  code: 'KPI-TER-01',
  label: 'Resumen de una localidad o comunidad',
  available: true,
  value: null,
  unit: 'cifras',
  breakdowns: [
    {
      by: 'components',
      rows: [
        {
          key: 'KPI-STK-02',
          code: 'KPI-STK-02',
          label: 'Distribución de posturas',
          available: false,
          unavailableReason: 'FIELD_NOT_READABLE',
          missingFields: ['stakeholder.stance']
        },
        { key: 'KPI-COM-03', code: 'KPI-COM-03', label: 'Compromisos vencidos', available: true, value: 2, unit: 'compromisos' },
        { key: 'lastActivity', available: true, value: '2026-10-03' }
      ]
    }
  ]
}
const FORMATOS = {
  formats: ['geojson', 'kml', 'gpkg', 'shp', 'csv', 'xlsx'].map((format) => ({ format, available: true, multiLayer: false, crsFromFile: false }))
}
const PERMISOS = Object.fromEntries([
  ['project', ['READ']],
  ['project_assignment', ['READ']],
  ['locality', ['READ', 'EXPORT']],
  ['community', ['READ', 'EXPORT']],
  ['organization', ['READ']],
  ['stakeholder', ['READ']],
  ['area_of_influence', ['READ']],
  ['area_of_influence_member', ['READ']],
  ['community_sector', ['READ']],
  ['administrative_unit', ['READ']],
  ['export_log', ['CREATE']]
] as [string, string[]][])

type Wms = 'ok' | 'teselas503' | 'capacidades503'

async function prepararF6(page: Page, { wms = 'ok' }: { wms?: Wms } = {}) {
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const caido = json({ title: 'Service Unavailable', status: 503, errors: [{ field: 'request', message: 'GEOSERVER_UNAVAILABLE' }] }, 503)
  const pedidos: Request[] = []
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const url = new URL(peticion.url())
    const ruta = url.pathname.replace(/^\/api/, '')
    if (ruta === '/sgspe/map/settings') return route.fulfill(json({ basemap: { type: 'none' } }))
    if (ruta === '/auth/me/permissions') return route.fulfill(json({ admin: false, objects: PERMISOS }))
    if (ruta === '/sgspe/territory/wms') {
      pedidos.push(peticion)
      if (url.searchParams.get('request') === 'GetCapabilities')
        return wms === 'capacidades503' ? route.fulfill(caido) : route.fulfill({ status: 200, contentType: 'application/vnd.ogc.wms_xml', body: CAPACIDADES })
      return wms === 'ok' ? route.fulfill({ status: 200, contentType: 'image/png', body: PNG }) : route.fulfill(caido)
    }
    // la sonda de las capas de gestión (LYR-19, bbox=0,0,0,0): sin el plan 6.2c el backend responde 404 y el grupo no se ofrece
    if (ruta === '/sgspe/territory/layers/LYR-19')
      return route.fulfill(json({ title: 'Not Found', status: 404, errors: [{ field: 'layer', message: 'LAYER_NOT_FOUND' }] }, 404))
    if (ruta === '/sgspe/territory/localities/l1/card') return route.fulfill(json(FICHA_LOCALIDAD))
    if (ruta === '/sgspe/dashboards/indicators/KPI-TER-01') return route.fulfill(json(KPI_TER_01))
    if (/^\/sgspe\/territory\/zones\/[a-z_]+\/[^/]+\/records$/.test(ruta))
      return route.fulfill(json({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0, available: true }))
    if (ruta === '/sgspe/territory/imports/formats') return route.fulfill(json(FORMATOS))
    if (ruta === '/sgspe/territory/exports' && peticion.method() === 'POST') {
      pedidos.push(peticion)
      return route.fulfill({
        status: 200,
        contentType: 'application/geopackage+sqlite3',
        headers: { 'Content-Disposition': 'attachment; filename="community-externo.gpkg"' },
        body: 'GPKG'
      })
    }
    return route.fallback()
  })
  return { pedidos }
}

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('las teselas WMS van por el proxy del mismo origen con el token, y nada sale a otro host', async ({ page, baseURL }) => {
  const { pedidos } = await prepararF6(page)
  const externas: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!)) externas.push(r.url())
  })
  await page.goto('/territory?project=p1')
  const tesela = (capa: string) => pedidos.find((p) => p.url().includes('request=GetMap') && p.url().includes(`layers=${capa}`))
  await expect.poll(() => Boolean(tesela('t_locality__location') && tesela('t_community__territory'))).toBe(true)
  const localidades = tesela('t_locality__location')!
  expect(await localidades.headerValue('authorization')).toBe('Bearer t-e2e')
  expect(localidades.url()).toContain('styles=sgspe-lyr-02-location')
  expect(localidades.url()).toContain('version=1.1.1')
  expect(localidades.url()).toMatch(/bbox=/i)
  expect(await tesela('t_community__territory')!.headerValue('authorization')).toBe('Bearer t-e2e')
  await expect(page.getByRole('region', { name: 'Mapa territorial' })).toHaveAttribute('data-reposo', 'si')
  await expect(page.getByText(/El servicio de mapas de referencia no responde/)).toHaveCount(0)
  expect(externas).toEqual([])
})

for (const wms of ['teselas503', 'capacidades503'] as const) {
  test(`si GeoServer no responde (${wms}), el mapa avisa y las capas siguen por la API`, async ({ page }) => {
    await prepararF6(page, { wms })
    await page.goto('/territory?project=p1')
    await expect(page.getByText(/El servicio de mapas de referencia no responde/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Lugares visibles' }).getByRole('link', { name: 'Tunas', exact: true })).toBeVisible()
  })
}

test('la ficha contextual de un lugar dice sus cifras y «No disponible» donde falta un permiso', async ({ page }) => {
  await prepararF6(page)
  await page.goto('/territory?project=p1')
  await page.getByRole('button', { name: 'Ver resumen de Tunas' }).click()
  const ficha = page.getByRole('complementary', { name: 'Ficha del lugar' })
  await expect(ficha.getByRole('heading', { name: 'Tunas' })).toBeVisible()
  await expect(ficha.getByText('Distrito Ejemplo')).toBeVisible()
  await expect(ficha.getByRole('region', { name: 'Compromisos vencidos' })).toContainText('2')
  await expect(ficha.getByRole('region', { name: 'Grupos de interés por postura' })).toContainText('No disponible')
  await expect(ficha.getByRole('link', { name: 'Abrir la ficha' })).toHaveAttribute('href', '/territory/localities/l1?project=p1')
  await expect(page).toHaveURL(/selected=locality%3Al1/)
  await ficha.getByRole('button', { name: 'Cerrar la ficha del lugar' }).click()
  await expect(ficha).toHaveCount(0)
  await expect(page).not.toHaveURL(/selected=/)
})

test('exportar una capa en EXTERNO pide la lista de verificación y descarga el archivo', async ({ page }) => {
  const { pedidos } = await prepararF6(page)
  await page.goto('/territory?project=p1')
  await page.getByRole('button', { name: 'Exportar' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Exportar una capa' })
  // la cuenta exporta localidades y comunidades; LYR-03 no se ofrece sola (H4): las ciudades salen con las localidades
  await expect(dialogo.getByLabel('Capa').locator('option')).toHaveText(['Centros poblados, localidades y ciudades', 'Territorio comunal'])
  await dialogo.getByLabel('Capa').selectOption('LYR-05')
  await dialogo.getByLabel('Formato').selectOption('gpkg')
  await dialogo.getByRole('radio', { name: 'UTM del proyecto' }).check()
  await dialogo.getByLabel('Nivel de divulgación').selectOption('EXTERNO')
  await dialogo.getByRole('button', { name: 'Exportar' }).click()
  await expect(dialogo.getByText('Confirme la lista de verificación para una salida fuera de la organización')).toBeVisible()
  expect(pedidos.filter((p) => p.method() === 'POST')).toHaveLength(0)
  await dialogo.getByRole('checkbox', { name: /Revisé que el archivo puede salir/ }).check()
  const descarga = page.waitForEvent('download')
  await dialogo.getByRole('button', { name: 'Exportar' }).click()
  expect((await descarga).suggestedFilename()).toBe('community-externo.gpkg')
  const pedido = pedidos.find((p) => p.method() === 'POST')!
  expect(pedido.postDataJSON()).toEqual({
    object: 'community',
    geometry: 'territory',
    format: 'gpkg',
    coordinates: 'UTM',
    filters: { project: ['p1'] },
    disclosureLevel: 'EXTERNO',
    checklistConfirmed: true
  })
  // una exportación geográfica no crea registros de negocio: no manda Idempotency-Key (enmienda 12.3)
  expect(await pedido.headerValue('idempotency-key')).toBeNull()
})
