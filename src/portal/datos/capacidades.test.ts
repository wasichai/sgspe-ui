import type { CallerPermissions } from '@wasichai/core'
import { describe, expect, it } from 'vitest'
import { permisos, permisosConCapacidades } from '../../test/portal'
import { capacidadesDe, listaElDirectorio, tieneCapacidad } from './capacidades'

// WAS-ADR-0053: GET /api/auth/me/permissions responde `capabilities`, las acciones sin objeto que la cuenta tiene
// (MANAGE_METADATA, MANAGE_ORGANIZATION), siempre presente y [] si no tiene ninguna. core 0.5.1 no la tipa pero la conserva

describe('capacidades de la cuenta', () => {
  it('lee capabilities de la respuesta y dice que falta si la respuesta no la trae', () => {
    expect(capacidadesDe(permisosConCapacidades({}, ['MANAGE_METADATA']))).toEqual(['MANAGE_METADATA'])
    expect(capacidadesDe(permisosConCapacidades({}, []))).toEqual([])
    expect(capacidadesDe(permisos({}))).toBeNull()
    expect(capacidadesDe(null)).toBeNull()
  })

  it('tieneCapacidad: quien administra las tiene todas y los demás las que lista capabilities', () => {
    const admin = { admin: true, capabilities: [], objects: {} } as CallerPermissions
    expect(tieneCapacidad(admin, 'MANAGE_ORGANIZATION')).toBe(true)
    expect(tieneCapacidad(permisosConCapacidades({}, ['MANAGE_METADATA']), 'MANAGE_METADATA')).toBe(true)
    expect(tieneCapacidad(permisosConCapacidades({}, ['MANAGE_METADATA']), 'MANAGE_ORGANIZATION')).toBe(false)
    expect(tieneCapacidad(permisos({}), 'MANAGE_ORGANIZATION')).toBe(false)
    expect(tieneCapacidad(null, 'MANAGE_ORGANIZATION')).toBe(false)
  })

  it('el directorio de usuarios y roles se pide salvo que la respuesta diga que la cuenta no gestiona la organización', () => {
    expect(listaElDirectorio(permisosConCapacidades({}, ['MANAGE_ORGANIZATION']))).toBe(true)
    expect(listaElDirectorio(permisosConCapacidades({}, ['MANAGE_METADATA']))).toBe(false)
    expect(listaElDirectorio(permisosConCapacidades({}, []))).toBe(false)
    expect(listaElDirectorio({ admin: true, capabilities: [], objects: {} } as CallerPermissions)).toBe(true)
    // un backend que no responde capabilities: se intenta y el 403 sigue siendo la red de seguridad
    expect(listaElDirectorio(permisos({}))).toBe(true)
  })
})
