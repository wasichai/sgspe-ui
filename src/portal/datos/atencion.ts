import { atributo, type Registro } from './registros'

// las quejas, consultas y solicitudes de BC-07 (domain-model.md §6.7, ASM-011): tres objetos con ciclos distintos (WF-E1, WF-E2 y
// WF-E3) que el portal une para atender por plazo. aquí, lo que comparten las pantallas de F4: sus nombres, sus rutas, el plazo
// que corre en cada estado y cuándo una QCS sigue abierta
export const OBJETOS_DE_QCS = ['grievance', 'inquiry', 'stakeholder_request'] as const
export type ObjetoDeQcs = (typeof OBJETOS_DE_QCS)[number]

export const esQcs = (objeto: string): objeto is ObjetoDeQcs => (OBJETOS_DE_QCS as readonly string[]).includes(objeto)

// la ruta de la ficha bajo el proyecto (screens.md S36 y S57): /projects/:projectId/grievances/:id, inquiries/:id, requests/:id
export const RUTA_DE_QCS: Readonly<Record<ObjetoDeQcs, string>> = {
  grievance: 'grievances',
  inquiry: 'inquiries',
  stakeholder_request: 'requests'
}

// la ruta de sus comandos en /api/sgspe (api.md §4.6): reclasificar y aceptar
export const RUTA_DE_COMANDO: Readonly<Record<ObjetoDeQcs, string>> = {
  grievance: 'grievances',
  inquiry: 'inquiries',
  stakeholder_request: 'stakeholder-requests'
}

export const rutaDeQcs = (proyecto: string, objeto: ObjetoDeQcs, id: string): string =>
  `/projects/${encodeURIComponent(proyecto)}/${RUTA_DE_QCS[objeto]}/${encodeURIComponent(id)}`

// los estados en que una QCS terminó su ciclo: lo demás está abierto (la lista «Atención» y los conteos de abiertas)
export const ESTADOS_FINALES: Readonly<Record<ObjetoDeQcs, readonly string[]>> = {
  grievance: ['closed', 'rejected', 'withdrawn'],
  inquiry: ['closed'],
  stakeholder_request: ['closed']
}

export const estaAbierta = (objeto: ObjetoDeQcs, registro: Registro): boolean => !ESTADOS_FINALES[objeto].includes(registro.state ?? '')

// el plazo que corre en el estado (workflows.md, «Plazos y escalamiento»; ASM-100): el acuse en una queja recibida, la resolución
// mientras se atiende, la respuesta en una consulta recibida; la solicitud no tiene plazo en el MVP. fuera de esos estados, null
const PLAZOS: Readonly<Record<ObjetoDeQcs, Readonly<Record<string, string>>>> = {
  grievance: {
    received: 'ack_due_date',
    acknowledged: 'resolution_due_date',
    in_assessment: 'resolution_due_date',
    in_investigation: 'resolution_due_date',
    in_action: 'resolution_due_date'
  },
  inquiry: { received: 'response_due_date' },
  stakeholder_request: {}
}

export function plazoQueCorre(objeto: ObjetoDeQcs, registro: Registro): { campo: string; fecha: string | null } | null {
  const campo = PLAZOS[objeto][registro.state ?? '']
  if (!campo) return null
  const fecha = atributo<string>(registro, campo)
  return { campo, fecha: typeof fecha === 'string' && fecha !== '' ? fecha : null }
}

// las severidades de una queja que resuelve otra persona (RN-GRV-002, ASM-036) y que avisan a quien aprueba (decisión 8)
export const SEVERIDADES_GRAVES: readonly string[] = ['ALTA', 'CRITICA']
export const esGrave = (registro: Registro): boolean => SEVERIDADES_GRAVES.includes(String(atributo(registro, 'severity') ?? ''))

// la acción declarada que deja leer toda QCS confidencial (security.md §9.6): hoy solo la gestión de quejas
export const LEE_CONFIDENCIALES = 'READ_CONFIDENTIAL'
