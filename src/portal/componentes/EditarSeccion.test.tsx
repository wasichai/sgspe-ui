import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { definicion, montar, registro } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { EditarSeccion } from './EditarSeccion'

// tercera pasada de UX (2.10): cada sección de una ficha se edita sola, con solo sus campos que la ficha deja editar y el motivo
// si el objeto lo pide; una relación o un UUID no se editan aquí, y una sección sin campo editable no ofrece «Editar»
let fetch: FetchMock | null = null
let red: Red | null = null
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const DEF = {
  ...definicion('grievance', [
    'description',
    ['category', { type: 'ENUM', enumOptions: ['AMBIENTAL', 'SOCIAL'] }],
    ['owner_user_id', { type: 'UUID' }],
    ['stakeholder', { type: 'RELATION', relationTarget: 'stakeholder' }]
  ]),
  requiresReason: true
}
const QUEJA = registro('g1', { project: 'p1', description: 'Polvo en la vía', category: 'AMBIENTAL' }, { updatedAt: '2026-10-05T15:00:00Z' })
const PUEDE = permisos({ grievance: ['READ', 'UPDATE'] })

describe('EditarSeccion', () => {
  it('abre un cajón con solo los campos de la sección que se editan aquí, y guarda con motivo', async () => {
    fetch = mockFetch([
      { path: '/metadata/objects/grievance', body: DEF },
      { method: 'PUT', path: '/objects/grievance/records/g1', body: QUEJA }
    ])
    red = espiarRed()
    montar(
      <EditarSeccion
        objeto="grievance"
        registro={QUEJA}
        seccion="Qué se plantea"
        campos={['description', 'category', 'owner_user_id', 'stakeholder', 'received_by']}
        permitidos={['description', 'owner_user_id', 'stakeholder']}
      />,
      { usuario: RELACIONISTA, permisos: PUEDE }
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Editar «Qué se plantea»' }))
    const cajon = await screen.findByRole('dialog', { name: 'Editar «Qué se plantea»' })
    expect(await within(cajon).findByLabelText(/^description/)).toHaveValue('Polvo en la vía')
    // la categoría no está entre los que la ficha deja editar; el UUID y la relación se editan en «Editar»
    expect(within(cajon).queryByLabelText(/^category/)).not.toBeInTheDocument()
    expect(within(cajon).queryByLabelText(/^owner_user_id/)).not.toBeInTheDocument()
    expect(within(cajon).queryByLabelText(/^stakeholder/)).not.toBeInTheDocument()
    await userEvent.type(within(cajon).getByLabelText('Motivo (obligatorio)'), 'Se precisó lo planteado')
    await userEvent.clear(within(cajon).getByLabelText(/^description/))
    await userEvent.type(within(cajon).getByLabelText(/^description/), 'Polvo y ruido en la vía')
    await userEvent.click(within(cajon).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('PUT', '/objects/grievance/records/g1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/grievance/records/g1')
    expect(cambio.cabeceras.get('If-Match')).toBe('"2026-10-05T15:00:00Z"')
    expect(cambio.cuerpo).toMatchObject({ attributes: { description: 'Polvo y ruido en la vía' } })
  })

  it('una sección sin campo que se edite aquí, o sin permiso de editar, no ofrece «Editar»', async () => {
    fetch = mockFetch([{ path: '/metadata/objects/grievance', body: DEF }])
    const { unmount } = montar(
      <EditarSeccion objeto="grievance" registro={QUEJA} seccion="Cómo llegó y quién" campos={['stakeholder', 'received_by']} permitidos={['stakeholder']} />,
      { usuario: RELACIONISTA, permisos: PUEDE }
    )
    await waitFor(() => expect(fetch?.calls.some((c) => c.url.includes('/metadata/objects/grievance'))).toBe(true))
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument()
    unmount()
    montar(<EditarSeccion objeto="grievance" registro={QUEJA} seccion="Qué se plantea" campos={['description']} />, {
      usuario: RELACIONISTA,
      permisos: permisos({ grievance: ['READ'] })
    })
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument()
  })
})
