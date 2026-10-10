// los parámetros y políticas de project que llegan en F2 y, desde F4, los de quejas y riesgos (database-model.md, project). wasichai
// no aplica defaultValue (UPS-15): el portal propone el valor por defecto al crear y lo muestra como tal (ASM-019)
export interface Parametro {
  campo: string
  tipo: 'numero' | 'politica'
  porDefecto: number | boolean
  grupo: 'grupos' | 'relacionamiento' | 'proyecto' | 'quejas' | 'riesgos'
  // el rango entero que el servidor acepta (ProjectWriteGuard, plan 4.2a: 400 OUT_OF_RANGE fuera de él)
  rango?: { min: number; max: number }
}

export const PARAMETROS_F2: readonly Parametro[] = [
  { campo: 'interest_threshold', tipo: 'numero', porDefecto: 3, grupo: 'grupos' },
  { campo: 'power_threshold', tipo: 'numero', porDefecto: 3, grupo: 'grupos' },
  { campo: 'stakeholder_review_days', tipo: 'numero', porDefecto: 30, grupo: 'grupos' },
  { campo: 'inactivity_days', tipo: 'numero', porDefecto: 90, grupo: 'grupos' },
  { campo: 'meetings_per_month_target', tipo: 'numero', porDefecto: 2, grupo: 'relacionamiento' },
  { campo: 'policy_minutes_only_formal_types', tipo: 'politica', porDefecto: true, grupo: 'relacionamiento' },
  { campo: 'policy_activation_preconditions', tipo: 'politica', porDefecto: true, grupo: 'proyecto' }
]

// F4 (plan 4.2a, ProjectParameters): los plazos de las QCS (el acuse en días hábiles), la política de las quejas graves, la
// cadencia de revisión de los riesgos y los umbrales de nivel por puntaje P × I, que deben crecer (medio < alto < crítico). un
// proyecto creado antes de F4 los tiene vacíos y vale el por defecto; el alta de un proyecto no los manda (no son de su asistente)
const DIAS = { min: 1, max: 365 }
const PUNTAJE = { min: 1, max: 25 }
export const PARAMETROS_F4: readonly Parametro[] = [
  { campo: 'grievance_ack_days', tipo: 'numero', porDefecto: 5, grupo: 'quejas', rango: DIAS },
  { campo: 'grievance_resolution_days', tipo: 'numero', porDefecto: 30, grupo: 'quejas', rango: DIAS },
  { campo: 'inquiry_response_days', tipo: 'numero', porDefecto: 15, grupo: 'quejas', rango: DIAS },
  { campo: 'policy_high_severity_requires_approver', tipo: 'politica', porDefecto: true, grupo: 'quejas' },
  { campo: 'risk_review_days', tipo: 'numero', porDefecto: 7, grupo: 'riesgos', rango: DIAS },
  { campo: 'risk_medium_min_score', tipo: 'numero', porDefecto: 5, grupo: 'riesgos', rango: PUNTAJE },
  { campo: 'risk_high_min_score', tipo: 'numero', porDefecto: 10, grupo: 'riesgos', rango: PUNTAJE },
  { campo: 'risk_critical_min_score', tipo: 'numero', porDefecto: 15, grupo: 'riesgos', rango: PUNTAJE }
]

export const UMBRALES_DE_RIESGO = ['risk_medium_min_score', 'risk_high_min_score', 'risk_critical_min_score'] as const

// lo que el servidor rechazaría (400 OUT_OF_RANGE), dicho antes de guardar: un valor fuera de su rango o no entero, y los umbrales
// que no crecen. devuelve el campo y el motivo; sin problemas, vacío
export function problemasDeParametros(valorDe: (campo: string) => number | boolean | undefined): { campo: string; motivo: 'rango' | 'orden' }[] {
  const problemas: { campo: string; motivo: 'rango' | 'orden' }[] = []
  for (const p of PARAMETROS_F4) {
    const v = valorDe(p.campo)
    if (!p.rango || typeof v !== 'number' || Number.isNaN(v)) continue
    if (!Number.isInteger(v) || v < p.rango.min || v > p.rango.max) problemas.push({ campo: p.campo, motivo: 'rango' })
  }
  const [medio, alto, critico] = UMBRALES_DE_RIESGO.map((c) => valorDe(c))
  if ([medio, alto, critico].every((v) => typeof v === 'number') && !((medio as number) < (alto as number) && (alto as number) < (critico as number)))
    problemas.push({ campo: 'risk_high_min_score', motivo: 'orden' })
  return problemas
}

export const valoresPorDefecto = (): Record<string, number | boolean> => Object.fromEntries(PARAMETROS_F2.map((p) => [p.campo, p.porDefecto]))

// el valor vigente de un parámetro: el guardado o, si está vacío, el por defecto (dashboards.md §3.3)
export const vigente = (atributos: Record<string, unknown>, p: Parametro): number | boolean => (atributos[p.campo] ?? p.porDefecto) as number | boolean
