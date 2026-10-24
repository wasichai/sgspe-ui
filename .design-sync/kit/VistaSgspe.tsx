import { QueryClient } from '@tanstack/react-query'
import { createApiClient, createRegistry, resolveConfig, WasichaiProviders } from '@wasichai/core'
import { useEffect, useState, type ReactNode } from 'react'
import { MemoryRouter, useInRouterContext } from 'react-router'
import { ZONA_DE_LIMA } from '../../src/portal/datos/fechas'
import { crearI18n, IDIOMAS } from '../../src/portal/i18n'
import flujos from './flujos.json'

// los workflows reales (sin roles) ya en la caché: EstadoChip y CaminoDelFlujo dicen «En ejecución», no `in_progress`
function consultasConFlujos() {
  const consultas = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  for (const [objeto, flujo] of Object.entries(flujos)) consultas.setQueryData(['workflow', objeto], flujo)
  return consultas
}

// dentro de otro router (una VistaSgspe anidada, una app con el suyo) no se abre un segundo
function ConRouter({ ruta, children }: { ruta: string; children: ReactNode }) {
  return useInRouterContext() ? <>{children}</> : <MemoryRouter initialEntries={[ruta]}>{children}</MemoryRouter>
}

// el tema va en <html data-theme>, como lo pone core en el portal (los tokens oscuros de tokens.css cuelgan de :root).
// core lo escribe en un efecto de layout desde la preferencia de la persona; este, pasivo, corre después y la pisa sin
// guardarla (una preferencia guardada pasaría a toda pantalla del mismo origen)
function useTema(tema: 'light' | 'dark' | undefined) {
  useEffect(() => {
    if (!tema) return
    const html = document.documentElement
    html.dataset.theme = tema
    html.style.colorScheme = tema
  }, [tema])
}

// el idioma pedido antes del primer dibujo, sin guardarlo (como el tema: pasaría a toda pantalla del mismo origen); sin
// él, el que la persona eligió o el del navegador
function conIdioma(i18n: ReturnType<typeof crearI18n>, idioma: 'es' | 'en' | undefined, clave: string) {
  if (!idioma) return i18n
  const guardado = localStorage.getItem(clave)
  void i18n.changeLanguage(idioma)
  if (guardado === null) localStorage.removeItem(clave)
  else localStorage.setItem(clave, guardado)
  return i18n
}

/** Raíz de toda pantalla de SGSPE: sesión, textos del portal (es-PE/en), TanStack Query con los 19 workflows del modelo
 * y un router en memoria. Sin ella los componentes del portal no tienen sus textos ni su contexto. `tema` fija `data-theme`
 * en <html> ('dark' para el tema oscuro; sin él, el del sistema); `idioma` ('es' o 'en') fija los textos del portal. */
export function VistaSgspe({ children, ruta = '/', tema, idioma }: { children: ReactNode; ruta?: string; tema?: 'light' | 'dark'; idioma?: 'es' | 'en' }) {
  useTema(tema)
  const [valores] = useState(() => {
    const cliente = createApiClient({ baseUrl: '/api', storagePrefix: 'sgspe' })
    return {
      config: resolveConfig({ apiBaseUrl: '/api', storagePrefix: 'sgspe', appName: 'SGSPE', languages: IDIOMAS, timeZone: ZONA_DE_LIMA }),
      cliente,
      i18n: conIdioma(crearI18n(), idioma, cliente.keys.lang),
      consultas: consultasConFlujos()
    }
  })
  return (
    <WasichaiProviders
      config={valores.config}
      registry={createRegistry([])}
      apiClient={valores.cliente}
      i18n={valores.i18n}
      queryClient={valores.consultas}
      initialUser={{ id: 'u-ficticio', email: 'equipo@sgspe.test', displayName: 'Equipo social', organizationId: 'o1', roles: [] }}
      initialPermissions={{ admin: true, objects: {} }}
    >
      <ConRouter ruta={ruta}>
        <div className="bg-sg-bg font-sg-sans text-sg-body text-sg-text">{children}</div>
      </ConRouter>
    </WasichaiProviders>
  )
}
