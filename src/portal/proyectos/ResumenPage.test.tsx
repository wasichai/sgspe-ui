import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock, MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro, workflow } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red, type RutaEspecial } from '../../test/red'

vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))
vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

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

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
const P1 = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa', stage: 'EXPLORACION', inactivity_days: 90 }, { state: 'active' })
const indicador = (code: string, extra: Record<string, unknown>) => ({ code, label: code, available: true, ...extra })
const SIN_STANCE = {
  code: 'KPI-STK-02',
  label: 'Distribución de posturas',
  available: false,
  unavailableReason: 'FIELD_NOT_READABLE',
  missingFields: ['stakeholder.stance']
}

// desde F8 S08 lee el tablero project en una sola llamada (decisión 6 del plan 8.3): cambios reemplaza un indicador por su código
const tableroDelProyecto = (postura: unknown, cambios: Record<string, Record<string, unknown>> = {}): MockRoute => ({
  path: '/sgspe/dashboards/project',
  body: {
    dashboard: 'project',
    computedAt: '2026-10-16T15:00:00Z',
    filters: { project: ['p1'] },
    indicators: [
      indicador('KPI-STK-01', { value: 42, unit: 'grupos de interés' }),
      postura,
      indicador('KPI-STK-03', {
        value: 30,
        numerator: 30,
        denominator: 42,
        breakdowns: [{ by: 'stakeholder', rows: [{ key: 's1', value: 6, interest: 3.5, power: 2.5 }] }]
      }),
      indicador('KPI-ENG-01', { value: 7, unit: 'interacciones' }),
      // un indicador disponible trae siempre value (api.md §4.11), aunque la pantalla dibuje su serie
      indicador('KPI-ENG-02', {
        value: 3,
        series: [
          { period: '2026-09', value: 1, target: 2 },
          { period: '2026-10', value: 3, target: 2 }
        ]
      }),
      indicador('KPI-COM-02', { value: 6, label: 'Compromisos abiertos', unit: 'compromisos' }),
      indicador('KPI-COM-03', { value: 3, unit: 'compromisos' }),
      indicador('KPI-COM-04', { value: 2, label: 'Compromisos por vencer', unit: 'compromisos' }),
      indicador('KPI-COM-06', { value: 1, label: 'Compromisos bloqueados', unit: 'compromisos' }),
      indicador('KPI-GRV-01', { value: 5, label: 'QCS recibidas', unit: 'QCS' }),
      indicador('KPI-GRV-02', { value: 4, unit: 'quejas' }),
      indicador('KPI-GRV-06', { value: 1, label: 'QCS vencidas', unit: 'QCS' }),
      indicador('KPI-RSK-01', { value: 8, unit: 'riesgos' }),
      indicador('KPI-RSK-02', { value: 0, breakdowns: [] }),
      indicador('KPI-INV-02', { value: null, breakdowns: [] }),
      indicador('KPI-INV-03', { value: null, breakdowns: [] }),
      indicador('KPI-INV-04', { value: null, breakdowns: [] })
    ].map((i) => (cambios[(i as { code: string }).code] ? { ...cambios[(i as { code: string }).code], code: (i as { code: string }).code } : i))
  }
})

