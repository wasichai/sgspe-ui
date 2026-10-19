import { createApiClient, type ApiClient } from '@wasichai/core'

// el cliente con la sesión renovable (design-system.md §6.5: «volver a ingresar sin perder el borrador»). core, ante un 401,
// borra el token y llama al manejador que AuthProvider registra con setOnUnauthorized: cierra la sesión y vacía la caché, y
// la pantalla se desmonta con lo escrito. aquí ese manejador queda de respaldo: si alguien pidió renovar la sesión (el diálogo
// del shell) y la toma, la pantalla sigue montada; si no (el login, /admin), cierra la sesión como siempre
export function conSesionRenovable(base: ApiClient): {
  cliente: ApiClient
  alVencerLaSesion: (renovar: () => boolean) => () => void
  sesionVencida: () => void
} {
  let deCore: (() => void) | null = null
  let renovar: (() => boolean) | null = null
  const sesionVencida = () => {
    if (!(renovar?.() ?? false)) deCore?.()
  }
  const cliente: ApiClient = {
    baseUrl: base.baseUrl,
    keys: base.keys,
    request: (ruta, opciones) => base.request(ruta, opciones),
    getToken: () => base.getToken(),
    setToken: (token) => base.setToken(token),
    setOnUnauthorized: (manejador) => {
      deCore = manejador
      base.setOnUnauthorized(manejador ? sesionVencida : null)
    }
  }
  const alVencerLaSesion = (quien: () => boolean) => {
    renovar = quien
    return () => {
      if (renovar === quien) renovar = null
    }
  }
  return { cliente, alVencerLaSesion, sesionVencida }
}

// el mismo baseUrl y el mismo storagePrefix que /admin: el token con el que se entra en uno sirve en el otro (sgspe.token)
const sesion = conSesionRenovable(createApiClient({ baseUrl: '/api', storagePrefix: 'sgspe' }))
export const client = sesion.cliente
export const alVencerLaSesion = sesion.alVencerLaSesion
// los pedidos propios del portal (datos/http.ts, el stream de avisos) avisan el 401 por aquí, como el cliente de core
export const sesionVencida = sesion.sesionVencida
