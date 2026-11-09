import { pagina, registro, USUARIO } from '../api'

// los datos de las capturas de la fase 11 (wasichai/sgspe-ui#110): programas e inversión, documentos, tareas y aprobaciones. van
// aparte de escenario.ts para no pisar las demás fases, que lo cambian en paralelo; escenario.ts los suma delante de sus rutas, así
// que ganan a las suyas. todo es ficticio

type Cuerpo = unknown | ((url: URL) => unknown)

const ahora = '2026-10-16T15:00:00Z'
const conEstado = (r: ReturnType<typeof registro>, extra: Record<string, unknown>) => ({ ...r, ...extra })
const flujo = (objeto: string, estados: [string, string, string?][]) => ({
  id: objeto,
  objectName: objeto,
  name: objeto,
  label: objeto,
  enabled: true,
  definition: { states: estados.map(([name, label, type]) => ({ name, label, type: type ?? 'INTERMEDIATE' })), transitions: [] }
})
const enumerado = (name: string, enumOptions: string[]) => ({ name, type: 'ENUM', enumOptions, editable: false, visible: true })

// programas: uno en ejecución con presupuesto en soles y en dólares, uno aprobado y uno por aprobar con socio
const PROGRAMAS = [
  registro(
    'sp1',
    {
      project: 'p1',
      code: 'PS-001',
      name: 'Programa de agua segura para las comunidades de la cuenca alta',
      description: 'Mejora de la calidad del agua de consumo humano con sistemas de cloración y capacitación a las JASS.',
      partner_organization: 'o14',
      start_date: '2026-03-01',
      end_date: '2027-02-28',
      currency: 'PEN',
      total_budget: '180000',
      state_changed_at: '2026-04-10T15:00:00Z',
      state_changed_by: 'cmm@sgspe.test'
    },
    'executing'
  ),
  registro(
    'sp2',
    { project: 'p1', code: 'PS-002', name: 'Fortalecimiento de capacidades productivas', currency: 'PEN', start_date: '2026-06-01', end_date: '2026-12-31' },
    'planned'
  ),
  registro(
    'sp3',
    { project: 'p1', code: 'PS-003', name: 'Becas de educación técnica para jóvenes', currency: 'USD', partner_organization: 'o15' },
    'pending_approval'
  )
]
const FLUJO_DE_PROGRAMA = flujo('social_program', [
  ['draft', 'Borrador', 'INITIAL'],
  ['pending_approval', 'Pendiente de aprobación'],
  ['planned', 'Planificado'],
  ['executing', 'En ejecución'],
  ['monitoring', 'En seguimiento'],
  ['evaluation', 'En evaluación'],
  ['closed', 'Cerrado', 'FINAL'],
  ['cancelled', 'Cancelado', 'FINAL']
])
const PRESUPUESTOS = [
  registro('pb1', { social_program: 'sp1', budget_year: 2026, currency: 'PEN', allocated_amount: '120000', executed_amount: '54000' }),
  registro('pb2', { social_program: 'sp1', budget_year: 2026, currency: 'USD', allocated_amount: '15000', executed_amount: '3200' }),
  registro('pb3', { social_program: 'sp1', budget_year: 2027, currency: 'PEN', allocated_amount: '60000', executed_amount: null })
]
const INDICADORES_DEL_PROGRAMA = [
  registro('pi1', { social_program: 'sp1', name: 'Familias con agua clorada', unit: 'familias', baseline_value: 40, target_value: 320 })
]
const MEDICIONES = [registro('pm1', { program_indicator: 'pi1', period_start_date: '2026-09-01', period_end_date: '2026-09-30', value: 186 })]
const GRUPOS_BENEFICIARIOS = [
  registro('bg1', { social_program: 'sp1', name: 'Familias de Tunas Pampa', target_count: 180, reached_count: 112 }),
  registro('bg2', { social_program: 'sp1', name: 'Familias de Ccollpa', target_count: 140, reached_count: 74 })
]

