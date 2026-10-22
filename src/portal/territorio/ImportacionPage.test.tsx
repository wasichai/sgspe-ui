import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { archivoXlsx, espiarRed, problema, type Red } from '../../test/red'
import { FORMATOS } from '../../test/sig'
import { crearI18n, NS } from '../i18n'
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

const GAN_OBJETOS = { project: ['READ'], locality: ['READ'], project_component: ['READ', 'CREATE', 'UPDATE'] }
const GAN = permisos(GAN_OBJETOS)
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

// el encabezado del portal también tiene un selector «Proyecto»; el del formulario se llama distinto
const selectorDeProyecto = () => screen.getByRole('combobox', { name: 'Proyecto de la importación' })

describe('S15 · importación geoespacial', () => {
  it('con un archivo elegido, «Cancelar» pide confirmar y vuelve al territorio sin escribir (revisión de UX, etapa 5)', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed()
    await prepararHastaLaVistaPrevia()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory'))
    // nada se escribe antes de confirmar: tampoco al salir
    expect(red.a('POST', '/sgspe/territory/imports/b-1/confirm')).toHaveLength(0)
  })

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

  it('un proyecto de la dirección que responde 404 dice que no existe o no es de sus proyectos, sin reintento', async () => {
    // un marcador viejo: el proyecto ya no es de los asignados o no existe (ADR-0029), y el portal no los distingue
    const ilegible = {
      path: '/objects/project/records/p9',
      status: 404,
      body: { title: 'Not Found', status: 404, detail: 'Record p9 does not exist', errors: [] }
    }
    fetch = abrirPortal('/territory/imports/new?project=p9', RELACIONISTA, GAN, [ilegible, ...rutas()])
    const archivo = new File(['Hole ID,East,North'], 'sondajes.csv', { type: 'text/csv' })
    await userEvent.upload(await screen.findByLabelText('Archivo (XLSX, CSV o GeoJSON)'), archivo)
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('El registro no existe o no es de sus proyectos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByText(/does not exist/)).not.toBeInTheDocument()
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
    expect(screen.getByText('2 nuevos, 0 versiones nuevas, 0 actualizaciones; 1 fila descartada')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Decisión Fila 5' }), 'DISCARD')
    expect(screen.getByText('1 nuevos, 0 versiones nuevas, 0 actualizaciones; 2 filas descartadas')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Decisión Fila 5' }), 'APPLY')
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
    expect(
      await screen.findByText('Su cuenta no puede crear ni cambiar componentes, predios, concesiones, comunidades ni elementos ambientales.')
    ).toBeInTheDocument()
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
    // atrás sale de la vista previa y adelante vuelve a /territory/imports/b-1, ya sin el archivo en la pestaña
    window.history.back()
    await waitFor(() => expect(rutaActual()).toBe('/territory/imports/new?project=p1'))
    window.history.forward()
    await waitFor(() => expect(rutaActual()).toBe('/territory/imports/b-1'))
    expect(await screen.findByRole('link', { name: 'Empezar de nuevo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar importación' })).not.toBeInTheDocument()
    expect(red.a('POST', '/sgspe/territory/imports/b-1/confirm')).toHaveLength(1)
  })

  it('cambiar el archivo pide confirmar el CRS otra vez', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    await prepararHastaLaVistaPrevia()
    const casilla = screen.getByRole('checkbox', { name: /Confirmo/ })
    await userEvent.click(casilla)
    expect(casilla).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await userEvent.upload(screen.getByLabelText('Archivo (XLSX, CSV o GeoJSON)'), new File(['otro'], 'otro.csv', { type: 'text/csv' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('checkbox', { name: /Confirmo/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Ver la vista previa' })).toBeDisabled()
  })

  it('cambiar el objeto destino pide confirmar el CRS otra vez', async () => {
    const dos = [
      ...rutas(),
      { path: '/metadata/objects/land_parcel', body: definicion('land_parcel', [['source_crs', { type: 'ENUM', enumOptions: ['EPSG 32717', 'EPSG 32718'] }]]) }
    ]
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, permisos({ ...GAN_OBJETOS, land_parcel: ['READ', 'CREATE', 'UPDATE'] }), dos)
    await prepararHastaLaVistaPrevia()
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Objeto destino' }), 'land_parcel')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('checkbox', { name: /Confirmo/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Ver la vista previa' })).toBeDisabled()
  })

  it('«Probar con otro CRS» vuelve al paso del CRS con el archivo y las columnas, sin la confirmación', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed()
    await hastaRevisar()
    await userEvent.click(screen.getByRole('button', { name: 'Probar con otro CRS' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory/imports/new'))
    expect(await screen.findByRole('combobox', { name: 'CRS de origen' })).toHaveValue('EPSG 32717')
    expect(screen.getByRole('textbox', { name: 'Código' })).toHaveValue('Hole ID')
    expect(screen.getByRole('checkbox', { name: /Confirmo/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Ver la vista previa' })).toBeDisabled()
    expect(red.a('POST', '/sgspe/territory/imports/b-1/confirm')).toHaveLength(0)
  })

  it('si el reporte de diferencias falla, dice el texto del código del error', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports',
        responder: (l) =>
          l.cabeceras.get('Accept')?.includes('spreadsheetml')
            ? problema(400, 'detalle', [{ field: 'file', message: 'FILE_TOO_LARGE' }])
            : new Response(JSON.stringify(VISTA))
      }
    ])
    await hastaRevisar()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar el reporte de diferencias' }))
    expect(await screen.findByText('El archivo pasa del tamaño máximo permitido: pártalo en varias importaciones.')).toBeInTheDocument()
    expect(screen.queryByText('FILE_TOO_LARGE')).not.toBeInTheDocument()
  })

  it('una fila fuera de zona se resalta y muestra el motivo del servidor; las demás no', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    await hastaRevisar()
    const fuera = screen.getByText('A 3 km del área del proyecto').closest('tr')!
    expect(fuera).toHaveAttribute('data-fuera-de-zona', 'true')
    expect(within(fuera).getByText('Fuera de la zona esperada')).toBeInTheDocument()
    expect(within(fuera).getByRole('combobox', { name: 'Decisión Fila 5' })).toHaveValue('APPLY')
    const otra = screen.getByRole('combobox', { name: 'Decisión Fila 3' }).closest('tr')!
    expect(otra).not.toHaveAttribute('data-fuera-de-zona')
  })

  it('una fila inválida nombra la columna del archivo, no el campo interno del modelo', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    const vista = {
      ...VISTA,
      invalid: [
        { row: 7, field: 'source_northing', message: 'fuera de la zona UTM esperada' },
        { row: 8, field: 'footprint', message: 'geometría inválida' },
        { row: 9, field: 'easting', message: 'faltan el este y el norte' },
        { row: 10, field: 'northing', message: 'ejes cambiados' }
      ]
    }
    red = espiarRed([{ method: 'POST', path: '/sgspe/territory/imports', responder: () => new Response(JSON.stringify(vista)) }])
    await hastaRevisar()
    const seccion = screen.getByRole('region', { name: 'Filas inválidas' })
    expect(within(seccion).getByText('Fila 7 · Norte: fuera de la zona UTM esperada')).toBeInTheDocument()
    expect(within(seccion).getByText('Fila 8: geometría inválida')).toBeInTheDocument()
    // el backend manda easting y northing (no source_*) en las filas sin coordenadas o con los ejes cambiados
    expect(within(seccion).getByText('Fila 9 · Este: faltan el este y el norte')).toBeInTheDocument()
    expect(within(seccion).getByText('Fila 10 · Norte: ejes cambiados')).toBeInTheDocument()
    expect(screen.queryByText(/source_northing|footprint/)).not.toBeInTheDocument()
    expect(screen.queryByText(/CON-024/)).not.toBeInTheDocument()
  })

  it('si la respuesta de la confirmación llega con la pantalla ya cerrada, la importación en curso se limpia igual', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    let responder: (r: Response) => void = () => {}
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports/b-1/confirm',
        responder: () => new Promise<Response>((resolver) => (responder = resolver))
      }
    ])
    const irA = (ruta: string) => {
      window.history.pushState({}, '', ruta)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
    await hastaRevisar()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/territory/imports/b-1/confirm')).toHaveLength(1))
    act(() => irA('/territory/imports/new'))
    await screen.findByRole('combobox', { name: 'CRS de origen' })
    await act(async () => responder(new Response(JSON.stringify({ created: 2, newVersions: 0, updated: 0, unchanged: 1, rejected: 2, evidenceId: null }))))
    act(() => irA('/territory/imports/b-1'))
    expect(await screen.findByText(/ya no está en esta pestaña/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar importación' })).not.toBeInTheDocument()
  })

  it('la importación en curso es de la cuenta que la abrió: otra cuenta en la misma pestaña no la ve', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    await hastaRevisar()
    // otra cuenta abre la misma dirección en la pestaña
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/territory/imports/b-1', GERENCIA_SOCIAL, GAN, rutas())
    expect(await screen.findByText(/ya no está en esta pestaña/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar importación' })).not.toBeInTheDocument()
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
    // el selector de la barra superior es un combobox cerrado (DD-09): la opción es la del selector de la importación
    await waitFor(() => expect(within(selectorDeProyecto()).getByRole('option', { name: /PRJ-02/ })).toBeInTheDocument())
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

  it('si los proyectos no cargan, lo dice y no ofrece una lista vacía; un 403 es «No disponible» (revisión final, M2)', async () => {
    const conProyectos = (status: number) =>
      rutas().map((r) => (r.path === '/objects/project/records' ? { path: r.path, status, body: { title: 'Error', status, detail: 'No' } } : r))
    fetch = abrirPortal('/territory/imports/new', RELACIONISTA, GAN, conProyectos(400))
    expect(await screen.findByText(/No se pudo cargar esta información/)).toBeInTheDocument()
    expect(selectorDeProyecto()).toBeDisabled()
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/territory/imports/new', RELACIONISTA, GAN, conProyectos(403))
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByText(/No se pudo cargar esta información/)).not.toBeInTheDocument()
    expect(selectorDeProyecto()).toBeDisabled()
  })
})

describe('S15 · formatos por GDAL y destinos nuevos (F6)', () => {
  const ESCRIBE_TERRITORIO = permisos({
    ...GAN_OBJETOS,
    community: ['READ', 'CREATE', 'UPDATE'],
    environmental_feature: ['READ', 'CREATE', 'UPDATE']
  })
  const definiciones = [
    {
      path: '/metadata/objects/community',
      body: definicion('community', [['source_crs', { type: 'ENUM', enumOptions: ['EPSG 32717', 'EPSG 32718', 'EPSG 4326'] }]])
    },
    {
      path: '/metadata/objects/environmental_feature',
      body: definicion('environmental_feature', [
        ['source_crs', { type: 'ENUM', enumOptions: ['EPSG 32717', 'EPSG 4326'] }],
        ['feature_type', { type: 'ENUM', enumOptions: ['FUENTE DE AGUA', 'SITIO SAGRADO'] }]
      ])
    }
  ]
  const conFormatos = (formatos = FORMATOS) => [{ path: '/sgspe/territory/imports/formats', body: formatos }, ...definiciones, ...rutas()]
  // un 400 con las capas del archivo en el cuerpo Problem (ImportChoiceRequired): LAYER_REQUIRED o el CRS que falta, sin código
  const conCapas = (error: { field: string; message: string }, layers: unknown[]) =>
    new Response(JSON.stringify({ title: 'Bad Request', status: 400, detail: 'detalle', errors: [error], layers }), {
      status: 400,
      headers: { 'Content-Type': 'application/problem+json' }
    })

  it('sin el endpoint de formatos (backend sin F6) ofrece los formatos y destinos de F2', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, ESCRIBE_TERRITORIO, [...definiciones, ...rutas()])
    const archivo = await screen.findByLabelText('Archivo (XLSX, CSV o GeoJSON)')
    expect(archivo).toHaveAttribute('accept', '.xlsx,.csv,.geojson,.json')
    expect(within(screen.getByRole('combobox', { name: 'Objeto destino' })).queryByRole('option', { name: 'Territorio comunal' })).not.toBeInTheDocument()
  })

  it('un KMZ al territorio comunal fija EPSG 4326 y manda el código y el nombre', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, ESCRIBE_TERRITORIO, conFormatos())
    red = espiarRed()
    const entrada = await screen.findByLabelText('Archivo')
    await waitFor(() => expect(entrada).toHaveAttribute('accept', expect.stringContaining('.kmz')))
    expect(entrada.getAttribute('accept')).toContain('.zip')
    expect(screen.getByText('Formatos: XLSX, CSV, GeoJSON, Shapefile o FileGDB (ZIP), KML, KMZ, GeoPackage, GPX.')).toBeInTheDocument()
    await userEvent.upload(entrada, new File(['PK'], 'territorio.kmz', { type: 'application/vnd.google-earth.kmz' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Objeto destino' }), 'community')
    // solo polígonos: los puntos y las líneas llegan como filas inválidas (TerritoryImports, destino community)
    expect(screen.getByText(/^Solo polígonos/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    const crs = await screen.findByRole('combobox', { name: 'CRS de origen' })
    await waitFor(() => expect(crs).toHaveValue('EPSG 4326'))
    expect(crs).toBeDisabled()
    expect(screen.getByText('Los archivos KML, KMZ y GPX están siempre en EPSG 4326.')).toBeInTheDocument()
    // con el CRS fijo no hace falta leer el archivo antes
    expect(screen.queryByRole('button', { name: 'Leer el archivo' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Código' }), 'codigo')
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre' }), 'nombre')
    expect(screen.queryByRole('textbox', { name: 'Este' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/territory/imports')).toHaveLength(1))
    const [vista] = red.a('POST', '/sgspe/territory/imports')
    expect(vista.formulario?.get('target')).toBe('community')
    expect(vista.formulario?.get('sourceCrs')).toBe('EPSG 4326')
    expect(vista.formulario?.get('layer')).toBeNull()
    expect(JSON.parse(String(vista.formulario?.get('columns')))).toEqual({ code: 'codigo', name: 'nombre' })
  })

  it('un elemento ambiental exige su tipo, por columna o fijo', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, ESCRIBE_TERRITORIO, conFormatos())
    red = espiarRed()
    await userEvent.upload(await screen.findByLabelText('Archivo'), new File(['x'], 'elementos.gpkg'))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Objeto destino' }), 'environmental_feature')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'CRS de origen' }), 'EPSG 32717')
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Código' }), 'cod')
    expect(screen.getByRole('button', { name: 'Ver la vista previa' })).toBeDisabled()
    expect(screen.getByText('Indique la columna del tipo de elemento o un tipo para todas las filas.')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de elemento para todas las filas' }), 'FUENTE DE AGUA')
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/territory/imports')).toHaveLength(1))
    expect(JSON.parse(String(red.a('POST', '/sgspe/territory/imports')[0].formulario?.get('columns')))).toEqual({ code: 'cod', featureType: '=FUENTE DE AGUA' })
  })

  it('un formato que el servidor no puede leer se dice y no deja avanzar', async () => {
    fetch = abrirPortal(
      '/territory/imports/new?project=p1',
      RELACIONISTA,
      ESCRIBE_TERRITORIO,
      conFormatos({
        formats: FORMATOS.formats.map((f) => (f.format === 'gpkg' ? { ...f, available: false } : f))
      })
    )
    await userEvent.upload(await screen.findByLabelText('Archivo'), new File(['x'], 'capas.gpkg'))
    expect(await screen.findByText('El servidor no puede leer GeoPackage todavía.')).toBeInTheDocument()
    expect(screen.getByText(/^Formatos: /)).not.toHaveTextContent('GeoPackage')
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('una hoja de coordenadas no va a un destino de polígonos', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, ESCRIBE_TERRITORIO, conFormatos())
    await userEvent.upload(await screen.findByLabelText('Archivo'), new File(['x'], 'puntos.csv', { type: 'text/csv' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Objeto destino' }), 'environmental_feature')
    expect(screen.getByText(/Este destino se importa desde un archivo con geometrías/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('un archivo de varias capas pide la capa y repite la vista previa con ella', async () => {
    let llamadas = 0
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, conFormatos())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports',
        responder: () =>
          ++llamadas === 1
            ? conCapas({ field: 'layer', message: 'LAYER_REQUIRED' }, [
                { name: 'sondajes', geometryType: 'Point', featureCount: 12, detectedCrs: null },
                { name: 'plataformas', geometryType: 'Polygon', featureCount: 3, detectedCrs: null }
              ])
            : new Response(JSON.stringify(VISTA), { headers: { 'Content-Type': 'application/json' } })
      }
    ])
    await userEvent.upload(await screen.findByLabelText('Archivo'), new File(['x'], 'proyecto.gpkg'))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'CRS de origen' })).toHaveValue('EPSG 32717'))
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Código' }), 'id')
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    expect(await screen.findByText('El archivo tiene varias capas: elija cuál importar.')).toBeInTheDocument()
    expect(screen.queryByText('LAYER_REQUIRED')).not.toBeInTheDocument()
    // sin capa elegida no se repite
    expect(screen.getByRole('button', { name: 'Ver la vista previa' })).toBeDisabled()
    expect(screen.getByRole('option', { name: 'plataformas · Polygon · 3 elementos' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Capa del archivo' }), 'plataformas')
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory/imports/b-1'))
    expect(red.a('POST', '/sgspe/territory/imports')[1].formulario?.get('layer')).toBe('plataformas')
  })

  it('«Leer el archivo» pide sus capas sin CRS y propone el que declara la capa, que hay que confirmar', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, conFormatos())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports',
        responder: (l) =>
          l.formulario?.get('sourceCrs')
            ? new Response(JSON.stringify({ ...VISTA, format: 'shp', layer: 'sondajes', detectedCrs: 'EPSG 32718' }))
            : conCapas({ field: 'sourceCrs', message: 'es obligatorio y sale del catálogo «CRS de origen»' }, [
                { name: 'sondajes', geometryType: 'Point', featureCount: 12, detectedCrs: 'EPSG 32718' }
              ])
      }
    ])
    await userEvent.upload(await screen.findByLabelText('Archivo'), new File(['x'], 'sondajes.zip'))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'CRS de origen' })).toHaveValue('EPSG 32717'))
    // lo confirmado antes de leer era el CRS de trabajo del proyecto: la propuesta del archivo pide confirmar otra vez
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Leer el archivo' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'CRS de origen' })).toHaveValue('EPSG 32718'))
    const [lectura] = red.a('POST', '/sgspe/territory/imports')
    expect(lectura.formulario?.get('sourceCrs')).toBeNull()
    expect(screen.getByText('Propuesto por el archivo: EPSG 32718. Confírmelo o elija otro.')).toBeInTheDocument()
    expect(screen.getByText('Capa leída: sondajes · Point · 12 elementos')).toBeInTheDocument()
    // el 400 del CRS que falta no es un error para la persona: es la lectura
    expect(screen.queryByText(/es obligatorio/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leer el archivo' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Confirmo que las coordenadas del archivo están en EPSG 32718' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Ver la vista previa' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Código' }), 'id')
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory/imports/b-1'))
    const vista = red.a('POST', '/sgspe/territory/imports')[1]
    expect(vista.formulario?.get('sourceCrs')).toBe('EPSG 32718')
    expect(vista.formulario?.get('layer')).toBe('sondajes')
    expect(await screen.findByText('El archivo declara EPSG 32718, el mismo CRS de la vista previa.')).toBeInTheDocument()
  })

  it('el CRS que declara el archivo se propone: «Usar el CRS del archivo» repite la vista previa con él', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, [
      { method: 'POST', path: '/sgspe/territory/imports', body: { ...VISTA, format: 'shp', layer: 'sondajes', detectedCrs: 'EPSG 32718' } },
      ...conFormatos()
    ])
    red = espiarRed()
    await userEvent.upload(await screen.findByLabelText('Archivo'), new File(['x'], 'sondajes.zip'))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'CRS de origen' })).toHaveValue('EPSG 32717'))
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Código' }), 'id')
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    expect(await screen.findByText('El archivo declara EPSG 32718; la vista previa usa EPSG 32717.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Usar el CRS del archivo' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/territory/imports')).toHaveLength(2))
    expect(red.a('POST', '/sgspe/territory/imports')[1].formulario?.get('sourceCrs')).toBe('EPSG 32718')
  })

  it('un destino que la organización todavía no tiene (400 sobre target) vuelve a los destinos de F2', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, ESCRIBE_TERRITORIO, conFormatos())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports',
        responder: () => problema(400, 'Destino inválido', [{ field: 'target', message: 'community se importa con el modelo de F6' }])
      }
    ])
    await userEvent.upload(await screen.findByLabelText('Archivo'), new File(['PK'], 'territorio.kml'))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Objeto destino' }), 'community')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    expect(await screen.findByText('Su organización todavía no tiene ese destino: elija otro.')).toBeInTheDocument()
    const destino = screen.getByRole('combobox', { name: 'Objeto destino' })
    expect(within(destino).queryByRole('option', { name: 'Territorio comunal' })).not.toBeInTheDocument()
    expect(within(destino).queryByRole('option', { name: 'Elementos ambientales' })).not.toBeInTheDocument()
    expect(destino).toHaveValue('project_component')
    expect(screen.queryByText(/modelo de F6/)).not.toBeInTheDocument()
  })

  it('una cuenta que solo importa a los destinos de F6, en una organización sin ese modelo, lo dice y no culpa a sus permisos', async () => {
    // los permisos del relacionista comunitario (model/roles.json): ningún destino de F2
    const SOLO_F6 = permisos({
      project: ['READ'],
      locality: ['READ', 'CREATE', 'UPDATE'],
      project_component: ['READ'],
      land_parcel: ['READ'],
      mining_concession: ['READ'],
      community: ['READ', 'CREATE', 'UPDATE'],
      environmental_feature: ['READ', 'CREATE', 'UPDATE']
    })
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, SOLO_F6, conFormatos())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports',
        responder: () => problema(400, 'Destino inválido', [{ field: 'target', message: 'community se importa con el modelo de F6' }])
      }
    ])
    await userEvent.upload(await screen.findByLabelText('Archivo'), new File(['PK'], 'territorio.kml'))
    expect(screen.getByRole('combobox', { name: 'Objeto destino' })).toHaveValue('community')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    expect(
      await screen.findByText('Su organización todavía no tiene ese destino: aún no puede importar comunidades ni elementos ambientales.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Su cuenta no puede/)).not.toBeInTheDocument()
  })

  it('al volver de la vista previa, el tipo fijo vuelve a su selector y no al campo de la columna', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, ESCRIBE_TERRITORIO, conFormatos())
    red = espiarRed()
    await userEvent.upload(await screen.findByLabelText('Archivo'), new File(['x'], 'elementos.gpkg'))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Objeto destino' }), 'environmental_feature')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'CRS de origen' }), 'EPSG 32717')
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de elemento para todas las filas' }), 'SITIO SAGRADO')
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory/imports/b-1'))
    await userEvent.click(await screen.findByRole('button', { name: 'Probar con otro CRS' }))
    expect(await screen.findByRole('combobox', { name: 'Tipo de elemento para todas las filas' })).toHaveValue('SITIO SAGRADO')
    expect(screen.getByRole('textbox', { name: 'Columna del tipo de elemento' })).toHaveValue('')
  })

  it('sin F6, FORMAT_NOT_SUPPORTED dice el texto común y no recomienda formatos que ese servidor no lee', async () => {
    fetch = abrirPortal('/territory/imports/new?project=p1', RELACIONISTA, GAN, rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/imports',
        responder: () => problema(400, 'detalle', [{ field: 'file', message: 'FORMAT_NOT_SUPPORTED' }])
      }
    ])
    await prepararHastaLaVistaPrevia()
    await userEvent.click(screen.getByRole('checkbox', { name: /Confirmo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver la vista previa' }))
    expect(await screen.findByText('Ese destino no se importa desde una hoja: use un GeoJSON.')).toBeInTheDocument()
    expect(screen.queryByText(/GeoPackage/)).not.toBeInTheDocument()
  })
})

describe('el conteo de filas descartadas', () => {
  it('se escribe en formato es-PE y conserva el plural, en los dos idiomas', () => {
    const i18n = crearI18n()
    const texto = (lng: string, count: number) => i18n.t('importacion.escritura', { ns: NS, lng, crear: '0', versiones: '0', actualizar: '0', count })
    expect(texto('es', 1)).toContain('; 1 fila descartada')
    expect(texto('es', 1234)).toContain('; 1,234 filas descartadas')
    expect(texto('en', 1)).toContain('; 1 row discarded')
    expect(texto('en', 1234)).toContain('; 1,234 rows discarded')
  })
})
