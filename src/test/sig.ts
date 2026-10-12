import type { AuthUser } from '@wasichai/core'
import type { MockRoute } from '@wasichai/testing'
import { pagina, registro } from './montar'
import { permisos } from './portal'

// los datos de las pruebas de F6 (SIG avanzado): el análisis SIG (GIS_ANALYST) y la gerencia social (SOCIAL_MANAGER), un
// proyecto en UTM 17S, una localidad y una comunidad con geometrías sintéticas alrededor de -78.50, -7.90 (RQ-GIS-021) y las
// respuestas de los endpoints de F6 con la forma que dejaron 6.2a y 6.2b en sgspe (api.md §4, enmiendas del plan 6.3). aquí sí
// se nombran roles: son datos de prueba (boundaries.test.ts deja fuera src/test). todo es ficticio
export const ANALISTA_SIG: AuthUser = {
  id: 'u-gan',
  email: 'gan@sgspe.test',
  displayName: 'Análisis SIG de prueba',
  organizationId: 'o1',
  roles: ['GIS_ANALYST']
}
export const GERENCIA_SIG: AuthUser = {
  id: 'u-smg',
  email: 'smg@sgspe.test',
  displayName: 'Gerencia social de prueba',
  organizationId: 'o1',
  roles: ['SOCIAL_MANAGER']
}

// lo que GAN lee y escribe en F6 (security.md §7, plan 6.0): el territorio, los componentes y predios, y EXPORT sobre los
// objetos de LYR-01 a LYR-16 (spec §4.2). export_log solo con CREATE: registra sus exportaciones, no lee la bitácora
export const EQUIPO_SIG = permisos({
  project: ['READ', 'EXPORT'],
  project_assignment: ['READ'],
  administrative_unit: ['READ', 'EXPORT'],
  locality: ['READ', 'UPDATE', 'EXPORT'],
  community: ['READ', 'CREATE', 'UPDATE', 'EXPORT'],
  community_sector: ['READ', 'EXPORT'],
  road_access: ['READ', 'EXPORT'],
  mining_concession: ['READ', 'CREATE', 'UPDATE', 'EXPORT'],
  environmental_feature: ['READ', 'CREATE', 'UPDATE', 'EXPORT'],
  project_component: ['READ', 'CREATE', 'UPDATE', 'EXPORT'],
  area_of_influence: ['READ', 'CREATE', 'UPDATE', 'EXPORT'],
  area_of_influence_member: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  land_parcel: ['READ', 'CREATE', 'UPDATE', 'EXPORT'],
  land_right: ['READ'],
  school: ['READ', 'EXPORT'],
  health_facility: ['READ', 'EXPORT'],
  stakeholder: ['READ'],
  engagement: ['READ'],
  commitment: ['READ'],
  grievance: ['READ'],
  social_risk: ['READ'],
  export_log: ['CREATE']
})

// quien lee el territorio sin la postura ni los programas: la ficha dice «No disponible» solo en esas cifras
export const LEE_SIN_POSTURA = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  locality: ['READ'],
  community: ['READ'],
  engagement: ['READ'],
  commitment: ['READ']
})

// geometrías sintéticas: un punto, un cuadrado de unos 200 m y un lazo (polígono que se corta a sí mismo)
export const PUNTO = { type: 'Point', coordinates: [-78.5, -7.9] }
export const CUADRADO = {
  type: 'Polygon',
  coordinates: [
    [
      [-78.501, -7.901],
      [-78.499, -7.901],
      [-78.499, -7.899],
      [-78.501, -7.899],
      [-78.501, -7.901]
    ]
  ]
}
export const LAZO = {
  type: 'Polygon',
  coordinates: [
    [
      [-78.501, -7.901],
      [-78.499, -7.899],
      [-78.499, -7.901],
      [-78.501, -7.899],
      [-78.501, -7.901]
    ]
  ]
}

