import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { Link } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { definicion, montar, registro, ubicacion, workflow } from '../../test/montar'
import { useRutaDeVistaPrevia, VistaPrevia } from './VistaPrevia'

// la revisión de UX, etapa 6 (ux-architecture.md §8.1): un registro relacionado en un drawer sin salir de la pantalla; vive en
// ?peek=, una vista previa reemplaza a otra y «Abrir ficha» lleva a la ficha
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const ACTA = registro('ev1', { project: 'p1', title: 'Acta firmada', evidence_type: 'ACTA', classification: 'INTERNA' })
const FOTO = registro('ev2', { project: 'p1', title: 'Foto del reservorio', evidence_type: 'FOTO', classification: 'PUBLICA' })
const rutas = () => [
  { path: '/objects/evidence/records/ev1', body: ACTA },
  { path: '/objects/evidence/records/ev2', body: FOTO },
  { path: '/objects/evidence/records/ev9', status: 404, body: { title: 'Not Found', status: 404 } },
  {
    path: '/metadata/objects/evidence',
    body: {
      ...definicion('evidence', ['title', ['evidence_type', { label: 'Tipo de evidencia' }], ['classification', { label: 'Clasificación' }]]),
      label: 'Evidencia'
    }
  },
  { path: '/objects/evidence/workflow', body: workflow('evidence', []) }
]

function Pantalla() {
  const previa = useRutaDeVistaPrevia()
  return (
    <>
      <Link to={previa('evidence', 'ev1')}>Acta firmada</Link>
      <Link to={previa('evidence', 'ev2')}>Foto del reservorio</Link>
      <Link to={previa('evidence', 'ev9')}>Una reservada</Link>
      <VistaPrevia />
    </>
  )
}

describe('VistaPrevia', () => {
  it('abre el registro en un drawer con su tipo y «Abrir ficha»; otra la reemplaza y cerrar la quita de la consulta', async () => {
    fetch = mockFetch(rutas())
    montar(<Pantalla />, { ruta: '/projects/p1/commitments/c1?tab=evidencias' })
    await userEvent.click(screen.getByRole('link', { name: 'Acta firmada' }))
    expect(ubicacion.actual).toBe('/projects/p1/commitments/c1?tab=evidencias&peek=evidence%3Aev1')
    const drawer = await screen.findByRole('dialog', { name: 'Acta firmada' })
    expect(await within(drawer).findByText('Clasificación')).toBeInTheDocument()
    expect(within(drawer).getByText(/^interna$/i)).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: 'Abrir ficha' })).toHaveAttribute('href', '/projects/p1/documents/ev1')
    // la consulta cambia y el drawer se reemplaza: nunca hay dos (el drawer es modal: el clic va directo al enlace de debajo)
    fireEvent.click(screen.getByRole('link', { name: 'Foto del reservorio', hidden: true }))
    expect(await screen.findByRole('dialog', { name: 'Foto del reservorio' })).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c1?tab=evidencias'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un registro que no se lee es «Registro reservado», sin «Abrir ficha»', async () => {
    fetch = mockFetch(rutas())
    montar(<Pantalla />, { ruta: '/projects/p1/commitments/c1?peek=evidence:ev9' })
    const drawer = await screen.findByRole('dialog', { name: 'Vista previa' })
    expect(await within(drawer).findByText('Registro reservado')).toBeInTheDocument()
    expect(within(drawer).queryByRole('link', { name: 'Abrir ficha' })).not.toBeInTheDocument()
  })
})
