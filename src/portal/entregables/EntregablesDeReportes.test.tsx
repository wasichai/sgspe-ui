import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeF8, COMUNIDAD, EJECUTIVA, ENTREGABLE, EQUIPO_DE_ENTREGABLES, PLANTILLA, SOLO_LECTURA_F8 } from '../../test/f8'
import { montar, pagina, registro, ubicacion } from '../../test/montar'
import { ADMIN_PERMISOS, ADMINISTRACION, GERENCIA_SOCIAL } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { EntregablesDeReportes } from './EntregablesDeReportes'

// S49 (screens.md): la tabla de entregables y «Nuevo entregable» con el alcance que pide cada tipo, con motivo, que lleva a S50
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const ESTUDIO = registro('st1', { project: 'p1', name: 'Estudio Ejemplo 2026' })
const AIDS = registro('a1', { project: 'p1', area_type: 'AIDS', version_number: 2 }, { state: 'approved' })
const AIDS_BORRADOR = registro('a2', { project: 'p1', area_type: 'AIDS', version_number: 3 }, { state: 'draft' })
const abrir = (ruta = '/projects/p1/reports', usuario = GERENCIA_SOCIAL, permisos = EQUIPO_DE_ENTREGABLES) => {
  fetch = mockFetch([
    { path: '/objects/deliverable/records', body: pagina([ENTREGABLE]) },
    { path: '/sgspe/deliverable-templates', body: [PLANTILLA] },
    { path: '/objects/community/records', body: pagina([COMUNIDAD]) },
    { path: '/objects/study/records', body: pagina([ESTUDIO]) },
    { path: '/objects/area_of_influence/records', body: pagina([AIDS, AIDS_BORRADOR]) },
    ...baseDeF8(usuario)
  ])
  red = espiarRed([{ method: 'POST', path: '/objects/deliverable/records', responder: () => jsonResponse({ ...ENTREGABLE, id: 'd9' }, 201) }])
  montar(<EntregablesDeReportes />, { ruta, camino: ruta.startsWith('/projects/') ? '/projects/:projectId/reports' : '/reports', usuario, permisos })
}

