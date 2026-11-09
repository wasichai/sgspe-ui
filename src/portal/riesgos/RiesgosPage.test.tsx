import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { P1 } from '../../test/compromisos'
import { definicion, montar, pagina, registro, ubicacion } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { ALERTA, baseDeRiesgos, DEF_RIESGO, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS, RELACIONES_EN_RIESGOS, RIESGO } from '../../test/riesgos'
import { RELACIONISTA } from '../../test/portal'
import { nivelDePuntaje, umbralesDe } from './niveles'
import { RiesgosPage } from './RiesgosPage'
import { numeroPe } from '../i18n'

// S38 y S39 (screens.md §9): el mapa de calor por los valores vigentes, los riesgos sin revisión fuera del mapa, la celda que filtra
// la tabla, las vistas armadas en el portal y el alta con motivo, también desde un incidente
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const NUEVO = registro('k2', { project: 'p1', code: 'R-002', title: 'Desinformación sobre el uso del agua' }, { state: 'identified' })
const MEDIO = registro(
  'k3',
  {
    project: 'p1',
    code: 'R-003',
    title: 'Reclamo por polvo en la vía',
    probability: 2,
    impact: 3,
    score: 6,
    risk_level: 'MEDIO',
    review_status: 'POR REVISAR',
    next_review_date: '2026-10-10',
    owner_user_id: 'u-otro'
  },
  { state: 'assessed' }
)
const CERRADO = registro('k4', { project: 'p1', code: 'R-004', title: 'Paro de transportistas' }, { state: 'closed' })

const rutas = (extra: MockRoute[] = [], riesgos = [RIESGO, NUEVO, MEDIO, CERRADO]): MockRoute[] => [
  ...extra,
  ...baseDeRiesgos(),
  { path: '/objects/social_risk/records', body: pagina(riesgos) },
  { path: '/objects/project/records', body: pagina([P1]) }
]
const abrir = (ruta = '/projects/p1/risks/register', usuario = GESTOR_DE_RIESGOS, permisos = EQUIPO_DE_RIESGOS) =>
  montar(<RiesgosPage />, { ruta, camino: ruta.startsWith('/projects') ? '/projects/:projectId/risks/register' : '/risks/register', usuario, permisos })

