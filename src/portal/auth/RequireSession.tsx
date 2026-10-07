import { useAuth } from '@wasichai/core'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

// sin sesión, al login con la ruta donde se estaba. un 401 a mitad de sesión cierra la sesión de core (AuthProvider), y
// esta guarda lleva al login con la misma ruta
export function RequireSession({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

// solo rutas internas después del login (security.md §3.2). //otro.sitio y /\otro.sitio salen del sitio, y un espacio o un
// carácter de control puede convertir una ruta en otra al pasar por el navegador: todo eso lleva al inicio
export function safeNext(next: string | null): string {
  return next !== null && /^\/(?![/\\])[^\\\s\u0000-\u001f\u007f]*$/.test(next) ? next : '/'
}
