import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@wasichai/core'
import { useCapacidades } from '../datos/capacidades'
import { usePedir } from '../datos/http'

// el directorio de usuarios y los roles de wasichai (GET /api/users, GET /api/roles) exigen MANAGE_ORGANIZATION: quien
// administra los ve y elige de una lista; los demás escriben el correo y el id del usuario y el nombre del rol, que
// UserReferenceGuard y AssignmentRoleGuard validan en el servidor (ASM-023, ASM-070). si GET /api/auth/me/permissions dice que la
// cuenta no tiene MANAGE_ORGANIZATION (capabilities, UPS-06), ni se pide; si no lo dice, se intenta. un 403 no es un error:
// es "a mano"
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
  const { leyendo, puedeListarElDirectorio } = useCapacidades()
  return useQuery({
    queryKey: ['users', puedeListarElDirectorio],
    queryFn: () => (puedeListarElDirectorio ? sinPermisoEsNulo(pedir<Usuario[]>('/users')) : Promise.resolve(null)),
    staleTime: 300_000,
    enabled: activo && !leyendo
  })
}

export function useNombresDeRol() {
  const pedir = usePedir()
  const { leyendo, puedeListarElDirectorio } = useCapacidades()
  return useQuery({
    queryKey: ['roles', puedeListarElDirectorio],
    queryFn: () => (puedeListarElDirectorio ? sinPermisoEsNulo(pedir<{ name: string; label: string }[]>('/roles')) : Promise.resolve(null)),
    staleTime: 300_000,
    enabled: !leyendo
  })
}
