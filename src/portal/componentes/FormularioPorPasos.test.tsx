import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRegistry, resolveConfig, WasichaiProviders } from '@wasichai/core'
import { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { client } from '../api'
import { crearI18n, IDIOMAS } from '../i18n'
import { FormularioPorPasos } from './FormularioPorPasos'

// la revisión de UX, etapa 5 (design-system.md §6.3): la misma forma para toda alta larga, con los botones siempre en su lugar y
// el aviso al salir con cambios
function Alta({ conCambios = false, alGuardarYSalir }: { conCambios?: boolean; alGuardarYSalir?: () => void }) {
  const [actual, setActual] = useState(0)
  return (
    <FormularioPorPasos
      titulo="Nuevo compromiso"
      descripcion="Lo que se promete a la comunidad."
      pasos={['Origen', 'Qué se promete', 'Revisión']}
      actual={actual}
      visitados={actual}
      alEnviar={(e) => {
        e.preventDefault()
        setActual(actual + 1)
      }}
      alAnterior={() => setActual(actual - 1)}
      alCancelar={() => undefined}
      alGuardarYSalir={alGuardarYSalir}
      conCambios={conCambios}
    >
      <p>Contenido del paso {actual + 1}</p>
    </FormularioPorPasos>
  )
}

describe('FormularioPorPasos', () => {
  it('dice el título, el paso actual y lleva los botones en su lugar; Siguiente avanza y Anterior vuelve', async () => {
    const guardar = vi.fn()
    montar(<Alta alGuardarYSalir={guardar} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Nuevo compromiso' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Origen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Qué se promete' })).toBeInTheDocument()
    expect(screen.getByText('Contenido del paso 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Origen' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }))
    expect(guardar).toHaveBeenCalled()
  })

  it('con cambios, salir por un enlace del portal pide confirmar; «Seguir aquí» se queda y «Salir» sale', async () => {
    localStorage.setItem('sgspe.token', 't')
    const router = createMemoryRouter(
      [
        {
          path: '/alta',
          element: (
            <>
              <Link to="/lista">Ir a la lista</Link>
              <Alta conCambios />
            </>
          )
        },
        { path: '/lista', element: <h1>Lista</h1> }
      ],
      { initialEntries: ['/alta'] }
    )
    const config = resolveConfig({ apiBaseUrl: '/api', storagePrefix: 'sgspe', appName: 'SGSPE', languages: IDIOMAS })
    render(
      <WasichaiProviders config={config} registry={createRegistry([])} apiClient={client} i18n={crearI18n()} queryClient={new QueryClient()}>
        <RouterProvider router={router} />
      </WasichaiProviders>
    )
    await userEvent.click(screen.getByRole('link', { name: 'Ir a la lista' }))
    expect(await screen.findByText('¿Salir sin terminar?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Seguir aquí' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Nuevo compromiso' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Ir a la lista' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Lista' })).toBeInTheDocument()
  })
})
