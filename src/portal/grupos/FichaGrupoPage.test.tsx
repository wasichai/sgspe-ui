import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro } from '../../test/montar'
import { hoyEnLima } from '../datos/fechas'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { base, LEE, S1, STK_DEF } from '../../test/grupos'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))
vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

describe('S17 · ficha de grupo de interés y S20 · nueva evaluación', () => {
  it('sin acceso a la postura muestra candados y no ofrece evaluar', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', RELACIONISTA, LEE, base())
    expect(await screen.findByRole('heading', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
    const decidir = screen.getByRole('region', { name: 'Para decidir' })
    expect(within(decidir).getByText('ESTRATEGICO')).toBeInTheDocument()
    expect(await within(decidir).findByText('Restringido')).toBeInTheDocument()
    // la postura y la confianza del grupo de interés son el último valor informado (ASM-087)
    expect(within(decidir).getByText('Postura vigente')).toHaveAttribute('title', 'El último valor informado en una evaluación (ASM-087)')
    expect(within(decidir).getByText('Confianza vigente')).toBeInTheDocument()
    expect(within(decidir).getByText('2 de 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva evaluación' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('complementary', { name: 'Qué generó' })).getByRole('link', { name: 'Asamblea de agosto' })).toHaveAttribute(
      'href',
      '/projects/p1/engagements/e1'
    )
    expect(await screen.findByRole('button', { name: 'Editar la caracterización' })).toBeInTheDocument()
  })

  it('con "u" sobre stakeholder (todos los campos de solo lectura, como el agente de campo) no ofrece editar el perfil', async () => {
    const soloLectura = { ...STK_DEF(false), fields: STK_DEF(false).fields.map((f) => ({ ...f, editable: false })) }
    fetch = abrirPortal('/projects/p1/stakeholders/s1', RELACIONISTA, LEE, [{ path: '/metadata/objects/stakeholder', body: soloLectura }, ...base()])
    red = espiarRed()
    expect(await screen.findByRole('heading', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
    await waitFor(() => expect(red!.a('GET', '/metadata/objects/stakeholder').length).toBeGreaterThan(0))
    expect(await within(screen.getByRole('region', { name: 'Para decidir' })).findByText('Restringido')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar la caracterización' })).not.toBeInTheDocument()
  })

  it('la historia de evaluaciones llega hasta la línea base y marca el ajuste manual', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    const historia = await screen.findByRole('region', { name: 'Evaluaciones' })
    expect(await within(historia).findByText(/2026-03-01 · INFERIDA/)).toHaveTextContent('(línea base)')
    expect(within(historia).getByText(/ajustado a mano/)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Para decidir' })).getByText('Cambió frente a la línea base')).toBeInTheDocument()
  })

  it('evaluar: pide la vista previa al completar los indicadores, exige motivo y guarda con clave, versión y motivo', async () => {
    const PREVIA = {
      computed: { interest_index: 3, power_index: 2.67, influence_score: 5.67, influence_group: 'PARA MONITOREO', information_priority: 'ALTA' },
      warnings: [{ code: 'STANCE_DIVERGENCE' }]
    }
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, [
      ...base(GERENCIA_SOCIAL, true),
      { method: 'POST', path: '/sgspe/stakeholders/s1/assessments/preview', body: PREVIA },
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        status: 201,
        body: { assessment: registro('ev3', {}), stakeholder: S1, warnings: [{ code: 'STANCE_DIVERGENCE' }] }
      }
    ])
    red = espiarRed()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva evaluación' }))
    expect(rutaActual()).toBe('/projects/p1/stakeholders/s1?drawer=assessment')
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    expect(within(drawer).getByText('(antes: 5)')).toBeInTheDocument()
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Base de la evaluación' }), 'ENTREVISTA')
    for (const grupo of within(drawer).getAllByRole('radiogroup')) await userEvent.click(within(grupo).getByRole('radio', { name: '3' }))
    expect(await within(drawer).findByText('PARA MONITOREO', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(within(drawer).getByText(/Dos evaluaciones cercanas tienen posturas distintas/)).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar evaluación' }))
    expect(await within(drawer).findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/stakeholders/s1/assessments')).toHaveLength(0)
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Postura' }), 'EN CONTRA PERO ABIERTO A ESCUCHAR')
    // la postura elegida viaja en la vista previa antes de guardar
    await waitFor(() =>
      expect(red!.a('POST', '/sgspe/stakeholders/s1/assessments/preview').at(-1)?.cuerpo).toMatchObject({
        attributes: { stance: 'EN CONTRA PERO ABIERTO A ESCUCHAR' }
      })
    )
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'Entrevista con la junta')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar evaluación' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholders/s1/assessments')).toHaveLength(1))
    const [alta] = red.a('POST', '/sgspe/stakeholders/s1/assessments')
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Entrevista%20con%20la%20junta")
    expect(alta.cabeceras.get('If-Match')).toBe('"2026-10-04T10:00:00.25Z"')
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(alta.cuerpo).toMatchObject({
      attributes: { basis: 'ENTREVISTA', affect_environment: 3, power_other_pressure: 3, stance: 'EN CONTRA PERO ABIERTO A ESCUCHAR', group_overridden: false }
    })
    expect(red.a('POST', '/sgspe/stakeholders/s1/assessments/preview')[0].cuerpo).toMatchObject({ attributes: { affect_environment: 3 } })
    // la vista previa lleva la fecha (hoy en Lima) y, una vez elegida, la postura: de ellas dependen sus advertencias
    const fechaDeLima = hoyEnLima()
    expect(red.a('POST', '/sgspe/stakeholders/s1/assessments/preview')[0].cuerpo).toMatchObject({ attributes: { assessment_date: fechaDeLima } })
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/stakeholders/s1'))
    expect(await screen.findByText(/Dos evaluaciones cercanas tienen posturas distintas/)).toBeInTheDocument()
  })

  it('un grupo de interés retirado (409 STATE_MISMATCH) lo dice en el drawer', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        responder: () => problema(409, 'retirado', [{ field: 'state', message: 'STATE_MISMATCH' }])
      },
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments/preview',
        responder: () => new Response('{"computed":{"interest_index":3,"power_index":3,"influence_score":6,"influence_group":"ESTRATEGICO"},"warnings":[]}')
      }
    ])
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Base de la evaluación' }), 'ENTREVISTA')
    for (const grupo of within(drawer).getAllByRole('radiogroup')) await userEvent.click(within(grupo).getByRole('radio', { name: '4' }))
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'x')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar evaluación' }))
    expect(await within(drawer).findByText('El grupo de interés está retirado: reincorpórelo antes de evaluarlo.')).toBeInTheDocument()
  })

  // api.md §4.3: además de STANCE_DIVERGENCE, la vista previa avisa una evaluación atrasada y una prioridad que queda vacía
  it('las advertencias BACKDATED_ASSESSMENT y NO_PRIORITY_RULE se dicen con su texto, nunca con el código', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, [
      ...base(GERENCIA_SOCIAL, true),
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments/preview',
        body: {
          computed: {
            interest_index: 3,
            power_index: 3,
            influence_score: 6,
            influence_group: 'ESTRATEGICO',
            information_priority: null,
            stance_changed: false
          },
          warnings: [
            { code: 'BACKDATED_ASSESSMENT', message: 'Hay evaluaciones posteriores' },
            { code: 'NO_PRIORITY_RULE', message: 'Ninguna fila coincide' }
          ]
        }
      }
    ])
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    for (const grupo of within(drawer).getAllByRole('radiogroup')) await userEvent.click(within(grupo).getByRole('radio', { name: '3' }))
    expect(await within(drawer).findByText(/Hay evaluaciones posteriores a esta fecha/, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(within(drawer).getByText(/Ninguna fila de la matriz de priorización coincide/)).toBeInTheDocument()
    expect(within(drawer).queryByText(/BACKDATED_ASSESSMENT|NO_PRIORITY_RULE/)).not.toBeInTheDocument()
  })

  it('sin leer el historial de evaluaciones no pide la vista previa y lo dice', async () => {
    const sinHistorial = permisos({ project: ['READ'], stakeholder: ['READ', 'UPDATE'], stakeholder_assessment: ['CREATE'], organization: ['READ'] })
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, sinHistorial, base(GERENCIA_SOCIAL, true))
    red = espiarRed()
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    expect(within(drawer).getByText(/la vista previa del cálculo no está disponible/)).toBeInTheDocument()
    for (const grupo of within(drawer).getAllByRole('radiogroup')) await userEvent.click(within(grupo).getByRole('radio', { name: '2' }))
    await new Promise((r) => setTimeout(r, 400))
    expect(red.a('POST', '/sgspe/stakeholders/s1/assessments/preview')).toHaveLength(0)
  })

  it('403 FIELD_NOT_WRITABLE dice que la postura no la puede escribir', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        responder: () => problema(403, 'No puede escribir la postura', [{ field: 'stance', message: 'FIELD_NOT_WRITABLE' }])
      },
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments/preview',
        responder: () => new Response('{"computed":{"interest_index":3,"power_index":3,"influence_score":6,"influence_group":"ESTRATEGICO"},"warnings":[]}')
      }
    ])
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Base de la evaluación' }), 'ENTREVISTA')
    for (const grupo of within(drawer).getAllByRole('radiogroup')) await userEvent.click(within(grupo).getByRole('radio', { name: '4' }))
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'x')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar evaluación' }))
    expect(await within(drawer).findByText('Evaluar escribe la postura del grupo de interés, un dato que su rol no puede escribir.')).toBeInTheDocument()
    expect(within(drawer).queryByText('FIELD_NOT_WRITABLE')).not.toBeInTheDocument()
  })

  // la fecha de la evaluación es el día de Lima: a las 21:00 de Lima ya es el día siguiente en UTC
  it('la fecha por defecto es hoy en Lima, no en UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-08T02:30:00Z') })
    try {
      fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
      const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
      expect(within(drawer).getByLabelText('Fecha de la evaluación')).toHaveValue('2026-10-07')
    } finally {
      vi.useRealTimers()
    }
  })

  it('una interacción de las 22:00 de Lima se ubica en su día de Lima, no en el de UTC', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, [
      {
        path: '/objects/stakeholder/records/s1/related/engagement_stakeholder',
        body: pagina([registro('e1', { title: 'Asamblea de agosto', held_at: '2026-08-21T03:00:00Z' })])
      },
      ...base(GERENCIA_SOCIAL, true)
    ])
    const cola = await screen.findByRole('complementary', { name: 'Qué generó' })
    expect(await within(cola).findByText(/2026-08-20/)).toBeInTheDocument()
  })

  it('sin leer el historial de evaluaciones la sección dice "No disponible" y no lo pide', async () => {
    const sinHistorial = permisos({ project: ['READ'], stakeholder: ['READ'], organization: ['READ'], engagement: ['READ'] })
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, sinHistorial, base(GERENCIA_SOCIAL, true))
    red = espiarRed()
    const historia = await screen.findByRole('region', { name: 'Evaluaciones' })
    expect(within(historia).getByText('No disponible')).toBeInTheDocument()
    expect(red.a('GET', '/objects/stakeholder_assessment/records')).toHaveLength(0)
  })

  it('si falla la lectura de las evaluaciones lo dice con reintento, no una lista vacía', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      { path: '/objects/stakeholder_assessment/records', responder: () => problema(404, 'No encontrado') },
      { path: '/objects/stakeholder/records/s1/related/engagement_stakeholder', responder: () => problema(403, 'Sin permiso') }
    ])
    const historia = await screen.findByRole('region', { name: 'Evaluaciones' })
    expect(await within(historia).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(within(historia).queryByText(/Aún no tiene evaluación/)).not.toBeInTheDocument()
    // un 403 en lo que generó es "no disponible", no una lista vacía
    const cola = screen.getByRole('complementary', { name: 'Qué generó' })
    expect(await within(cola).findByText('No disponible')).toBeInTheDocument()
    expect(within(cola).queryByText(/Aún no participó/)).not.toBeInTheDocument()
  })

  it('un 412 al guardar dice que otra persona cambió el registro, ofrece recargar y conserva lo escrito', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      { method: 'POST', path: '/sgspe/stakeholders/s1/assessments', responder: () => problema(412, 'Versión vieja') },
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments/preview',
        responder: () => new Response('{"computed":{"interest_index":3,"power_index":3,"influence_score":6,"influence_group":"ESTRATEGICO"},"warnings":[]}')
      }
    ])
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Base de la evaluación' }), 'ENTREVISTA')
    for (const grupo of within(drawer).getAllByRole('radiogroup')) await userEvent.click(within(grupo).getByRole('radio', { name: '4' }))
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'Entrevista con la junta')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar evaluación' }))
    expect(await within(drawer).findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(within(drawer).queryByText(/Otra persona cambió este registro/)).not.toBeInTheDocument())
    expect(within(drawer).getByLabelText('Motivo (obligatorio)')).toHaveValue('Entrevista con la junta')
    expect(within(drawer).getByRole('combobox', { name: 'Base de la evaluación' })).toHaveValue('ENTREVISTA')
  })

  it('403 ROLE_REQUIRED dice que su rol no puede evaluar', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        responder: () => problema(403, 'Rol', [{ field: 'record', message: 'ROLE_REQUIRED' }])
      }
    ])
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Base de la evaluación' }), 'ENTREVISTA')
    for (const grupo of within(drawer).getAllByRole('radiogroup')) await userEvent.click(within(grupo).getByRole('radio', { name: '4' }))
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'x')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar evaluación' }))
    expect(await within(drawer).findByText(/es un paso que su rol no puede dar/)).toBeInTheDocument()
    expect(within(drawer).queryByText('ROLE_REQUIRED')).not.toBeInTheDocument()
  })
})
