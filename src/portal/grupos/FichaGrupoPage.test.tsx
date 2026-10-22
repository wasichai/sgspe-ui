import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro } from '../../test/montar'
import { hoyEnLima } from '../datos/fechas'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ADMINISTRACION, GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { ASSESS_DEF, base, LEE, S1, STK_DEF } from '../../test/grupos'

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

// completa una evaluación (base, los 15 indicadores y el motivo) y la guarda
async function llenar(drawer: HTMLElement, valor = '4', motivo = 'x') {
  await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Base de la evaluación' }), 'ENTREVISTA')
  for (const grupo of within(drawer).getAllByRole('radiogroup')) await userEvent.click(within(grupo).getByRole('radio', { name: valor }))
  await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), motivo)
  await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar evaluación' }))
}

const PREVIA = '{"computed":{"interest_index":3,"power_index":3,"influence_score":6,"influence_group":"ESTRATEGICO"},"warnings":[]}'

describe('S17 · ficha de grupo de interés y S20 · nueva evaluación', () => {
  it('sin acceso a la postura muestra candados y no ofrece evaluar', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', RELACIONISTA, LEE, base())
    expect(await screen.findByRole('heading', { name: 'Ronda campesina Tunas' })).toBeInTheDocument()
    const decidir = screen.getByRole('region', { name: 'Para decidir' })
    expect(within(decidir).getByText('Estratégico')).toBeInTheDocument()
    expect(await within(decidir).findByText('Restringido')).toBeInTheDocument()
    // la postura y la confianza del grupo de interés son el último valor informado (ASM-087)
    expect(within(decidir).getByText('Postura vigente')).toHaveAttribute('title', 'El último valor informado en una evaluación')
    expect(within(decidir).getByText('Confianza vigente')).toBeInTheDocument()
    expect(within(decidir).getByText('2 de 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva evaluación' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('complementary', { name: 'Qué generó' })).getByRole('link', { name: 'Asamblea de agosto' })).toHaveAttribute(
      'href',
      '/projects/p1/engagements/e1'
    )
    expect(await screen.findByRole('button', { name: 'Editar la caracterización' })).toBeInTheDocument()
  })

  // D5 y D9 de la revisión de UX: sin índices, «—» (nunca NaN); sin responsable, ningún guion suelto junto a «Ver el actor»
  it('sin índices dice «—» y sin responsable no deja un guion suelto; el código del grupo va en las migas', async () => {
    const sinIndices = { ...S1, attributes: { ...S1.attributes, interest_index: undefined, power_index: undefined, owner_user_id: undefined } }
    fetch = abrirPortal('/projects/p1/stakeholders/s1', RELACIONISTA, LEE, [{ path: '/objects/stakeholder/records/s1', body: sinIndices }, ...base()])
    expect(await screen.findByRole('heading', { name: 'Ronda campesina Tunas', level: 1 })).toBeInTheDocument()
    const decidir = screen.getByRole('region', { name: 'Para decidir' })
    expect(within(decidir).queryByText(/NaN/)).not.toBeInTheDocument()
    expect(within(decidir).getByText('Interés — · Poder —')).toBeInTheDocument()
    expect(screen.queryByText(/^—\s*Ver el actor/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/—\s*Ver el actor/)
  })

  it('«Pendientes» dice los compromisos y las QCS abiertas del grupo, y «Qué generó» enlaza sus compromisos', async () => {
    const conPendientes = permisos({
      project: ['READ'],
      stakeholder: ['READ'],
      stakeholder_assessment: ['READ'],
      engagement: ['READ'],
      organization: ['READ'],
      commitment: ['READ'],
      grievance: ['READ']
    })
    fetch = abrirPortal('/projects/p1/stakeholders/s1', RELACIONISTA, conPendientes, [
      ...base(),
      {
        path: '/objects/stakeholder/records/s1/related/commitment_stakeholder',
        // como la plataforma: la lectura por relación no trae el estado del workflow
        body: pagina([
          registro('c1', { code: 'C-001', title: 'Mejora del canal', project: 'p1' }, { state: null }),
          registro('c2', { code: 'C-002', title: 'Taller de riego', project: 'p1' }, { state: null })
        ])
      },
      { path: '/objects/commitment/records/c1', body: registro('c1', { code: 'C-001', project: 'p1' }, { state: 'in_progress' }) },
      { path: '/objects/commitment/records/c2', body: registro('c2', { code: 'C-002', project: 'p1' }, { state: 'closed' }) },
      { path: /^\/objects\/grievance\/records\?.*stakeholder=s1/, body: pagina([registro('q1', { stakeholder: 's1' }, { state: 'acknowledged' })]) },
      // la lista de compromisos del proyecto: c3 no es del grupo
      {
        path: /^\/objects\/commitment\/records\?/,
        body: pagina([
          registro('c1', { code: 'C-001', title: 'Mejora del canal', project: 'p1' }, { state: 'in_progress' }),
          registro('c3', { code: 'C-003', title: 'Otro compromiso', project: 'p1' }, { state: 'in_progress' })
        ])
      }
    ])
    const decidir = await screen.findByRole('region', { name: 'Para decidir' })
    // las cifras llevan a su lista con el grupo como filtro (revisión de UX, etapa 6)
    const compromisos = await within(decidir).findByRole('link', { name: '1 compromiso abierto' })
    expect(compromisos).toHaveAttribute('href', '/projects/p1/commitments?stakeholder=s1')
    expect(await within(decidir).findByRole('link', { name: '1 QCS abierta' })).toHaveAttribute('href', '/projects/p1/attention?stakeholder=s1')
    expect(within(decidir).queryByText(/llegan en F3/)).not.toBeInTheDocument()
    const genero = screen.getByRole('complementary', { name: 'Qué generó' })
    expect(await within(genero).findByRole('link', { name: 'C-001 · Mejora del canal' })).toHaveAttribute('href', '/projects/p1/commitments/c1')
    expect(within(genero).queryByText(/desde F3/)).not.toBeInTheDocument()
    await userEvent.click(compromisos)
    expect(await screen.findByText('Grupo de interés: Ronda campesina Tunas')).toBeInTheDocument()
    const tabla = await screen.findByRole('table', { name: 'Compromisos' })
    expect(await within(tabla).findByText('Mejora del canal')).toBeInTheDocument()
    expect(within(tabla).queryByText('Otro compromiso')).not.toBeInTheDocument()
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
    // la fecha de cada evaluación se dice en es-PE, como el resto (revisión final, M12)
    expect(await within(historia).findByText(/^1 mar\. 2026 · Inferida/)).toHaveTextContent('(línea base)')
    expect(within(historia).queryByText(/2026-03-01/)).not.toBeInTheDocument()
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
    expect(await within(drawer).findByText('Para monitoreo', {}, { timeout: 3000 })).toBeInTheDocument()
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

  it('un 409 STATE_MISMATCH relee el grupo de interés: la ficha ya no ofrece evaluar y el aviso sigue a la vista', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    let retirado = false
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        responder: () => {
          retirado = true
          return problema(409, 'retirado', [{ field: 'state', message: 'STATE_MISMATCH' }])
        }
      },
      { path: '/objects/stakeholder/records/s1', responder: () => new Response(JSON.stringify({ ...S1, state: retirado ? 'retired' : 'assessed' })) }
    ])
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    const lecturas = () => red!.a('GET', '/objects/stakeholder/records/s1').length
    const antes = lecturas()
    await llenar(drawer)
    await waitFor(() => expect(lecturas()).toBeGreaterThan(antes))
    expect(await within(drawer).findByText(/está retirado/)).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Guardar evaluación' })).toBeDisabled()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Nueva evaluación', hidden: true })).not.toBeInTheDocument())
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
    // el reloj avanza solo, pero el plazo de la espera (300 ms) se salta de golpe: sin READ no se pide nada
    // (comprobada por mutación: con conVistaPrevia = true en el drawer, esta prueba falla)
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      for (const grupo of within(drawer).getAllByRole('radiogroup')) await usuario.click(within(grupo).getByRole('radio', { name: '2' }))
      await waitFor(() => expect(within(drawer).getAllByRole('radio', { checked: true })).toHaveLength(15))
      await vi.advanceTimersByTimeAsync(1000)
    } finally {
      vi.useRealTimers()
    }
    expect(red.a('POST', '/sgspe/stakeholders/s1/assessments/preview')).toHaveLength(0)
  })

  it('403 FIELD_NOT_WRITABLE nombra el campo que dice el servidor, con su etiqueta de la metadata', async () => {
    const definicion = { ...ASSESS_DEF(true), fields: ASSESS_DEF(true).fields.map((f) => (f.name === 'stance' ? { ...f, label: 'Postura' } : f)) }
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, [
      { path: '/metadata/objects/stakeholder_assessment', body: definicion },
      ...base(GERENCIA_SOCIAL, true)
    ])
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
    expect(await within(drawer).findByText('Evaluar escribe «Postura», un dato que su rol no puede escribir.')).toBeInTheDocument()
    expect(within(drawer).queryByText('FIELD_NOT_WRITABLE')).not.toBeInTheDocument()
  })

  it('403 FIELD_NOT_WRITABLE de un campo que la metadata no trae (restringido) no inventa su nombre', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        responder: () => problema(403, 'No puede escribir', [{ field: 'campo_restringido', message: 'FIELD_NOT_WRITABLE' }])
      }
    ])
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    await llenar(drawer)
    expect(await within(drawer).findByText('Evaluar escribe un dato que su rol no puede escribir.')).toBeInTheDocument()
    expect(within(drawer).queryByText(/campo_restringido/)).not.toBeInTheDocument()
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
    expect(await within(cola).findByText('20 ago. 2026')).toBeInTheDocument()
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

  it('dos evaluaciones seguidas: la segunda lleva otra clave de idempotencia y arranca con el formulario vacío y la fecha de hoy', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        responder: () => new Response(JSON.stringify({ assessment: registro('ev3', {}), stakeholder: S1, warnings: [] }), { status: 201 })
      },
      { method: 'POST', path: '/sgspe/stakeholders/s1/assessments/preview', responder: () => new Response(PREVIA) }
    ])
    const abrir = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Nueva evaluación' }))
      return screen.findByRole('dialog', { name: 'Nueva evaluación' })
    }
    let drawer = await abrir()
    // la fecha la cambia la persona: la siguiente evaluación vuelve a hoy
    fireEvent.change(within(drawer).getByLabelText('Fecha de la evaluación'), { target: { value: '2026-01-15' } })
    await llenar(drawer, '4', 'Primera')
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholders/s1/assessments')).toHaveLength(1))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/stakeholders/s1'))
    drawer = await abrir()
    expect(within(drawer).getByLabelText('Fecha de la evaluación')).toHaveValue(hoyEnLima())
    expect(within(drawer).getByRole('combobox', { name: 'Base de la evaluación' })).toHaveValue('')
    expect(within(drawer).getByLabelText('Motivo (obligatorio)')).toHaveValue('')
    expect(within(drawer).queryAllByRole('radio', { checked: true })).toHaveLength(0)
    await llenar(drawer, '2', 'Segunda')
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholders/s1/assessments')).toHaveLength(2))
    const [primera, segunda] = red.a('POST', '/sgspe/stakeholders/s1/assessments')
    expect(primera.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(segunda.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(segunda.cabeceras.get('Idempotency-Key')).not.toBe(primera.cabeceras.get('Idempotency-Key'))
    expect(primera.cuerpo).toMatchObject({ attributes: { assessment_date: '2026-01-15', affect_environment: 4 } })
    expect(segunda.cuerpo).toMatchObject({ attributes: { assessment_date: hoyEnLima(), affect_environment: 2 } })
    expect(segunda.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Segunda")
  })

  it('"Recargar" tras un 412 espera la versión nueva: el siguiente guardado lleva su If-Match', async () => {
    const NUEVA = '2026-10-05T09:30:00.75Z'
    let cambiado = false
    let intentos = 0
    // la relectura del grupo queda retenida hasta que la prueba la suelta
    let soltar: () => void = () => {}
    const retenida = new Promise<void>((r) => (soltar = r))
    fetch = abrirPortal('/projects/p1/stakeholders/s1?drawer=assessment', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        responder: () => {
          intentos += 1
          if (intentos > 1) return new Response(JSON.stringify({ assessment: registro('ev3', {}), stakeholder: S1, warnings: [] }), { status: 201 })
          cambiado = true
          return problema(412, 'Versión vieja')
        }
      },
      {
        path: '/objects/stakeholder/records/s1',
        responder: async () => {
          if (cambiado) await retenida
          return new Response(JSON.stringify(cambiado ? { ...S1, updatedAt: NUEVA } : S1))
        }
      },
      { method: 'POST', path: '/sgspe/stakeholders/s1/assessments/preview', responder: () => new Response(PREVIA) }
    ])
    const drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    await llenar(drawer, '4', 'Entrevista con la junta')
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Recargar' }))
    // mientras la versión nueva no llega, el aviso sigue y no se puede guardar sobre la vieja sin verlo
    await waitFor(() => expect(red!.a('GET', '/objects/stakeholder/records/s1').length).toBeGreaterThan(1))
    expect(within(drawer).getByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    soltar()
    await waitFor(() => expect(within(drawer).queryByText(/Otra persona cambió este registro/)).not.toBeInTheDocument())
    await userEvent.click(within(drawer).getByRole('button', { name: 'Guardar evaluación' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholders/s1/assessments')).toHaveLength(2))
    const [primero, segundo] = red.a('POST', '/sgspe/stakeholders/s1/assessments')
    expect(primero.cabeceras.get('If-Match')).toBe('"2026-10-04T10:00:00.25Z"')
    expect(segundo.cabeceras.get('If-Match')).toBe(`"${NUEVA}"`)
  })

  it('cancelar descarta lo escrito, el error y la fecha', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        responder: () => problema(403, 'Rol', [{ field: 'record', message: 'ROLE_REQUIRED' }])
      },
      { method: 'POST', path: '/sgspe/stakeholders/s1/assessments/preview', responder: () => new Response(PREVIA) }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva evaluación' }))
    let drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    fireEvent.change(within(drawer).getByLabelText('Fecha de la evaluación'), { target: { value: '2026-01-15' } })
    await llenar(drawer, '4', 'Borrador')
    expect(await within(drawer).findByText(/es un paso que su rol no puede dar/)).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva evaluación' }))
    drawer = await screen.findByRole('dialog', { name: 'Nueva evaluación' })
    expect(within(drawer).getByLabelText('Fecha de la evaluación')).toHaveValue(hoyEnLima())
    expect(within(drawer).getByLabelText('Motivo (obligatorio)')).toHaveValue('')
    expect(within(drawer).getByRole('combobox', { name: 'Base de la evaluación' })).toHaveValue('')
    expect(within(drawer).queryByText(/es un paso que su rol no puede dar/)).not.toBeInTheDocument()
  })

  it('mientras guarda no se puede cancelar ni cerrar: la respuesta renueva la clave y reinicia el formulario', async () => {
    let soltar: () => void = () => {}
    const retenida = new Promise<void>((r) => (soltar = r))
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholders/s1/assessments',
        responder: async () => {
          await retenida
          return new Response(JSON.stringify({ assessment: registro('ev3', {}), stakeholder: S1, warnings: [] }), { status: 201 })
        }
      },
      { method: 'POST', path: '/sgspe/stakeholders/s1/assessments/preview', responder: () => new Response(PREVIA) }
    ])
    const abrir = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Nueva evaluación' }))
      return screen.findByRole('dialog', { name: 'Nueva evaluación' })
    }
    let drawer = await abrir()
    await llenar(drawer, '4', 'Primera')
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholders/s1/assessments')).toHaveLength(1))
    expect(within(drawer).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    // Escape y la X piden cerrar: se ignoran hasta que llegue la respuesta
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Nueva evaluación' })).toBeInTheDocument()
    expect(within(drawer).getByLabelText('Motivo (obligatorio)')).toHaveValue('Primera')
    soltar()
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/stakeholders/s1'))
    // la clave se renovó y el formulario quedó limpio: la siguiente evaluación es otra
    drawer = await abrir()
    expect(within(drawer).getByLabelText('Motivo (obligatorio)')).toHaveValue('')
    await llenar(drawer, '2', 'Segunda')
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholders/s1/assessments')).toHaveLength(2))
    const [primera, segunda] = red.a('POST', '/sgspe/stakeholders/s1/assessments')
    expect(segunda.cabeceras.get('Idempotency-Key')).not.toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  it('una interacción sin fecha no deja un separador suelto', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, [
      { path: '/objects/stakeholder/records/s1/related/engagement_stakeholder', body: pagina([registro('e1', { title: 'Asamblea de agosto' })]) },
      ...base(GERENCIA_SOCIAL, true)
    ])
    const cola = await screen.findByRole('complementary', { name: 'Qué generó' })
    const fila = (await within(cola).findByRole('link', { name: 'Asamblea de agosto' })).closest('li')
    expect(fila).toHaveTextContent(/^Asamblea de agosto$/)
  })
})

