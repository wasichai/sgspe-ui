import { useAuth, type NavTreeLeaf } from '@wasichai/core'
import {
  ChartColumn,
  FileText,
  FolderKanban,
  Handshake,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  MapIcon,
  MessageSquareWarning,
  MessagesSquare,
  Settings,
  ShieldAlert,
  Users
} from 'lucide-react'
import { useMemo } from 'react'
import { useCapacidades } from '../datos/capacidades'
import { PANTALLAS } from '../pantallas'

// la navegación principal del portal (docs/ux/ux-architecture.md §6.2 y §7): las 13 secciones de RNF-USA-001 en su orden,
// el mismo para todos los roles, con ícono, la ruta global en inglés y kebab-case (ASM-075) y sus fases (architecture.md
// §9.2). una sección se dibuja solo si tiene pantalla y la cuenta tiene los permisos que pide (RF-IAM-002); los permisos
// son los de GET /api/auth/me/permissions. Administración, solo para quien administra (ADR-0024): admin o MANAGE_METADATA o
// MANAGE_ORGANIZATION en capabilities (UPS-06). el
// asistente de IA no es una sección (ASM-073): es el botón Preguntar de la barra superior. sin nombres de rol: decide
// isAdmin de core y los pares objeto/acción (RQ-SEC-005)

export type ClaveDeSeccion =
  | 'dashboard'
  | 'projects'
  | 'territory'
  | 'stakeholders'
  | 'engagements'
  | 'commitments'
  | 'attention'
  | 'risks'
  | 'programs'
  | 'documents'
  | 'tasks'
  | 'reports'
  | 'admin'

export type Fase = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8'

// lo que una cuenta puede hacer sobre un objeto del modelo, como lo lista GET /api/auth/me/permissions (WAS-ADR-0020)
export type Accion = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT'

export interface Par {
  objeto: string
  accion: Accion
}

export interface SeccionNav extends NavTreeLeaf {
  clave: ClaveDeSeccion
  // las fases en que llega o crece la sección; la primera es la de llegada
  fases: Fase[]
  // cuándo se ofrece: alguna de estas alternativas, cada una una lista de pares que la cuenta debe tener todos
  seOfreceCon?: Par[][]
  // solo para quien administra: la sección Administración
  soloAdmin?: boolean
}

const lee = (objeto: string): Par => ({ objeto, accion: 'READ' })

// los objetos son los del catálogo canónico (domain-model.md §6): el que lee la pantalla principal de cada sección
export const NAV_TREE: SeccionNav[] = [
  { clave: 'dashboard', label: 'Dashboard', to: '/', icon: LayoutDashboard, fases: ['F1', 'F8'] },
  { clave: 'projects', label: 'Proyectos', to: '/projects', icon: FolderKanban, fases: ['F2', 'F7'], seOfreceCon: [[lee('project')]] },
  { clave: 'territory', label: 'Territorio', to: '/territory', icon: MapIcon, fases: ['F2', 'F6'], seOfreceCon: [[lee('locality')]] },
  { clave: 'stakeholders', label: 'Grupos de interés', to: '/stakeholders', icon: Users, fases: ['F2'], seOfreceCon: [[lee('stakeholder')]] },
  { clave: 'engagements', label: 'Relacionamiento', to: '/engagements', icon: MessagesSquare, fases: ['F2'], seOfreceCon: [[lee('engagement')]] },
  { clave: 'commitments', label: 'Compromisos', to: '/commitments', icon: Handshake, fases: ['F3'], seOfreceCon: [[lee('commitment')]] },
  {
    clave: 'attention',
    label: 'Quejas, consultas y solicitudes',
    to: '/attention',
    icon: MessageSquareWarning,
    fases: ['F4'],
    seOfreceCon: [[lee('grievance')], [lee('inquiry')], [lee('stakeholder_request')]]
  },
  {
    clave: 'risks',
    label: 'Riesgos',
    to: '/risks',
    icon: ShieldAlert,
    fases: ['F4'],
    seOfreceCon: [[lee('social_risk')], [lee('early_warning')], [lee('incident')]]
  },
  {
    clave: 'programs',
    label: 'Programas sociales',
    to: '/programs',
    icon: HeartHandshake,
    fases: ['F5'],
    seOfreceCon: [[lee('social_program')], [lee('social_contribution')]]
  },
  { clave: 'documents', label: 'Documentos', to: '/documents', icon: FileText, fases: ['F3'], seOfreceCon: [[lee('evidence')]] },
  { clave: 'tasks', label: 'Tareas', to: '/tasks', icon: ListChecks, fases: ['F3'], seOfreceCon: [[lee('task')]] },
  // en F2 y F3, Reportes son las exportaciones (el registro de grupos de interés y la matriz de compromisos) y su historial
  {
    clave: 'reports',
    label: 'Reportes',
    to: '/reports',
    icon: ChartColumn,
    fases: ['F2', 'F8'],
    seOfreceCon: [[{ objeto: 'stakeholder', accion: 'EXPORT' }], [{ objeto: 'commitment', accion: 'EXPORT' }], [lee('export_log')]]
  },
  { clave: 'admin', label: 'Administración', to: '/admin', icon: Settings, external: true, soloAdmin: true, fases: ['F1'] }
]

