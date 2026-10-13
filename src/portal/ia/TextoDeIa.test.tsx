import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CARGO, PERSONA, PERSONA_SIN_NOMBRE } from '../../test/ia'
import { montar, pagina } from '../../test/montar'
import { MarcaDeIa } from './MarcaDeIa'
import { TextoDeIa } from './TextoDeIa'

// la re-identificación al mostrar (ai-architecture.md §12.2, security.md §7.8): una persona registrada con los permisos de quien
// mira; sin sus nombres, su cargo; sin cargo, «persona». los marcadores sin id nunca se resuelven, y el HTML de una salida se ve
// como texto
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('TextoDeIa', () => {
  it('una persona registrada se dice con sus nombres si quien mira los lee', async () => {
    fetch = mockFetch([{ path: '/objects/person/records/pe1', body: PERSONA }])
    montar(<TextoDeIa texto="Lo pidió [PERSONA:pe1]." />)
    expect(await screen.findByText('Ana Ejemplo')).toBeInTheDocument()
    expect(screen.queryByText(/PERSONA/)).not.toBeInTheDocument()
  })

  it('sin sus nombres se dice por su cargo vigente; sin persona legible ni cargo, «persona»', async () => {
    fetch = mockFetch([
      { path: '/objects/person/records/pe2', body: PERSONA_SIN_NOMBRE },
      { path: /^\/objects\/position\/records\?.*person=pe2/, body: pagina([CARGO]) },
      { path: '/objects/position/records', body: pagina([]) }
    ])
    montar(<TextoDeIa texto="[PERSONA:pe2] habló con [PERSONA:pe9]" />)
    expect(await screen.findByText('Presidencia comunal (cargo)')).toBeInTheDocument()
    expect(await screen.findByText('persona')).toBeInTheDocument()
  })

  it('los marcadores sin id se dicen como reservados, con su ayuda, y nunca se resuelven', () => {
    fetch = mockFetch([])
    montar(<TextoDeIa texto="Llamó al [TELEFONO] con [DOCUMENTO] y [CORREO]; también [PERSONA] y [PERSONA_3]" />)
    expect(screen.getByText('teléfono reservado')).toHaveAttribute('title', 'Dato reservado: la IA no lo guarda; quien puede abrir la fuente lo lee allí.')
    expect(screen.getByText('documento reservado')).toBeInTheDocument()
    expect(screen.getByText('correo reservado')).toBeInTheDocument()
    expect(screen.getAllByText('persona')).toHaveLength(2)
  })

  it('los marcadores de los campos restringidos se dicen como reservados', () => {
    fetch = mockFetch([])
    montar(<TextoDeIa texto="Su [CONTACTO], un [DATO_SENSIBLE] y la [CITA]" />)
    expect(screen.getByText('contacto reservado')).toBeInTheDocument()
    expect(screen.getByText('dato sensible reservado')).toBeInTheDocument()
    expect(screen.getByText('cita reservada')).toBeInTheDocument()
  })

  it('el HTML de una salida se muestra como texto, también en Markdown', async () => {
    fetch = mockFetch([{ path: '/objects/person/records/pe1', body: PERSONA }])
    const { container } = montar(
      <TextoDeIa markdown texto={'## Acuerdos\n- [PERSONA:pe1] pidió <b>agua</b>\n<img src=x onerror=alert(1)>\n<script>alert(1)</script>'} />
    )
    expect(screen.getByRole('heading', { name: 'Acuerdos' })).toBeInTheDocument()
    expect(await screen.findByText('Ana Ejemplo')).toBeInTheDocument()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(container.querySelector('img, script, b')).toBeNull()
  })

  it('la marca de procedencia dice que es una sugerencia o un resumen de la IA', () => {
    fetch = mockFetch([])
    montar(
      <>
        <MarcaDeIa clase="sugerencia" />
        <MarcaDeIa clase="resumen" />
      </>
    )
    expect(screen.getByText('Sugerencia de IA')).toBeInTheDocument()
    expect(screen.getByText('Resumen de IA')).toBeInTheDocument()
  })
})
