import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro, workflow } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { archivoXlsx, espiarRed, problema, type Red } from '../../test/red'
import { DEF_QUEJA, WF_CONSULTA, WF_QUEJA, WF_SOLICITUD } from '../../test/atencion'
import { DEF_RIESGO, WF_RIESGO } from '../../test/riesgos'

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  // guardar el archivo hace clic en un enlace blob:, y jsdom no navega («Not implemented: navigation»)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const rutas = [
  {
    path: '/objects/project/records',
    body: pagina([registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }), registro('p2', { code: 'PRJ-02', name: 'Wayra Norte' })])
  },
  { path: '/objects/project/records/p1', body: registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'active' }) },
  { path: '/objects/project/records/p2', body: registro('p2', { code: 'PRJ-02', name: 'Wayra Norte' }, { state: 'active' }) },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/project_assignment/records', body: pagina([registro('a', { project: 'p1', active: true, member_user_id: 'u-smg' })]) },
  {
    path: '/objects/export_log/records',
    body: pagina([
      registro('x1', {
        exported_at: '2026-10-06T15:00:00Z',
        exporter_user_email: 'shm@sgspe.test',
        object_name: 'stakeholder',
        disclosure_level: 'INTERNO',
        row_count: 42,
        project: 'p1'
      })
    ])
  }
]