describe('S49 · entregables', () => {
  it('lista los entregables con su estado, su borrador y sus niveles, y enlaza a cada uno dentro de su proyecto', async () => {
    abrir()
    const tabla = await screen.findByRole('table', { name: 'Entregables' })
    // el código en gris y el título como enlace a su página (revisión de UX, etapa 7)
    expect(within(tabla).getByText('INF-001')).toBeInTheDocument()
    expect(within(tabla).getByRole('link', { name: 'Informe de campo de la Comunidad Ejemplo' })).toHaveAttribute(
      'href',
      '/projects/p1/reports/deliverables/d1'
    )
    const fila = within(tabla).getByRole('link', { name: 'Informe de campo de la Comunidad Ejemplo' }).closest('tr')!
    expect(within(fila).getByText('Informe de campo y avance')).toBeInTheDocument()
    expect(within(fila).getByText('Listo')).toBeInTheDocument()
    // los niveles como etiquetas (lienzo S12 de Civic Modern), una por nivel
    expect(within(fila).getByText('Interno')).toBeInTheDocument()
    expect(within(fila).getByText('Externo')).toBeInTheDocument()
  })

  it('dice el tipo como etiqueta T1 o T2, las secciones revisadas mientras se revisa y la causa de un borrador fallido', async () => {
    const fallido = registro(
      'd2',
      {
        ...ENTREGABLE.attributes,
        document_code: 'INF-002',
        title: 'Informe de octubre',
        draft_generation_status: 'FALLIDO',
        draft_warnings: 'MAP_FAILED anexo-mapa'
      },
      { state: 'observed' }
    )
    const emitido = registro(
      'd3',
      { ...ENTREGABLE.attributes, document_code: 'DSO-001', title: 'Diagnóstico', deliverable_type: 'DIAGNOSTICO SOCIAL', current_revision: 'B' },
      { state: 'issued' }
    )
    fetch = mockFetch([
      { path: '/objects/deliverable/records', body: pagina([ENTREGABLE, fallido, emitido]) },
      // dos conteos por entregable en curso: todas sus secciones y las revisadas
      { path: /\/objects\/deliverable_section\/records\?deliverable=d1&reviewed=true/, body: { ...pagina([]), totalElements: 3 } },
      { path: /\/objects\/deliverable_section\/records\?deliverable=d1&size/, body: { ...pagina([]), totalElements: 11 } },
      { path: '/objects/deliverable_section/records', body: { ...pagina([]), totalElements: 0 } },
      ...baseDeF8(GERENCIA_SOCIAL)
    ])
    montar(<EntregablesDeReportes />, {
      ruta: '/projects/p1/reports',
      camino: '/projects/:projectId/reports',
      usuario: GERENCIA_SOCIAL,
      permisos: EQUIPO_DE_ENTREGABLES
    })
    const tabla = await screen.findByRole('table', { name: 'Entregables' })
    const fila = (titulo: string) => within(tabla).getByRole('link', { name: titulo }).closest('tr')!
    // el tipo: visible la abreviatura, entero para el lector de pantalla
    expect(within(fila('Informe de campo de la Comunidad Ejemplo')).getByText('T2')).toHaveAttribute('aria-hidden')
    expect(within(fila('Diagnóstico')).getByText('Diagnóstico social')).toBeInTheDocument()
    expect(await within(fila('Informe de campo de la Comunidad Ejemplo')).findByText('Revisadas: 3 de 11')).toBeInTheDocument()
    // FALLIDO en danger con su causa en pocas palabras
    const borrador = within(fila('Informe de octubre')).getByText('Fallido').parentElement!
    expect(borrador).toHaveClass('text-sg-danger')
    expect(borrador).toHaveTextContent('mapa sin dibujar')
    // emitido: la revisión emitida, no el conteo
    expect(within(fila('Diagnóstico')).getByText('B')).toBeInTheDocument()
  })

  it('fuera de un proyecto, enlaza a la ruta global de cada entregable', async () => {
    abrir('/reports')
    const tabla = await screen.findByRole('table', { name: 'Entregables' })
    expect(within(tabla).getByRole('link', { name: 'Informe de campo de la Comunidad Ejemplo' })).toHaveAttribute('href', '/reports/deliverables/d1')
  })

  it('un informe de campo pide la comunidad y el periodo, y se crea con motivo', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo entregable' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo entregable' })
    await within(dialogo).findByRole('option', { name: 'Informe de campo y avance' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo de entregable'), 'INFORME DE CAMPO Y AVANCE')
    await userEvent.type(within(dialogo).getByLabelText('Código del documento'), 'INF-002')
    await userEvent.type(within(dialogo).getByLabelText('Título'), 'Informe de octubre')
    await userEvent.type(within(dialogo).getByLabelText('Inicio del periodo'), '01/10/2026')
    await userEvent.type(within(dialogo).getByLabelText('Fin del periodo'), '31/10/2026')
    expect(within(dialogo).queryByLabelText('Fecha de corte')).not.toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear entregable' }))
    expect(within(dialogo).getByText('Elija la comunidad del informe.')).toBeInTheDocument()
    expect(red!.a('POST', '/objects/deliverable/records')).toHaveLength(0)
    await userEvent.type(within(dialogo).getByLabelText('Buscar la comunidad'), 'Comu')
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'Comunidad Ejemplo' }))
    await userEvent.selectOptions(within(dialogo).getByLabelText('Plantilla'), 'informe-base')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Informe mensual')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear entregable' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/reports/deliverables/d9'))
    const [alta] = red!.a('POST', '/objects/deliverable/records')
    expect(alta.cuerpo).toMatchObject({
      attributes: {
        project: 'p1',
        deliverable_type: 'INFORME DE CAMPO Y AVANCE',
        document_code: 'INF-002',
        title: 'Informe de octubre',
        period_start_date: '2026-10-01',
        period_end_date: '2026-10-31',
        community: 'c1',
        template_key: 'informe-base'
      }
    })
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Informe%20mensual")
  })

  it('un diagnóstico pide el estudio, un área directa aprobada y la fecha de corte', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo entregable' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo entregable' })
    await within(dialogo).findByRole('option', { name: 'Diagnóstico social' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo de entregable'), 'DIAGNOSTICO SOCIAL')
    expect(await within(dialogo).findByRole('option', { name: 'Estudio Ejemplo 2026' })).toBeInTheDocument()
    const areas = within(dialogo).getByLabelText('Área de influencia directa social aprobada')
    expect(within(areas).getByRole('option', { name: 'AIDS · v2' })).toBeInTheDocument()
    expect(within(areas).queryByRole('option', { name: 'AIDS · v3' })).not.toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Fecha de corte')).toBeInTheDocument()
    expect(within(dialogo).queryByLabelText('Buscar la comunidad')).not.toBeInTheDocument()
  })

  // rediseño de UX (2026-10-20): sin proyecto en la barra, «Nuevo entregable» salía deshabilitado y un texto mandaba al selector;
  // ahora pide el proyecto (o va directo al único donde escribe), como toda alta con el alcance global (BotonCrear), y abre el formulario en el elegido
  it('sin un proyecto en la barra pide el proyecto y abre el formulario; sin CREATE no se ofrece', async () => {
    abrir('/projects/p1/reports', EJECUTIVA, SOLO_LECTURA_F8)
    await screen.findByRole('table', { name: 'Entregables' })
    expect(screen.queryByRole('button', { name: 'Nuevo entregable' })).not.toBeInTheDocument()
    fetch!.restore()
    red!.restaurar()
    cleanup()
    fetch = mockFetch([
      { path: '/objects/deliverable/records', body: pagina([ENTREGABLE]) },
      { path: '/sgspe/deliverable-templates', body: [PLANTILLA] },
      ...baseDeF8(GERENCIA_SOCIAL)
    ])
    red = espiarRed()
    montar(<EntregablesDeReportes />, { ruta: '/reports', camino: '/reports', usuario: GERENCIA_SOCIAL, permisos: EQUIPO_DE_ENTREGABLES })
    const nuevo = await screen.findByRole('button', { name: 'Nuevo entregable' })
    await waitFor(() => expect(nuevo).toBeEnabled())
    expect(screen.queryByText('Elija un proyecto para crear un entregable.')).not.toBeInTheDocument()
    // con una sola asignación vigente no hay qué elegir: abre el formulario en ese proyecto
    await userEvent.click(nuevo)
    expect(await screen.findByRole('dialog', { name: 'Nuevo entregable' })).toBeInTheDocument()
  })

  it('«Plantillas» solo para la administración', async () => {
    abrir()
    await screen.findByRole('table', { name: 'Entregables' })
    expect(screen.queryByRole('link', { name: 'Plantillas' })).not.toBeInTheDocument()
    fetch!.restore()
    red!.restaurar()
    cleanup()
    abrir('/projects/p1/reports', ADMINISTRACION, ADMIN_PERMISOS)
    expect(await screen.findByRole('link', { name: 'Plantillas' })).toHaveAttribute('href', '/reports/templates')
  })
})
