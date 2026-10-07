import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// las fronteras de sgspe-ui (security.md §5.10, ADR-0010): ningún fuente nombra un rol (RQ-SEC-005) y @wasichai/* se importa
// solo por la raíz de cada paquete, nunca por sus archivos internos (RNF-MNT-005). las pruebas y sus ayudas (src/test) sí
// nombran roles: son datos de prueba. como boundaries.test.tsx de caja-ui@a45b224, escanea las fuentes
const SRC = import.meta.dirname

// los 15 roles declarados de model/roles.json de sgspe, los 2 que son ADMIN y el ADMIN de wasichai
const ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'ORGANIZATION_ADMIN',
  'PROJECT_ADMIN',
  'PROJECT_MANAGER',
  'SOCIAL_MANAGER',
  'COMMUNITY_RELATIONS_OFFICER',
  'STAKEHOLDER_MANAGER',
  'COMMITMENT_MANAGER',
  'GRIEVANCE_MANAGER',
  'SOCIAL_RISK_MANAGER',
  'SOCIAL_INVESTMENT_MANAGER',
  'GIS_ANALYST',
  'FIELD_AGENT',
  'APPROVER',
  'AUDITOR',
  'ANALYST',
  'READ_ONLY'
]
const ROL = new RegExp(`\\b(${ROLES.join('|')})\\b`)
const IMPORTACION_INTERNA = /(?:from |import |import\()(['"])@wasichai\/[a-z-]+\/[^'"]+\1/

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return path === join(SRC, 'test') ? [] : fuentes(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const ruta = (file: string) => relative(SRC, file).split(sep).join('/')

// el código sin los comentarios de línea, que pueden nombrar un rol para explicar por qué no se usa
const codigo = (file: string) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))

const hallazgos = (regla: RegExp) =>
  fuentes(SRC).flatMap((file) => codigo(file).flatMap((line, i) => (regla.test(line) ? [`${ruta(file)}:${i + 1}: ${line.trim()}`] : [])))

describe('fronteras de la interfaz', () => {
  it('ve las fuentes del portal y de /admin', () => {
    expect(fuentes(SRC).map(ruta)).toEqual(expect.arrayContaining(['main.tsx', 'admin/AdminApp.tsx', 'portal/PortalApp.tsx', 'portal/shell/navTree.ts']))
  })

  it('ningún fuente nombra un rol', () => {
    expect(hallazgos(ROL)).toEqual([])
  })

  it('importa @wasichai/* solo por la raíz del paquete', () => {
    expect(hallazgos(IMPORTACION_INTERNA)).toEqual([])
  })

  it('los vigías reconocen lo prohibido y dejan pasar lo permitido', () => {
    expect(ROL.test("user.roles.includes('AUDITOR')")).toBe(true)
    expect(ROL.test("const rol = 'GIS_ANALYST'")).toBe(true)
    expect(ROL.test('const { isAdmin } = useAuth()')).toBe(false)
    expect(ROL.test("label: 'Administración'")).toBe(false)
    expect(IMPORTACION_INTERNA.test("import { x } from '@wasichai/core/dist/auth/AuthProvider'")).toBe(true)
    expect(IMPORTACION_INTERNA.test("import { useAuth } from '@wasichai/core'")).toBe(false)
  })
})
