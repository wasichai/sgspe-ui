import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import type { CallerPermissions } from '@wasichai/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  baseDeIa,
  EQUIPO_IA,
  ESTADO_ACTIVO,
  ESTADO_SOLO_DATOS,
  GERENCIA_IA,
  RESPUESTA_DOCUMENTOS,
  SIN_CITA_VALIDA,
  SIN_DESCARGA,
  SIN_EVIDENCIA
} from '../../test/ia'
import { montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { BotonPreguntar, ProveedorDelAsistente } from './Asistente'

// S05 «Respuesta con citas» (AI-06): sobre los documentos de un proyecto, con cada fuente y su cita solo para quien la descarga;
// sin citas, «No encontré documentos que respondan esto» y nunca la respuesta sin fuente
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const abrirDocumentos = async ({
  respuesta = RESPUESTA_DOCUMENTOS as unknown,
  responder = null as (() => Response) | null,
  permisos = EQUIPO_IA as CallerPermissions,
  ruta = '/projects/p1/overview',
  estado = ESTADO_ACTIVO as unknown
} = {}) => {
  fetch = mockFetch(baseDeIa(estado))
  red = espiarRed([{ method: 'POST', path: '/sgspe/ai/knowledge/questions', responder: responder ?? (() => jsonResponse(respuesta)) }])
  montar(
    <ProveedorDelAsistente>
      <BotonPreguntar />
    </ProveedorDelAsistente>,
    { ruta, usuario: GERENCIA_IA, permisos }
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Preguntar' }))
  return screen.findByRole('dialog', { name: 'Asistente de IA' })
}
const preguntar = async (panel: HTMLElement) => {
  await userEvent.click(within(panel).getByRole('tab', { name: 'Preguntar a los documentos' }))
  await userEvent.type(within(panel).getByLabelText('Su pregunta'), '¿Qué pidió la asamblea?')
}

describe('S05 · preguntar a los documentos', () => {
  it('pregunta sobre el proyecto de la ruta y muestra las fuentes con su cita re-identificada', async () => {
    const panel = await abrirDocumentos()
    await preguntar(panel)
    await userEvent.click(within(panel).getByRole('button', { name: 'Preguntar' }))
    expect(await within(panel).findByText('Fuente 1 · Acta de la asamblea de agosto')).toBeInTheDocument()
    await waitFor(() => expect(within(panel).getAllByText('Ana Ejemplo')).toHaveLength(2))
    expect(within(panel).getByText('Tipo: ACTA · Clasificación: CONFIDENCIAL')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Abrir el documento' })).toHaveAttribute('href', '/r/evidence/ev1')
    expect(red!.a('POST', '/sgspe/ai/knowledge/questions')[0].cuerpo).toEqual({ question: '¿Qué pidió la asamblea?', project: 'p1' })
  })

  it('sin citas dice que no encontró documentos y no muestra la respuesta del servidor', async () => {
    const panel = await abrirDocumentos({ respuesta: SIN_EVIDENCIA })
    await preguntar(panel)
    await userEvent.click(within(panel).getByRole('button', { name: 'Preguntar' }))
    expect(await within(panel).findByText('No encontré documentos que respondan esto.')).toBeInTheDocument()
    expect(within(panel).queryByText(/No hay evidencia/)).not.toBeInTheDocument()
  })

  it('sin una cita válida, aunque el modelo haya respondido, tampoco muestra la respuesta', async () => {
    const panel = await abrirDocumentos({ respuesta: SIN_CITA_VALIDA })
    await preguntar(panel)
    await userEvent.click(within(panel).getByRole('button', { name: 'Preguntar' }))
    expect(await within(panel).findByText('No encontré documentos que respondan esto.')).toBeInTheDocument()
    expect(within(panel).queryByText(/cita que respalde/)).not.toBeInTheDocument()
  })

  // 7.2c: 404 si quien pregunta no lee el proyecto, sin decir si existe
  it('un proyecto que la cuenta no lee se dice sin distinguir si existe', async () => {
    const panel = await abrirDocumentos({ responder: () => problema(404, 'Not Found') })
    await preguntar(panel)
    await userEvent.click(within(panel).getByRole('button', { name: 'Preguntar' }))
    expect(await within(panel).findByText('El proyecto no existe o no es de sus proyectos: elija otro.')).toBeInTheDocument()
  })

  it('una fuente citada que no se descarga no muestra la cita', async () => {
    const panel = await abrirDocumentos({ permisos: SIN_DESCARGA })
    await preguntar(panel)
    await userEvent.click(within(panel).getByRole('button', { name: 'Preguntar' }))
    expect(await within(panel).findByText('Fuente restringida')).toBeInTheDocument()
    expect(within(panel).queryByRole('link', { name: 'Abrir el documento' })).not.toBeInTheDocument()
    expect(within(panel).queryByText(/reservorio para el anexo/)).not.toBeInTheDocument()
  })

  it('sin proyecto en la ruta pide elegirlo antes de preguntar', async () => {
    const panel = await abrirDocumentos({ ruta: '/' })
    await preguntar(panel)
    expect(within(panel).getByText('Elija el proyecto cuyos documentos quiere consultar.')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Preguntar' })).toBeDisabled()
    await userEvent.selectOptions(await within(panel).findByLabelText('Proyecto'), 'p1')
    await userEvent.click(within(panel).getByRole('button', { name: 'Preguntar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai/knowledge/questions')).toHaveLength(1))
    expect(red!.a('POST', '/sgspe/ai/knowledge/questions')[0].cuerpo).toEqual({ question: '¿Qué pidió la asamblea?', project: 'p1' })
  })

  it('quien no tiene preguntar a los documentos no ve esa pestaña', async () => {
    const panel = await abrirDocumentos({ estado: ESTADO_SOLO_DATOS })
    expect(within(panel).queryByRole('tab', { name: 'Preguntar a los documentos' })).not.toBeInTheDocument()
    expect(within(panel).getByLabelText('Su pregunta')).toBeInTheDocument()
  })
})