describe('S38 y S39 · registro y matriz de riesgos', () => {
  it('el mapa cuenta los riesgos por P × I con el nivel de cada celda y deja fuera los que no tienen revisión', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const mapa = await screen.findByRole('region', { name: 'Matriz probabilidad × impacto' })
    expect(within(mapa).getByRole('button', { name: 'Probabilidad 4, impacto 4: 1 riesgo, nivel Crítico' })).toBeInTheDocument()
    expect(within(mapa).getByRole('button', { name: 'Probabilidad 2, impacto 3: 1 riesgo, nivel Medio' })).toBeInTheDocument()
    expect(within(mapa).getByRole('button', { name: 'Probabilidad 1, impacto 1: 0 riesgos, nivel Bajo' })).toBeInTheDocument()
    expect(within(mapa).getByText('Sin evaluar (fuera del mapa): 1')).toBeInTheDocument()
    const tabla = screen.getByRole('table', { name: 'Riesgos' })
    // el código va aparte, en gris, y el título es el enlace (EnlaceDeRegistro, revisión de UX)
    expect(within(tabla).getByRole('link', { name: 'Bloqueo de la vía de acceso por la comunidad' })).toHaveAttribute('href', '/projects/p1/risks/k1')
    expect(within(tabla).getByText('R-001')).toHaveClass('font-sg-mono')
    expect(within(tabla).getByLabelText('Nivel de riesgo: Crítico')).toBeInTheDocument()
    // P × I es numérico, con el puntaje en 800 (S10)
    expect(within(tabla).getByRole('cell', { name: '4 × 4 = 16' })).toHaveClass('text-right')
    expect(within(tabla).getByText('Sin evaluar')).toBeInTheDocument()
    expect(within(tabla).queryByText(/R-004/)).not.toBeInTheDocument()
  })

  it('sin puntaje la celda P × I dice «—» y un riesgo sin proyecto se nombra sin enlace', async () => {
    const SIN_PUNTAJE = registro('k5', { ...MEDIO.attributes, code: 'R-005', score: null }, { state: 'assessed' })
    const SIN_PROYECTO = registro('k6', { code: 'R-006', title: 'Huelga regional' }, { state: 'identified' })
    fetch = mockFetch(rutas([], [SIN_PUNTAJE, SIN_PROYECTO]))
    abrir()
    const tabla = await screen.findByRole('table', { name: 'Riesgos' })
    const fila = within(tabla).getByRole('row', { name: /R-005/ })
    expect(within(fila).queryByText(/=/)).not.toBeInTheDocument()
    expect(within(fila).getAllByText('—').length).toBeGreaterThan(0)
    expect(within(tabla).getByText('Huelga regional')).toBeInTheDocument()
    expect(within(tabla).getByText('R-006')).toBeInTheDocument()
    expect(within(tabla).queryByRole('link', { name: /Huelga regional/ })).not.toBeInTheDocument()
  })

  // 05-especificacion §1.6: en una fila enfocada, Espacio abre su vista previa y Enter su ficha
  it('Espacio en una fila enfocada abre la vista previa del riesgo y Enter su ficha', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const tabla = await screen.findByRole('table', { name: 'Riesgos' })
    const fila = within(tabla).getAllByRole('row')[1]
    const ficha = within(fila).getAllByRole('link')[0].getAttribute('href')!
    fila.focus()
    await userEvent.keyboard(' ')
    expect(ubicacion.actual).toMatch(/^\/projects\/p1\/risks\/register\?peek=social_risk%3A/)
    within(screen.getByRole('table', { name: 'Riesgos', hidden: true }))
      .getAllByRole('row', { hidden: true })[1]
      .focus()
    await userEvent.keyboard('{Enter}')
    expect(ubicacion.actual).toBe(ficha)
  })

  // 05-especificacion §1.6: el portal tiene todos los riesgos y los ordena aquí, el nivel por su orden de negocio y no por su texto
  it('el riesgo, P × I y el nivel ordenan en el portal, con aria-sort; el nivel va de bajo a crítico y lo sin dato, al final', async () => {
    const ALTO = registro('k7', { ...MEDIO.attributes, code: 'R-007', probability: 3, impact: 3, score: 9, risk_level: 'ALTO' }, { state: 'assessed' })
    const BAJO = registro('k8', { ...MEDIO.attributes, code: 'R-008', probability: 1, impact: 2, score: 2, risk_level: 'BAJO' }, { state: 'assessed' })
    // llegan desordenados: el orden inicial es el del código
    fetch = mockFetch(rutas([], [ALTO, NUEVO, RIESGO, BAJO, MEDIO]))
    red = espiarRed()
    abrir()
    await screen.findByRole('table', { name: 'Riesgos' })
    const tabla = () => screen.getByRole('table', { name: 'Riesgos' })
    const codigos = () =>
      within(tabla())
        .getAllByRole('row')
        .slice(1)
        .map((f) => within(f).getByText(/^R-\d+$/).textContent)
    expect(codigos()).toEqual(['R-001', 'R-002', 'R-003', 'R-007', 'R-008'])
    expect(within(tabla()).getByRole('columnheader', { name: 'Riesgo · categoría' })).toHaveAttribute('aria-sort', 'ascending')
    // el nivel por su orden (bajo, medio, alto, crítico), no alfabético; el sin evaluar, al final en los dos sentidos
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Nivel y tendencia' }))
    expect(codigos()).toEqual(['R-008', 'R-003', 'R-007', 'R-001', 'R-002'])
    expect(within(tabla()).getByRole('columnheader', { name: 'Nivel y tendencia' })).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Nivel y tendencia' }))
    expect(codigos()).toEqual(['R-001', 'R-007', 'R-003', 'R-008', 'R-002'])
    expect(within(tabla()).getByRole('columnheader', { name: 'Nivel y tendencia' })).toHaveAttribute('aria-sort', 'descending')
    // el puntaje como número: 2, 6, 9, 16 (no «16» antes de «2»)
    await userEvent.click(within(tabla()).getByRole('button', { name: 'P × I' }))
    expect(codigos()).toEqual(['R-008', 'R-003', 'R-007', 'R-001', 'R-002'])
    // el estado y la revisión no se ordenan; el orden viaja en la URL (DD-37) y no vuelve a pedir la lista
    expect(within(tabla()).queryByRole('button', { name: 'Estado' })).not.toBeInTheDocument()
    expect(ubicacion.actual).toBe('/projects/p1/risks/register?sort=puntaje&dir=asc')
    expect(red.a('GET', '/objects/social_risk/records').every((l) => l.ruta.includes('sort=code&dir=asc'))).toBe(true)
  })

  // tercera pasada de UX, 3.7: buscar por código o título, sin tildes ni mayúsculas
  it('busca por código o título sin tildes, con su chip, y el vacío ofrece quitar la búsqueda', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const buscar = await screen.findByRole('searchbox', { name: 'Buscar por código o título' })
    await userEvent.type(buscar, 'VIA')
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Riesgos' })).getAllByRole('row')).toHaveLength(3))
    expect(within(screen.getByRole('list', { name: 'Filtros aplicados' })).getByRole('listitem')).toHaveTextContent('Contiene «VIA»')
    await userEvent.clear(buscar)
    await userEvent.type(buscar, 'r-003')
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Riesgos' })).getAllByRole('row')).toHaveLength(2))
    await userEvent.clear(buscar)
    await userEvent.type(buscar, 'nada de esto')
    // la barra y el vacío ofrecen limpiar: los dos quitan la búsqueda
    await userEvent.click((await screen.findAllByRole('button', { name: 'Limpiar filtros' }))[0])
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Riesgos' })).getAllByRole('row')).toHaveLength(4))
  })

  it('elegir una celda filtra la tabla y «Quitar filtro de celda» la devuelve entera', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: /Probabilidad 4, impacto 4/ }))
    const tabla = screen.getByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Probabilidad 4, impacto 4/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro de celda' }))
    expect(within(screen.getByRole('table', { name: 'Riesgos' })).getAllByRole('row')).toHaveLength(4)
  })

  // rediseño de UX (2026-10-20): un filtro que deja la vista vacía se puede quitar desde el vacío, que dice cuántos hay sin él
  it('con la celda o el nivel puestos y nada que mostrar, el vacío ofrece limpiar los filtros', async () => {
    fetch = mockFetch(rutas())
    abrir('/projects/p1/risks/register?cell=1-1')
    expect(await screen.findByText('Nada coincide con los filtros')).toBeInTheDocument()
    // el del vacío, no el de la barra de filtros
    const barra = screen.getByRole('group', { name: 'Filtros' })
    const delVacio = screen.getAllByRole('button', { name: 'Limpiar filtros' }).find((b) => !barra.contains(b))!
    await userEvent.click(delVacio)
    expect(within(await screen.findByRole('table', { name: 'Riesgos' })).getAllByRole('row')).toHaveLength(4)
  })

  // revisión de UX, etapa 6: «Riesgos altos» del resumen y del tablero llegan con ?level=alto
  it('?level=alto deja los de nivel alto o crítico, con su chip, y quitarlo devuelve la tabla entera', async () => {
    fetch = mockFetch(rutas())
    abrir('/projects/p1/risks/register?level=alto')
    const tabla = await screen.findByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el filtro Nivel alto o crítico' }))
    expect(within(screen.getByRole('table', { name: 'Riesgos' })).getAllByRole('row')).toHaveLength(4)
  })

  // P-02 (DD-03, DD-04): las vistas en el selector de la barra de filtros, con su conteo; la celda y el nivel son chips con «Limpiar»
  it('las vistas van en el selector de la barra de filtros y la celda elegida es un chip; «Limpiar filtros» deja la vista', async () => {
    fetch = mockFetch(rutas())
    abrir('/projects/p1/risks/register?view=registro&level=alto')
    await screen.findByRole('table', { name: 'Riesgos' })
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    const barra = screen.getByRole('group', { name: 'Filtros' })
    expect(within(barra).getByRole('radio', { name: 'Vigentes, 3' })).toHaveAttribute('aria-checked', 'true')
    expect(within(barra).getByRole('radio', { name: 'Cerrados, 1' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Probabilidad 4, impacto 4/ }))
    const aplicados = within(barra).getByRole('list', { name: 'Filtros aplicados' })
    expect(within(aplicados).getByText('Probabilidad 4 × impacto 4')).toBeInTheDocument()
    expect(within(aplicados).getByText('Nivel alto o crítico')).toBeInTheDocument()
    await userEvent.click(within(barra).getByRole('button', { name: 'Limpiar filtros' }))
    expect(ubicacion.actual).toBe('/projects/p1/risks/register?view=registro')
    expect(within(screen.getByRole('table', { name: 'Riesgos' })).getAllByRole('row')).toHaveLength(4)
  })

  it('las vistas: revisión pendiente, mis riesgos y cerrados', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await userEvent.click(await screen.findByRole('radio', { name: /^Revisión pendiente\b/ }))
    let tabla = screen.getByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getByText(/R-003/)).toBeInTheDocument()
    expect(within(tabla).getByLabelText(/^Situación de revisión: Por revisar/)).toBeInTheDocument()
    expect(within(tabla).queryByText(/R-001/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Mis riesgos\b/ }))
    tabla = screen.getByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getByText(/R-001/)).toBeInTheDocument()
    expect(within(tabla).queryByText(/R-003/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Cerrados\b/ }))
    expect(within(screen.getByRole('table', { name: 'Riesgos' })).getByText(/R-004/)).toBeInTheDocument()
  })

  it('identificar un riesgo desde un incidente lo crea con el proyecto, el incidente de origen y el motivo', async () => {
    fetch = mockFetch(
      rutas([
        { method: 'POST', path: '/objects/social_risk/records', status: 201, body: NUEVO },
        // los ids de prueba no son UUID: aquí las relaciones fijas se leen como texto para que el formulario de wasichai las acepte
        {
          path: '/metadata/objects/social_risk',
          body: { ...DEF_RIESGO, fields: DEF_RIESGO.fields.map((f) => (['project', 'origin_incident'].includes(f.name) ? { ...f, type: 'TEXT' } : f)) }
        },
        { path: '/metadata/objects/locality', body: definicion('locality', ['name']) },
        { path: '/metadata/objects/community', body: definicion('community', ['name']) },
        { path: '/objects/locality/records', body: pagina([]) },
        { path: '/objects/community/records', body: pagina([]) }
      ])
    )
    red = espiarRed()
    abrir('/projects/p1/risks/register?nuevo=1&origin_incident=n1')
    const drawer = await screen.findByRole('dialog', { name: 'Identificar riesgo' })
    expect(within(drawer).getByText('El riesgo se registra con el incidente de origen.')).toBeInTheDocument()
    expect(within(drawer).getByText(/de 1 a 365/)).toBeInTheDocument()
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'riesgo visto en el bloqueo')
    await userEvent.type(await within(drawer).findByLabelText(/^code/), 'R-002')
    await userEvent.type(within(drawer).getByLabelText(/^title/), 'Desinformación sobre el uso del agua')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('POST', '/objects/social_risk/records')).toHaveLength(1))
    const [alta] = red.a('POST', '/objects/social_risk/records')
    expect(alta.cuerpo).toMatchObject({ attributes: { code: 'R-002', project: 'p1', origin_incident: 'n1' } })
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''riesgo%20visto%20en%20el%20bloqueo")
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('quien no crea riesgos no ve «Identificar riesgo»; en el alcance global se dice el proyecto de cada uno', async () => {
    fetch = mockFetch(rutas())
    abrir('/risks/register', RELACIONISTA, RELACIONES_EN_RIESGOS)
    const tabla = await screen.findByRole('table', { name: 'Riesgos' })
    expect(within(tabla).getAllByRole('link', { name: 'PRJ-01 · Pukaqaqa' })[0]).toHaveAttribute('href', '/projects/p1/overview')
    expect(screen.queryByRole('button', { name: 'Identificar riesgo' })).not.toBeInTheDocument()
  })

  it('lee todos los riesgos del alcance, sin tope: sigue el cursor más allá de 1000 y no avisa de un recorte', async () => {
    const pagina200 = (n: number) =>
      Array.from({ length: 200 }, (_, i) => registro(`r${n}-${i}`, { ...RIESGO.attributes, code: `R-${n}-${i}` }, { state: 'identified' }))
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        path: '/objects/social_risk/records',
        responder: ({ ruta }) => {
          const n = Number(new URLSearchParams(ruta.split('?')[1]).get('after') ?? 0)
          return new Response(JSON.stringify(pagina(pagina200(n), { nextCursor: n < 5 ? String(n + 1) : null })), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    ])
    abrir('/risks/register')
    await waitFor(() => expect(red!.a('GET', '/objects/social_risk/records')).toHaveLength(6))
    expect(await screen.findByRole('radio', { name: `Vigentes, ${numeroPe(1200)}` })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/Se muestran los primeros/)).not.toBeInTheDocument()
  })

  it('mientras los riesgos cargan no dice que no hay ninguno', async () => {
    fetch = mockFetch(rutas([], []))
    abrir()
    expect(screen.queryByText('Aún no hay riesgos registrados.')).not.toBeInTheDocument()
    expect(await screen.findByText('Aún no hay riesgos registrados.')).toBeInTheDocument()
  })

  // rediseño de UX (2026-10-20): sin ningún riesgo, la matriz 5 × 5 llena de ceros tapaba el vacío, que no decía cómo seguir
  it('sin ningún riesgo en el alcance no dibuja la matriz y dice cómo registrar el primero', async () => {
    fetch = mockFetch(rutas([], []))
    abrir()
    expect(await screen.findByText('Aún no hay riesgos registrados.')).toBeInTheDocument()
    expect(screen.getByText(/Identifique el primero con «Identificar riesgo»/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Matriz probabilidad × impacto' })).not.toBeInTheDocument()
  })
})

