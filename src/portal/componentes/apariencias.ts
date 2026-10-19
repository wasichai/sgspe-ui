import {
  Ban,
  BadgeCheck,
  Check,
  CircleCheck,
  CircleDashed,
  Clock,
  Copy,
  Eye,
  FileText,
  Forward,
  Handshake,
  Inbox,
  Lock,
  Package,
  Pause,
  Play,
  Search,
  Siren,
  Undo2,
  X,
  type LucideIcon
} from 'lucide-react'

// el sistema de estados de design-system.md §4.1 para los workflows de F2 a F5: cada estado con su tono y su ícono, nunca solo
// color. la etiqueta sale de la metadata del workflow (español, CON-051); aquí solo el tono
export type Tono = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger' | 'final'

export interface Apariencia {
  tono: Tono
  Icono: LucideIcon
}

const a = (tono: Tono, Icono: LucideIcon): Apariencia => ({ tono, Icono })

export const APARIENCIAS: Record<string, Record<string, Apariencia>> = {
  project: {
    draft: a('neutral', CircleDashed),
    in_review: a('info', Clock),
    active: a('success', CircleCheck),
    suspended: a('warning', Pause),
    closed: a('final', Lock),
    cancelled: a('final', X)
  },
  stakeholder: {
    identified: a('neutral', CircleDashed),
    profiled: a('info', FileText),
    assessed: a('success', CircleCheck),
    retired: a('final', X)
  },
  engagement: {
    planned: a('neutral', CircleDashed),
    scheduled: a('info', Clock),
    held: a('progress', Check),
    minutes_drafted: a('progress', FileText),
    minutes_in_review: a('info', Clock),
    minutes_approved: a('success', CircleCheck),
    postponed: a('warning', Pause),
    closed: a('final', Lock),
    cancelled: a('final', X)
  },
  field_visit: {
    planned: a('neutral', CircleDashed),
    in_progress: a('progress', Play),
    completed: a('success', CircleCheck),
    partial: a('warning', Check),
    cancelled: a('final', X)
  },
  area_of_influence: {
    draft: a('neutral', CircleDashed),
    approved: a('success', CircleCheck),
    superseded: a('final', Lock)
  },
  // WF-D
  commitment: {
    draft: a('neutral', CircleDashed),
    pending_approval: a('info', Clock),
    approved: a('info', CircleCheck),
    in_progress: a('progress', Play),
    blocked: a('warning', Pause),
    fulfilled: a('success', Check),
    verified: a('success', BadgeCheck),
    closed: a('final', Lock),
    cancelled: a('final', X)
  },
  // WF-K
  commitment_candidate: {
    proposed: a('info', CircleDashed),
    accepted: a('success', CircleCheck),
    rejected: a('final', X),
    duplicate: a('final', Copy)
  },
  // WF-I
  agreement: {
    draft: a('neutral', CircleDashed),
    in_negotiation: a('progress', Handshake),
    active: a('success', CircleCheck),
    suspended: a('warning', Pause),
    concluded: a('final', Lock),
    terminated: a('final', Ban),
    cancelled: a('final', X)
  },
  // WF-N
  task: {
    open: a('neutral', CircleDashed),
    in_progress: a('progress', Play),
    blocked: a('warning', Pause),
    done: a('success', CircleCheck),
    cancelled: a('final', X)
  },
  // WF-E1
  grievance: {
    received: a('neutral', Inbox),
    acknowledged: a('info', Check),
    in_assessment: a('info', Search),
    in_investigation: a('progress', Search),
    in_action: a('progress', Play),
    resolved: a('success', CircleCheck),
    verified: a('success', BadgeCheck),
    closed: a('final', Lock),
    rejected: a('final', Ban),
    withdrawn: a('final', Undo2)
  },
  // WF-E2
  inquiry: {
    received: a('neutral', Inbox),
    answered: a('success', CircleCheck),
    referred: a('info', Forward),
    closed: a('final', Lock)
  },
  // WF-E3
  stakeholder_request: {
    received: a('neutral', Inbox),
    under_evaluation: a('info', Search),
    accepted: a('success', CircleCheck),
    declined: a('warning', Ban),
    closed: a('final', Lock)
  },
  // WF-F
  social_risk: {
    identified: a('neutral', CircleDashed),
    assessed: a('info', Check),
    mitigating: a('progress', Play),
    monitoring: a('info', Eye),
    closed: a('final', Lock)
  },
  // WF-J
  early_warning: {
    detected: a('warning', Siren),
    in_triage: a('info', Search),
    confirmed: a('danger', CircleCheck),
    responding: a('progress', Play),
    resolved: a('success', CircleCheck),
    dismissed: a('final', X),
    closed: a('final', Lock)
  },
  // WF-M
  incident: {
    reported: a('warning', Siren),
    under_review: a('info', Search),
    responding: a('progress', Play),
    closed: a('final', Lock)
  },
  // WF-G
  social_program: {
    draft: a('neutral', CircleDashed),
    pending_approval: a('info', Clock),
    planned: a('info', CircleCheck),
    executing: a('progress', Play),
    monitoring: a('info', Eye),
    evaluation: a('info', Search),
    suspended: a('warning', Pause),
    closed: a('final', Lock),
    cancelled: a('final', X)
  },
  // WF-P
  // WF-K (F7): una propuesta de la IA espera a que una persona decida
  ai_suggestion: {
    proposed: a('info', Inbox),
    accepted: a('success', CircleCheck),
    rejected: a('final', X),
    duplicate: a('final', Copy)
  },
  // WF-H (F8): el entregable; emitido es un estado intermedio (puede abrir una nueva revisión) pero ya salió
  deliverable: {
    draft: a('neutral', CircleDashed),
    in_review: a('info', Clock),
    observed: a('warning', Eye),
    approved: a('success', CircleCheck),
    issued: a('success', BadgeCheck),
    voided: a('final', X)
  },
  social_contribution: {
    requested: a('neutral', Inbox),
    approved: a('info', CircleCheck),
    procured: a('progress', Package),
    delivered: a('success', Check),
    closed: a('final', Lock),
    rejected: a('final', Ban),
    cancelled: a('final', X)
  }
}

export const CLASE_DE_TONO: Record<Tono, string> = {
  neutral: 'bg-sg-neutral-soft text-sg-neutral',
  info: 'bg-sg-info-soft text-sg-info',
  progress: 'bg-sg-progress-soft text-sg-progress',
  success: 'bg-sg-success-soft text-sg-success',
  warning: 'bg-sg-warning-soft text-sg-warning',
  danger: 'bg-sg-danger-soft text-sg-danger',
  final: 'border border-sg-border-strong text-sg-text-muted'
}

// un estado sin apariencia propia es neutro y sin juicio: nunca el ícono de prohibido, que se lee como «rechazado»
export const aparienciaDe = (objeto: string, estado: string | null | undefined): Apariencia =>
  (estado ? APARIENCIAS[objeto]?.[estado] : undefined) ?? a('neutral', CircleDashed)
