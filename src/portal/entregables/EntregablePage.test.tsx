import { focusManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prepararEditorEnJsdom } from '../../test/editor'
import { baseDeF8, ENTREGABLE, SUG_SECCION, entregableEn, EQUIPO_DE_ENTREGABLES, SECCION_ANTECEDENTES, SECCION_CONCLUSIONES, SECCIONES } from '../../test/f8'
import { montar, pagina } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { GERENCIA_SOCIAL } from '../../test/portal'
import { espiarRed, problema, type Red, type RutaEspecial } from '../../test/red'
import { EntregablePage } from './EntregablePage'

// S50 (screens.md): el encabezado, el camino de WF-H, las secciones con su origen y sus marcas, y el editor de la sección, que
// solo edita en borrador u observado y pide motivo para una sección asistida por IA
let fetch: FetchMock | null = null
let red: Red | null = null
beforeAll(prepararEditorEnJsdom)
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const rutas = (entregable = ENTREGABLE, secciones = SECCIONES): MockRoute[] => [
  { path: '/objects/deliverable/records/d1', body: entregable },
  { path: '/objects/deliverable_section/records', body: pagina(secciones) },
  { path: '/objects/deliverable_section/records/sec-antecedentes', body: SECCION_ANTECEDENTES },
  { path: '/objects/deliverable_section/records/sec-conclusiones', body: SECCION_CONCLUSIONES },
  ...baseDeF8(GERENCIA_SOCIAL)
]
const abrir = (ruta = '/reports/deliverables/d1', especiales: RutaEspecial[] = [], entregable = ENTREGABLE, secciones = SECCIONES) => {
  fetch = mockFetch(rutas(entregable, secciones))
  red = espiarRed(especiales)
  montar(<EntregablePage />, { ruta, camino: '/reports/deliverables/:deliverableId', usuario: GERENCIA_SOCIAL, permisos: EQUIPO_DE_ENTREGABLES })
}
const guardado = (id: string): RutaEspecial => ({
  method: 'PUT',
  path: `/objects/deliverable_section/records/${id}`,
  responder: () => jsonResponse(SECCION_ANTECEDENTES)
})