// S10 (fase 10 de Civic Modern): la alerta por triar como aviso con «Triar alerta», la alerta temprana junto a la matriz, la
// leyenda de niveles con sus rangos, la tendencia bajo el nivel, la revisión con sus días y la acción de las reglas de alerta
describe('S10 · riesgos y alerta temprana', () => {
  const CONFIRMADA = registro(
    'w2',
    { project: 'p1', title: 'Mención en radio local sobre contaminación', detected_at: '2026-10-01T13:00:00Z', severity: 'MEDIO' },
    { state: 'confirmed' }
  )
  const conAlertas = (porTriar: unknown[], activas: unknown[]): MockRoute[] => [
    { path: /^\/objects\/early_warning\/records\?.*state=detected%2Cin_triage&/, body: pagina(porTriar as never[]) },
    { path: /^\/objects\/early_warning\/records\?.*state=detected%2Cin_triage%2Cconfirmed%2Cresponding/, body: pagina(activas as never[]) },
    { path: '/objects/social_risk/records/k1', body: RIESGO }
  ]

  it('la alerta por triar es un aviso con «Triar alerta» que abre su ficha; la alerta temprana la lista junto a la matriz', async () => {
    fetch = mockFetch(rutas(conAlertas([ALERTA], [ALERTA, CONFIRMADA])))
    abrir()
    expect(await screen.findByRole('heading', { name: 'Riesgos y alerta temprana', level: 1 })).toBeInTheDocument()
    const aviso = await screen.findByText('Alerta por triar: «Señales de conflicto: CONTEO DE SEÑALES»')
    expect(screen.getByText(/Severidad Alto\. Se activó por una regla de alerta\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Triar alerta' })).toHaveAttribute('href', '/projects/p1/risks/warnings/w1')
    expect(aviso).toBeInTheDocument()
    const alertas = screen.getByRole('region', { name: /^Alerta temprana/ })
    expect(await within(alertas).findByText('2 activas')).toBeInTheDocument()
    // la que está en triaje se tria; la confirmada se ve. las dos abren su ficha
    expect(within(alertas).getByRole('link', { name: 'Triar la alerta Señales de conflicto: CONTEO DE SEÑALES' })).toHaveAttribute(
      'href',
      '/projects/p1/risks/warnings/w1'
    )
    expect(within(alertas).getByRole('link', { name: 'Ver la alerta Mención en radio local sobre contaminación' })).toHaveAttribute(
      'href',
      '/projects/p1/risks/warnings/w2'
    )
    expect(within(alertas).getByLabelText('Severidad: Medio')).toBeInTheDocument()
    expect(within(alertas).getByRole('link', { name: 'Todas las alertas' })).toHaveAttribute('href', '/projects/p1/risks/warnings')
    expect(within(alertas).getByText(/no cambian el nivel del riesgo por sí solas/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver reglas de alerta' })).toHaveAttribute('href', '/projects/p1/risks/rules')
  })

  it('sin alertas por triar no hay aviso, y la alerta temprana lo dice', async () => {
    fetch = mockFetch(rutas(conAlertas([], [])))
    abrir()
    expect(await screen.findByText('No hay alertas activas en el proyecto.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Triar alerta' })).not.toBeInTheDocument()
  })

  it('quien no lee las alertas ve el registro sin la alerta temprana', async () => {
    fetch = mockFetch(rutas(conAlertas([ALERTA], [ALERTA])))
    abrir('/projects/p1/risks/register', GESTOR_DE_RIESGOS, { ...EQUIPO_DE_RIESGOS, objects: { ...EQUIPO_DE_RIESGOS.objects, early_warning: [] } })
    expect(await screen.findByRole('heading', { name: 'Riesgos', level: 1 })).toBeInTheDocument()
    await screen.findByRole('table', { name: 'Riesgos' })
    expect(screen.queryByRole('region', { name: /^Alerta temprana/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/por triar/)).not.toBeInTheDocument()
  })

  it('la matriz dice el rango de cada nivel con los umbrales del proyecto y marca la celda con riesgos', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const mapa = await screen.findByRole('region', { name: 'Matriz probabilidad × impacto' })
    const leyenda = within(mapa).getByRole('list', { name: 'Niveles por puntaje P × I' })
    expect(
      within(leyenda)
        .getAllByRole('listitem')
        .map((l) => l.textContent)
    ).toEqual(['Bajo 1–4', 'Medio 5–9', 'Alto 10–14', 'Crítico 15+'])
    // la celda crítica con riesgos: contorno y la cifra sobre el relleno de CRITICO; un cero, en text-muted
    const critica = within(mapa).getByRole('button', { name: 'Probabilidad 4, impacto 4: 1 riesgo, nivel Crítico' })
    expect(critica).toHaveClass('bg-sg-zone-4', 'outline-sg-text')
    expect(critica.querySelector('[data-cifra]')).toHaveClass('bg-sg-risk-critical')
    expect(within(mapa).getByRole('button', { name: 'Probabilidad 1, impacto 1: 0 riesgos, nivel Bajo' })).toHaveClass('text-sg-text-muted')
  })

  it('el registro dice cuántos y cuántos críticos, la tendencia bajo el nivel y la revisión con sus días', async () => {
    const VENCIDA = registro(
      'k9',
      { ...RIESGO.attributes, code: 'R-009', trend: 'AUMENTA', review_status: 'REVISION VENCIDA', next_review_date: '2026-10-30' },
      { state: 'mitigating' }
    )
    fetch = mockFetch(rutas([], [VENCIDA, MEDIO]))
    abrir()
    expect(await screen.findByText('2 riesgos · 1 crítico')).toBeInTheDocument()
    const fila = within(screen.getByRole('table', { name: 'Riesgos' })).getByRole('row', { name: /R-009/ })
    expect(within(fila).getByText('Aumenta')).toBeInTheDocument()
    // la revisión vencida con sus días desde hoy en Lima (2026-11-09 en las pruebas)
    expect(within(fila).getByLabelText(/^Situación de revisión: Revisión vencida · \d+ días$/)).toBeInTheDocument()
    expect(within(fila).getByText('Expectativas y beneficios')).toBeInTheDocument()
  })
})

describe('niveles de riesgo', () => {
  it('el nivel sale del puntaje con los umbrales del proyecto, o los por defecto si están vacíos', () => {
    expect([4, 5, 10, 15].map((n) => nivelDePuntaje(n))).toEqual(['BAJO', 'MEDIO', 'ALTO', 'CRITICO'])
    const umbrales = umbralesDe(registro('p1', { risk_medium_min_score: 4, risk_high_min_score: 9, risk_critical_min_score: null }))
    expect(umbrales).toEqual({ medio: 4, alto: 9, critico: 15 })
    expect(nivelDePuntaje(9, umbrales)).toBe('ALTO')
  })
})
