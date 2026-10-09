import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro, workflow } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { archivoXlsx, espiarRed, problema, type Red } from '../../test/red'

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const rutas = [
  { path: '/objects/project/records', body: pagina([registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' })]) },
  { path: '/objects/project/records/p1', body: registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'active' }) },
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
  it('una salida EXTERNO exige la lista de verificación y viaja con el nivel y los filtros', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed([{ method: 'POST', path: '/sgspe/exports/stakeholder-register', responder: () => archivoXlsx('registro.xlsx') }])
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Nivel de divulgación' }), 'EXTERNO')
    await userEvent.click(screen.getByRole('button', { name: 'Exportar XLSX' }))
    expect(await screen.findByText('Confirme la lista de verificación para una salida fuera de la organización')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(0)
    await userEvent.click(screen.getByRole('checkbox', { name: /Revisé que el archivo puede salir/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Exportar XLSX' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/exports/stakeholder-register')).toHaveLength(1))
    expect(red.a('POST', '/sgspe/exports/stakeholder-register')[0].cuerpo).toEqual({
      filters: { project: ['p1'] },
      disclosureLevel: 'EXTERNO',
      checklistConfirmed: true
    })
    expect(URL.createObjectURL).toHaveBeenCalled()
    // quien lee export_log (la gerencia social, la auditoría) ve el registro del proyecto, con quién exportó
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
  })

  it('PUBLICO dice la marca «reservado» y advierte no publicar dos salidas que difieran en pocas personas (ASM-088)', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Nivel de divulgación' }), 'EXTERNO')
    expect(screen.getByText(/código GI- con 12 dígitos hexadecimales/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Nivel de divulgación' }), 'PUBLICO')
    expect(screen.getByText(/sale como «reservado»/)).toBeInTheDocument()
    expect(screen.getByText(/No publique dos salidas PUBLICO que difieran en pocas personas/)).toBeInTheDocument()
    expect(screen.queryByText(/12 dígitos hexadecimales/)).not.toBeInTheDocument()
  })

  it.each([
    [403, 'NOT_ASSIGNED', 'filters.project', 'No tiene una asignación vigente a este proyecto: elija «Todos mis proyectos» o pida la asignación.'],
    [400, 'TOO_MANY_RECORDS', 'filters.project', 'Hay demasiados grupos de interés para un solo archivo: elija un proyecto o acote los filtros.'],
    [
      409,
      'CATALOGUE_UNAVAILABLE',
      'stance',
      'Falta el catálogo de stance: la salida pública necesita todos sus valores. Pida a la administración que lo cargue.'
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
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
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
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed([{ path: '/objects/export_log/records', responder: () => problema(403, 'Sin permiso') }])
    const region = await screen.findByRole('region', { name: 'Registro de exportaciones' })
    expect(await within(region).findByText('No disponible')).toBeInTheDocument()
    expect(within(region).queryByRole('table')).not.toBeInTheDocument()
    // exportar sigue disponible: el registro y la exportación son permisos distintos
    expect(screen.getByRole('button', { name: 'Exportar XLSX' })).toBeEnabled()
  })

  it('otro error al leer el registro de exportaciones ofrece reintentar y no dibuja una tabla vacía', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed([{ path: '/objects/export_log/records', responder: () => problema(422, 'Consulta no válida') }])
    const region = await screen.findByRole('region', { name: 'Registro de exportaciones' })
    expect(await within(region).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(within(region).queryByRole('table')).not.toBeInTheDocument()
  })

  it('un 403 de la exportación sin código dice su texto y la correlación, no un código', async () => {
    fetch = abrirPortal('/projects/p1/reports', GERENCIA_SOCIAL, permisos({ project: ['READ'], stakeholder: ['READ', 'EXPORT'], export_log: ['READ'] }), rutas)
    red = espiarRed([{ method: 'POST', path: '/sgspe/exports/stakeholder-register', responder: () => problema(403, 'Forbidden', [], 'corr-77') }])
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar XLSX' }))
    expect(await screen.findByText(/corr-77/)).toBeInTheDocument()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('sin la acción EXPORT lo dice y no ofrece exportar', async () => {
    fetch = abrirPortal('/reports', RELACIONISTA, permisos({ project: ['READ'], stakeholder: ['READ'] }), rutas)
    expect(await screen.findByText('Su cuenta no tiene la acción EXPORT sobre grupos de interés.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar XLSX' })).not.toBeInTheDocument()
  })
})
