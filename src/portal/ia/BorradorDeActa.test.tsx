import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeIa, EQUIPO_IA, GERENCIA_IA, INTERACCION, SUG_BORRADOR, TRANSICIONES_DE_SUGERENCIA } from '../../test/ia'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { BorradorDeActa, combinarActa } from './BorradorDeActa'

// el borrador del acta de la IA en S25 (AI-02, decisión 21 del plan): nunca escribe el acta solo; se inserta con su aceptación,
// con el texto completo que la persona revisó y su motivo, y nunca con un dato reservado
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const ACTUAL = '## Desarrollo\nSe habló del agua.'

const montarBorrador = (borrador = SUG_BORRADOR, listo = true) => {
  fetch = mockFetch([
    { path: '/objects/ai_suggestion/records', body: pagina([borrador]) },
    { path: /^\/objects\/ai_suggestion\/records\/s\d+\/transitions$/, body: TRANSICIONES_DE_SUGERENCIA },
    ...baseDeIa()
  ])
  const alInsertado = vi.fn()
  red = espiarRed([
    {
      method: 'POST',
      path: /^\/sgspe\/ai-suggestions\/s\d+\/accept$/,
      responder: () => jsonResponse({ suggestion: { ...borrador, state: 'accepted' }, result: INTERACCION })
    }
  ])
  montar(<BorradorDeActa interaccion={INTERACCION} actual={ACTUAL} listo={listo} alInsertado={alInsertado} />, {
    usuario: GERENCIA_IA,
    permisos: EQUIPO_IA
  })
  return alInsertado
}

describe('S25 · borrador de la IA', () => {
  it('combina el acta actual con el borrador', () => {
    expect(combinarActa('', '## Acuerdos')).toBe('## Acuerdos')
    expect(combinarActa('# Acta\n\n', '## Acuerdos')).toBe('# Acta\n\n## Acuerdos')
  })

  it('muestra el borrador re-identificado con su marca y su confianza', async () => {
    montarBorrador()
    const tarjeta = await screen.findByRole('region', { name: 'Borrador de la IA' })
    expect(await within(tarjeta).findByText('Ana Ejemplo')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Sugerencia de IA')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Confianza 70 %')).toBeInTheDocument()
    expect(await within(tarjeta).findByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
  })

  it('insertar y editar propone el acta actual más el borrador y la acepta con el texto revisado y el motivo', async () => {
    const alInsertado = montarBorrador()
    await userEvent.click(await screen.findByRole('button', { name: 'Insertar y editar…' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Insertar el borrador en el acta' })
    const propuesto = `${ACTUAL}\n\n## Acuerdos\n- Ana Ejemplo pidió el reservorio`
    expect(await within(dialogo).findByLabelText('Texto del acta')).toHaveValue(propuesto)
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Borrador revisado')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Insertar en el acta' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai-suggestions/s4/accept')).toHaveLength(1))
    expect(red!.a('POST', '/sgspe/ai-suggestions/s4/accept')[0].cuerpo).toEqual({ attributes: { minutes: propuesto } })
    expect(red!.a('POST', '/sgspe/ai-suggestions/s4/accept')[0].cabeceras.get('X-Change-Reason')).toBe("UTF-8''Borrador%20revisado")
    await waitFor(() => expect(alInsertado).toHaveBeenCalledWith(propuesto))
  })

  it('el borrador con un dato reservado no se inserta hasta reemplazarlo', async () => {
    const conReservado = registro('s12', { ...SUG_BORRADOR.attributes, suggested_value: '## Acuerdos\n- Llamar al [TELEFONO]' }, { state: 'proposed' })
    montarBorrador(conReservado)
    await userEvent.click(await screen.findByRole('button', { name: 'Insertar y editar…' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Insertar el borrador en el acta' })
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Revisado')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Insertar en el acta' }))
    expect(
      within(dialogo).getByText(
        'Reemplace los datos reservados (persona, documento, teléfono, correo u otro dato reservado) por lo que corresponda antes de aceptar.'
      )
    ).toBeInTheDocument()
    expect(red!.a('POST', '/sgspe/ai-suggestions/s12/accept')).toHaveLength(0)
  })

  it('con el acta sin guardar no deja insertar y dice por qué', async () => {
    montarBorrador(SUG_BORRADOR, false)
    expect(await screen.findByRole('button', { name: 'Insertar y editar…' })).toBeDisabled()
    expect(screen.getByText('Espere a que el acta se guarde para insertar el borrador.')).toBeInTheDocument()
  })
  it.each(['[CONTACTO]', '[DATO_SENSIBLE]', '[PERSONA_1]'])('el borrador con %s no se inserta aunque la persona escriba el motivo', async (marcador) => {
    const conReservado = registro('s13', { ...SUG_BORRADOR.attributes, suggested_value: `## Acuerdos\n- Ver ${marcador}` }, { state: 'proposed' })
    montarBorrador(conReservado)
    await userEvent.click(await screen.findByRole('button', { name: 'Insertar y editar…' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Insertar el borrador en el acta' })
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Revisado')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Insertar en el acta' }))
    expect(within(dialogo).getByText(/Reemplace los datos reservados/)).toBeInTheDocument()
    expect(red!.a('POST', '/sgspe/ai-suggestions/s13/accept')).toHaveLength(0)
  })
})