describe('S49 · exportación del registro de grupos de interés', () => {
  // revisión de UX, etapa 7: Reportes en tres vistas, cada una con su pestaña; sin permiso para una, su pestaña no está
  it('ofrece Entregables, Exportaciones e Historial como pestañas, y sin leer el historial no ofrece la suya', async () => {
    fetch = abrirPortal(
      '/projects/p1/reports',
      GERENCIA_SOCIAL,
      permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'], deliverable: ['READ'] }),
      [...rutas, { path: '/objects/deliverable/records', body: pagina([]) }]
    )
    const pestanas = await screen.findByRole('tablist', { name: 'Reportes' })
    expect(
      within(pestanas)
        .getAllByRole('tab')
        .map((p) => p.textContent)
    ).toEqual(['Entregables', 'Exportaciones', 'Historial'])
    expect(within(pestanas).getByRole('tab', { name: 'Entregables' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(within(pestanas).getByRole('tab', { name: 'Exportaciones' }))
    expect(await screen.findByRole('region', { name: 'Registro de grupos de interés' })).toBeInTheDocument()
  })

  it('una salida EXTERNO exige la lista de verificación y viaja con el nivel y los filtros', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed([{ method: 'POST', path: '/sgspe/exports/stakeholder-register', responder: () => archivoXlsx('registro.xlsx') }])
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Nivel de divulgación' }), 'EXTERNO')
    await userEvent.click(screen.getByRole('button', { name: 'Exportar XLSX' }))
    expect(await screen.findByText('Confirme la lista de verificación para una salida fuera de la organización')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(0)
    await userEvent.click(screen.getByRole('checkbox', { name: /Revisé que el archivo puede salir/ }))
    // el registro de exportaciones ya se leyó una vez; tras exportar se vuelve a leer para mostrar la nueva fila
    await waitFor(() => expect(red!.a('GET', '/objects/export_log/records').length).toBeGreaterThan(0))
    const lecturas = red.a('GET', '/objects/export_log/records').length
    await userEvent.click(screen.getByRole('button', { name: 'Exportar XLSX' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(1))
    await waitFor(() => expect(red!.a('GET', '/objects/export_log/records').length).toBeGreaterThan(lecturas))
    expect(red.a('POST', '/sgspe/exports/stakeholder-register')[0].cuerpo).toEqual({
      filters: { project: ['p1'] },
      disclosureLevel: 'EXTERNO',
      checklistConfirmed: true
    })
    expect(URL.createObjectURL).toHaveBeenCalled()
    // quien lee export_log (la gerencia social, la auditoría) ve el registro del proyecto, con quién exportó, en su vista
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(await screen.findByRole('cell', { name: '42' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'shm@sgspe.test' })).toBeInTheDocument()
    expect(red.a('GET', '/objects/export_log/records').at(-1)?.ruta).toContain('project=p1')
  })

  it('con EXPORT pero sin leer export_log (como STAKEHOLDER_MANAGER) exporta y no ve el registro de exportaciones', async () => {
    fetch = abrirPortal('/projects/p1/reports', RELACIONISTA, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['CREATE'] }), rutas)
    red = espiarRed([{ method: 'POST', path: '/sgspe/exports/stakeholder-register', responder: () => archivoXlsx('registro.xlsx') }])
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar XLSX' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(1))
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Registro de exportaciones' })).not.toBeInTheDocument()
    expect(red.a('GET', '/objects/export_log/records')).toHaveLength(0)
    // ni su definición: export_log es un objeto reservado que esta cuenta no lee
    expect(red.a('GET', '/metadata/objects/export_log')).toHaveLength(0)
  })

  it('PUBLICO dice la marca «reservado» y advierte no publicar dos salidas que difieran en pocas personas (ASM-088)', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Nivel de divulgación' }), 'EXTERNO')
    expect(screen.getByText(/código seudónimo de 12 dígitos/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Nivel de divulgación' }), 'PUBLICO')
    expect(screen.getByText(/sale como «reservado»/)).toBeInTheDocument()
    expect(screen.getByText(/No publique dos salidas públicas que difieran en pocas personas/)).toBeInTheDocument()
    expect(screen.queryByText(/12 dígitos hexadecimales/)).not.toBeInTheDocument()
  })

  it.each([
    [403, 'NOT_ASSIGNED', 'filters.project', 'No tiene una asignación vigente a este proyecto: elija «Todos mis proyectos» o pida la asignación.'],
    [400, 'TOO_MANY_RECORDS', 'filters.project', 'Hay demasiados grupos de interés para un solo archivo: elija un proyecto o acote los filtros.'],
    [
      409,
      'CATALOGUE_UNAVAILABLE',
      'stance',
      'Falta el catálogo de uno de los datos: la salida pública necesita todos sus valores. Pida a la administración que lo cargue.'
    ]
  ])('un %i %s dice su texto, no el código', async (status, codigo, campo, texto) => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed([
      { method: 'POST', path: '/sgspe/exports/stakeholder-register', responder: () => problema(status, 'detalle', [{ field: campo, message: codigo }]) }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar XLSX' }))
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(codigo)).not.toBeInTheDocument()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('pide el XLSX o el problema, y cada exportación de la sesión lleva su propia Idempotency-Key', async () => {
    fetch = abrirPortal('/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed([{ method: 'POST', path: '/sgspe/exports/stakeholder-register', responder: () => archivoXlsx('registro.xlsx') }])
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar XLSX' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar XLSX' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Exportar XLSX' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(2))
    const [primera, segunda] = red.a('POST', '/sgspe/exports/stakeholder-register')
    // sin proyecto elegido, la lista vacía es «mis proyectos» (api.md §4.13)
    expect(primera.cuerpo).toEqual({ filters: { project: [] }, disclosureLevel: 'INTERNO', checklistConfirmed: false })
    expect(primera.cabeceras.get('Accept')).toContain('application/problem+json')
    expect(primera.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(segunda.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(segunda.cabeceras.get('Idempotency-Key')).not.toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  it('cambiar el nivel pide de nuevo la lista de verificación', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed()
    const nivel = await screen.findByRole('combobox', { name: 'Nivel de divulgación' })
    await userEvent.selectOptions(nivel, 'EXTERNO')
    await userEvent.click(screen.getByRole('checkbox', { name: /Revisé que el archivo puede salir/ }))
    await userEvent.selectOptions(nivel, 'PUBLICO')
    expect(screen.getByRole('checkbox', { name: /Revisé que el archivo puede salir/ })).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Exportar XLSX' }))
    expect(await screen.findByText('Confirme la lista de verificación para una salida fuera de la organización')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(0)
  })

  it('mientras el registro de exportaciones carga lo dice, y sin exportaciones no dibuja una tabla de ceros', async () => {
    // el historial es su propia vista (revisión de UX, etapa 7)
    fetch = abrirPortal(
      '/projects/p1/reports?tab=historial',
      GERENCIA_SOCIAL,
      permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }),
      rutas
    )
    let liberar: () => void = () => undefined
    const espera = new Promise<void>((resolver) => (liberar = resolver))
    red = espiarRed([
      {
        path: '/objects/export_log/records',
        responder: async () => {
          await espera
          return new Response(JSON.stringify(pagina([])), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
      }
    ])
    const region = await screen.findByRole('region', { name: 'Registro de exportaciones' })
    expect(within(region).getByRole('status')).toBeInTheDocument()
    expect(within(region).queryByRole('table')).not.toBeInTheDocument()
    liberar()
    expect(await within(region).findByText('Todavía no hay exportaciones registradas.')).toBeInTheDocument()
  })

  it('un 403 al leer el registro de exportaciones dice «No disponible», no una tabla vacía', async () => {
    // el historial es su propia vista (revisión de UX, etapa 7)
    fetch = abrirPortal(
      '/projects/p1/reports?tab=historial',
      GERENCIA_SOCIAL,
      permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }),
      rutas
    )
    red = espiarRed([{ path: '/objects/export_log/records', responder: () => problema(403, 'Sin permiso') }])
    const region = await screen.findByRole('region', { name: 'Registro de exportaciones' })
    expect(await within(region).findByText('No disponible')).toBeInTheDocument()
    expect(within(region).queryByRole('table')).not.toBeInTheDocument()
    // exportar sigue disponible: el registro y la exportación son permisos distintos
    await userEvent.click(screen.getByRole('tab', { name: 'Exportaciones' }))
    expect(await screen.findByRole('button', { name: 'Exportar XLSX' })).toBeEnabled()
  })

  it('otro error al leer el registro de exportaciones ofrece reintentar y no dibuja una tabla vacía', async () => {
    // el historial es su propia vista (revisión de UX, etapa 7)
    fetch = abrirPortal(
      '/projects/p1/reports?tab=historial',
      GERENCIA_SOCIAL,
      permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }),
      rutas
    )
    red = espiarRed([{ path: '/objects/export_log/records', responder: () => problema(422, 'Consulta no válida') }])
    const region = await screen.findByRole('region', { name: 'Registro de exportaciones' })
    expect(await within(region).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(within(region).queryByRole('table')).not.toBeInTheDocument()
  })

  it('un 403 de la exportación sin código dice su texto y la correlación, no un código', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed([{ method: 'POST', path: '/sgspe/exports/stakeholder-register', responder: () => problema(403, 'Forbidden', [], 'corr-77') }])
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar XLSX' }))
    expect(await screen.findByText('Su cuenta no tiene permiso para esta acción. Pídalo a la administración del proyecto.')).toBeInTheDocument()
    expect(screen.getByText(/corr-77/)).toBeInTheDocument()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  // revisión de UX, etapa 7: las exportaciones usan el alcance de la barra superior, sin un selector propio
  it('en la URL de un proyecto exporta ese proyecto y lo dice; el historial sigue al mismo proyecto', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed([{ method: 'POST', path: '/sgspe/exports/stakeholder-register', responder: () => archivoXlsx('registro.xlsx') }])
    const seccion = await screen.findByRole('region', { name: 'Registro de grupos de interés' })
    expect(await within(seccion).findByText('Proyecto: PRJ-01 · Pukaqaqa, el que eligió en el selector.')).toBeInTheDocument()
    expect(within(seccion).queryByRole('combobox', { name: 'Proyecto' })).not.toBeInTheDocument()
    await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar XLSX' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(1))
    expect(red.a('POST', '/sgspe/exports/stakeholder-register')[0].cuerpo).toMatchObject({ filters: { project: ['p1'] } })
    expect(red.a('GET', '/objects/export_log/records').at(-1)?.ruta).toContain('project=p1')
  })

  // con READ_ALL_PROJECTS el servidor no pide asignación para un proyecto (spec 4.4 §3.7): fuera de un proyecto, el alcance es
  // «Todos los proyectos» y viaja la lista vacía
  it('con la acción de leer todos los proyectos, fuera de un proyecto el alcance es «Todos los proyectos» y manda la lista vacía', async () => {
    fetch = abrirPortal(
      '/reports',
      GERENCIA_SOCIAL,
      permisos({ project: ['READ', 'READ_ALL_PROJECTS'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }),
      rutas
    )
    red = espiarRed([{ method: 'POST', path: '/sgspe/exports/stakeholder-register', responder: () => archivoXlsx('registro.xlsx') }])
    const seccion = await screen.findByRole('region', { name: 'Registro de grupos de interés' })
    expect(within(seccion).getByText('Todos los proyectos: elija uno en el selector para acotar.')).toBeInTheDocument()
    await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar XLSX' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(1))
    expect(red.a('POST', '/sgspe/exports/stakeholder-register')[0].cuerpo).toMatchObject({ filters: { project: [] } })
  })

  it('sin la acción, el alcance de la exportación es «Todos sus proyectos»', async () => {
    fetch = abrirPortal('/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    const seccion = await screen.findByRole('region', { name: 'Registro de grupos de interés' })
    expect(within(seccion).getByText('Todos sus proyectos: elija uno en el selector para acotar.')).toBeInTheDocument()
  })

  it('si la lista de proyectos falla, el alcance rotula el proyecto de la URL sin mostrar su identificador', async () => {
    const id = '0b6f1c3e-5d2a-4c1e-9a77-3f8e2d1b4a90'
    fetch = abrirPortal(`/projects/${id}/reports`, GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), [
      ...rutas,
      { path: `/objects/project/records/${id}`, body: registro(id, { code: 'PRJ-09', name: 'Sin lista' }, { state: 'active' }) }
    ])
    red = espiarRed([{ path: '/objects/project/records', responder: () => problema(422, 'Consulta no válida') }])
    const seccion = await screen.findByRole('region', { name: 'Registro de grupos de interés' })
    expect(await within(seccion).findByText('Proyecto: Proyecto de la página, el que eligió en el selector.')).toBeInTheDocument()
    expect(within(seccion).queryByText(new RegExp(id))).not.toBeInTheDocument()
  })

  it('sin la acción EXPORT, quien lee el historial lo ve y lee que no puede exportar', async () => {
    fetch = abrirPortal('/reports', RELACIONISTA, permisos({ project: ['READ'], stakeholder: ['READ'], export_log: ['READ'] }), rutas)
    expect(await screen.findByText('Su cuenta no tiene permiso para exportar grupos de interés.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar XLSX' })).not.toBeInTheDocument()
  })

  it('sin EXPORT ni el historial, Reportes no se ofrece y su ruta lo dice (revisión final, M7)', async () => {
    fetch = abrirPortal('/reports', RELACIONISTA, permisos({ project: ['READ'], stakeholder: ['READ'] }), rutas)
    expect(await screen.findByRole('heading', { name: 'No puede abrir «Reportes»' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Reportes' })).not.toBeInTheDocument()
  })

  describe('F3 · matriz de compromisos', () => {
    const conMatriz = permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], commitment: ['READ', 'EXPORT'], export_log: ['READ'] })
    const rutasDeLaMatriz = [
      ...rutas,
      {
        path: '/objects/commitment/workflow',
        body: workflow('commitment', [
          ['in_progress', 'En ejecución'],
          ['blocked', 'Bloqueado']
        ])
      },
      { path: '/objects/exploration_campaign/records', body: pagina([registro('camp1', { project: 'p1', name: 'Campaña 2026' })]) }
    ]

    it('exporta con el proyecto, la campaña, los estados y el nivel, con su propia clave', async () => {
      fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conMatriz, rutasDeLaMatriz)
      red = espiarRed([{ method: 'POST', path: '/sgspe/exports/commitment-matrix', responder: () => archivoXlsx('matriz.xlsx') }])
      const seccion = await screen.findByRole('region', { name: 'Matriz de compromisos' })
      await waitFor(() => expect(within(seccion).getByRole('option', { name: 'Campaña 2026' })).toBeInTheDocument())
      await userEvent.selectOptions(within(seccion).getByRole('combobox', { name: 'Campaña de exploración' }), 'camp1')
      await userEvent.click(await within(seccion).findByRole('checkbox', { name: 'Bloqueado' }))
      // la matriz imprime deadline_status solo en los pendientes (plan 3.2): la pantalla lo dice junto a los estados
      expect(within(seccion).getByText(/solo se imprime en los compromisos pendientes/)).toBeInTheDocument()
      await userEvent.selectOptions(within(seccion).getByRole('combobox', { name: 'Nivel de divulgación' }), 'EXTERNO')
      await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz' }))
      expect(await within(seccion).findByText('Confirme la lista de verificación para una salida fuera de la organización')).toBeInTheDocument()
      await userEvent.click(within(seccion).getByRole('checkbox', { name: /Revisé que la matriz puede salir/ }))
      await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz' }))
      await waitFor(() => expect(red!.a('POST', '/sgspe/exports/commitment-matrix')).toHaveLength(1))
      const [llamada] = red.a('POST', '/sgspe/exports/commitment-matrix')
      expect(llamada.cuerpo).toEqual({
        filters: { project: ['p1'], explorationCampaign: 'camp1', state: ['blocked'] },
        disclosureLevel: 'EXTERNO',
        checklistConfirmed: true
      })
      expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
      expect(llamada.cabeceras.get('Accept')).toContain('application/problem+json')
      expect(URL.createObjectURL).toHaveBeenCalled()
    })

    it('INVALID_FILTER sobre los estados dice su texto propio', async () => {
      fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conMatriz, rutasDeLaMatriz)
      red = espiarRed([
        {
          method: 'POST',
          path: '/sgspe/exports/commitment-matrix',
          responder: () => problema(400, 'x', [{ field: 'filters.state', message: 'INVALID_FILTER' }])
        }
      ])
      const seccion = await screen.findByRole('region', { name: 'Matriz de compromisos' })
      await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz' }))
      expect(await within(seccion).findByText('Uno de los estados elegidos ya no es un estado de compromiso: recargue la página.')).toBeInTheDocument()
      expect(within(seccion).queryByText('INVALID_FILTER')).not.toBeInTheDocument()
    })

    it('INVALID_FILTER sobre otro filtro no culpa a los estados, y cambiar un filtro quita el error', async () => {
      fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conMatriz, rutasDeLaMatriz)
      red = espiarRed([
        {
          method: 'POST',
          path: '/sgspe/exports/commitment-matrix',
          responder: () => problema(400, 'x', [{ field: 'filters.explorationCampaign', message: 'INVALID_FILTER' }])
        }
      ])
      const seccion = await screen.findByRole('region', { name: 'Matriz de compromisos' })
      await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz' }))
      expect(await within(seccion).findByText('Uno de los filtros no es válido.')).toBeInTheDocument()
      expect(within(seccion).queryByText(/estados elegidos/)).not.toBeInTheDocument()
      await userEvent.click(await within(seccion).findByRole('checkbox', { name: 'Bloqueado' }))
      expect(within(seccion).queryByText('Uno de los filtros no es válido.')).not.toBeInTheDocument()
    })

    it('TOO_MANY_RECORDS dice que filtrar no siempre basta', async () => {
      fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conMatriz, rutasDeLaMatriz)
      red = espiarRed([
        {
          method: 'POST',
          path: '/sgspe/exports/commitment-matrix',
          responder: () => problema(400, 'x', [{ field: 'filters.project', message: 'TOO_MANY_RECORDS' }])
        }
      ])
      const seccion = await screen.findByRole('region', { name: 'Matriz de compromisos' })
      await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz' }))
      expect(await within(seccion).findByText(/más de 200 solicitantes/)).toBeInTheDocument()
      expect(within(seccion).queryByText('TOO_MANY_RECORDS')).not.toBeInTheDocument()
    })

    it('la campaña elegida no pasa a otro proyecto cuando el shell cambia de proyecto', async () => {
      fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conMatriz, rutasDeLaMatriz)
      red = espiarRed([{ method: 'POST', path: '/sgspe/exports/commitment-matrix', responder: () => archivoXlsx('matriz.xlsx') }])
      const seccion = await screen.findByRole('region', { name: 'Matriz de compromisos' })
      await waitFor(() => expect(within(seccion).getByRole('option', { name: 'Campaña 2026' })).toBeInTheDocument())
      await userEvent.selectOptions(within(seccion).getByRole('combobox', { name: 'Campaña de exploración' }), 'camp1')
      // el conmutador del shell (el primer combobox «Proyecto») cambia el proyecto de la URL
      await userEvent.click(screen.getAllByRole('combobox', { name: 'Proyecto' })[0])
      await userEvent.click(await screen.findByRole('option', { name: 'PRJ-02 · Wayra Norte' }))
      await waitFor(() => expect(window.location.pathname).toBe('/projects/p2/reports'))
      const nueva = screen.getByRole('region', { name: 'Matriz de compromisos' })
      // el alcance es el de la barra superior (revisión de UX, etapa 7)
      expect(await within(nueva).findByText('Proyecto: PRJ-02 · Wayra Norte, el que eligió en el selector.')).toBeInTheDocument()
      expect(within(nueva).getByRole('combobox', { name: 'Campaña de exploración' })).toHaveValue('')
      await userEvent.click(within(nueva).getByRole('button', { name: 'Exportar la matriz' }))
      await waitFor(() => expect(red!.a('POST', '/sgspe/exports/commitment-matrix')).toHaveLength(1))
      const [llamada] = red.a('POST', '/sgspe/exports/commitment-matrix')
      expect(llamada.cuerpo).toEqual({ filters: { project: ['p2'], state: [] }, disclosureLevel: 'INTERNO', checklistConfirmed: false })
    })

    it('con «Todos sus proyectos» no ofrece campaña y manda la lista vacía', async () => {
      fetch = abrirPortal('/reports', GERENCIA_SOCIAL, conMatriz, rutasDeLaMatriz)
      red = espiarRed([{ method: 'POST', path: '/sgspe/exports/commitment-matrix', responder: () => archivoXlsx('matriz.xlsx') }])
      const seccion = await screen.findByRole('region', { name: 'Matriz de compromisos' })
      expect(within(seccion).getByText('Todos sus proyectos: elija uno en el selector para acotar.')).toBeInTheDocument()
      expect(within(seccion).queryByRole('combobox', { name: 'Campaña de exploración' })).not.toBeInTheDocument()
      await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz' }))
      await waitFor(() => expect(red!.a('POST', '/sgspe/exports/commitment-matrix')).toHaveLength(1))
      expect(red.a('POST', '/sgspe/exports/commitment-matrix')[0].cuerpo).toEqual({
        filters: { project: [], state: [] },
        disclosureLevel: 'INTERNO',
        checklistConfirmed: false
      })
    })

    it('PUBLICO describe la matriz, no el registro de grupos de interés, y exige la lista de verificación', async () => {
      fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conMatriz, rutasDeLaMatriz)
      red = espiarRed([{ method: 'POST', path: '/sgspe/exports/commitment-matrix', responder: () => archivoXlsx('matriz.xlsx') }])
      const seccion = await screen.findByRole('region', { name: 'Matriz de compromisos' })
      const nivel = within(seccion).getByRole('combobox', { name: 'Nivel de divulgación' })
      expect(within(nivel).getByRole('option', { name: /Público · Público: solo conteos por estado y tema y por tipo de recurso/ })).toBeInTheDocument()
      expect(within(nivel).queryByRole('option', { name: /grupo de influencia/ })).not.toBeInTheDocument()
      await userEvent.selectOptions(nivel, 'PUBLICO')
      expect(within(seccion).getByText(/«Por estado y tema» y «Por tipo de recurso»/)).toBeInTheDocument()
      expect(within(seccion).getByText(/No publique dos salidas públicas que difieran en pocas personas/)).toBeInTheDocument()
      expect(within(seccion).queryByText(/ASM-088/)).not.toBeInTheDocument()
      await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz' }))
      expect(await within(seccion).findByText('Confirme la lista de verificación para una salida fuera de la organización')).toBeInTheDocument()
      expect(red.a('POST', '/sgspe/exports/commitment-matrix')).toHaveLength(0)
      await userEvent.click(within(seccion).getByRole('checkbox', { name: /Revisé que la matriz puede salir/ }))
      await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz' }))
      await waitFor(() => expect(red!.a('POST', '/sgspe/exports/commitment-matrix')).toHaveLength(1))
      expect(red.a('POST', '/sgspe/exports/commitment-matrix')[0].cuerpo).toMatchObject({ disclosureLevel: 'PUBLICO', checklistConfirmed: true })
    })

    it('mientras los estados cargan lo dice, y si su lectura falla ofrece reintentar', async () => {
      fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conMatriz, rutasDeLaMatriz)
      let liberar: () => void = () => undefined
      const espera = new Promise<void>((resolver) => (liberar = resolver))
      red = espiarRed([
        {
          path: '/objects/commitment/workflow',
          responder: async () => {
            await espera
            return problema(422, 'Consulta no válida')
          }
        }
      ])
      const seccion = await screen.findByRole('region', { name: 'Matriz de compromisos' })
      const estados = within(seccion).getByRole('group', { name: 'Estados' })
      expect(within(estados).getByRole('status')).toBeInTheDocument()
      liberar()
      expect(await within(estados).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
      expect(within(estados).queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('sin EXPORT sobre compromisos no se ofrece la matriz', async () => {
      fetch = abrirPortal(
        '/projects/p1/reports',
        GERENCIA_SOCIAL,
        permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], commitment: ['READ'], export_log: ['READ'] }),
        rutasDeLaMatriz
      )
      expect(await screen.findByRole('region', { name: 'Registro de grupos de interés' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Matriz de compromisos' })).not.toBeInTheDocument()
    })
  })
})

// F4 (api.md §4.13, deliverables.md §10): el registro de quejas, consultas y solicitudes con EXPORT sobre los tres objetos y la
// matriz de riesgos con EXPORT sobre social_risk, cada uno con sus filtros, lo que lleva cada nivel y su propia clave
describe('F4 · registro de quejas, consultas y solicitudes', () => {
  const qcs = ['READ', 'EXPORT']
  const conRegistro = (extra: Record<string, string[]> = {}) =>
    permisos({ project: ['READ'], export_log: ['READ'], grievance: qcs, inquiry: qcs, stakeholder_request: qcs, ...extra })
  const rutasDeAtencion = [
    ...rutas,
    { path: '/objects/grievance/workflow', body: WF_QUEJA },
    { path: '/objects/inquiry/workflow', body: WF_CONSULTA },
    { path: '/objects/stakeholder_request/workflow', body: WF_SOLICITUD },
    { path: '/metadata/objects/grievance', body: DEF_QUEJA }
  ]
  const exportar = () => espiarRed([{ method: 'POST', path: '/sgspe/exports/attention-register', responder: () => archivoXlsx('registro-de-qcs.xlsx') }])

  it('un atajo de periodo llena «Recibidas desde» y «Recibidas hasta» con el día de Lima', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T15:00:00Z'))
    try {
      fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conRegistro(), rutasDeAtencion)
      const seccion = await screen.findByRole('region', { name: 'Registro de quejas, consultas y solicitudes' })
      const atajos = within(seccion).getByRole('group', { name: 'Atajos de periodo' })
      await userEvent.click(within(atajos).getByRole('button', { name: 'Este año' }))
      expect(within(seccion).getByLabelText('Recibidas desde')).toHaveValue('01/01/2026')
      expect(within(seccion).getByLabelText('Recibidas hasta')).toHaveValue('23/10/2026')
      expect(within(atajos).getByRole('button', { name: 'Este año' })).toHaveAttribute('aria-pressed', 'true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('exporta con el proyecto, el periodo, los tipos, los estados, el canal, la categoría y las reclasificadas, con su propia clave', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conRegistro(), rutasDeAtencion)
    red = exportar()
    const seccion = await screen.findByRole('region', { name: 'Registro de quejas, consultas y solicitudes' })
    await userEvent.type(within(seccion).getByLabelText('Recibidas desde'), '01/09/2026')
    await userEvent.type(within(seccion).getByLabelText('Recibidas hasta'), '30/09/2026')
    await userEvent.click(within(seccion).getByRole('checkbox', { name: 'Quejas' }))
    await userEvent.click(within(seccion).getByRole('checkbox', { name: 'Consultas' }))
    // «Recibida» existe en los tres workflows: se manda una vez
    await userEvent.click(await within(seccion).findByRole('checkbox', { name: 'Queja · Recibida' }))
    await userEvent.click(within(seccion).getByRole('checkbox', { name: 'Consulta · Recibida' }))
    await userEvent.click(within(seccion).getByRole('checkbox', { name: 'Queja · En atención' }))
    await userEvent.selectOptions(within(seccion).getByRole('combobox', { name: 'Canal' }), 'REUNION')
    await userEvent.selectOptions(within(seccion).getByRole('combobox', { name: 'Categoría' }), 'EMPLEO')
    await userEvent.click(within(seccion).getByRole('checkbox', { name: /registros originales que se reclasificaron/ }))
    await userEvent.selectOptions(within(seccion).getByRole('combobox', { name: 'Nivel de divulgación' }), 'EXTERNO')
    expect(within(seccion).getByText(/Ninguna QCS confidencial sale en este nivel/)).toBeInTheDocument()
    await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar el registro' }))
    expect(await within(seccion).findByText('Confirme la lista de verificación para una salida fuera de la organización')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/exports/attention-register')).toHaveLength(0)
    await userEvent.click(within(seccion).getByRole('checkbox', { name: /Revisé que el registro puede salir/ }))
    await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar el registro' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/attention-register')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/exports/attention-register')
    expect(llamada.cuerpo).toEqual({
      filters: {
        project: ['p1'],
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        type: ['grievance', 'inquiry'],
        state: ['received', 'in_action'],
        channel: 'REUNION',
        category: 'EMPLEO',
        includeReclassified: true
      },
      disclosureLevel: 'EXTERNO',
      checklistConfirmed: true
    })
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('sin filtros manda las listas vacías y las reclasificadas en falso', async () => {
    fetch = abrirPortal('/reports', GERENCIA_SOCIAL, conRegistro(), rutasDeAtencion)
    red = exportar()
    const seccion = await screen.findByRole('region', { name: 'Registro de quejas, consultas y solicitudes' })
    await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar el registro' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/attention-register')).toHaveLength(1))
    expect(red.a('POST', '/sgspe/exports/attention-register')[0].cuerpo).toEqual({
      filters: { project: [], type: [], state: [], includeReclassified: false },
      disclosureLevel: 'INTERNO',
      checklistConfirmed: false
    })
  })

  it('PUBLICO dice si el conteo incluye las confidenciales según lo que la cuenta lee', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conRegistro(), rutasDeAtencion)
    const seccion = await screen.findByRole('region', { name: 'Registro de quejas, consultas y solicitudes' })
    await userEvent.selectOptions(within(seccion).getByRole('combobox', { name: 'Nivel de divulgación' }), 'PUBLICO')
    expect(within(seccion).getByText(/solo incluye las QCS confidenciales que su cuenta puede leer/)).toBeInTheDocument()
    expect(within(seccion).getByText(/«reservado»/)).toBeInTheDocument()
  })

  it('con la lectura de todas las confidenciales, PUBLICO dice que el conteo las incluye', async () => {
    const todas = ['READ', 'EXPORT', 'READ_CONFIDENTIAL']
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conRegistro({ grievance: todas, inquiry: todas, stakeholder_request: todas }), rutasDeAtencion)
    const seccion = await screen.findByRole('region', { name: 'Registro de quejas, consultas y solicitudes' })
    await userEvent.selectOptions(within(seccion).getByRole('combobox', { name: 'Nivel de divulgación' }), 'PUBLICO')
    expect(within(seccion).getByText(/el conteo las incluye/)).toBeInTheDocument()
  })

  it.each([
    ['filters.state', 'ya no es un estado de queja, consulta o solicitud'],
    ['filters.periodEnd', 'la fecha final no puede ser anterior a la inicial'],
    ['filters.channel', 'Uno de los filtros no es válido.']
  ])('INVALID_FILTER sobre %s dice su texto', async (campo, texto) => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conRegistro(), rutasDeAtencion)
    red = espiarRed([
      { method: 'POST', path: '/sgspe/exports/attention-register', responder: () => problema(400, 'filtro', [{ field: campo, message: 'INVALID_FILTER' }]) }
    ])
    const seccion = await screen.findByRole('region', { name: 'Registro de quejas, consultas y solicitudes' })
    await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar el registro' }))
    expect(await within(seccion).findByText(new RegExp(texto.replace('.', '\\.')))).toBeInTheDocument()
  })

  it('sin EXPORT sobre alguno de los tres objetos no se ofrece: un registro con un tipo de menos engañaría', async () => {
    fetch = abrirPortal(
      '/projects/p1/reports',
      GERENCIA_SOCIAL,
      permisos({ project: ['READ'], export_log: ['READ'], grievance: qcs, inquiry: qcs, stakeholder_request: ['READ'] }),
      rutasDeAtencion
    )
    expect(await screen.findByRole('heading', { name: 'Reportes', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Registro de quejas, consultas y solicitudes' })).not.toBeInTheDocument()
  })
})

describe('F4 · matriz de riesgos', () => {
  const conMatriz = permisos({ project: ['READ'], export_log: ['READ'], social_risk: ['READ', 'EXPORT'] })
  const rutasDeRiesgos = [...rutas, { path: '/objects/social_risk/workflow', body: WF_RIESGO }, { path: '/metadata/objects/social_risk', body: DEF_RIESGO }]

  it('exporta con los estados, las categorías, los niveles y los cerrados; PUBLICO exige la lista de verificación', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conMatriz, rutasDeRiesgos)
    red = espiarRed([{ method: 'POST', path: '/sgspe/exports/risk-register', responder: () => archivoXlsx('matriz-de-riesgos.xlsx') }])
    const seccion = await screen.findByRole('region', { name: 'Matriz de riesgos' })
    await userEvent.click(await within(seccion).findByRole('checkbox', { name: 'En mitigación' }))
    await userEvent.click(await within(seccion).findByRole('checkbox', { name: 'AMBIENTAL' }))
    await userEvent.click(within(seccion).getByRole('checkbox', { name: 'CRITICO' }))
    await userEvent.click(within(seccion).getByRole('checkbox', { name: /Incluir los riesgos cerrados/ }))
    await userEvent.selectOptions(within(seccion).getByRole('combobox', { name: 'Nivel de divulgación' }), 'PUBLICO')
    expect(within(seccion).getByText(/Cuenta solo los riesgos activos/)).toBeInTheDocument()
    await userEvent.click(within(seccion).getByRole('checkbox', { name: /Revisé que la matriz de riesgos puede salir/ }))
    await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz de riesgos' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/risk-register')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/exports/risk-register')
    expect(llamada.cuerpo).toEqual({
      filters: { project: ['p1'], state: ['mitigating'], category: ['AMBIENTAL'], riskLevel: ['CRITICO'], includeClosed: true },
      disclosureLevel: 'PUBLICO',
      checklistConfirmed: true
    })
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('TOO_MANY_RECORDS dice su texto propio', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, conMatriz, rutasDeRiesgos)
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/exports/risk-register',
        responder: () => problema(400, 'tope', [{ field: 'filters.project', message: 'TOO_MANY_RECORDS' }])
      }
    ])
    const seccion = await screen.findByRole('region', { name: 'Matriz de riesgos' })
    await userEvent.click(within(seccion).getByRole('button', { name: 'Exportar la matriz de riesgos' }))
    expect(await within(seccion).findByText(/La matriz de riesgos no cabe en un solo archivo/)).toBeInTheDocument()
  })

  it('sin EXPORT sobre riesgos no se ofrece la matriz de riesgos', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], export_log: ['READ'], social_risk: ['READ'] }), rutasDeRiesgos)
    expect(await screen.findByRole('heading', { name: 'Reportes', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Matriz de riesgos' })).not.toBeInTheDocument()
  })
})

