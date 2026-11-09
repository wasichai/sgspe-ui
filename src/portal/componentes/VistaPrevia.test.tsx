import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { Link } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { TablaPriorizada } from './TablaPriorizada'
import { definicion, montar, registro, ubicacion, workflow } from '../../test/montar'
import { useRutaDeVistaPrevia, VistaPrevia } from './VistaPrevia'

// la revisión de UX, etapa 6 (ux-architecture.md §8.1): un registro relacionado en un drawer sin salir de la pantalla; vive en
// ?peek=, una vista previa reemplaza a otra y «Abrir ficha» lleva a la ficha
let fetch: FetchMock | null = null
const original = window.matchMedia
afterEach(() => {
  fetch?.restore()
  fetch = null
  window.matchMedia = original
})
// la ventana desde xl (1280 px) o por debajo
const conAncho = (desdeXl: boolean) => {
  window.matchMedia = ((consulta: string) => ({
    matches: consulta === '(min-width: 80rem)' ? desdeXl : false,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  })) as unknown as typeof window.matchMedia
}

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

// design-system.md §5.3, «Vista previa acoplada»: desde 1280 px, el ?peek= de una fila es un panel junto a la tabla, no modal;
// por debajo, el cajón. el shell monta VistaPrevia y la tabla, su panel
describe('VistaPrevia acoplada', () => {
  const EVIDENCIAS = [
    { id: 'ev1', titulo: 'Acta firmada' },
    { id: 'ev2', titulo: 'Foto del reservorio' }
  ]
  function Lista() {
    const previa = useRutaDeVistaPrevia()
    return (
      <>
        <TablaPriorizada<(typeof EVIDENCIAS)[number]>
          etiqueta="Evidencias"
          columnas={[{ id: 'titulo', encabezado: 'Evidencia', prioridad: 'esencial', titulo: true }]}
          filas={EVIDENCIAS}
          clave={(f) => f.id}
          celda={(f) => f.titulo}
          previaDe={(f) => ({ objeto: 'evidence', id: f.id })}
        />
        {/* un registro que no es fila de la tabla */}
        <Link to={previa('evidence', 'ev9')}>Una reservada</Link>
        <VistaPrevia />
      </>
    )
  }
  const fila = (nombre: string) => screen.getByRole('cell', { name: nombre }).closest('tr') as HTMLElement

  it('desde xl, Espacio en una fila la abre en un panel complementario junto a la tabla, sin cajón; Esc la cierra y el foco vuelve a la fila', async () => {
    conAncho(true)
    fetch = mockFetch(rutas())
    montar(<Lista />, { ruta: '/projects/p1/documents' })
    fila('Acta firmada').focus()
    await userEvent.keyboard(' ')
    const panel = await screen.findByRole('complementary', { name: 'Acta firmada' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // a la derecha de la tabla, en la misma rejilla, sin taparla
    expect(panel.parentElement).toHaveClass('grid', 'grid-cols-[minmax(0,1fr)_420px]', 'gap-4')
    expect(panel.parentElement).toContainElement(screen.getByRole('table', { name: 'Evidencias' }))
    expect(panel).toHaveClass('sticky', 'top-0', 'border-2', 'border-sg-border-strong')
    expect(await within(panel).findByText('Clasificación')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Abrir ficha' })).toHaveAttribute('href', '/projects/p1/documents/ev1')
    // la fila de la vista previa es la elegida y sigue con el foco
    expect(fila('Acta firmada')).toHaveAttribute('aria-current', 'true')
    expect(fila('Acta firmada')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/documents'))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(fila('Acta firmada')).toHaveFocus()
  })

  it('desde xl, «×» cierra el panel y devuelve el foco a la fila; otra fila lo reemplaza', async () => {
    conAncho(true)
    fetch = mockFetch(rutas())
    montar(<Lista />, { ruta: '/projects/p1/documents?peek=evidence:ev1' })
    const panel = await screen.findByRole('complementary', { name: 'Acta firmada' })
    fila('Foto del reservorio').focus()
    await userEvent.keyboard(' ')
    expect(await screen.findByRole('complementary', { name: 'Foto del reservorio' })).toBeInTheDocument()
    expect(screen.getAllByRole('complementary')).toHaveLength(1)
    expect(panel).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar la vista previa' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/documents'))
    expect(fila('Foto del reservorio')).toHaveFocus()
  })

  it('desde xl, la vista previa de un registro que no es fila de la tabla sigue siendo el cajón', async () => {
    conAncho(true)
    fetch = mockFetch(rutas())
    montar(<Lista />, { ruta: '/projects/p1/documents?peek=evidence:ev9' })
    expect(await screen.findByRole('dialog', { name: 'Vista previa' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('por debajo de xl, la fila abre el cajón (un diálogo), sin panel', async () => {
    conAncho(false)
    fetch = mockFetch(rutas())
    montar(<Lista />, { ruta: '/projects/p1/documents' })
    fila('Acta firmada').focus()
    await userEvent.keyboard(' ')
    expect(await screen.findByRole('dialog', { name: 'Acta firmada' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
})
