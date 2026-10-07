import { QueryClient } from '@tanstack/react-query'
import { ApiError, createRegistry, EmptyState, resolveConfig, WasichaiProviders } from '@wasichai/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router'
import { client } from './api'
import { LoginPage } from './auth/LoginPage'
import { RequireSession } from './auth/RequireSession'
import { crearI18n, IDIOMAS, NS } from './i18n'
import { InicioPage } from './pages/InicioPage'
import { PANTALLAS } from './pantallas'
import { AppShell } from './shell/AppShell'
import { GuardaDeSeccion } from './shell/GuardaDeSeccion'
import { NAV_TREE } from './shell/navTree'

// un 4xx no cambia por preguntar otra vez; un corte de red o un 5xx tal vez sí
const retry = (count: number, error: unknown) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2

function NoEncontrada() {
  const { t } = useTranslation(NS)
  return <EmptyState title={t('noEncontrada')} />
}

// el Dashboard es la ruta índice; cada otra sección tiene ruta solo con su pantalla (PANTALLAS), y la pantalla se guarda
// con los mismos permisos que el árbol (GuardaDeSeccion)
const rutas = () =>
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireSession>
            <AppShell />
          </RequireSession>
        }
      >
        <Route index element={<InicioPage />} />
        {NAV_TREE.flatMap((seccion) => {
          const Pantalla = PANTALLAS[seccion.clave]
          return Pantalla
            ? [
                <Route
                  key={seccion.clave}
                  path={seccion.to}
                  element={
                    <GuardaDeSeccion seccion={seccion}>
                      <Pantalla />
                    </GuardaDeSeccion>
                  }
                />
              ]
            : []
        })}
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </>
  )

// el portal: los proveedores de core, como /admin, así que la sesión, el tema y el idioma son los mismos. sin módulos:
// el portal dibuja sus propias pantallas
export function PortalApp() {
  const [app] = useState(() => {
    const config = resolveConfig({ apiBaseUrl: '/api', storagePrefix: 'sgspe', appName: 'SGSPE', languages: IDIOMAS })
    const registry = createRegistry([])
    const i18n = crearI18n(registry.modules)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry, refetchOnWindowFocus: false } } })
    return { config, registry, i18n, queryClient, router: createBrowserRouter(rutas()) }
  })

  return (
    <WasichaiProviders config={app.config} registry={app.registry} apiClient={client} i18n={app.i18n} queryClient={app.queryClient}>
      <RouterProvider router={app.router} />
    </WasichaiProviders>
  )
}
