import type { TerritoryFilter, TerritoryKind } from '../shell/context'

// a dónde lleva el selector de proyecto (ASM-076): la misma página con el otro alcance. de un proyecto a "todos" se
// vuelve a la lista global de la sección; de "todos" a un proyecto, a la misma sección del proyecto; entre proyectos se
// conserva la sección y se sueltan los identificadores de registro, que son de otro proyecto. el chip de territorio no
// viaja: el lugar puede no ser del otro proyecto (ux-architecture.md §8.4)
const GLOBAL_A_PROYECTO: [RegExp, string][] = [
  [/^\/stakeholders\/dashboard/, 'stakeholders/dashboard'],
  [/^\/stakeholders/, 'stakeholders'],
  [/^\/engagements\/calendar/, 'engagements/calendar'],
  [/^\/engagements\/dashboard/, 'engagements/dashboard'],
  [/^\/(engagements|field-visits)/, 'engagements'],
  [/^\/territory/, 'map'],
  [/^\/commitments\/dashboard/, 'commitments/dashboard'],
  [/^\/commitments/, 'commitments'],
  [/^\/agreements/, 'agreements'],
  [/^\/documents/, 'documents'],
  [/^\/tasks/, 'tasks'],
  [/^\/reports/, 'reports'],
  [/^\/attention\/dashboard/, 'attention/dashboard'],
  [/^\/attention\/report/, 'attention/report'],
  [/^\/attention/, 'attention'],
  [/^\/programs\/dashboard/, 'programs/dashboard'],
  [/^\/programs/, 'programs'],
  [/^\/risks\/register/, 'risks/register'],
  [/^\/risks\/rules/, 'risks/rules'],
  [/^\/risks\/dashboard/, 'risks/dashboard'],
  [/^\/risks/, 'risks']
]

const PROYECTO_A_GLOBAL: [RegExp, string][] = [
  [/^stakeholders\/dashboard/, '/stakeholders/dashboard'],
  [/^stakeholders/, '/stakeholders'],
  [/^engagements\/calendar/, '/engagements/calendar'],
  [/^engagements\/dashboard/, '/engagements/dashboard'],
  [/^(engagements|field-visits)/, '/engagements'],
  [/^(map|areas)/, '/territory'],
  [/^commitments\/dashboard/, '/commitments/dashboard'],
  [/^commitments/, '/commitments'],
  [/^agreements/, '/agreements'],
  [/^documents/, '/documents'],
  [/^tasks/, '/tasks'],
  [/^reports/, '/reports'],
  [/^attention\/dashboard/, '/attention/dashboard'],
  [/^attention\/report/, '/attention/report'],
  [/^(attention|grievances|inquiries|requests)/, '/attention'],
  [/^programs\/dashboard/, '/programs/dashboard'],
  [/^(programs|contributions)/, '/programs'],
  [/^risks\/rules/, '/risks/rules'],
  [/^risks\/dashboard/, '/risks/dashboard'],
  [/^risks\/register/, '/risks/register'],
  [/^(risks|incidents)/, '/risks']
]

const SECCIONES_DE_PROYECTO = [
  'overview',
  'map',
  'settings',
  'reports',
  'commitments',
  'agreements',
  'documents',
  'tasks',
  'attention',
  'risks',
  'incidents',
  'programs'
]

export function rutaEquivalente(pathname: string, proyecto: string | null): string {
  const enProyecto = /^\/projects\/([^/]+)\/?(.*)$/.exec(pathname)
  const resto = enProyecto && enProyecto[1] !== 'new' ? enProyecto[2] : null
  if (proyecto === null) {
    if (resto === null) return pathname.startsWith('/projects') ? '/projects' : pathname
    return PROYECTO_A_GLOBAL.find(([patron]) => patron.test(resto))?.[1] ?? '/projects'
  }
  const base = `/projects/${encodeURIComponent(proyecto)}`
  if (resto !== null) {
    const [primera, segunda] = resto.split('/')
    if (primera === 'stakeholders' && (segunda === 'matrix' || segunda === 'dashboard')) return `${base}/stakeholders/${segunda}`
    if (primera === 'engagements' && (segunda === 'calendar' || segunda === 'dashboard')) return `${base}/engagements/${segunda}`
    if (primera === 'commitments' && segunda === 'dashboard') return `${base}/commitments/dashboard`
    if (primera === 'attention' && (segunda === 'dashboard' || segunda === 'report')) return `${base}/attention/${segunda}`
    if (['grievances', 'inquiries', 'requests'].includes(primera)) return `${base}/attention`
    if (primera === 'risks' && segunda === 'incidents') return `${base}/incidents`
    if (primera === 'risks' && ['register', 'dashboard', 'warnings', 'mentions', 'signals', 'impacts', 'rules'].includes(segunda ?? ''))
      return `${base}/risks/${segunda}`
    if (primera === 'programs' && segunda === 'dashboard') return `${base}/programs/dashboard`
    if (primera === 'contributions') return `${base}/programs`
    if (primera === 'field-visits') return `${base}/engagements`
    if (primera === 'areas') return `${base}/map`
    return `${base}/${primera && (SECCIONES_DE_PROYECTO.includes(primera) || ['stakeholders', 'engagements'].includes(primera)) ? primera : 'overview'}`
  }
  const destino = GLOBAL_A_PROYECTO.find(([patron]) => patron.test(pathname))?.[1] ?? 'overview'
  return `${base}/${destino}`
}

// el objeto del modelo detrás de cada tipo de chip de territorio
export const OBJETO_DE_TERRITORIO: Record<TerritoryKind, string> = {
  community: 'community',
  locality: 'locality',
  'admin-unit': 'administrative_unit',
  area: 'area_of_influence'
}

// el filtro de igualdad de la API genérica que aplica el chip a una lista, si el objeto tiene esa relación. la regla de
// inclusión completa de dashboards.md §3.1 (sectores, unidades hijas, miembros del área) es de los indicadores
export function filtroDeTerritorio(territorio: TerritoryFilter | null, relaciones: Partial<Record<TerritoryKind, string>>): Record<string, string> | null {
  if (!territorio) return {}
  const campo = relaciones[territorio.kind]
  return campo ? { [campo]: territorio.id } : null
}

// el chip del lugar como lo escribe la URL (?territory=community:<id>)
export const valorDeTerritorio = (kind: TerritoryKind, id: string) => `${kind}:${id}`
