import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeF8, EQUIPO_DE_ENTREGABLES, PLANTILLA, SHA_PLANTILLA } from '../../test/f8'
import { montar } from '../../test/montar'
import { ADMIN_PERMISOS, ADMINISTRACION, GERENCIA_SOCIAL } from '../../test/portal'
import { espiarRed, type Red, type RutaEspecial } from '../../test/red'
import { PlantillasPage } from './PlantillasPage'

// S64 (screens.md): solo la administración; la lista de la más reciente de cada clave, la subida multipart con su clave de
// idempotencia, cada violación de una plantilla rechazada y los avisos de una aceptada
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const abrir = (plantillas: unknown[] = [PLANTILLA], especiales: RutaEspecial[] = [], usuario = ADMINISTRACION, permisos = ADMIN_PERMISOS) => {
  fetch = mockFetch([{ path: '/sgspe/deliverable-templates', body: plantillas }, ...baseDeF8(usuario)])
  red = espiarRed([
    {
      path: '/objects/deliverable_template/records/t1/files/file',
      responder: () => new Response('PK', { headers: { 'Content-Disposition': 'attachment; filename="base.dotx"' } })
    },
    ...especiales
  ])
  montar(<PlantillasPage />, { usuario, permisos })
}
const archivo = new File(['PK'], 'informe.dotx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' })
const subir = async (clave = 'informe-base') => {
  await userEvent.click(await screen.findByRole('button', { name: 'Subir plantilla' }))
  const dialogo = screen.getByRole('dialog', { name: 'Subir una plantilla' })
  await userEvent.upload(within(dialogo).getByLabelText('Archivo (.dotx o .docx, hasta 20 MB)'), archivo)
  await userEvent.type(within(dialogo).getByLabelText('Clave'), clave)
  await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Plantilla Ejemplo')
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Subir' }))
  return dialogo
}

describe('S64 · plantillas', () => {
  it('lista la más reciente de cada clave con su huella y sus avisos, y la descarga', async () => {
    abrir()
    const tabla = await screen.findByRole('table', { name: 'Plantillas de entregables' })
    expect(within(tabla).getByText('informe-base')).toBeInTheDocument()
    expect(within(tabla).getByText(SHA_PLANTILLA)).toBeInTheDocument()
    expect(within(tabla).getByText('Fuente que solo figura en la tabla de fuentes: Calibri')).toBeInTheDocument()
    await userEvent.click(within(tabla).getByRole('button', { name: 'Descargar informe-base' }))
    await waitFor(() => expect(red!.a('GET', '/objects/deliverable_template/records/t1/files/file')).toHaveLength(1))
    expect(screen.getByText('{{titulo}}')).toBeInTheDocument()
    expect(screen.getByText('heading 1')).toBeInTheDocument()
    expect(screen.getByText('Liberation Serif')).toBeInTheDocument()
  })

  it('sube una plantilla en multipart y dice sus avisos', async () => {
    abrir(
      [PLANTILLA],
      [
        {
          method: 'POST',
          path: '/sgspe/deliverable-templates',
          responder: () =>
            jsonResponse({ id: 't2', templateKey: 'informe-base', sha256: SHA_PLANTILLA, warnings: [{ code: 'FONT_IN_TABLE', detail: 'Arial' }] }, 201)
        }
      ]
    )
    const dialogo = await subir()
    expect(await within(dialogo).findByText('Plantilla aceptada. Rige para los borradores siguientes de esa clave.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Fuente que solo figura en la tabla de fuentes: Arial')).toBeInTheDocument()
    const [subida] = red!.a('POST', '/sgspe/deliverable-templates')
    expect(subida.formulario?.get('templateKey')).toBe('informe-base')
    expect(subida.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('una plantilla rechazada lista cada violación con su detalle', async () => {
    abrir(
      [PLANTILLA],
      [
        {
          method: 'POST',
          path: '/sgspe/deliverable-templates',
          responder: () =>
            new Response(
              JSON.stringify({
                title: 'x',
                status: 422,
                errors: [{ field: 'file', message: 'TEMPLATE_INVALID' }],
                violations: [
                  { code: 'MACROS', detail: 'la plantilla trae macros' },
                  { code: 'MISSING_STYLE', detail: 'caption' },
                  { code: 'UNKNOWN_PLACEHOLDER', detail: '{{cliente}}' }
                ],
                warnings: []
              }),
              { status: 422, headers: { 'Content-Type': 'application/problem+json' } }
            )
        }
      ]
    )
    const dialogo = await subir()
    const lista = await within(dialogo).findByRole('list', { name: 'Problemas de la plantilla' })
    expect(within(lista).getByText('Trae macros: la plantilla trae macros')).toBeInTheDocument()
    expect(within(lista).getByText('Falta un estilo requerido: caption')).toBeInTheDocument()
    expect(within(lista).getByText('Un marcador que no se admite: {{cliente}}')).toBeInTheDocument()
  })

  it('una clave inválida no se envía', async () => {
    abrir()
    const dialogo = await subir('Informe Base')
    expect(within(dialogo).getByText('De 1 a 64 letras minúsculas, dígitos o guiones; empieza por una letra o un dígito.')).toBeInTheDocument()
    expect(red!.a('POST', '/sgspe/deliverable-templates')).toHaveLength(0)
  })

  it('sin plantillas rige la base; quien no administra no ve la pantalla', async () => {
    abrir([])
    expect(await screen.findByText('Todavía no hay plantillas propias: rige la plantilla base de SGSPE.')).toBeInTheDocument()
    fetch!.restore()
    red!.restaurar()
    document.body.innerHTML = ''
    abrir([PLANTILLA], [], GERENCIA_SOCIAL, EQUIPO_DE_ENTREGABLES)
    expect(await screen.findByText('Las plantillas de entregables las administra la administración de la organización.')).toBeInTheDocument()
    expect(red!.a('GET', '/sgspe/deliverable-templates')).toHaveLength(0)
  })
})
