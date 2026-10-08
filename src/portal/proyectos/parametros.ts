// los parámetros y políticas de project que llegan en F2 (database-model.md, project; los de F3 y F4 llegan con su módulo).
// wasichai no aplica defaultValue (UPS-15): el portal propone el valor por defecto al crear y lo muestra como tal (ASM-019)
export interface Parametro {
  campo: string
  tipo: 'numero' | 'politica'
  porDefecto: number | boolean
  grupo: 'grupos' | 'relacionamiento' | 'proyecto'
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

export const valoresPorDefecto = (): Record<string, number | boolean> => Object.fromEntries(PARAMETROS_F2.map((p) => [p.campo, p.porDefecto]))

// el valor vigente de un parámetro: el guardado o, si está vacío, el por defecto (dashboards.md §3.3)
export const vigente = (atributos: Record<string, unknown>, p: Parametro): number | boolean => (atributos[p.campo] ?? p.porDefecto) as number | boolean
