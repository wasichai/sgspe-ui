import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// las fronteras de sgspe-ui (security.md §5.10, ADR-0010): ningún fuente nombra un rol (RQ-SEC-005) y @wasichai/* se importa
// solo por la raíz de cada paquete, nunca por sus archivos internos (RNF-MNT-005). las pruebas y sus ayudas (src/test) sí
// nombran roles: son datos de prueba. como boundaries.test.tsx de caja-ui@a45b224, escanea las fuentes
const SRC = import.meta.dirname

// los 15 roles declarados de model/roles.json de sgspe, los 2 que son ADMIN y el ADMIN de wasichai. esta lista refleja
// sgspe/model/roles.json (repositorio aparte, nada la compara): hay que actualizarla junto con ese archivo
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
// los límites son de lookaround y no \b: \b trata '_' como parte de la palabra y dejaría pasar ROLE_AUDITOR o AUDITOR_X. la
// búsqueda distingue mayúsculas, como el backend: con 'i' las palabras comunes en minúscula (admin, approver) darían falsos positivos
const ROL = new RegExp(`(?<![A-Za-z0-9])(${ROLES.join('|')})(?![A-Za-z0-9])`)
// cualquier literal de cadena con un archivo interno de @wasichai/*: cubre from, export from, import( con espacios o en varias líneas
const IMPORTACION_INTERNA = /['"`]@wasichai\/[a-z0-9-]+\/[^'"`]+['"`]/

// extensiones de fuente que el escaneo lee; y las de recursos que no son código y se ignoran. cualquier otra bajo src/ falla
const ESCANEADAS = /\.tsx?$/
const RECURSOS = /\.(css|json|svg|png|jpe?g|webp|woff2?|ico)$/

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return path === join(SRC, 'test') ? [] : fuentes(path)
    return ESCANEADAS.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const ruta = (file: string) => relative(SRC, file).split(sep).join('/')

// la línea sin su comentario de línea, que puede nombrar un rol para explicar por qué no se usa. las líneas que son solo comentario
// (//, /*, /** o * de JSDoc) se descartan enteras; en las demás, las cadenas se consumen primero para que un // dentro de una
// URL ('http://x') no corte el resto de la línea
const sinComentario = (line: string) => {
  if (/^\s*(\/\/|\/\*|\*)/.test(line)) return ''
  return line.replace(/('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\/\/.*$/g, (_m, cadena?: string) => cadena ?? '')
}

function archivosSinEscanear(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return archivosSinEscanear(path)
    return ESCANEADAS.test(name) || RECURSOS.test(name) ? [] : [path]
  })
}

const codigo = (file: string) => readFileSync(file, 'utf8').split('\n').map(sinComentario)

const hallazgos = (regla: RegExp) =>
  fuentes(SRC).flatMap((file) => codigo(file).flatMap((line, i) => (regla.test(line) ? [`${ruta(file)}:${i + 1}: ${line.trim()}`] : [])))

describe('fronteras de la interfaz', () => {
  it('ve las fuentes del portal y de /admin', () => {
    expect(fuentes(SRC).map(ruta)).toEqual(expect.arrayContaining(['main.tsx', 'admin/AdminApp.tsx', 'portal/PortalApp.tsx', 'portal/shell/navTree.ts']))
  })

  it('no hay archivos de código que el escaneo no lea', () => {
    expect(archivosSinEscanear(SRC).map(ruta)).toEqual([])
  })

  it('ningún fuente nombra un rol', () => {
    expect(hallazgos(ROL)).toEqual([])
  })

  it('importa @wasichai/* solo por la raíz del paquete', () => {
    expect(hallazgos(IMPORTACION_INTERNA)).toEqual([])
  })

  // quién lee todos los proyectos lo decide una sola pieza (useLeeTodosLosProyectos): la acción declarada no se pregunta suelta
  // en las pantallas, como un rol no se nombra (spec 4.4 §3.12)
  it('la acción de leer todos los proyectos solo se nombra en contexto/proyectos.ts', () => {
    const lugares = hallazgos(/(?<![A-Za-z0-9_])READ_ALL_PROJECTS(?![A-Za-z0-9_])/).map((h) => h.split(':')[0])
    expect([...new Set(lugares)]).toEqual(['portal/contexto/proyectos.ts'])
  })

  // F7: las salidas de la IA y el Markdown se dibujan como elementos de React, nunca como HTML (RQ-AI-011, screens.md §13)
  it('ningún fuente dibuja HTML crudo', () => {
    expect(hallazgos(/dangerouslySetInnerHTML|\.(?:inner|outer)HTML\s*=/)).toEqual([])
  })

  // F8 (plan 8.3, decisión 8): tiptap vive solo en el editor de secciones; las pantallas usan EditorMarkdown
  it('tiptap solo se importa en el editor de secciones', () => {
    const lugares = hallazgos(/['"]@tiptap\//).map((h) => h.split(':')[0])
    expect([...new Set(lugares)].sort()).toEqual(['portal/entregables/EditorMarkdown.tsx', 'portal/entregables/nodoMencion.ts'])
  })

  it('los vigías reconocen lo prohibido y dejan pasar lo permitido', () => {
    const rol = (line: string) => ROL.test(sinComentario(line))
    expect(rol("user.roles.includes('AUDITOR')")).toBe(true)
    expect(rol("const rol = 'GIS_ANALYST'")).toBe(true)
    expect(rol("'ROLE_AUDITOR'")).toBe(true)
    expect(rol("'AUDITOR_X'")).toBe(true)
    expect(rol("const u = 'http://x.com'; const r = 'AUDITOR'")).toBe(true)
    expect(rol("fetch('https://a/b', {r:'AUDITOR'})")).toBe(true)
    expect(rol('const { isAdmin } = useAuth()')).toBe(false)
    expect(rol("label: 'Administración'")).toBe(false)
    expect(rol("'AUDITORIA'")).toBe(false)
    expect(rol('const r = 1 // el AUDITOR no se nombra')).toBe(false)
    expect(rol("const u = 'http://x.com' // AUDITOR")).toBe(false)
    expect(rol('  // AUDITOR')).toBe(false)
    expect(rol('/** el AUDITOR ve todo')).toBe(false)
    expect(rol(' * el AUDITOR ve todo')).toBe(false)
    expect(rol('/* AUDITOR')).toBe(false)

    const interna = (code: string) => IMPORTACION_INTERNA.test(code)
    expect(interna("import { x } from '@wasichai/core/dist/auth/AuthProvider'")).toBe(true)
    expect(interna("export * from '@wasichai/ui/dist/button'")).toBe(true)
    expect(interna("import * as ui from '@wasichai/ui/dist/button'")).toBe(true)
    expect(interna("import { a as b } from '@wasichai/views/dist/a'")).toBe(true)
    expect(interna("import('@wasichai/core/dist/x')")).toBe(true)
    expect(interna("import( '@wasichai/core/dist/x')")).toBe(true)
    expect(interna("  '@wasichai/core/dist/x'")).toBe(true) // la línea de un import( de varias líneas
    expect(interna("import { useAuth } from '@wasichai/core'")).toBe(false)
  })
})
