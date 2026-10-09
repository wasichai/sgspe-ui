import { Ban, Check, CircleCheck, CircleDashed, Clock, FileText, Lock, Pause, Play, X, type LucideIcon } from 'lucide-react'

// el sistema de estados de design-system.md §4.1 para los workflows de F2: cada estado con su tono y su ícono, nunca solo
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

export const aparienciaDe = (objeto: string, estado: string | null | undefined): Apariencia =>
  (estado ? APARIENCIAS[objeto]?.[estado] : undefined) ?? a('neutral', Ban)