// aportes: uno por aprobar (requested, sin monto aún), uno entregado (congelado, en dólares) y uno aprobado en soles
const APORTES = [
  registro(
    'ap1',
    {
      project: 'p1',
      code: 'AP-001',
      contribution_type: 'APOYO EN ESPECIE',
      occasion: 'Aniversario de la institución educativa',
      declared_purpose: 'Equipar la biblioteca escolar de Tunas Pampa',
      conditions: 'Entrega en la plaza con acta firmada por la directiva',
      total_amount: '1750.5',
      currency: 'PEN',
      beneficiaries_count: 120,
      recipient_organization: 'o1',
      payer_organization: 'o13',
      exploration_campaign: 'camp1',
      state_changed_at: '2026-10-06T15:00:00Z'
    },
    'requested'
  ),
  registro(
    'ap2',
    {
      project: 'p1',
      code: 'AP-002',
      contribution_type: 'DONACION',
      occasion: 'Fiesta patronal de Tunas',
      declared_purpose: 'Equipos de sonido para la fiesta patronal',
      total_amount: '850',
      currency: 'USD',
      beneficiaries_count: 300,
      recipient_organization: 'o16',
      state_changed_at: '2026-10-02T15:00:00Z'
    },
    'delivered'
  ),
  registro(
    'ap3',
    {
      project: 'p1',
      code: 'AP-003',
      contribution_type: 'APOYO ECONOMICO',
      declared_purpose: 'Transporte de la delegación al encuentro regional de rondas',
      total_amount: '2400',
      currency: 'PEN',
      stakeholder: 's1',
      exploration_campaign: 'camp1'
    },
    'approved'
  ),
  registro('ap4', { project: 'p1', code: 'AP-004', contribution_type: 'DONACION', declared_purpose: 'Útiles para el PRONOEI', currency: 'PEN' }, 'requested')
]
const FLUJO_DE_APORTE = flujo('social_contribution', [
  ['requested', 'Solicitado', 'INITIAL'],
  ['approved', 'Aprobado'],
  ['procured', 'Adquirido'],
  ['delivered', 'Entregado'],
  ['closed', 'Cerrado', 'FINAL'],
  ['rejected', 'Rechazado', 'FINAL'],
  ['cancelled', 'Cancelado', 'FINAL']
])
const ITEMS: Record<string, ReturnType<typeof registro>[]> = {
  ap1: [
    registro('it1', {
      social_contribution: 'ap1',
      description: 'Estantes de madera',
      item_kind: 'BIEN',
      quantity: 5,
      unit: 'unidad',
      unit_cost: '250',
      line_amount: '1250'
    }),
    registro('it2', {
      social_contribution: 'ap1',
      description: 'Colección de libros de lectura',
      item_kind: 'BIEN',
      quantity: 1,
      unit: 'lote',
      unit_cost: '500.5',
      line_amount: '500.5'
    })
  ],
  ap2: [
    registro('it3', {
      social_contribution: 'ap2',
      description: 'Parlantes y consola',
      item_kind: 'BIEN',
      quantity: 1,
      unit: 'lote',
      unit_cost: '850',
      line_amount: '850'
    })
  ]
}
const ENTREGA = registro('dl1', {
  social_contribution: 'ap2',
  delivery_date: '2026-10-02',
  place: 'Plaza de Tunas',
  delivered_items: 'Parlantes y consola de sonido',
  recipients: 'Directiva de la comisión de festejos',
  conformity_given: true,
  conformity_by: 'Presidencia de la comisión de festejos'
})
const DE_LA_ENTREGA = [
  registro('ev5', { project: 'p1', title: 'Acta de recepción firmada', evidence_type: 'ACTA DE RECEPCION', classification: 'INTERNA' }),
  registro('ev2', { project: 'p1', title: 'Foto de la entrega de equipos de sonido', evidence_type: 'FOTO', classification: 'INTERNA' }),
  registro('ev4', { project: 'p1', title: 'Comprobante de compra', evidence_type: 'COMPROBANTE', classification: 'PUBLICA' })
]
const COMPROBANTE = registro('rc1', {
  social_contribution: 'ap2',
  receipt_type: 'FACTURA',
  receipt_number: 'F001-000123',
  issuer_name: 'Comercial de prueba',
  issue_date: '2026-09-30',
  amount: '850',
  currency: 'USD'
})
const CAMPANA = registro('camp1', {
  project: 'p1',
  name: 'Campaña de exploración 2026',
  social_support_cap: '50000',
  currency: 'PEN',
  executed_social_amount: '18750',
  committed_social_amount: '26400',
  other_currency_items_count: 0
})
const ORGANIZACIONES = [
  registro('o13', { name: 'Minera Ejemplo S.A.C.' }),
  registro('o14', { name: 'ONG Agua para Todos' }),
  registro('o15', { name: 'Instituto técnico de prueba' }),
  registro('o16', { name: 'Comisión de festejos de Tunas' })
]

