import { useAuth, type CallerPermissions } from '@wasichai/core'

// las capacidades de tenant de la cuenta, como las responde GET /api/auth/me/permissions desde wasichai 0.5 (WAS-ADR-0053,
// UPS-06): `capabilities` lista las acciones sin objeto que la cuenta tiene (MANAGE_METADATA, MANAGE_ORGANIZATION), siempre
// presente y [] si no tiene ninguna. core 0.5.1 no la tipa pero conserva la respuesta tal cual, así que se lee de
// `permissions`. una respuesta sin la clave (un backend anterior) es «no se sabe», no «ninguna»
export type Capacidad = 'MANAGE_METADATA' | 'MANAGE_ORGANIZATION'

type ConCapacidades = CallerPermissions & { capabilities?: string[] }

export const capacidadesDe = (permisos: CallerPermissions | null | undefined): string[] | null => {
  const lista = (permisos as ConCapacidades | null | undefined)?.capabilities
  return Array.isArray(lista) ? lista : null
}

// quien administra (ADMIN) tiene todas las capacidades; los demás, las que lista capabilities
export const tieneCapacidad = (permisos: CallerPermissions | null | undefined, capacidad: Capacidad): boolean =>
  permisos?.admin === true || (capacidadesDe(permisos)?.includes(capacidad) ?? false)

// si conviene pedir GET /api/users y GET /api/roles, que exigen MANAGE_ORGANIZATION: no si la respuesta dice que la cuenta no la
// tiene. sin la clave se intenta y el 403 sigue siendo la red de seguridad (ASM-023, ASM-070)
export const listaElDirectorio = (permisos: CallerPermissions | null | undefined): boolean =>
  permisos?.admin === true || capacidadesDe(permisos) === null || tieneCapacidad(permisos, 'MANAGE_ORGANIZATION')

const NINGUNA: string[] = []

// las capacidades de quien inició sesión
export function useCapacidades() {
  const { permissions, permissionsError } = useAuth()
  return {
    // los permisos todavía se leen: nada se puede decir de las capacidades
    leyendo: permissions === null && permissionsError === null,
    puedeListarElDirectorio: listaElDirectorio(permissions),
    administra: tieneCapacidad(permissions, 'MANAGE_METADATA') || tieneCapacidad(permissions, 'MANAGE_ORGANIZATION'),
    capacidades: capacidadesDe(permissions) ?? NINGUNA
  }
}
