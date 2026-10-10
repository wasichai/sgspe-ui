import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { baseDeRiesgos, DEF_REGLA, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS, REGLA, RELACIONES_EN_RIESGOS } from '../../test/riesgos'
import { ReglasPage } from './ReglasPage'

// S60 · reglas de alerta (workflows.md, «Tipos de regla de JOB-04»; ASM-097): la explicación de cada tipo, el umbral entero (de 1 a
// 25 en NIVEL DE RIESGO) y la ventana de 1 a 365 antes de mandar, el OUT_OF_RANGE del servidor junto a su campo, sin CAMBIO DE
// POSTURA, las reglas de la organización aparte de las del proyecto, desactivar y borrar con HAS_DEPENDENTS
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const DE_LA_ORGANIZACION = registro('rg0', { name: 'QCS de la organización', rule_kind: 'CONTEO DE QCS', threshold: 10, window_days: 30, enabled: true })
// un catálogo viejo que todavía trae CAMBIO DE POSTURA: el formulario no lo ofrece
const DEF_CON_POSTURA = {
  ...DEF_REGLA,
  fields: DEF_REGLA.fields.map((f) =>
    f.name === 'rule_kind' ? { ...f, enumOptions: [...((f.enumOptions as unknown as string[] | null) ?? []), 'CAMBIO DE POSTURA'] } : f
  )
}

const rutas = (usuario = GESTOR_DE_RIESGOS, extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeRiesgos(usuario),
  { path: '/objects/early_warning_rule/records', body: pagina([REGLA, DE_LA_ORGANIZACION]) }
]
const delProyecto = (usuario = GESTOR_DE_RIESGOS, permisos = EQUIPO_DE_RIESGOS) =>
  montar(<ReglasPage />, { ruta: '/projects/p1/risks/rules', camino: '/projects/:projectId/risks/rules', usuario, permisos })