describe('S49 · las tres salidas a la vez', () => {
  it('la matriz de compromisos, el registro de QCS y la matriz de riesgos no comparten la key del proyecto (humo F4, D2)', async () => {
    const errores = vi.spyOn(console, 'error')
    const qcs = ['READ', 'EXPORT']
    fetch = abrirPortal(
      '/projects/p1/reports',
      GERENCIA_SOCIAL,
      permisos({
        project: ['READ'],
        export_log: ['READ'],
        commitment: ['READ', 'EXPORT'],
        grievance: qcs,
        inquiry: qcs,
        stakeholder_request: qcs,
        social_risk: ['READ', 'EXPORT']
      }),
      [
        ...rutas,
        { path: '/objects/grievance/workflow', body: WF_QUEJA },
        { path: '/objects/inquiry/workflow', body: WF_CONSULTA },
        { path: '/objects/stakeholder_request/workflow', body: WF_SOLICITUD },
        { path: '/metadata/objects/grievance', body: DEF_QUEJA },
        { path: '/objects/social_risk/workflow', body: WF_RIESGO },
        { path: '/metadata/objects/social_risk', body: DEF_RIESGO }
      ]
    )
    expect(await screen.findByRole('region', { name: 'Matriz de riesgos' })).toBeInTheDocument()
    const claveRepetida = errores.mock.calls.filter((c) => c.some((a) => typeof a === 'string' && a.includes('same key')))
    errores.mockRestore()
    expect(claveRepetida).toEqual([])
  })
})