export const PROYECTO_UTM = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A', working_crs: 'EPSG 32717' }, { state: 'active' })
export const LOCALIDAD = registro(
  'l1',
  { name: 'Localidad Ejemplo', locality_type: 'CASERIO', administrative_unit: 'au1' },
  { geometries: { location: PUNTO, boundary: null } }
)
export const COMUNIDAD = registro('c1', { name: 'Comunidad Ejemplo', community_type: 'COMUNIDAD CAMPESINA', code: 'CC-001' })
export const AREA_BORRADOR = registro('ai1', { project: 'p1', area_type: 'AIDS', version_number: 2, calculated_area_ha: 1234.5 }, { state: 'draft' })

// una capa LYR-NN con un elemento por lugar: [id, objeto, nombre]
export const coleccion = (elementos: [string, string, string][]) => ({
  type: 'FeatureCollection',
  features: elementos.map(([id, objeto, name]) => ({
    type: 'Feature',
    id: `${id}:g`,
    geometry: PUNTO,
    properties: { __id: id, __object: objeto, name }
  }))
})

// GET /api/sgspe/territory/localities/l1/card (TerritoryCards): la parte territorial de la ficha. geometry trae un objeto por
// campo (la comunidad, { territory }); la unidad, su nivel; cada área, la condición del miembro; unavailable, lo que la cuenta
// no lee (objetos o rutas objeto.campo)
export const FICHA_LOCALIDAD = {
  locality: LOCALIDAD,
  geometry: { location: PUNTO, boundary: null },
  administrativeUnit: { id: 'au1', name: 'Distrito Ejemplo', level: 'DISTRITO' },
  communities: [{ id: 'c1', name: 'Comunidad Ejemplo' }],
  areasOfInfluence: [{ id: 'ai0', project: 'p1', areaType: 'AIDS', versionNumber: 1, memberCondition: 'INCLUIDO' }],
  unavailable: []
}

// KPI-TER-01 de la localidad (dashboards.md §4.8, TerritorySummary): sin cifra propia, sus filas en el desglose components.
// cada fila tiene key (el código en las de un KPI) y su available; programs y lastActivity no traen label, y lastActivity trae
// la fecha AAAA-MM-DD en value
const kpi = (code: string, label: string, value: number, unit: string, extra: Record<string, unknown> = {}) => ({
  key: code,
  code,
  label,
  available: true,
  value,
  unit,
  ...extra
})
const FILAS_DE_LA_FICHA: Record<string, unknown>[] = [
  kpi('KPI-STK-02', 'Distribución de posturas', 6, 'grupos de interés', {
    breakdowns: [
      {
        by: 'stance',
        rows: [
          { key: 'A FAVOR', value: 3 },
          { key: 'NEUTRAL', value: 1 },
          { key: 'EN CONTRA PERO ABIERTO A ESCUCHAR', value: 1 },
          { key: 'EN CONTRA', value: 1 },
          { key: 'SIN EVALUAR', value: 0 }
        ]
      }
    ]
  }),
  kpi('KPI-ENG-01', 'Interacciones realizadas', 4, 'interacciones'),
  kpi('KPI-COM-02', 'Compromisos abiertos', 3, 'compromisos'),
  kpi('KPI-COM-03', 'Compromisos vencidos', 1, 'compromisos'),
  kpi('KPI-GRV-02', 'QCS abiertas', 2, 'QCS', { confidentialHidden: true }),
  kpi('KPI-RSK-01', 'Riesgos altos', 0, 'riesgos'),
  { key: 'programs', available: true, value: 1, breakdowns: [{ by: 'program', rows: [{ key: 'sp1', label: 'Programa Ejemplo' }] }] },
  kpi('KPI-INV-03', 'Inversión social ejecutada', 1500, 'monto', {
    breakdowns: [
      {
        by: 'source',
        rows: [
          { key: 'COMPROMISOS:PEN', source: 'COMPROMISOS', currency: 'PEN', value: 1000 },
          { key: 'APORTES:PEN', source: 'APORTES', currency: 'PEN', value: 500 },
          { key: 'APORTES:USD', source: 'APORTES', currency: 'USD', value: 200 }
        ]
      }
    ],
    warnings: [
      '1 montos ejecutados en una moneda distinta de PEN no se suman a la cifra (ASM-063)',
      'Los programas no tienen territorio: con un filtro de localidad no se suman'
    ]
  }),
  { key: 'lastActivity', available: true, value: '2026-10-03' }
]