describe('S60 · reglas de alerta', () => {
  it('explica el tipo elegido, valida umbral y ventana antes de mandar y crea la regla en el proyecto', async () => {
    fetch = mockFetch(
      rutas(GESTOR_DE_RIESGOS, [
        { path: '/metadata/objects/early_warning_rule', body: DEF_CON_POSTURA },
        { method: 'POST', path: '/objects/early_warning_rule/records', status: 201, body: registro('rg2', { project: 'p1', name: 'Riesgos críticos' }) }
      ])
    )
    red = espiarRed()
    delProyecto()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva regla' }))
    const drawer = await screen.findByRole('dialog', { name: 'Nueva regla' })
    const tipo = within(drawer).getByLabelText('Tipo de regla')
    expect(within(tipo).queryByRole('option', { name: 'CAMBIO DE POSTURA' })).not.toBeInTheDocument()
    await userEvent.selectOptions(tipo, 'NIVEL DE RIESGO')
    expect(within(drawer).getByRole('note')).toHaveTextContent('puntaje vigente (probabilidad por impacto) llega al umbral, de 1 a 25')
    await userEvent.type(within(drawer).getByLabelText('Nombre'), 'Riesgos críticos')
    await userEvent.type(within(drawer).getByLabelText('Puntaje mínimo (probabilidad por impacto)'), '30')
    await userEvent.type(within(drawer).getByLabelText('Silencio tras una alerta (días)'), '400')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar' }))
    expect(within(drawer).getByText('Escriba un número entero de 1 a 25.')).toBeInTheDocument()
    expect(within(drawer).getByText('Escriba un número entero de 1 a 365, o déjelo vacío.')).toBeInTheDocument()
    expect(red.a('POST', '/objects/early_warning_rule/records')).toHaveLength(0)
    await userEvent.clear(within(drawer).getByLabelText('Puntaje mínimo (probabilidad por impacto)'))
    await userEvent.type(within(drawer).getByLabelText('Puntaje mínimo (probabilidad por impacto)'), '15')
    await userEvent.clear(within(drawer).getByLabelText('Silencio tras una alerta (días)'))
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/early_warning_rule/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/early_warning_rule/records')[0].cuerpo).toMatchObject({
      attributes: { project: 'p1', name: 'Riesgos críticos', rule_kind: 'NIVEL DE RIESGO', threshold: 15, window_days: null, enabled: true }
    })
  })

  it('un OUT_OF_RANGE del servidor se dice junto al umbral', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/early_warning_rule/records',
        responder: () => problema(400, 'fuera de rango', [{ field: 'threshold', message: 'OUT_OF_RANGE' }])
      }
    ])
    delProyecto()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva regla' }))
    const drawer = await screen.findByRole('dialog', { name: 'Nueva regla' })
    await userEvent.selectOptions(within(drawer).getByLabelText('Tipo de regla'), 'INCIDENTES')
    await userEvent.type(within(drawer).getByLabelText('Nombre'), 'Incidentes')
    await userEvent.type(within(drawer).getByLabelText('Umbral'), '2')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar' }))
    expect(await within(drawer).findByText('El número está fuera del rango permitido.')).toBeInTheDocument()
    expect(within(drawer).getByLabelText('Umbral')).toHaveAccessibleDescription('El número está fuera del rango permitido.')
  })

  it('las reglas de la organización se listan sin las de un proyecto', async () => {
    fetch = mockFetch(rutas())
    montar(<ReglasPage />, { ruta: '/risks/rules', camino: '/risks/rules', usuario: GESTOR_DE_RIESGOS, permisos: EQUIPO_DE_RIESGOS })
    const tabla = await screen.findByRole('table', { name: 'Reglas de alerta' })
    expect(within(tabla).getByText('QCS de la organización')).toBeInTheDocument()
    expect(within(tabla).getByText('Organización')).toBeInTheDocument()
    expect(within(tabla).queryByText('Señales de conflicto')).not.toBeInTheDocument()
  })

  it('desactivar manda enabled falso con la versión leída; borrar una regla con alertas dice que se desactive', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/early_warning_rule/records/rg1',
        responder: () => jsonResponse({ ...REGLA, attributes: { ...REGLA.attributes, enabled: false } })
      },
      {
        method: 'DELETE',
        path: '/objects/early_warning_rule/records/rg1',
        responder: () => problema(409, 'tiene alertas', [{ field: 'early_warning.early_warning_rule', message: 'HAS_DEPENDENTS' }])
      }
    ])
    delProyecto()
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar Señales de conflicto' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/early_warning_rule/records/rg1')).toHaveLength(1))
    const [put] = red.a('PUT', '/objects/early_warning_rule/records/rg1')
    expect(put.cuerpo).toMatchObject({ attributes: { enabled: false } })
    expect(put.cabeceras.get('If-Match')).toBe(`"${REGLA.updatedAt}"`)
    await userEvent.click(screen.getByRole('button', { name: 'Borrar Señales de conflicto' }))
    expect(screen.getByText('¿Borrar la regla «Señales de conflicto»? No se puede deshacer.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(await screen.findByText(/desactívela en lugar de borrarla/)).toBeInTheDocument()
  })

  it('editar manda solo lo que la persona cambió: tras un 412 y «Recargar», no pisa lo que otra persona guardó', async () => {
    // A abre la regla con umbral 3 y cambia solo el nombre; B guarda umbral 5 antes
    const DE_B = { ...REGLA, updatedAt: '2026-10-06T11:00:00Z', attributes: { ...REGLA.attributes, threshold: 5 } }
    fetch = mockFetch(rutas())
    let lecturas = 0
    let cambios = 0
    red = espiarRed([
      { path: '/objects/early_warning_rule/records', responder: () => jsonResponse(pagina(++lecturas === 1 ? [REGLA] : [DE_B])) },
      {
        method: 'PUT',
        path: '/objects/early_warning_rule/records/rg1',
        responder: () => (++cambios === 1 ? problema(412, 'Precondition Failed') : jsonResponse(DE_B))
      }
    ])
    delProyecto()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Señales de conflicto' }))
    const drawer = await screen.findByRole('dialog')
    const nombre = await within(drawer).findByLabelText('Nombre')
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Señales de bloqueo')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar' }))
    expect(await within(drawer).findByRole('alert')).toHaveTextContent(/Otra persona cambió este registro/)
    await userEvent.click(within(drawer).getByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(within(drawer).queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/early_warning_rule/records/rg1')).toHaveLength(2))
    const [primero, segundo] = red.a('PUT', '/objects/early_warning_rule/records/rg1')
    // el cuerpo lleva el registro vigente con lo cambiado encima: lo no tocado sale del registro, no del formulario
    expect(primero.cuerpo).toMatchObject({ attributes: { name: 'Señales de bloqueo', threshold: 3 } })
    expect(primero.cabeceras.get('If-Match')).toBe(`"${REGLA.updatedAt}"`)
    expect(segundo.cuerpo).toMatchObject({ attributes: { name: 'Señales de bloqueo', threshold: 5 } })
    expect(segundo.cabeceras.get('If-Match')).toBe('"2026-10-06T11:00:00Z"')
  })

  it('quien solo lee ve las reglas sin «Nueva regla», editar, desactivar ni borrar', async () => {
    fetch = mockFetch(rutas(RELACIONISTA))
    delProyecto(RELACIONISTA, RELACIONES_EN_RIESGOS)
    expect(await screen.findByText('Señales de conflicto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva regla' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desactivar|Editar|Borrar/ })).not.toBeInTheDocument()
  })
})
