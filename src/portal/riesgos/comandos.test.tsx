import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS, RIESGO } from '../../test/riesgos'
import { useTodos } from '../datos/registros'
import { useRevisarRiesgo } from './comandos'

// el endpoint de revisiones (api.md §4.7): la fecha, la probabilidad, el impacto y si es residual, con el motivo y una clave que el
// reintento repite: un corte de red no deja dos revisiones; otro riesgo es otra acción (P63)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

function Revisar() {
  const comando = useRevisarRiesgo()
  const revisar = (riesgo: typeof RIESGO) =>
    comando.mutate({
      riesgo,
      fecha: '2026-10-09',
      probabilidad: 3,
      impacto: 4,
      residual: false,
      notas: '  tras la mesa de diálogo ',
      motivo: 'revisión semanal'
    })
  return (
    <>
      <button type="button" onClick={() => revisar(RIESGO)}>
        Revisar
      </button>
      <button type="button" onClick={() => revisar(registro('k2', { project: 'p1' }))}>
        Revisar otro
      </button>
      <p>{comando.isError ? 'falló' : comando.isSuccess ? `nivel ${String(comando.data.risk.attributes.risk_level)}` : 'quieto'}</p>
    </>
  )
}

describe('revisión de un riesgo', () => {
  it('manda la revisión con el motivo y repite la clave al reintentar; otro riesgo lleva otra', async () => {
    fetch = mockFetch([{ method: 'POST', path: '/sgspe/social-risks/k2/assessments', status: 201, body: { assessment: registro('a2', {}), risk: RIESGO } }])
    let veces = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/social-risks/k1/assessments',
        responder: () =>
          ++veces === 1
            ? problema(400, 'fuera de rango', [{ field: 'attributes.assessment_date', message: 'OUT_OF_RANGE' }])
            : jsonResponse({ assessment: registro('a1', { score: 12 }), risk: { ...RIESGO, attributes: { ...RIESGO.attributes, risk_level: 'ALTO' } } }, 201)
      }
    ])
    montar(<Revisar />, { usuario: GESTOR_DE_RIESGOS, permisos: EQUIPO_DE_RIESGOS })
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    await screen.findByText('falló')
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('nivel ALTO')).toBeInTheDocument()
    const [primera, segunda] = red.a('POST', '/sgspe/social-risks/k1/assessments')
    expect(primera.cuerpo).toEqual({
      attributes: { assessment_date: '2026-10-09', probability: 3, impact: 4, residual: false, notes: 'tras la mesa de diálogo' }
    })
    expect(primera.cabeceras.get('X-Change-Reason')).toBe("UTF-8''revisi%C3%B3n%20semanal")
    expect(segunda.cabeceras.get('Idempotency-Key')).toBe(primera.cabeceras.get('Idempotency-Key'))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar otro' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/social-risks/k2/assessments')).toHaveLength(1))
    expect(red.a('POST', '/sgspe/social-risks/k2/assessments')[0].cabeceras.get('Idempotency-Key')).not.toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  // plan 4.2b: la revisión deja hechas las tareas de revisión abiertas del riesgo (risk_review de JOB-01). S47 y toda lista de tareas
  // se vuelven a leer para que la tarea cerrada no siga a la vista
  it('tras la revisión se releen las tareas: la de revisión del riesgo ya quedó hecha', async () => {
    fetch = mockFetch([
      { method: 'POST', path: '/sgspe/social-risks/k1/assessments', status: 201, body: { assessment: registro('a1', {}), risk: RIESGO } },
      { path: /^\/objects\/task\/records/, body: pagina([]) }
    ])
    red = espiarRed()
    function ConTareas() {
      const tareas = useTodos('task', { project: 'p1' })
      return (
        <>
          <Revisar />
          <p>{tareas.isSuccess ? 'tareas leídas' : 'leyendo tareas'}</p>
        </>
      )
    }
    montar(<ConTareas />, { usuario: GESTOR_DE_RIESGOS, permisos: EQUIPO_DE_RIESGOS })
    await screen.findByText('tareas leídas')
    expect(red.a('GET', '/objects/task/records')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    await screen.findByText(/nivel/)
    await waitFor(() => expect(red!.a('GET', '/objects/task/records')).toHaveLength(2))
  })
})
