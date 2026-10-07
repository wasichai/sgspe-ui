import type { AuthUser, CallerPermissions } from '@wasichai/core'
import type { MockRoute } from '@wasichai/testing'

// lo que comparten las pruebas del portal: cuentas ficticias @sgspe.test, lo que wasichai contesta de ellas y una sesión
// ya abierta. aquí sí se nombran roles: son datos de prueba (boundaries.test.ts deja fuera src/test)

export const RELACIONISTA: AuthUser = {
  id: 'u-relacionista',
  email: 'relacionista@sgspe.test',
  displayName: 'Relacionista de prueba',
  organizationId: 'o1',
  roles: ['COMMUNITY_RELATIONS_OFFICER']
}
export const AUDITORA: AuthUser = {
  id: 'u-auditoria',
  email: 'auditoria@sgspe.test',
  displayName: 'Auditoría de prueba',
  organizationId: 'o1',
  roles: ['AUDITOR']
}
export const ADMINISTRACION: AuthUser = {
  id: 'u-admin',
  email: 'admin@sgspe.test',
  displayName: 'Administración de prueba',
  organizationId: 'o1',
  roles: ['ADMIN']
}

export const SIN_PERMISOS: CallerPermissions = { admin: false, objects: {} }
export const ADMIN_PERMISOS: CallerPermissions = { admin: true, objects: {} }

// GET /api/auth/me: el AuthenticatedUser de wasichai, la cuenta a la que pertenece el token
export const yo = (user: AuthUser) => ({
  userId: user.id,
  organizationId: user.organizationId,
  email: user.email,
  roles: user.roles,
  admin: user.roles.includes('ADMIN')
})

// lo que el portal pregunta con una sesión abierta: quién es el token y qué puede hacer (WAS-ADR-0020)
export function rutasDeSesion(user: AuthUser, permisos: CallerPermissions): MockRoute[] {
  return [
    { path: '/auth/me', body: yo(user) },
    { path: '/auth/me/permissions', body: permisos }
  ]
}

// una sesión abierta antes de cargar el portal, como la guarda core: el token y el usuario bajo sgspe.*
export function abrirSesion(user: AuthUser) {
  localStorage.setItem('sgspe.token', 't')
  localStorage.setItem('sgspe.user', JSON.stringify(user))
}
