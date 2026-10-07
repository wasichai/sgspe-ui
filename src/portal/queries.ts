import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { client } from './api'

// GET /api/auth/me: la cuenta a la que pertenece el token, según wasichai (no lo que se tecleó en el login)
export interface CuentaDeWasichai {
  userId: string
  organizationId: string
  email: string
  roles: string[]
}

// GET /api/organizations/current: el tenant de quien llama (cualquier cuenta lo lee)
export interface Organizacion {
  id: string
  name: string
  slug: string
}

export function useCuenta() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['auth', 'me', user?.id ?? null],
    queryFn: () => client.request<CuentaDeWasichai>('/auth/me'),
    enabled: user !== null,
    staleTime: Infinity
  })
}

export function useOrganizacion() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['organizations', 'current', user?.id ?? null],
    queryFn: () => client.request<Organizacion>('/organizations/current'),
    enabled: user !== null,
    staleTime: Infinity
  })
}