export const KPI_TER_01 = {
  code: 'KPI-TER-01',
  label: 'Resumen de una localidad o comunidad',
  available: true,
  value: null,
  unit: 'cifras',
  breakdowns: [{ by: 'components', rows: FILAS_DE_LA_FICHA }]
}

// la misma ficha para quien no lee stance ni social_program: esas filas no tienen cifra (KpiEvaluation, unavailableRow)
export const KPI_TER_01_SIN_POSTURA = {
  ...KPI_TER_01,
  breakdowns: [
    {
      by: 'components',
      rows: FILAS_DE_LA_FICHA.map((fila) =>
        fila.key === 'KPI-STK-02'
          ? {
              key: 'KPI-STK-02',
              code: 'KPI-STK-02',
              label: fila.label,
              available: false,
              unit: fila.unit,
              unavailableReason: 'FIELD_NOT_READABLE',
              missingFields: ['stakeholder.stance']
            }
          : fila.key === 'programs'
            ? {
                key: 'programs',
                available: false,
                unavailableReason: 'OBJECT_NOT_READABLE',
                missingFields: [
                  'social_program.project',
                  'social_program.name',
                  'social_initiative.social_program',
                  'social_initiative.locality',
                  'social_initiative.community',
                  'beneficiary_group.social_program',
                  'beneficiary_group.locality'
                ]
              }
            : fila
      )
    }
  ]
}

// GetCapabilities del proxy (WmsCapabilities, WMS 1.3.0 con espacio de nombres por defecto): solo la lista blanca, una capa
// de GeoServer por objeto y geometría con un estilo sgspe-lyr-NN[-sufijo] por cada LYR-NN que la usa (la ubicación de las
// localidades sirve a LYR-02 y a LYR-03). el nombre físico no se interpreta
export const CAPACIDADES_WMS = `<?xml version="1.0" encoding="UTF-8"?><WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms" xmlns:xlink="http://www.w3.org/1999/xlink"><Service><Name>WMS</Name><Title>SGSPE</Title><OnlineResource xlink:type="simple" xlink:href="/api/sgspe/territory/wms"/></Service><Capability><Request><GetCapabilities><Format>text/xml</Format></GetCapabilities><GetMap><Format>image/png</Format><Format>image/jpeg</Format></GetMap></Request><Exception><Format>XML</Format></Exception><Layer><Title>SGSPE</Title><CRS>EPSG:3857</CRS><CRS>EPSG:4326</CRS>
<Layer queryable="0"><Name>t_admin__boundary</Name><Title>LYR-01 · Unidad administrativa</Title><Style><Name>sgspe-lyr-01</Name><Title>sgspe-lyr-01</Title></Style></Layer>
<Layer queryable="0"><Name>t_locality__location</Name><Title>LYR-02, LYR-03 · Localidad</Title><Style><Name>sgspe-lyr-02-location</Name><Title>sgspe-lyr-02-location</Title></Style><Style><Name>sgspe-lyr-03</Name><Title>sgspe-lyr-03</Title></Style></Layer>
<Layer queryable="0"><Name>t_community__territory</Name><Title>LYR-05 · Comunidad</Title><Style><Name>sgspe-lyr-05</Name><Title>sgspe-lyr-05</Title></Style></Layer>
</Layer></Capability></WMS_Capabilities>`