// el tablero investment del proyecto: el tope de la campaña, el presupuesto del año por moneda y los beneficiarios
const INVERSION = {
  dashboard: 'investment',
  computedAt: ahora,
  filters: { project: ['p1'] },
  indicators: [
    {
      code: 'KPI-INV-01',
      label: 'Ejecución de la campaña frente a su tope',
      available: true,
      value: 38,
      breakdowns: [
        {
          by: 'campaign',
          rows: [
            {
              key: 'camp1',
              label: 'Campaña de exploración 2026',
              currency: 'PEN',
              cap: '50000',
              committed: '26400',
              executed: '18750',
              committedPercent: 53,
              executedPercent: 38,
              committedOtherCurrencyCount: 0,
              otherCurrencyCount: 1
            }
          ]
        }
      ]
    },
    {
      code: 'KPI-INV-02',
      label: 'Ejecución de programas frente a presupuesto',
      available: true,
      value: null,
      breakdowns: [
        {
          by: 'program',
          rows: [
            {
              key: 'sp1:2026:PEN',
              program: 'sp1',
              label: 'PS-001',
              year: 2026,
              currency: 'PEN',
              allocated: '120000',
              executed: '54000',
              percent: 45,
              state: 'executing'
            },
            {
              key: 'sp1:2026:USD',
              program: 'sp1',
              label: 'PS-001',
              year: 2026,
              currency: 'USD',
              allocated: '15000',
              executed: '3200',
              percent: 21,
              state: 'executing'
            },
            {
              key: 'sp2:2026:PEN',
              program: 'sp2',
              label: 'PS-002',
              year: 2026,
              currency: 'PEN',
              allocated: '40000',
              executed: '0',
              percent: 0,
              state: 'planned'
            },
            { key: 'sp3:2026:USD', program: 'sp3', label: 'PS-003', year: 2026, currency: 'USD', allocated: '20000', executed: null, state: 'pending_approval' }
          ]
        }
      ]
    },
    {
      code: 'KPI-INV-04',
      label: 'Beneficiarios',
      available: true,
      value: 186,
      breakdowns: [
        {
          by: 'source',
          rows: [
            { key: 'PROGRAMAS', value: 186, target: 320 },
            { key: 'APORTES', value: 420 },
            { key: 'COMPROMISOS', value: 95 }
          ]
        },
        { by: 'program', rows: [{ key: 'sp1', target: 320, reached: 186 }] }
      ]
    }
  ]
}

// documentos: un acta interna, una foto con personas sin consentimiento y una lista restringida (sin nombre ni huella para quien no
// descarga)
const archivo = (name: string, contentType: string, size: number) => ({ id: `f-${name}`, name, contentType, size, sha256: 'ab12'.repeat(16) })
const EVIDENCIAS = [
  registro('ev1', {
    project: 'p1',
    title: 'Acta firmada de la asamblea comunal',
    evidence_type: 'ACTA DE ENTREGA',
    classification: 'INTERNA',
    document_date: '2026-10-12',
    author: 'Relacionista de prueba',
    people_identifiable: false,
    file: archivo('acta-asamblea.pdf', 'application/pdf', 482_133)
  }),
  registro('ev2', {
    project: 'p1',
    title: 'Foto de la entrega de equipos de sonido',
    evidence_type: 'FOTO',
    classification: 'INTERNA',
    document_date: '2026-10-02',
    people_identifiable: true,
    photo_consent_given: false,
    file: archivo('entrega.jpg', 'image/jpeg', 2_310_552)
  }),
  registro('ev3', {
    project: 'p1',
    title: '',
    evidence_type: 'LISTA DE ASISTENCIA',
    classification: 'DATOS PERSONALES',
    document_date: '2026-09-28',
    file: archivo('evidencia-20260928-101500.pdf', 'application/pdf', 156_004)
  }),
  registro('ev4', {
    project: 'p1',
    title: 'Comprobante de compra de estantes',
    evidence_type: 'COMPROBANTE',
    classification: 'PUBLICA',
    document_date: '2026-10-05',
    file: archivo('comprobante.pdf', 'application/pdf', 98_221)
  })
].map((e) => conEstado(e, { createdAt: '2026-10-12T15:00:00Z' }))
const DEF_DE_EVIDENCIA = {
  id: 'x',
  name: 'evidence',
  label: 'Evidencia',
  fields: [
    enumerado('evidence_type', ['ACTA DE ENTREGA', 'FOTO', 'LISTA DE ASISTENCIA', 'COMPROBANTE']),
    enumerado('classification', ['PUBLICA', 'INTERNA', 'CONFIDENCIAL', 'DATOS PERSONALES'])
  ]
}