describe('S50 · entregable por secciones', () => {
  it('muestra el encabezado, el camino de WF-H y las secciones con su origen y sus marcas', async () => {
    abrir()
    expect(await screen.findByRole('heading', { level: 1, name: 'Informe de campo de la Comunidad Ejemplo' })).toBeInTheDocument()
    // el código va en el antetítulo del encabezado común, con el tipo (revisión de UX, etapa 4)
    expect(screen.getByText(/^INF-001 · /)).toBeInTheDocument()
    const camino = screen.getByRole('navigation', { name: 'Camino del entregable' })
    expect(await within(camino).findByText('Borrador')).toHaveAttribute('aria-current', 'step')
    const lista = await screen.findByRole('navigation', { name: 'Secciones' })
    const conclusiones = within(lista).getByRole('button', { name: /Conclusiones/ })
    expect(conclusiones).toHaveTextContent('Asistido por IA')
    expect(conclusiones).toHaveTextContent('Con IA')
    expect(conclusiones).toHaveTextContent('Cambió después del borrador')
    expect(within(lista).getByRole('button', { name: /Antecedentes/ })).not.toHaveTextContent('Cambió después del borrador')
  })

  it('muestra la guía de redacción del backend, edita una sección humana y la guarda con su versión, sin motivo', async () => {
    abrir('/reports/deliverables/d1?seccion=antecedentes', [guardado('sec-antecedentes')])
    await screen.findByRole('heading', { level: 2, name: 'Antecedentes' })
    expect(await screen.findByText('Guía de redacción')).toBeInTheDocument()
    expect(screen.getByText('Incidentes del proyecto y relación con los grupos de interés.')).toBeInTheDocument()
    // el editor llega en su chunk diferido
    await userEvent.click(await screen.findByRole('button', { name: 'Editar como Markdown' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Texto de la sección' }), ' Con acta.')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Revisada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/deliverable_section/records/sec-antecedentes')).toHaveLength(1))
    const [cambio] = red!.a('PUT', '/objects/deliverable_section/records/sec-antecedentes')
    expect(cambio.cuerpo).toMatchObject({
      attributes: { content: 'La comunidad pidió una reunión en agosto. Con acta.', reviewed: true, content_origin: 'HUMANO' }
    })
    expect(cambio.cabeceras.get('If-Match')).toBe('"2026-10-09T15:00:00Z"')
    expect(cambio.cabeceras.get('X-Change-Reason')).toBeNull()
  })

  it('una sección asistida por IA pide motivo para guardar y explica el cerrojo del origen', async () => {
    abrir('/reports/deliverables/d1?seccion=conclusiones', [
      {
        method: 'PUT',
        path: '/objects/deliverable_section/records/sec-conclusiones',
        responder: () => problema(422, 'x', [{ field: 'content_origin', message: 'AI_ORIGIN_LOCKED' }])
      }
    ])
    await screen.findByRole('heading', { level: 2, name: 'Conclusiones' })
    await userEvent.click(await screen.findByRole('button', { name: 'Editar como Markdown' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Texto de la sección' }), ' Y algo más.')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }))
    expect(screen.getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red!.a('PUT', '/objects/deliverable_section/records/sec-conclusiones')).toHaveLength(0)
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Corrección de la reunión')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }))
    expect(await screen.findByText(/conserva ese origen durante toda la vida del entregable/)).toBeInTheDocument()
    const [cambio] = red!.a('PUT', '/objects/deliverable_section/records/sec-conclusiones')
    expect(cambio.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Correcci%C3%B3n%20de%20la%20reuni%C3%B3n")
  })

  it('una calculada no se edita; fuera de borrador u observado tampoco, y la mención se lee como ficha', async () => {
    abrir('/reports/deliverables/d1?seccion=portada')
    expect(await screen.findByText('Sección calculada: su contenido sale de los registros al generar el borrador.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar sección' })).not.toBeInTheDocument()
    fetch!.restore()
    red!.restaurar()
    document.body.innerHTML = ''
    abrir('/reports/deliverables/d1?seccion=conclusiones', [], entregableEn('in_review'))
    expect(await screen.findByText('Las secciones se editan con el entregable en borrador u observado.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Texto de la sección' })).not.toBeInTheDocument()
    expect(screen.getByText('@persona 9b8a7c6d')).toBeInTheDocument()
  })

  it('una calculada se muestra de solo lectura con su contenido', async () => {
    const portada = { ...SECCIONES[0], attributes: { ...SECCIONES[0].attributes, content: 'Informe del **periodo** de septiembre.' } }
    abrir('/reports/deliverables/d1?seccion=portada', [], ENTREGABLE, [portada, ...SECCIONES.slice(1)])
    expect(await screen.findByText('Sección calculada: su contenido sale de los registros al generar el borrador.')).toBeInTheDocument()
    expect(screen.getByText('periodo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar sección' })).not.toBeInTheDocument()
  })

  it('un 400 de motivo se explica para la sección y el guardado hecho no se repite', async () => {
    abrir('/reports/deliverables/d1?seccion=antecedentes', [
      {
        method: 'PUT',
        path: '/objects/deliverable_section/records/sec-antecedentes',
        responder: () => problema(400, 'x', [{ field: 'content', message: 'FIELD_REASON_REQUIRED' }])
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar como Markdown' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Texto de la sección' }), ' Más.')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }))
    expect(await screen.findByText('Esta sección está asistida por IA: guardar un cambio exige un motivo.')).toBeInTheDocument()
  })

  it('tras guardar bien, el botón no admite un segundo guardado con la versión vieja', async () => {
    abrir('/reports/deliverables/d1?seccion=antecedentes', [guardado('sec-antecedentes')])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar como Markdown' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Texto de la sección' }), ' Más.')
    const boton = screen.getByRole('button', { name: 'Guardar sección' })
    await userEvent.click(boton)
    await userEvent.click(boton)
    await waitFor(() => expect(red!.a('PUT', '/objects/deliverable_section/records/sec-antecedentes')).toHaveLength(1))
  })

  it('vive en /reports/deliverables/:deliverableId', async () => {
    fetch = abrirPortal('/reports/deliverables/d1', GERENCIA_SOCIAL, EQUIPO_DE_ENTREGABLES, [
      ...rutas(),
      { path: '/sgspe/deliverables/d1/draft', body: { status: null, pending: false, levels: [], warnings: [] } },
      { path: '/objects/deliverable/records/d1/transitions', body: [] },
      { path: '/objects/deliverable_version/records', body: pagina([]) },
      { path: '/objects/deliverable/records/d1/documents', body: [] },
      { path: '/objects/ai_suggestion/records', body: pagina([]) }
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'Informe de campo de la Comunidad Ejemplo' })).toBeInTheDocument()
  })

  it('con cambios sin guardar el panel de IA no deja usar la sugerencia, y sí tras guardar', async () => {
    abrir('/reports/deliverables/d1?seccion=antecedentes', [
      guardado('sec-antecedentes'),
      {
        method: 'GET',
        path: /ai_suggestion\/records.*suggestion_kind=BORRADOR/,
        responder: () => jsonResponse(pagina([SUG_SECCION]))
      }
    ])
    const usar = await screen.findByRole('button', { name: 'Usar…' })
    expect(usar).toBeEnabled()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar como Markdown' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Texto de la sección' }), ' Más.')
    expect(screen.getByRole('button', { name: 'Usar…' })).toBeDisabled()
    expect(screen.getAllByText('Guarde o descarte los cambios de la sección antes de usar una sugerencia.').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Revisada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/deliverable_section/records/sec-antecedentes')).toHaveLength(1))
  })

  it('con cambios sin guardar, cambiar de sección pide confirmación y solo cambia al descartar', async () => {
    abrir('/reports/deliverables/d1?seccion=antecedentes')
    await userEvent.click(await screen.findByRole('button', { name: 'Editar como Markdown' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Texto de la sección' }), ' Sin guardar.')
    const lista = screen.getByRole('navigation', { name: 'Secciones' })
    await userEvent.click(within(lista).getByRole('button', { name: /Conclusiones/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Hay cambios sin guardar' })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Antecedentes' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Texto de la sección' })).toHaveValue('La comunidad pidió una reunión en agosto. Sin guardar.')
    await userEvent.click(within(lista).getByRole('button', { name: /Conclusiones/ }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Descartar' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Conclusiones' })).toBeInTheDocument()
    // sin cambios, se cambia de sección sin preguntar
    await userEvent.click(within(lista).getByRole('button', { name: /Antecedentes/ }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Antecedentes' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('una relectura de la lista no vuelve a montar el editor con cambios: el guardado dice 412 y Recargar conserva lo escrito', async () => {
    let otraGuardo = false
    const ajena = {
      ...SECCION_ANTECEDENTES,
      updatedAt: '2026-10-12T15:00:00Z',
      attributes: { ...SECCION_ANTECEDENTES.attributes, content: 'Texto de otra persona.' }
    }
    const vigente = () => (otraGuardo ? ajena : SECCION_ANTECEDENTES)
    let guardados = 0
    abrir('/reports/deliverables/d1?seccion=antecedentes', [
      {
        method: 'GET',
        path: '/objects/deliverable_section/records',
        responder: () => jsonResponse(pagina(SECCIONES.map((s) => (s.id === 'sec-antecedentes' ? vigente() : s))))
      },
      { method: 'GET', path: '/objects/deliverable_section/records/sec-antecedentes', responder: () => jsonResponse(vigente()) },
      {
        method: 'PUT',
        path: '/objects/deliverable_section/records/sec-antecedentes',
        responder: () => (++guardados === 1 ? problema(412, 'x') : jsonResponse(ajena))
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar como Markdown' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Texto de la sección' }), ' Mío.')
    otraGuardo = true
    const antes = red!.a('GET', '/objects/deliverable_section/records').length
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    focusManager.setFocused(undefined)
    await waitFor(() => expect(red!.a('GET', '/objects/deliverable_section/records').length).toBeGreaterThan(antes))
    // la lista ya llegó: la sección ajena cambió después del borrador
    const lista = screen.getByRole('navigation', { name: 'Secciones' })
    await waitFor(() => expect(within(lista).getByRole('button', { name: /Antecedentes/ })).toHaveTextContent('Cambió después del borrador'))
    expect(screen.getByRole('textbox', { name: 'Texto de la sección' })).toHaveValue('La comunidad pidió una reunión en agosto. Mío.')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Texto de la sección' })).toHaveValue('La comunidad pidió una reunión en agosto. Mío.')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sección' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/deliverable_section/records/sec-antecedentes')).toHaveLength(2))
    const [primero, segundo] = red!.a('PUT', '/objects/deliverable_section/records/sec-antecedentes')
    expect(primero.cabeceras.get('If-Match')).toBe('"2026-10-09T15:00:00Z"')
    expect(segundo.cabeceras.get('If-Match')).toBe('"2026-10-12T15:00:00Z"')
    expect(segundo.cuerpo).toMatchObject({ attributes: { content: 'La comunidad pidió una reunión en agosto. Mío.' } })
  })
})