// GET /api/sgspe/territory/concentration?of=grievance (TerritoryAggregates): conteos por localidad o comunidad, nunca por
// punto, con el periodo que contó el servidor (sin periodo, los 12 meses que terminan hoy en Lima). no trae confidentialHidden
export const CONCENTRACION = {
  of: 'grievance',
  periodStart: '2025-10-11',
  periodEnd: '2026-10-10',
  available: true,
  truncated: false,
  cells: [
    { object: 'locality', id: 'l1', name: 'Localidad Ejemplo', point: PUNTO, count: 5 },
    { object: 'locality', id: 'l2', name: 'Otra Localidad Ejemplo', point: { type: 'Point', coordinates: [-78.52, -7.92] }, count: 2 }
  ]
}

// GET /api/sgspe/territory/projects/p1/component-parcels (ProjectLandQueries): una plataforma que corta dos predios (gis.md §9).
// holders son los titulares vigentes; el segundo predio no tiene ninguno
export const PREDIOS_AFECTADOS = {
  available: true,
  truncated: false,
  rows: [
    {
      component: { id: 'pc1', code: 'PLT-01', componentType: 'PLATAFORMA' },
      parcel: { id: 'lp1', code: 'PR-001', tenureType: 'PROPIEDAD' },
      lengthM: null,
      areaHa: 0.42,
      holders: [{ object: 'person', id: 'pe1', name: 'Titular Ejemplo Uno' }]
    },
    {
      component: { id: 'pc1', code: 'PLT-01', componentType: 'PLATAFORMA' },
      parcel: { id: 'lp2', code: 'PR-002', tenureType: 'POSESION' },
      lengthM: null,
      areaHa: 0.18,
      holders: []
    }
  ]
}

// GET /api/sgspe/areas-of-influence/ai1/member-suggestions (MemberSuggestions)
export const SUGERENCIAS = {
  available: true,
  suggestions: [
    { object: 'locality', recordId: 'l1', name: 'Localidad Ejemplo', relation: 'INTERSECTS', alreadyMember: false },
    { object: 'community', recordId: 'c1', name: 'Comunidad Ejemplo', relation: 'INTERSECTS', alreadyMember: true }
  ]
}

// GET /api/sgspe/areas-of-influence/ai1/summary (TerritoryAggregates): sin leer la tenencia de los predios, el cruce de los
// componentes con la tierra no se calcula y las dos cifras salen null (no disponibles, nunca cero)
export const RESUMEN_AREA = {
  available: false,
  missingFields: ['land_parcel.tenure_type'],
  areaHa: 1234.5,
  localitiesByType: [
    { localityType: 'ANEXO', count: 1 },
    { localityType: 'CASERIO', count: 3 }
  ],
  componentsOnCommunalLand: null,
  componentsOnPrivateLand: null
}

// GET /api/sgspe/territory/locate?lon=&lat= (ZoneQueries)
export const UBICADOS = {
  administrativeUnit: { id: 'au1', name: 'Distrito Ejemplo', level: 'DISTRITO' },
  locality: { id: 'l1', name: 'Localidad Ejemplo', localityType: 'CASERIO' },
  community: { id: 'c1', name: 'Comunidad Ejemplo' },
  unavailable: []
}

// POST /api/sgspe/territory/geometry-checks de un lazo en community.territory (MULTIPOLYGON): inválido, con el motivo en
// español, normalized en el tipo del campo (el lazo envuelto en Multi), la reparación y el cambio de área
export const REVISION_LAZO = {
  valid: false,
  reason: 'autointersección',
  typeMatches: true,
  normalized: { type: 'MultiPolygon', coordinates: [LAZO.coordinates] },
  repaired: { type: 'MultiPolygon', coordinates: [CUADRADO.coordinates] },
  areaHaBefore: 4.9,
  areaHaAfter: 2.45,
  zone: { srid: 32717, outOfZone: false, outOfRegion: false }
}