// tareas de quien mira: vencidas, por vencer y al día, con prioridad, y una de escalamiento para tomar
const tarea = (id: string, title: string, estado: string, extra: Record<string, unknown>) =>
  registro(id, { project: 'p1', assignee_user_id: USUARIO.id, assignee_user_email: USUARIO.email, title, ...extra }, estado)
const TAREAS = [
  tarea('t1', 'Levantar fotos del tramo con sedimento', 'open', { due_date: '2026-10-12', deadline_status: 'VENCIDO', priority: 'ALTA', commitment: 'k4' }),
  tarea('t2', 'Acusar recibo de la queja por polvo en Tunas', 'in_progress', {
    due_date: '2026-10-19',
    deadline_status: 'POR VENCER',
    priority: 'MUY ALTA',
    grievance: 'q1'
  }),
  tarea('t3', 'Coordinar la entrega de estantes con la directiva', 'open', {
    due_date: '2026-10-28',
    deadline_status: 'AL DIA',
    priority: 'MEDIA',
    social_contribution: 'ap1'
  }),
  tarea('t4', 'Registrar la medición de setiembre del programa de agua', 'blocked', {
    due_date: '2026-10-30',
    deadline_status: 'AL DIA',
    priority: 'BAJA',
    social_program: 'sp1'
  }),
  tarea('t5', 'Revisar el acta de la reunión informativa', 'done', { due_date: '2026-10-09', priority: 'MEDIA' })
]
const PARA_TOMAR = [
  registro('t6', { project: 'p1', title: 'Escalamiento: compromiso C-002 vencido sin avance', due_date: '2026-10-17', deadline_status: 'POR VENCER' }, 'open')
]
const FLUJO_DE_TAREA = flujo('task', [
  ['open', 'Abierta', 'INITIAL'],
  ['in_progress', 'En curso'],
  ['blocked', 'Bloqueada'],
  ['done', 'Hecha', 'FINAL'],
  ['cancelled', 'Cancelada', 'FINAL']
])
const lasTareas = (u: URL) => {
  const p = u.searchParams
  if (p.get('empty') === 'assignee_user_id') return pagina(PARA_TOMAR)
  if (p.get('empty') === 'due_date') return pagina([])
  const estados = p.get('state')?.split(',')
  const situacion = p.get('deadline_status')
  return pagina(TAREAS.filter((x) => (!estados || estados.includes(x.state ?? '')) && (!situacion || x.attributes.deadline_status === situacion)))
}

// aprobaciones: un compromiso y dos aportes esperan decisión; el más antiguo primero
const aviso = (id: string, object: string, recordId: string, title: string, publishAt: string) => ({
  id,
  kind: 'ACTION',
  title,
  body: null,
  link: { type: 'RECORD', object, recordId },
  publishAt,
  expiresAt: null,
  dueAt: null,
  overdue: false,
  source: 'sgspe.approvals',
  read: false,
  snoozedUntil: null,
  dismissible: false
})
const APROBACIONES = [
  aviso('n1', 'social_contribution', 'ap1', 'Aporte por aprobar', '2026-10-06T15:00:00Z'),
  aviso('n2', 'commitment', 'k7', 'Compromiso por aprobar', '2026-10-09T15:00:00Z'),
  aviso('n3', 'social_contribution', 'ap4', 'Aporte por aprobar', '2026-10-14T15:00:00Z')
]
const POR_APROBAR = registro(
  'k7',
  {
    project: 'p1',
    code: 'C-007',
    title: 'Faenas comunales para el mantenimiento de la trocha a la parte alta',
    description: 'Jornales de mano de obra local para el mantenimiento de 4 km de trocha.',
    amount: 7300,
    currency: 'PEN',
    due_date: '2026-12-20',
    owner_user_email: 'cmm@sgspe.test',
    exploration_campaign: 'camp1',
    state_changed_at: '2026-10-09T15:00:00Z'
  },
  'pending_approval'
)

// la consulta en seco de «Aprobar» un aporte: la prioridad del tema advierte; lo demás cumple
export const COMPROBACION_F11 = {
  allowed: true,
  blocking: [],
  warnings: [{ code: 'PRIORITY_NOT_MET', message: 'topic not prioritized', field: 'topic' }]
}
const APROBAR_APORTE = [
  { name: 'approve', label: 'Aprobar', to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null },
  { name: 'reject', label: 'Rechazar', to: 'rejected', toLabel: 'Rechazado', allowed: true, reason: null }
]
const APROBAR_COMPROMISO = [
  { name: 'approve', label: 'Aprobar', to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null },
  { name: 'return_to_draft', label: 'Devolver a borrador', to: 'draft', toLabel: 'Borrador', allowed: true, reason: null }
]