// P-09 del rediseño de UX (DD-02 y DD-06; U-02, U-03, U-25, U-26 y U-27): la cabecera dice qué es en la letra del texto y sin
// el estado del flujo, que se dice una sola vez en «Para decidir»; una sola primaria, retirar en «Más acciones» y la
// caracterización en su sección, con los campos sin dato plegados
describe('S17 · cabecera y cuerpo de la ficha (P-09)', () => {
  const conRetiro = {
    path: '/objects/stakeholder/records/s1/transitions',
    body: [{ name: 'retire_assessed', label: 'Retirar', to: 'retired', toLabel: 'Retirado', allowed: true, reason: null }]
  }

  it('una sola primaria, retirar en «Más acciones» y el estado una sola vez, fuera de la cabecera', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, [conRetiro, ...base(GERENCIA_SOCIAL, true)])
    const titulo = await screen.findByRole('heading', { name: 'Ronda campesina Tunas', level: 1 })
    const cabecera = titulo.parentElement!
    expect(within(cabecera).getByText(/^Grupo de interés/)).not.toHaveClass('font-sg-mono')
    expect(within(cabecera).queryByText('Evaluado')).not.toBeInTheDocument()
    const acciones = screen.getByRole('group', { name: 'Acciones del registro' })
    const registrar = within(acciones).getByRole('link', { name: 'Registrar interacción' })
    expect(registrar).toHaveAttribute('data-variant', 'primary')
    expect(await within(acciones).findByRole('button', { name: 'Nueva evaluación' })).toHaveAttribute('data-variant', 'secondary')
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(1)
    await waitFor(() => expect(within(acciones).getByRole('button', { name: 'Más acciones' })).toBeInTheDocument())
    expect(within(acciones).queryByRole('button', { name: /^Retirar/ })).not.toBeInTheDocument()
    await userEvent.click(within(acciones).getByRole('button', { name: 'Más acciones' }))
    expect(within(screen.getByRole('group', { name: 'Más acciones' })).getByRole('button', { name: /^Retirar/ })).toBeInTheDocument()
    // el estado, una sola vez: en «Para decidir»
    const estados = await screen.findAllByText('Evaluado', { selector: '[data-estado]' })
    expect(estados).toHaveLength(1)
    expect(within(screen.getByRole('region', { name: 'Para decidir' })).getByText('Evaluado')).toBe(estados[0])
  })

  it('la caracterización en su sección, con los campos sin dato plegados tras su conteo', async () => {
    const conPerfil = { ...S1, attributes: { ...S1.attributes, inclusion_reason: 'Usa el agua del canal', owner_user_email: undefined } }
    fetch = abrirPortal('/projects/p1/stakeholders/s1', GERENCIA_SOCIAL, LEE, [
      { path: '/objects/stakeholder/records/s1', body: conPerfil },
      ...base(GERENCIA_SOCIAL, true)
    ])
    const perfil = await screen.findByRole('region', { name: 'Caracterización' })
    expect(within(perfil).getByText('Motivo de inclusión')).toBeInTheDocument()
    expect(within(perfil).getByText('Usa el agua del canal')).toBeInTheDocument()
    expect(within(perfil).queryByText('Resumen del perfil')).not.toBeInTheDocument()
    const mostrar = within(perfil).getByRole('button', { name: /^Mostrar los \d+ campos sin dato$/ })
    await userEvent.click(mostrar)
    expect(within(perfil).getByText('Resumen del perfil')).toBeInTheDocument()
    expect(within(perfil).getByText('Responsable')).toBeInTheDocument()
  })
})

// P38: solo ADMIN escribe sin asignación (revisión final, I3)
describe('S17 · escritura sin asignación', () => {
  it('ADMIN sin asignación edita la caracterización y evalúa', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders/s1', ADMINISTRACION, { admin: true, objects: LEE.objects }, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...base(ADMINISTRACION, true)
    ])
    expect(await screen.findByRole('button', { name: 'Editar la caracterización' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Nueva evaluación' })).toBeInTheDocument()
  })
})
