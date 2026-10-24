import { QueryClient } from '@tanstack/react-query'
import { ApiError, createRegistry, resolveConfig, WasichaiProviders } from '@wasichai/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router'
import { client } from './api'
import { ZONA_DE_LIMA } from './datos/fechas'
import { LoginPage } from './auth/LoginPage'
import { AbrirRegistroPage } from './avisos/AbrirRegistroPage'
import { AvisosPage } from './avisos/AvisosPage'
import { Vacio } from './componentes/Estados'
import { NoEncontrada } from './shell/NoEncontrada'
import { parametrosDe, PorRuta } from './componentes/PorRuta'
import { RequireSession } from './auth/RequireSession'
import { idiomaHtmlModule } from '../idiomaHtml'
import { mapaBaseModule } from './mapa/mapaBase'
import { crearI18n, IDIOMAS, NS } from './i18n'
import { InicioPage } from './pages/InicioPage'
import { PANTALLAS, RUTAS_ADICIONALES } from './pantallas'
import { AppShell } from './shell/AppShell'
import { FalloDePantalla } from './shell/FalloDePantalla'
import { GuardaDeSeccion } from './shell/GuardaDeSeccion'
import { conPantalla, guardaDe, NAV_TREE, type SeccionNav } from './shell/navTree'

// un 4xx no cambia por preguntar otra vez; un corte de red o un 5xx tal vez sí
const retry = (count: number, error: unknown) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2

// design-system.md §6.5: la sección que aún no llega lo dice, sin un error técnico; llega en la primera de sus fases
function SeccionPorLlegar({ seccion }: { seccion: SeccionNav }) {
  const { t } = useTranslation(NS)
  return <Vacio titulo={t('seccionPorLlegar', { fase: seccion.fases[0] })} />
}

// el Dashboard es la ruta índice; cada otra sección tiene ruta solo con su pantalla (PANTALLAS), y la pantalla se guarda
// con los mismos permisos que el árbol (GuardaDeSeccion); una sección del árbol sin pantalla todavía dice en qué fase llega.
// las fichas de los maestros del tenant que no son secciones (/actors/:actorId, /field-visits, /agreements) son RUTAS_ADICIONALES,
// guardadas con su sección y montadas de nuevo por registro; cualquier otra ruta es la página no encontrada. un error de
// render lo recoge FalloDePantalla (D1): el de una pantalla, dentro del shell (la ruta sin camino que las agrupa); el del
// shell mismo, en su ruta
const rutas = () =>
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route
        errorElement={<FalloDePantalla />}
        element={
          <RequireSession>
            <AppShell />
          </RequireSession>
        }
      >
        <Route errorElement={<FalloDePantalla />}>
          <Route index element={<InicioPage />} />
          {NAV_TREE.flatMap((seccion) => {
            const Pantalla = PANTALLAS[seccion.clave]
            if (!Pantalla && !seccion.external && !conPantalla(seccion.clave)) {
              return [<Route key={seccion.clave} path={seccion.to} element={<SeccionPorLlegar seccion={seccion} />} />]
            }
            // la pantalla de una sección es su raíz: sus rutas hijas (/projects/:projectId/…, /territory/communities/:id…)
            // las declara ella misma
            return Pantalla
              ? [
                  <Route
                    key={seccion.clave}
                    path={`${seccion.to}/*`}
                    element={
                      <GuardaDeSeccion seccion={seccion}>
                        <Pantalla />
                      </GuardaDeSeccion>
                    }
                  />
                ]
              : []
          })}
          {RUTAS_ADICIONALES.map(({ ruta, seccion, seOfreceCon, Pantalla }) => (
            <Route
              key={ruta}
              path={ruta}
              element={
                <GuardaDeSeccion seccion={guardaDe(seccion, seOfreceCon)}>
                  <PorRuta parametros={parametrosDe(ruta)} Pantalla={Pantalla} />
                </GuardaDeSeccion>
              }
            />
          ))}
          {/* transversales, de toda cuenta (ux-architecture.md §6.2 y §7.4): los avisos y el salto a la ficha de un registro */}
          <Route path="/notifications" element={<AvisosPage />} />
          <Route path="/r/:object/:recordId" element={<AbrirRegistroPage />} />
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Route>
    </>
  )

// el portal: los proveedores de core, como /admin, así que la sesión, el tema y el idioma son los mismos. sin módulos de starters:
// el portal dibuja sus propias pantallas. dos módulos propios, solo con proveedores: idiomaHtmlModule (core escribe <html lang> con
// el código de i18n, `es`, y el módulo lo vuelve a es-PE, WCAG 3.1.1) y mapaBaseModule (el mapa base de la organización tras el
// login, spec F6 elección 9). los DATETIME de un DynamicForm, en la hora de Lima (ZONA_DE_LIMA, core 0.6.0)
export function PortalApp() {
  const [app] = useState(() => {
    const config = resolveConfig({ apiBaseUrl: '/api', storagePrefix: 'sgspe', appName: 'SGSPE', languages: IDIOMAS, timeZone: ZONA_DE_LIMA })
    const registry = createRegistry([idiomaHtmlModule(), mapaBaseModule()])
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