export const RUTAS_F11: [RegExp, Cuerpo][] = [
  [/^\/objects\/social_program\/workflow$/, FLUJO_DE_PROGRAMA],
  [/^\/objects\/social_program\/records$/, pagina(PROGRAMAS)],
  [/^\/objects\/social_program\/records\/(sp\d)$/, (u: URL) => PROGRAMAS.find((p) => u.pathname.endsWith(`/${p.id}`))],
  [/^\/objects\/social_program\/records\/sp\d\/related\//, pagina([])],
  [/^\/objects\/program_budget\/records$/, (u: URL) => pagina(u.searchParams.get('social_program') === 'sp1' ? PRESUPUESTOS : [])],
  [/^\/objects\/program_indicator\/records$/, (u: URL) => pagina(u.searchParams.get('social_program') === 'sp1' ? INDICADORES_DEL_PROGRAMA : [])],
  [/^\/objects\/program_measurement\/records$/, pagina(MEDICIONES)],
  [/^\/objects\/beneficiary_group\/records$/, (u: URL) => pagina(u.searchParams.get('social_program') === 'sp1' ? GRUPOS_BENEFICIARIOS : [])],
  [/^\/objects\/social_contribution\/workflow$/, FLUJO_DE_APORTE],
  [
    /^\/objects\/social_contribution\/records$/,
    (u: URL) => {
      const estados = u.searchParams.get('state')?.split(',')
      const fuera = u.searchParams.get('state_not')?.split(',')
      return pagina(APORTES.filter((a) => (!estados || estados.includes(a.state ?? '')) && (!fuera || !fuera.includes(a.state ?? ''))))
    }
  ],
  [/^\/objects\/social_contribution\/records\/(ap\d)$/, (u: URL) => APORTES.find((a) => u.pathname.endsWith(`/${a.id}`))],
  [/^\/objects\/social_contribution\/records\/ap[14]\/transitions$/, APROBAR_APORTE],
  [/^\/objects\/social_contribution\/records\/ap\d\/related\//, pagina([])],
  [/^\/objects\/contribution_item\/records$/, (u: URL) => pagina(ITEMS[u.searchParams.get('social_contribution') ?? ''] ?? [])],
  [/^\/objects\/delivery\/records$/, (u: URL) => pagina(u.searchParams.get('social_contribution') === 'ap2' ? [ENTREGA] : [])],
  [/^\/objects\/delivery\/records\/dl1\/related\/evidence_delivery$/, pagina(DE_LA_ENTREGA)],
  [/^\/objects\/receipt\/records$/, (u: URL) => pagina(u.searchParams.get('social_contribution') === 'ap2' ? [COMPROBANTE] : [])],
  [/^\/objects\/exploration_campaign\/records\/camp1$/, CAMPANA],
  [/^\/objects\/organization\/records\/(o1[3-6])$/, (u: URL) => ORGANIZACIONES.find((o) => u.pathname.endsWith(`/${o.id}`))],
  [/^\/sgspe\/dashboards\/investment$/, INVERSION],
  [/^\/sgspe\/dashboards\/indicators$/, [{ code: 'KPI-INV-01', label: 'Ejecución de la campaña', dashboard: 'investment', available: true }]],
  [/^\/metadata\/objects\/evidence$/, DEF_DE_EVIDENCIA],
  [/^\/objects\/evidence\/records$/, (u: URL) => pagina(u.searchParams.get('replaces') ? [] : EVIDENCIAS)],
  [/^\/objects\/evidence\/records\/(ev\d)$/, (u: URL) => EVIDENCIAS.find((e) => u.pathname.endsWith(`/${e.id}`))],
  [/^\/objects\/evidence\/records\/ev\d\/related\//, pagina([])],
  [/^\/objects\/task\/workflow$/, FLUJO_DE_TAREA],
  [/^\/objects\/task\/records$/, lasTareas],
  [/^\/objects\/commitment\/records\/k7$/, POR_APROBAR],
  [/^\/objects\/commitment\/records\/k7\/transitions$/, APROBAR_COMPROMISO],
  [
    /^\/auth\/me\/notifications$/,
    (u: URL) => (u.searchParams.get('kind') === 'ACTION' && u.searchParams.get('size') === '200' ? pagina(APROBACIONES) : pagina([]))
  ]
]
