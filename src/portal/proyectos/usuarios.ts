import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@wasichai/core'
import { usePedir } from '../datos/http'

// el directorio de usuarios y los roles de wasichai (GET /api/users, GET /api/roles) exigen MANAGE_ORGANIZATION: quien
// administra los ve y elige de una lista; los demás escriben el correo y el id del usuario y el nombre del rol, que
// UserReferenceGuard y AssignmentRoleGuard validan en el servidor (ASM-023, ASM-070). un 403 no es un error: es "a mano"
export interface Usuario {
  id: string
  email: string
  displayName: string
  enabled: boolean
}

const sinPermisoEsNulo = <T>(promesa: Promise<T>): Promise<T | null> =>
  promesa.catch((e: unknown) => (e instanceof ApiError && e.status === 403 ? null : Promise.reject(e)))

export function useUsuarios(activo = true) {
  const pedir = usePedir()
  return useQuery({ queryKey: ['users'], queryFn: () => sinPermisoEsNulo(pedir<Usuario[]>('/users')), staleTime: 300_000, enabled: activo })
}

export function useNombresDeRol() {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => sinPermisoEsNulo(pedir<{ name: string; label: string }[]>('/roles')),
    staleTime: 300_000
  })
}
