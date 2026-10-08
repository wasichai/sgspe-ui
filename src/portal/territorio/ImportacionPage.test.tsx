import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'
import { archivoXlsx, espiarRed, problema, type Red } from '../../test/red'
import { reiniciarImportacion } from './ImportacionPage'

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  reiniciarImportacion()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  // descargar el reporte hace clic en un enlace: jsdom no navega
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const GAN = permisos({ project: ['READ'], locality: ['READ'], project_component: ['READ', 'CREATE', 'UPDATE'] })
const VISTA = {
  importBatchId: 'b-1',
  sha256: 'abc123',
  target: 'project_component',
  sourceCrs: 'EPSG 32717',
  rows: 5,
  valid: 4,
  invalid: [{ row: 7, field: 'source_northing', message: 'fuera de la zona UTM esperada' }],
  differences: [
    { row: 2, code: 'SDJ-003', outcome: 'CREATE' },
    { row: 3, code: 'SDJ-004', outcome: 'NEW_VERSION', currentVersion: 1, distanceM: 93.4 },
    { row: 4, code: 'SDJ-005', outcome: 'UNCHANGED' },
    { row: 5, code: 'SDJ-006', outcome: 'CREATE' }
  ],
  // la fila 5 es válida pero cae a 3 km del área del proyecto: solo entra con un APPLY explícito (gis.md §4.3)
  outOfZone: [{ row: 5, code: 'SDJ-006', message: 'A 3 km del área del proyecto' }]
}
const rutas = () => [
  { path: '/objects/project/records', body: pagina([registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' })]) },
  { path: '/objects/project/records/p1', body: registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa', working_crs: 'EPSG 32717' }) },
  { path: '/objects/project_assignment/records', body: pagina([registro('a', { project: 'p1', active: true })]) },
  {
    path: '/metadata/objects/project_component',
    body: definicion('project_component', [['source_crs', { type: 'ENUM', enumOptions: ['EPSG 32717', 'EPSG 32718', 'EPSG 24877', 'EPSG 4326'] }]])
  },
  { method: 'POST', path: '/sgspe/territory/imports', body: VISTA },
  {
    method: 'POST',
    path: '/sgspe/territory/imports/b-1/confirm',
    // lo que preveía la vista previa con la fila 3 descartada: 2 nuevas, 1 sin cambio y 2 rechazadas (la 7 y la 3)
    body: { created: 2, newVersions: 0, updated: 0, unchanged: 1, rejected: 2, evidenceId: null }
  }
]

// hasta la vista previa en /territory/imports/b-1, con el CRS confirmado y la columna del código
async function hastaRevisar() {
  await prepararHastaLaVistaPrevia()
  await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Código' }), 'Hole ID')
  await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
  await waitFor(() => expect(rutaActual()).toBe('/territory/imports/b-1'))
  await screen.findByRole('button', { name: 'Confirmar importación' })
}

async function prepararHastaLaVistaPrevia() {
  const archivo = new File(['Hole ID,East,North'], 'sondajes.csv', { type: 'text/csv' })
  await userEvent.upload(await screen.findByLabelText('Archivo (XLSX, CSV o GeoJSON)'), archivo)
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  const crs = await screen.findByRole('combobox', { name: 'CRS de origen' })
  await waitFor(() => expect(crs).toHaveValue('EPSG 32717'))
  return archivo
}

// el encabezado del portal también tiene un selector de proyecto: el del formulario es el último
const selectorDeProyecto = () => screen.getAllByRole('combobox', { name: 'Proyecto' }).at(-1)!

describe('S15 · importación geoespacial', () => {
  it('sin confirmar el CRS de origen no se avanza; la vista previa manda el archivo, el destino, el proyecto, el CRS y las columnas', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed()
    const archivo = await prepararHastaLaVistaPrevia()
    const ver = screen.getByRole('button', { name: 'Ver la vista previa' })
    expect(ver).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Confirmo que las coordenadas del archivo están en EPSG 32717' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Código' }), 'Hole ID')
    await userEvent.type(screen.getByRole('textbox', { name: 'Este' }), 'East')
    await userEvent.click(ver)
    await waitFor(() => expect(rutaActual()).toBe('/territory/imports/b-1'))
    const [vista] = red.a('POST', '/sgspe/territory/imports')
    expect(vista.formulario?.get('file')).toEqual(archivo)
    expect(vista.formulario?.get('target')).toBe('project_component')
    expect(vista.formulario?.get('project')).toBe('p1')
    expect(vista.formulario?.get('sourceCrs')).toBe('EPSG 32717')
    expect(JSON.parse(String(vista.formulario?.get('columns')))).toEqual({ code: 'Hole ID', easting: 'East' })
  })

  it('cambiar el CRS pide confirmarlo otra vez', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    await prepararHastaLaVistaPrevia()
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'CRS de origen' }), 'EPSG 24877')
    expect(screen.getByRole('checkbox', { name: 'Confirmo que las coordenadas del archivo están en EPSG 24877' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Ver la vista previa' })).toBeDisabled()
  })

  it('la vista previa cuenta, pide decisión en las versiones nuevas y confirma con el SHA-256, las decisiones y una clave', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports',
        responder: (l) => (l.cabeceras.get('Accept')?.includes('spreadsheetml') ? archivoXlsx('diferencias.xlsx') : new Response(JSON.stringify(VISTA)))
      }
    ])
    await prepararHastaLaVistaPrevia()
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Código' }), 'Hole ID')
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    expect(within(await screen.findByRole('listitem', { name: 'Con diferencias' })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Inválidas' })).getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/fuera de la zona UTM esperada/)).toBeInTheDocument()
    expect(screen.getByText('Nada se ha escrito todavía.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar el reporte de diferencias' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/territory/imports')).toHaveLength(2))
    // el reporte se pide como XLSX o problem+json: así un error llega con su código y no con el cuerpo vacío
    expect(red.a('POST', '/sgspe/territory/imports')[1].cabeceras.get('Accept')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/problem+json'
    )
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Decisión Fila 3' }), 'DISCARD')
    // la fila fuera de zona nadie la tocó: se muestra y se manda APPLY
    expect(screen.getByRole('combobox', { name: 'Decisión Fila 5' })).toHaveValue('APPLY')
    expect(screen.getByText('Fuera de la zona esperada')).toBeInTheDocument()
    expect(screen.getByText('2 nuevos, 0 versiones nuevas, 0 actualizaciones; 1 filas descartadas')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByRole('heading', { name: 'Importación confirmada' })).toBeInTheDocument()
    const [confirmacion] = red.a('POST', '/sgspe/territory/imports/b-1/confirm')
    expect(confirmacion.formulario?.get('sha256')).toBe('abc123')
    expect(JSON.parse(String(confirmacion.formulario?.get('decisions')))).toEqual([
      { row: 3, action: 'DISCARD' },
      { row: 5, action: 'APPLY' }
    ])
    // la importación no deja estado en el servidor: la confirmación repite lo que pidió la vista previa
    const [previa] = red.a('POST', '/sgspe/territory/imports')
    expect(confirmacion.formulario?.get('file')).toEqual(previa.formulario?.get('file'))
    for (const parte of ['target', 'project', 'sourceCrs', 'columns']) expect(confirmacion.formulario?.get(parte)).toBe(previa.formulario?.get(parte))
    expect(confirmacion.formulario?.get('sourceCrs')).toBe('EPSG 32717')
    expect(JSON.parse(String(confirmacion.formulario?.get('columns')))).toEqual({ code: 'Hole ID' })
    expect(confirmacion.cabeceras.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/)
    expect(screen.getByRole('link', { name: 'Volver al mapa del proyecto' })).toHaveAttribute('href', '/projects/p1/map')
    // los conteos coinciden con la vista previa: no hay aviso
    expect(screen.queryByText(/no coincide con la vista previa/)).not.toBeInTheDocument()
  })

  it('si los conteos de la confirmación difieren de la vista previa, lo dice y muestra lo previsto', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    // alguien registró SDJ-006 entre las dos llamadas: la fila 5 se confirmó como versión nueva y no como alta
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports/b-1/confirm',
        responder: () => new Response(JSON.stringify({ created: 1, newVersions: 2, updated: 0, unchanged: 1, rejected: 1, evidenceId: null }))
      }
    ])
    await hastaRevisar()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByText(/no coincide con la vista previa/)).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Creados' })).getByText('previsto: 2')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Versiones nuevas' })).getByText('previsto: 1')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Sin cambio' })).queryByText(/previsto/)).not.toBeInTheDocument()
  })

  it('409 IMPORT_CONFLICT: no se escribió nada y ofrece volver a ver la vista previa con el mismo pedido', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    let previas = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports',
        responder: () => new Response(JSON.stringify({ ...VISTA, importBatchId: ++previas === 1 ? 'b-1' : 'b-2' }))
      },
      {
        method: 'POST',
        path: '/sgspe/territory/imports/b-1/confirm',
        responder: () => problema(409, 'Lo registrado cambió', [{ field: 'file', message: 'IMPORT_CONFLICT' }])
      }
    ])
    await hastaRevisar()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByText(/Lo registrado cambió mientras se confirmaba y no se escribió nada/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Volver a ver la vista previa' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory/imports/b-2'))
    const [primera, segunda] = red.a('POST', '/sgspe/territory/imports')
    expect(segunda.formulario?.get('file')).toEqual(primera.formulario?.get('file'))
    expect(segunda.formulario?.get('sourceCrs')).toBe('EPSG 32717')
    expect(screen.queryByText(/no se escribió nada/)).not.toBeInTheDocument()
  })

  it('503 IMPORT_BUSY ofrece reintentar la confirmación con la misma clave', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    let intentos = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports/b-1/confirm',
        responder: () =>
          ++intentos === 1
            ? problema(503, 'Hay importaciones en curso', [{ field: 'file', message: 'IMPORT_BUSY' }])
            : new Response(JSON.stringify({ created: 2, newVersions: 1, updated: 0, unchanged: 1, rejected: 1, evidenceId: null }))
      }
    ])
    await hastaRevisar()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByText('Hay otras importaciones en curso: reintente en un momento.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Importación confirmada' })).toBeInTheDocument()
    const [uno, dos] = red.a('POST', '/sgspe/territory/imports/b-1/confirm')
    expect(dos.cabeceras.get('Idempotency-Key')).toBe(uno.cabeceras.get('Idempotency-Key'))
  })

  it.each([
    [400, 'FILE_TOO_LARGE', 'file', 'El archivo pasa del tamaño máximo permitido: pártalo en varias importaciones.'],
    [400, 'IMPORT_TIMEOUT', 'file', 'Leer y validar el archivo tardó demasiado: pártalo en archivos más pequeños.'],
    [403, 'NOT_ASSIGNED', 'project', 'No tiene una asignación vigente a este proyecto: solo quien está asignado importa componentes o concesiones.']
  ])('la vista previa con %i %s dice su texto, no el código', async (status, codigo, campo, texto) => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed([{ method: 'POST', path: '/sgspe/territory/imports', responder: () => problema(status, 'detalle', [{ field: campo, message: codigo }]) }])
    await prepararHastaLaVistaPrevia()
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(codigo)).not.toBeInTheDocument()
    expect(rutaActual()).toBe('/territory/imports/new?project=p1')
  })

  it('sin el archivo en la pestaña (recarga), pide empezar de nuevo', async () => {
    fetch = abrirPortal('/territory/imports/b-1', RELACIONISTA, GAN, rutas())
    expect(await screen.findByText(/ya no está en esta pestaña/)).toBeInTheDocument()
  })

  it('sin permisos de escritura en ningún destino no se ofrece importar', async () => {
    fetch = abrirPortal('/territory/imports/new', RELACIONISTA, permisos({ project: ['READ'], locality: ['READ'] }), rutas())
    expect(await screen.findByText('Su cuenta no puede crear ni cambiar componentes, predios ni concesiones.')).toBeInTheDocument()
  })

  it.each([
    [400, 'PART_TOO_LARGE', 'columns', 'Una parte del pedido es demasiado grande: revise las columnas.'],
    [400, 'INVALID_MULTIPART', 'multipart', 'No se pudo leer el pedido: vuelva a cargar el archivo.']
  ])('la vista previa con %i %s también dice su texto', async (status, codigo, campo, texto) => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed([{ method: 'POST', path: '/sgspe/territory/imports', responder: () => problema(status, 'detalle', [{ field: campo, message: codigo }]) }])
    await prepararHastaLaVistaPrevia()
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(codigo)).not.toBeInTheDocument()
  })

  it('503 IMPORT_BUSY en la vista previa ofrece reintentar', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    let intentos = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports',
        responder: () => (++intentos === 1 ? problema(503, 'Ocupado', [{ field: 'file', message: 'IMPORT_BUSY' }]) : new Response(JSON.stringify(VISTA)))
      }
    ])
    await prepararHastaLaVistaPrevia()
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    expect(await screen.findByText('Hay otras importaciones en curso: reintente en un momento.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory/imports/b-1'))
  })

  it('400 SHA256_MISMATCH dice su texto y empieza de nuevo, sin el archivo anterior', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports/b-1/confirm',
        responder: () => problema(400, 'detalle', [{ field: 'sha256', message: 'SHA256_MISMATCH' }])
      }
    ])
    await hastaRevisar()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    expect(await screen.findByText(/El archivo no es el de la vista previa/)).toBeInTheDocument()
    expect(screen.queryByText('SHA256_MISMATCH')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Empezar de nuevo' }))
    expect(await screen.findByLabelText('Archivo (XLSX, CSV o GeoJSON)')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'CRS de origen' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('una decisión nunca viaja sobre una fila inválida, aunque también figure fuera de zona', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    const vista = { ...VISTA, outOfZone: [...VISTA.outOfZone, { row: 7, message: 'sin coordenadas' }] }
    red = espiarRed([{ method: 'POST', path: '/sgspe/territory/imports', responder: () => new Response(JSON.stringify(vista)) }])
    await hastaRevisar()
    expect(screen.queryByRole('combobox', { name: 'Decisión Fila 7' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    await screen.findByRole('heading', { name: 'Importación confirmada' })
    const [confirmacion] = red.a('POST', '/sgspe/territory/imports/b-1/confirm')
    expect(JSON.parse(String(confirmacion.formulario?.get('decisions')))).toEqual([
      { row: 3, action: 'APPLY' },
      { row: 5, action: 'APPLY' }
    ])
  })

  it('tras confirmar, volver a la dirección de la vista previa pide empezar de nuevo y no confirma otra vez', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed()
    await hastaRevisar()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    await screen.findByRole('heading', { name: 'Importación confirmada' })
    window.history.back()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Importación confirmada' })).not.toBeInTheDocument())
    expect(red.a('POST', '/sgspe/territory/imports/b-1/confirm')).toHaveLength(1)
  })

  it('cambiar de proyecto pide confirmar el CRS otra vez', async () => {
    const dos = rutas().map((r) =>
      r.path === '/objects/project/records'
        ? { ...r, body: pagina([registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }), registro('p2', { code: 'PRJ-02', name: 'Qori' })]) }
        : r.path === '/objects/project_assignment/records'
          ? { ...r, body: pagina([registro('a', { project: 'p1', active: true }), registro('b', { project: 'p2', active: true })]) }
          : r
    )
    dos.push({ path: '/objects/project/records/p2', body: registro('p2', { code: 'PRJ-02', name: 'Qori', working_crs: 'EPSG 32718' }) })
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, dos)
    const archivo = new File(['x'], 'a.csv', { type: 'text/csv' })
    await userEvent.upload(await screen.findByLabelText('Archivo (XLSX, CSV o GeoJSON)'), archivo)
    await waitFor(() => expect(screen.getAllByRole('option', { name: /PRJ-02/ }).length).toBeGreaterThan(1))
    await userEvent.selectOptions(selectorDeProyecto(), 'p2')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    const casilla = await screen.findByRole('checkbox', { name: /Confirmo/ })
    await userEvent.click(casilla)
    expect(casilla).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await userEvent.selectOptions(selectorDeProyecto(), 'p1')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('checkbox', { name: /Confirmo/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Ver la vista previa' })).toBeDisabled()
  })

  it('si los proyectos no cargan, lo dice y no ofrece una lista vacía', async () => {
    const sinProyectos = rutas().map((r) =>
      r.path === '/objects/project/records' ? { path: r.path, status: 403, body: { title: 'Error', status: 403, detail: 'No' } } : r
    )
    fetch = abrirPortal('/territory/imports/new', RELACIONISTA, GAN, sinProyectos)
    expect(await screen.findByText(/No se pudo cargar esta información/)).toBeInTheDocument()
    expect(selectorDeProyecto()).toBeDisabled()
  })
})