// la guarda de una pantalla que vive bajo una sección pero lee otro objeto: la sección (su nombre y su pantalla) con otros
// permisos (LEE_ACUERDOS, de leeAcuerdos.ts)
export function guardaDe(clave: ClaveDeSeccion, seOfreceCon?: Par[][]): SeccionNav {
  const seccion = NAV_TREE.find((s) => s.clave === clave)!
  return seOfreceCon ? { ...seccion, seOfreceCon } : seccion
}

// lo que el árbol pregunta de la cuenta (useAuth de core: can es siempre true para el admin) y de las pantallas
export interface Oferta {
  isAdmin: boolean
  // las capacidades de tenant que responde GET /api/auth/me/permissions (capabilities, UPS-06)
  capacidades?: string[]
  can: (objeto: string, accion: string) => boolean
  conPantalla: (clave: ClaveDeSeccion) => boolean
}

export type Estado = 'disponible' | 'sin-acceso' | 'solo-admin' | 'por-llegar'

// si la cuenta tiene alguna de las alternativas, cada una con todos sus pares. lo usan las secciones y los inicios por rol
export const ofrece = (alternativas: Par[][], can: Oferta['can']) =>
  alternativas.some((alternativa) => alternativa.every(({ objeto, accion }) => can(objeto, accion)))

// el Dashboard es la ruta índice del portal y Administración un enlace a /admin: existen sin registrarse en PANTALLAS
export const conPantalla = (clave: ClaveDeSeccion) => clave === 'dashboard' || PANTALLAS[clave] !== undefined

// administra quien es admin o la plataforma dice que tiene MANAGE_METADATA o MANAGE_ORGANIZATION (WAS-ADR-0053)
const administra = ({ isAdmin, capacidades = [] }: Oferta) => isAdmin || capacidades.includes('MANAGE_METADATA') || capacidades.includes('MANAGE_ORGANIZATION')

// por qué una sección se dibuja o no para esta cuenta
export function estadoDe(seccion: SeccionNav, oferta: Oferta): Estado {
  if (seccion.soloAdmin && !administra(oferta)) return 'solo-admin'
  if (!seccion.external && !oferta.conPantalla(seccion.clave)) return 'por-llegar'
  return !seccion.seOfreceCon || ofrece(seccion.seOfreceCon, oferta.can) ? 'disponible' : 'sin-acceso'
}

// las secciones que se dibujan para esta cuenta, en su orden
export function arbolPara(secciones: SeccionNav[], oferta: Oferta): SeccionNav[] {
  return secciones.filter((seccion) => estadoDe(seccion, oferta) === 'disponible')
}

// la oferta de la cuenta que inició sesión: mientras sus permisos no se leen, o si no se pueden leer, nada pide permisos
// pasa, y Administración no se dibuja
export function useOferta(): Oferta {
  const { isAdmin, can } = useAuth()
  const { capacidades } = useCapacidades()
  return useMemo(() => ({ isAdmin, capacidades, can, conPantalla }), [isAdmin, capacidades, can])
}

export function useArbol(): SeccionNav[] {
  const oferta = useOferta()
  return useMemo(() => arbolPara(NAV_TREE, oferta), [oferta])
}