const rutas = (postura: unknown, cambios: Record<string, Record<string, unknown>> = {}): MockRoute[] => [
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/project/records/p1/transitions', body: [] },
  { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
  { path: /^\/objects\/project_assignment\/records\?.*role_name/, body: pagina([registro('a1', { member_user_email: 'jefa@sgspe.test' })]) },
  { path: '/objects/area_of_influence/records', body: pagina([registro('ai', { area_type: 'AIDS', version_number: 2 }, { state: 'approved' })]) },
  {
    path: '/objects/engagement/records',
    body: pagina([
      registro('e1', { title: 'Asamblea de agosto', engagement_type: 'ASAMBLEA' }, { state: 'held' }),
      registro('e2', { title: 'Llamada', engagement_type: 'LLAMADA' }, { state: 'held' })
    ])
  },
  { path: '/objects/stakeholder/records', body: pagina([registro('s1', { organization: 'o1', last_contact_date: hace(120) }, { state: 'profiled' })]) },
  { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Ronda campesina Tunas' }) },
  {
    path: '/objects/project/records/p1/history',
    body: [{ id: 'h1', userEmail: 'pad@sgspe.test', operation: 'UPDATE', occurredAt: '2026-10-05T15:00:00Z', reason: 'cambio de etapa', changes: [] }]
  },
  { path: /^\/sgspe\/territory\/layers\//, body: { type: 'FeatureCollection', features: [] } },
  tableroDelProyecto(postura, cambios)
]

const LECTOR = permisos({ project: ['READ'], stakeholder: ['READ'], engagement: ['READ'], area_of_influence: ['READ'], project_assignment: ['READ'] })

// abre el resumen y, sobre la red simulada, responde a mano lo que la prueba pide (un 403 o un error). los errores son 4xx: el
// portal reintenta los 5xx con espera y la prueba no tiene por qué esperarlos
const abrir = (rutasDelResumen: MockRoute[], especiales: RutaEspecial[] = []) => {
  fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutasDelResumen)
  red = espiarRed(especiales)
}
const cerrar = () => {
  red?.restaurar()
  fetch?.restore()
  document.body.innerHTML = ''
}
const falla = (ruta: string | RegExp, status = 400, correlacion = 'corr-123'): RutaEspecial => ({
  path: ruta,
  responder: () => problema(status, 'Falló', [], correlacion)
})

describe('S08 · Project 360, resumen', () => {
  it('muestra la jefatura y las cifras de salud de una sola llamada al tablero del proyecto', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutas(SIN_STANCE))
    red = espiarRed()
    expect(await screen.findByText(/jefa@sgspe.test/)).toBeInTheDocument()
    const salud = screen.getByRole('region', { name: 'Salud del proyecto' })
    expect(await within(salud).findByText('42')).toBeInTheDocument()
    expect(within(salud).getByText('7')).toBeInTheDocument()
    expect(within(salud).getByText('8')).toBeInTheDocument()
    expect(within(salud).queryByText(/Llega en/)).not.toBeInTheDocument()
    await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/project').length).toBeGreaterThan(0))
    expect(red.a('GET', '/sgspe/dashboards/project')[0].ruta).toContain('project=p1')
    expect(red.a('GET', /^\/sgspe\/dashboards\/indicators\//)).toHaveLength(0)
    expect(screen.getByText('12 sin evaluar')).toBeInTheDocument()
    // cada cifra lleva a su lista con el filtro puesto (revisión de UX, etapa 6); KPI-COM-03 son los vencidos
    expect(within(salud).getByRole('link', { name: 'Compromisos vencidos: 3' })).toHaveAttribute('href', '/projects/p1/commitments?view=vencidos')
    expect(within(salud).getByRole('link', { name: 'Riesgos altos: 8' })).toHaveAttribute('href', '/projects/p1/risks?level=alto')
    expect(within(salud).getByRole('link', { name: 'QCS abiertas: 4' })).toHaveAttribute('href', '/projects/p1/attention')
  })

  it('el tablero del proyecto reparte compromisos, QCS, riesgos e inversión de la misma llamada', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutas(SIN_STANCE))
    const tablero = await screen.findByRole('region', { name: 'Tablero del proyecto' })
    const compromisos = await within(tablero).findByRole('region', { name: 'Compromisos' })
    expect(await within(compromisos).findByText('2')).toBeInTheDocument()
    expect(within(compromisos).getByRole('link', { name: 'Ver el tablero de compromisos' })).toHaveAttribute('href', '/projects/p1/commitments/dashboard')
    expect(within(tablero).getByRole('region', { name: 'Quejas, consultas y solicitudes' })).toHaveTextContent('QCS vencidas')
    expect(within(tablero).getByRole('region', { name: 'Mapa de calor de riesgos' })).toBeInTheDocument()
    expect(within(tablero).getByRole('region', { name: 'Inversión ejecutada' })).toBeInTheDocument()
  })

  it('sin permiso para la postura no dibuja la barra y dice "No disponible" con su motivo; con él, sí', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutas(SIN_STANCE))
    red = espiarRed()
    const paisaje = await screen.findByRole('region', { name: 'Paisaje de grupos de interés' })
    // la respuesta de KPI-STK-02 llega después del proyecto: se espera el texto, no solo la región
    const sinPostura = await within(paisaje).findByText('No disponible')
    expect(sinPostura).toHaveAttribute('title', 'Su rol no puede leer un dato de esta cifra')
    expect(red.a('GET', '/sgspe/dashboards/project').length).toBeGreaterThan(0)
    expect(within(paisaje).getByText('Posturas')).toBeInTheDocument()
    expect(within(paisaje).queryByText(/A favor/)).not.toBeInTheDocument()
    fetch.restore()
    document.body.innerHTML = ''
    fetch = abrirPortal(
      '/projects/p1/overview',
      GERENCIA_SOCIAL,
      LECTOR,
      rutas({
        code: 'KPI-STK-02',
        label: 'x',
        available: true,
        value: 7,
        breakdowns: [
          {
            by: 'stance',
            rows: [
              { key: 'A FAVOR', value: 5 },
              { key: 'EN CONTRA', value: 2 }
            ]
          }
        ]
      })
    )
    expect(await screen.findByText('A favor: 5')).toBeInTheDocument()
    expect(screen.getByText('En contra: 2')).toBeInTheDocument()
    expect(screen.queryByText('No disponible')).not.toBeInTheDocument()
  })

  it('"Atención requerida" lista las actas por redactar de reuniones formales y los grupos sin contacto', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutas(SIN_STANCE))
    const atencion = await screen.findByRole('region', { name: 'Atención requerida' })
    expect(await within(atencion).findByRole('link', { name: 'Asamblea de agosto' })).toHaveAttribute('href', '/projects/p1/engagements/e1')
    expect(within(atencion).queryByText(/Llamada/)).not.toBeInTheDocument()
    expect(await within(atencion).findByRole('link', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
  })

  it('un borrador ofrece completarse solo a quien puede escribir algún campo del proyecto, no a un rol con "u"', async () => {
    const BORRADOR = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'draft' })
    const conCambio = permisos({ ...LECTOR.objects, project: ['READ', 'UPDATE'] })
    const rutasCon = (editable: boolean) => [
      { path: '/objects/project/records/p1', body: BORRADOR },
      {
        path: '/metadata/objects/project',
        body: definicion('project', [
          ['code', { editable }],
          ['name', { editable }]
        ])
      },
      ...rutas(SIN_STANCE)
    ]
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, conCambio, rutasCon(true))
    expect(await screen.findByRole('link', { name: 'Completar proyecto' })).toHaveAttribute('href', '/projects/new?draft=p1')
    fetch.restore()
    document.body.innerHTML = ''
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, conCambio, rutasCon(false))
    red = espiarRed()
    await screen.findByRole('region', { name: 'Paisaje de grupos de interés' })
    await waitFor(() => expect(red!.a('GET', '/metadata/objects/project').length).toBeGreaterThan(0))
    expect(screen.queryByRole('link', { name: 'Completar proyecto' })).not.toBeInTheDocument()
  })

  it('las reuniones del mes se comparan con la meta y la actividad trae el motivo', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutas(SIN_STANCE))
    expect(await screen.findByText('oct. 2026: 3 de 2')).toBeInTheDocument()
    expect(await screen.findByText(/cambio de etapa/)).toBeInTheDocument()
  })

  it('sin asignación no ofrece las transiciones del proyecto; con ella, sí (re-revisión, menor 4)', async () => {
    const enviar = { name: 'submit_for_review', label: 'Enviar a revisión', to: 'in_review', toLabel: 'En revisión', allowed: true, reason: null }
    const transiciones = { path: '/objects/project/records/p1/transitions', body: [enviar] }
    const mia = {
      path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
      body: pagina([registro('as', { project: 'p1', member_user_id: RELACIONISTA.id, active: true })])
    }
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, [transiciones, ...rutas(SIN_STANCE)])
    // el aviso de solo lectura sale cuando las asignaciones llegaron: los botones ya las vieron
    await screen.findByText(/No está asignado a este proyecto/)
    expect(screen.queryByRole('button', { name: 'Enviar a revisión' })).not.toBeInTheDocument()
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, [transiciones, mia, ...rutas(SIN_STANCE)])
    expect(await screen.findByRole('button', { name: 'Enviar a revisión' })).toBeInTheDocument()
  })

  it('la actividad es la misma pieza que la de una interacción: dice los campos cambiados (revisión final, M3)', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, [
      {
        path: '/objects/project/records/p1/history',
        body: [{ id: 'h1', userEmail: 'pad@sgspe.test', operation: 'UPDATE', occurredAt: '2026-10-05T15:00:00Z', reason: null, changes: [{ field: 'state' }] }]
      },
      ...rutas(SIN_STANCE)
    ])
    const actividad = await screen.findByRole('region', { name: 'Actividad reciente' })
    expect(await within(actividad).findByText('(Estado)')).toBeInTheDocument()
  })

  it('la jefatura dice "No disponible" ante un 403 y ofrece reintentar ante un error, nunca "Sin jefatura"; con datos vacíos, sí', async () => {
    const asignaciones = /^\/objects\/project_assignment\/records\?.*role_name/
    abrir(rutas(SIN_STANCE), [falla(asignaciones, 403)])
    const cabecera = (await screen.findByRole('heading', { level: 1 })).closest('header')!
    expect(await within(cabecera).findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByText('Sin jefatura asignada')).not.toBeInTheDocument()
    cerrar()
    abrir(rutas(SIN_STANCE), [falla(asignaciones)])
    const conError = (await screen.findByRole('heading', { level: 1 })).closest('header')!
    expect(await within(conError).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(within(conError).queryByText('No disponible')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin jefatura asignada')).not.toBeInTheDocument()
    cerrar()
    abrir([{ path: asignaciones, body: pagina([]) }, ...rutas(SIN_STANCE)])
    expect(await screen.findByText('Sin jefatura asignada')).toBeInTheDocument()
  })

  it('"Atención requerida" no tranquiliza cuando una lectura no se puede hacer: dice cuál', async () => {
    abrir(rutas(SIN_STANCE), [falla(/^\/objects\/stakeholder\/records/, 403)])
    const atencion = await screen.findByRole('region', { name: 'Atención requerida' })
    expect(await within(atencion).findByText('Grupos de interés')).toBeInTheDocument()
    expect(within(atencion).getByText('No disponible')).toBeInTheDocument()
    // la otra lectura sí respondió: su aviso se lista
    expect(await within(atencion).findByRole('link', { name: 'Asamblea de agosto' })).toBeInTheDocument()
    expect(within(atencion).queryByText(/Nada pide atención/)).not.toBeInTheDocument()
    cerrar()
    abrir(rutas(SIN_STANCE), [falla(/^\/objects\/engagement\/records/, 400, 'corr-77')])
    const conError = await screen.findByRole('region', { name: 'Atención requerida' })
    expect(await within(conError).findByText('Interacciones')).toBeInTheDocument()
    expect(await within(conError).findByText(/corr-77/)).toBeInTheDocument()
    expect(within(conError).queryByText(/Nada pide atención/)).not.toBeInTheDocument()
  })

  it('"Nada pide atención hoy" solo se dice cuando las dos lecturas respondieron y no hay nada', async () => {
    abrir([{ path: '/objects/engagement/records', body: pagina([]) }, { path: '/objects/stakeholder/records', body: pagina([]) }, ...rutas(SIN_STANCE)])
    const atencion = await screen.findByRole('region', { name: 'Atención requerida' })
    expect(await within(atencion).findByText(/Nada pide atención hoy/)).toBeInTheDocument()
  })

  it('"Atención requerida" agrupa por tipo con su conteo, muestra cinco y despliega el resto', async () => {
    const siete = Array.from({ length: 7 }, (_, n) => registro(`s${n}`, { organization: 'o1', last_contact_date: hace(120) }, { state: 'profiled' }))
    abrir([{ path: '/objects/stakeholder/records', body: pagina(siete) }, ...rutas(SIN_STANCE)])
    const atencion = await screen.findByRole('region', { name: 'Atención requerida' })
    const sinContacto = await within(atencion).findByRole('group', { name: '7 grupos de interés sin contacto en más de 90 días' })
    await waitFor(() => expect(within(sinContacto).getAllByRole('link')).toHaveLength(5))
    expect(within(atencion).getByRole('group', { name: '1 acta por redactar' })).toBeInTheDocument()
    await userEvent.click(within(sinContacto).getByRole('button', { name: 'Ver los 7' }))
    expect(within(sinContacto).getAllByRole('link')).toHaveLength(7)
    await userEvent.click(within(sinContacto).getByRole('button', { name: 'Ver menos' }))
    expect(within(sinContacto).getAllByRole('link')).toHaveLength(5)
  })

  it('un grupo que nunca tuvo contacto entra en "sin contacto" con su propio texto', async () => {
    abrir([
      { path: '/objects/stakeholder/records', body: pagina([registro('s9', { organization: 'o1', last_contact_date: null }, { state: 'identified' })]) },
      ...rutas(SIN_STANCE)
    ])
    const atencion = await screen.findByRole('region', { name: 'Atención requerida' })
    expect(await within(atencion).findByRole('link', { name: 'Ronda campesina Tunas · nunca contactado' })).toBeInTheDocument()
  })

  it('una cuenta que no lee last_contact_date no marca a nadie como "sin contacto registrado"', async () => {
    abrir([
      { path: '/objects/engagement/records', body: pagina([]) },
      { path: '/objects/stakeholder/records', body: pagina([registro('s9', { organization: 'o1' }, { state: 'identified' })]) },
      ...rutas(SIN_STANCE)
    ])
    const atencion = await screen.findByRole('region', { name: 'Atención requerida' })
    expect(await within(atencion).findByText(/Nada pide atención hoy/)).toBeInTheDocument()
    expect(within(atencion).queryByText(/sin contacto/)).not.toBeInTheDocument()
  })

  describe('con el reloj cerca de la medianoche de Lima', () => {
    afterEach(() => vi.useRealTimers())
    // 2026-10-08T03:00Z es el 7 de octubre a las 22:00 en Lima: hoy es el 7. desde el 9 de julio hay 90 días, y "más de 90" no
    // se cumple; contra la hora UTC (8 de octubre) serían 91 y el aviso saldría un día antes
    it('cuenta los días de calendario contra hoy en Lima, no contra la medianoche UTC', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-08T03:00:00Z'))
      const con = (fecha: string) => [
        { path: '/objects/stakeholder/records', body: pagina([registro('s1', { organization: 'o1', last_contact_date: fecha }, { state: 'profiled' })]) },
        ...rutas(SIN_STANCE)
      ]
      abrir(con('2026-07-09'))
      const atencion = await screen.findByRole('region', { name: 'Atención requerida' })
      await within(atencion).findByRole('link', { name: 'Asamblea de agosto' })
      expect(within(atencion).queryByText(/sin contacto/)).not.toBeInTheDocument()
      cerrar()
      abrir(con('2026-07-08'))
      const mas = await screen.findByRole('region', { name: 'Atención requerida' })
      expect(await within(mas).findByRole('link', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
    })
  })

  it('el tablero que falla dice el error en cada zona, no "Cargando" para siempre; la matriz no disponible dice su motivo', async () => {
    abrir(rutas(SIN_STANCE), [falla('/sgspe/dashboards/project', 400, 'corr-501')])
    const salud = await screen.findByRole('region', { name: 'Salud del proyecto' })
    // D4 (revisión de UX, etapa 7): cada cifra en una línea, con el detalle en title, y el tablero lo dice una sola vez
    const cifras = await within(salud).findAllByText(/No se pudo cargar/)
    expect(cifras).toHaveLength(5)
    expect(cifras[0].getAttribute('title')).toMatch(/corr-501/)
    expect(await screen.findAllByText(/corr-501/)).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Salud del proyecto' })).toBeInTheDocument()
    const paisaje = screen.getByRole('region', { name: 'Paisaje de grupos de interés' })
    expect(within(paisaje).queryByRole('img', { name: 'Interés × poder' })).not.toBeInTheDocument()
    cerrar()
    abrir(rutas(SIN_STANCE, { 'KPI-STK-03': { label: 'x', available: false, unavailableReason: 'OBJECT_NOT_READABLE' } }))
    const otroPaisaje = await screen.findByRole('region', { name: 'Paisaje de grupos de interés' })
    await waitFor(() =>
      expect(
        within(otroPaisaje)
          .getAllByText('No disponible')
          .some((m) => m.getAttribute('title') === 'Su rol no puede leer los registros de esta cifra')
      ).toBe(true)
    )
  })

  it('las reuniones y la actividad dicen su error, su vacío y un mes sin cifra', async () => {
    abrir([{ path: '/objects/project/records/p1/history', body: [] }, ...rutas(SIN_STANCE)], [falla('/sgspe/dashboards/project', 400, 'corr-502')])
    const reuniones = await screen.findByRole('region', { name: 'Reuniones al mes frente a la meta' })
    // D4 (revisión de UX, etapa 7): en una línea, con el detalle en title
    expect((await within(reuniones).findByText(/No se pudo cargar/)).getAttribute('title')).toMatch(/corr-502/)
    const actividad = screen.getByRole('region', { name: 'Actividad reciente' })
    expect(await within(actividad).findByText('Este proyecto aún no tiene actividad registrada.')).toBeInTheDocument()
    cerrar()
    abrir(
      rutas(SIN_STANCE, {
        'KPI-ENG-02': {
          label: 'x',
          available: true,
          value: 1,
          series: [
            { period: '2026-09', value: null, target: 2 },
            { period: '2026-10', value: 1, target: 2 }
          ]
        }
      }),
      [falla(/^\/objects\/project\/records\/p1\/history/, 400, 'corr-504')]
    )
    expect(await screen.findByText('set. 2026: — de 2')).toBeInTheDocument()
    expect(await screen.findByText(/corr-504/)).toBeInTheDocument()
    cerrar()
    abrir(rutas(SIN_STANCE, { 'KPI-ENG-02': { label: 'x', available: true, value: 0, series: [] } }))
    expect(await screen.findByText('Aún no hay meses con reuniones que comparar con la meta.')).toBeInTheDocument()
  })

  it('un 403 en la actividad, el tablero y las áreas sale como "No disponible", no como un error rojo', async () => {
    abrir(rutas(SIN_STANCE), [
      falla(/^\/objects\/project\/records\/p1\/history/, 403),
      falla('/sgspe/dashboards/project', 403),
      falla('/objects/area_of_influence/records', 403)
    ])
    for (const region of ['Actividad reciente', 'Reuniones al mes frente a la meta', 'Paisaje de grupos de interés', 'Áreas de influencia vigentes']) {
      const seccion = await screen.findByRole('region', { name: region })
      await waitFor(() => expect(within(seccion).getAllByText('No disponible').length).toBeGreaterThan(0))
    }
    expect(within(screen.getByRole('region', { name: 'Paisaje de grupos de interés' })).getAllByText('No disponible')).toHaveLength(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un error al leer la jefatura ofrece reintentar, y al reintentar muestra a la jefa', async () => {
    let llamadas = 0
    abrir(rutas(SIN_STANCE), [
      {
        path: /^\/objects\/project_assignment\/records\?.*role_name/,
        responder: () =>
          ++llamadas === 1
            ? problema(400, 'Falló', [], 'corr-601')
            : new Response(JSON.stringify(pagina([registro('a1', { member_user_email: 'jefa@sgspe.test' })])), {
                headers: { 'Content-Type': 'application/json' }
              })
      }
    ])
    const cabecera = (await screen.findByRole('heading', { level: 1 })).closest('header')!
    await userEvent.click(await within(cabecera).findByRole('button', { name: 'Reintentar' }))
    expect(await within(cabecera).findByText(/jefa@sgspe\.test/)).toBeInTheDocument()
    expect(within(cabecera).queryByText('Sin jefatura asignada')).not.toBeInTheDocument()
  })

  it('el mini mapa dice por qué está en blanco: bloqueado, con error o sin geometrías', async () => {
    abrir(rutas(SIN_STANCE), [falla(/^\/sgspe\/territory\/layers\//, 403)])
    expect(await screen.findByText('Su cuenta no puede ver ninguna de las capas encendidas.')).toBeInTheDocument()
    cerrar()
    abrir(rutas(SIN_STANCE), [falla(/^\/sgspe\/territory\/layers\//)])
    expect(await screen.findByText('No se pudo leer ninguna de las capas encendidas: vuelva a cargar la página.')).toBeInTheDocument()
    cerrar()
    abrir(rutas(SIN_STANCE))
    expect(await screen.findByText('Este proyecto aún no tiene geometrías: impórtelas o dibújelas para verlas aquí.')).toBeInTheDocument()
  })
})
