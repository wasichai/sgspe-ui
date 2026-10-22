import { screen, waitFor, within } from '@testing-library/react'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirPortal } from '../../test/pantalla'
import { ADMIN_PERMISOS, ADMINISTRACION, AUDITORA, permisosConCapacidades } from '../../test/portal'
import { codigosEn } from '../componentes/codigosVisibles'

// S53 · Administración (screens.md; hallazgos U-08 y U-37 del rediseño de UX, DD-14): la sección del portal que dice qué se
// administra aquí, con motivo y reglas, y qué en la consola de la plataforma (/admin, otra aplicación), con el aviso de que el
// modelo, los workflows, los roles y los tipos de documento viven en el repositorio y se pierden si se editan en la consola.
// solo para quien administra (isAdmin o las capacidades de la plataforma), como el árbol
let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const lateral = () => screen.getByRole('navigation', { name: 'Secciones' })
const region = (nombre: string) => screen.getByRole('region', { name: nombre })
// los textos visibles de un bloque, uno por nodo: textContent los pegaría («…consola.Lo que…»)
function textosDe(raiz: Element): string {
  const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
  const textos: string[] = []
  while (caminante.nextNode()) textos.push(caminante.currentNode.textContent ?? '')
  return textos.join(' ')
}

describe('S53 · Administración', () => {
  it('quien administra llega desde la navegación a /administration, dentro del portal', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    const entrada = await within(await screen.findByRole('navigation', { name: 'Secciones' })).findByRole('link', { name: 'Administración' })
    expect(entrada).toHaveAttribute('href', '/administration')
    expect(entrada).not.toHaveAttribute('target')
  })

  it('dice qué se administra en el portal y en la consola, con los cuidados antes de abrir la consola', async () => {
    fetch = abrirPortal('/administration', ADMINISTRACION, ADMIN_PERMISOS, [])
    expect(await screen.findByRole('heading', { level: 1, name: 'Administración' })).toBeInTheDocument()
    expect(within(lateral()).getByRole('link', { name: 'Administración' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Administración · SGSPE')

    const portal = region('En el portal')
    expect(within(portal).getByRole('link', { name: 'Proyectos' })).toHaveAttribute('href', '/projects')
    expect(portal).toHaveTextContent('Equipo y parámetros')
    expect(within(portal).getByRole('link', { name: 'Reglas de alerta de la organización' })).toHaveAttribute('href', '/risks/rules')
    expect(within(portal).getByRole('link', { name: 'Plantillas de entregables' })).toHaveAttribute('href', '/reports/templates')

    const consola = region('En la consola de la plataforma')
    expect(consola).toHaveTextContent('Usuarios')
    expect(consola).toHaveTextContent('Roles y permisos')
    const abrir = within(consola).getByRole('link', { name: /Abrir la consola/ })
    expect(abrir).toHaveAttribute('href', '/admin')
    expect(abrir).toHaveAttribute('target', '_blank')

    const cuidados = region('Cuidados')
    expect(cuidados).toHaveTextContent('se pierde')
    expect(cuidados).toHaveTextContent('aprovisionamiento')
    // el aviso se lee antes que el botón: viene primero en el orden del documento
    expect(cuidados.compareDocumentPosition(abrir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // en lenguaje llano: ni un código de hallazgo o de requisito ni una ruta del repositorio
    const main = screen.getByRole('main')
    expect(codigosEn(textosDe(main))).toEqual([])
    expect(main).not.toHaveTextContent(/GAP-|model\//)
  })

  it('a quien administra la organización sin leer los módulos solo le ofrece la consola', async () => {
    fetch = abrirPortal('/administration', AUDITORA, permisosConCapacidades({}, ['MANAGE_ORGANIZATION']), [])
    expect(await screen.findByRole('heading', { level: 1, name: 'Administración' })).toBeInTheDocument()
    const portal = region('En el portal')
    expect(within(portal).queryByRole('link')).not.toBeInTheDocument()
    expect(portal).toHaveTextContent('Su cuenta no abre por ahora ninguna de estas pantallas del portal.')
    expect(within(region('En la consola de la plataforma')).getByRole('link', { name: /Abrir la consola/ })).toHaveAttribute('href', '/admin')
  })

  it('quien no administra no ve la entrada y, por la URL, lee que no puede abrirla', async () => {
    fetch = abrirPortal('/administration', AUDITORA, permisosConCapacidades({ project: ['READ'] }, []), [])
    expect(await screen.findByRole('heading', { name: 'No puede abrir «Administración»' })).toBeInTheDocument()
    await waitFor(() => expect(within(lateral()).getByRole('link', { name: 'Proyectos' })).toBeInTheDocument())
    expect(within(lateral()).queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Cuidados' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Abrir la consola/ })).not.toBeInTheDocument()
  })

  it('habla inglés con el idioma en inglés', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    fetch = abrirPortal('/administration', ADMINISTRACION, ADMIN_PERMISOS, [])
    expect(await screen.findByRole('heading', { level: 1, name: 'Administration' })).toBeInTheDocument()
    expect(region('Take care')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open the console/ })).toHaveAttribute('href', '/admin')
  })
})