// GET /api/sgspe/territory/data-quality?check=INVALID (DataQuality): una fila por registro y campo, sin total de páginas
export const CALIDAD_INVALIDAS = {
  check: 'INVALID',
  content: [
    { object: 'community', id: 'c1', label: 'Comunidad Ejemplo', field: 'territory', detail: 'autointersección' },
    { object: 'land_parcel', id: 'lp9', label: 'PR-009', field: 'boundary', detail: 'anillo autointersecado' }
  ],
  page: 0,
  size: 50,
  hasNext: false
}

// GET /api/sgspe/territory/imports/formats con GDAL instalado, sin FileGDB (ImportFormat, en su orden)
export const FORMATOS = {
  formats: [
    { format: 'xlsx', available: true, multiLayer: false, crsFromFile: false },
    { format: 'csv', available: true, multiLayer: false, crsFromFile: false },
    { format: 'geojson', available: true, multiLayer: false, crsFromFile: false },
    { format: 'shp', available: true, multiLayer: false, crsFromFile: true },
    { format: 'kml', available: true, multiLayer: true, crsFromFile: false },
    { format: 'kmz', available: true, multiLayer: true, crsFromFile: false },
    { format: 'gpkg', available: true, multiLayer: true, crsFromFile: true },
    { format: 'gdb', available: false, multiLayer: true, crsFromFile: true },
    { format: 'gpx', available: true, multiLayer: true, crsFromFile: false }
  ]
}

// GET /api/sgspe/dashboards/territory?project=p1 (dashboards.md §5.9, TerritoryKpis): KPI-TER-02 por área aprobada, KPI-TER-03
// por tipo de área, de miembro y condición (filas sin label) y KPI-TER-04 sin permiso sobre los predios
export const TABLERO_TERRITORIAL = {
  dashboard: 'territory',
  computedAt: '2026-10-10T15:00:00Z',
  filters: { project: ['p1'] },
  indicators: [
    {
      code: 'KPI-TER-02',
      label: 'Superficie del área de influencia',
      available: true,
      value: 1234.5,
      unit: 'ha',
      breakdowns: [{ by: 'area', rows: [{ key: 'ai0', project: 'p1', areaType: 'AIDS', versionNumber: 1, value: 1234.5 }] }]
    },
    {
      code: 'KPI-TER-03',
      label: 'Miembros por tipo de área',
      available: true,
      value: 7,
      unit: 'miembros',
      breakdowns: [
        { by: 'areaType', rows: [{ key: 'AIDS', value: 7 }] },
        {
          by: 'memberType',
          rows: [
            { key: 'locality', value: 5 },
            { key: 'community', value: 2 }
          ]
        },
        {
          by: 'memberCondition',
          rows: [
            { key: 'INCLUIDO', value: 6 },
            { key: 'PROVISIONAL', value: 1 }
          ]
        }
      ]
    },
    {
      code: 'KPI-TER-04',
      label: 'Componentes sobre tierras comunales o privadas',
      available: false,
      unit: 'componentes',
      unavailableReason: 'OBJECT_NOT_READABLE',
      missingFields: ['land_parcel.tenure_type', 'land_parcel.boundary']
    }
  ]
}

// lo que toda pantalla de F6 pregunta: proyectos, asignaciones y, sin F6 en el backend, /map/settings y GetCapabilities en 404
export const baseDeSig = (): MockRoute[] => [
  { path: '/objects/project/records', body: pagina([PROYECTO_UTM]) },
  { path: '/objects/project/records/p1', body: PROYECTO_UTM },
  { path: '/objects/project_assignment/records', body: pagina([registro('as1', { project: 'p1', member_user_id: 'u-gan', active: true })]) },
  { path: '/sgspe/dashboards/indicators', body: [] },
  { path: '/auth/me/notifications/summary', status: 404, body: { title: 'Not Found', status: 404 } }
]
