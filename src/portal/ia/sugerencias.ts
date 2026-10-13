import { atributo, texto, type Registro } from '../datos/registros'
import { reidentificar } from './marcadores'

// las propuestas de la bandeja S52 (ai-architecture.md §4.2 y §9.3): las sugerencias de IA y los candidatos a compromiso en
// proposed, y la fila de la lista cerrada de cada sugerencia. la lista es cerrada: lo que no está en una fila no se acepta
// desde el portal (el servidor lo rechaza igual)
export interface Propuesta {
  clase: 'sugerencia' | 'candidato'
  registro: Registro
}

// RESUMEN EJECUTIVO y BORRADOR DE SECCION se muestran donde se usan (decisión 11 del plan)
const EN_OTRA_PANTALLA: readonly string[] = ['RESUMEN EJECUTIVO', 'BORRADOR DE SECCION']
export const enLaBandeja = (sugerencia: Registro): boolean => !EN_OTRA_PANTALLA.includes(texto(sugerencia, 'suggestion_kind'))

// confidence va de 0 a 1 y no está calibrada: ordena y nunca acepta nada (ai-architecture.md §9.1)
export function confianzaDe(registro: Registro): number | null {
  const valor = atributo(registro, 'confidence')
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() ? Number(valor) : Number.NaN
  return Number.isFinite(n) ? n : null
}

// por confianza, sin confianza al final (los candidatos humanos); a igual confianza, la más reciente primero (decisión 12)
export function ordenarPropuestas(lista: readonly Propuesta[]): Propuesta[] {
  return [...lista].sort((a, b) => {
    const ca = confianzaDe(a.registro)
    const cb = confianzaDe(b.registro)
    if (ca !== cb) return ca === null ? 1 : cb === null ? -1 : cb - ca
    return String(b.registro.createdAt ?? '').localeCompare(String(a.registro.createdAt ?? ''))
  })
}

export type Fila =
  | { fila: 'clasificacion'; campo: string; valor: string }
  | { fila: 'lugar'; campo: string; valor: string }
  | { fila: 'tema'; valor: string }
  | { fila: 'fecha'; campo: string; valor: string }
  | { fila: 'clausula'; numero: string; texto: string; creaCompromiso: boolean }
  | { fila: 'organizacion'; nombre: string; tipo: string; localidad: string; tipoDeGrupo: string | null }
  | { fila: 'persona'; nombre: string; existente: string | null; localidad: string; tipoDeGrupo: string | null }
  | { fila: 'borrador'; texto: string }
  | { fila: 'duplicado'; otro: string; razones: string[] }
  | { fila: 'resumen'; texto: string }

// los campos que CLASIFICACION puede proponer por objeto destino (ai-architecture.md §4.2)
const CLASIFICABLES: Readonly<Record<string, readonly string[]>> = {
  grievance: ['category', 'priority', 'topic'],
  inquiry: ['category', 'priority', 'topic'],
  stakeholder_request: ['category', 'priority', 'topic'],
  engagement_question: ['topic'],
  media_mention: ['tone', 'topic']
}
const CON_DUPLICADO: readonly string[] = ['grievance', 'organization', 'person', 'stakeholder', 'commitment', 'inquiry', 'stakeholder_request']
const FECHAS: readonly string[] = ['signed_date', 'effective_date', 'expiry_date']
const MARKDOWN: readonly string[] = ['BORRADOR DE ACTA', 'RESUMEN EJECUTIVO', 'BORRADOR DE SECCION']

function json(valor: string): Record<string, unknown> | null {
  try {
    const leido: unknown = JSON.parse(valor)
    return leido && typeof leido === 'object' && !Array.isArray(leido) ? (leido as Record<string, unknown>) : null
  } catch {
    return null
  }
}
const cadena = (valor: unknown): string => (typeof valor === 'string' ? valor : typeof valor === 'number' ? String(valor) : '')
const tipoDeGrupo = (valor: unknown): string | null =>
  valor && typeof valor === 'object' ? cadena((valor as Record<string, unknown>).stakeholder_type) || null : null

// suggested_value se puede leer: Markdown con texto, o JSON con forma de objeto (ai-architecture.md §9.1)
export const valorLegible = (sugerencia: Registro): boolean =>
  MARKDOWN.includes(texto(sugerencia, 'suggestion_kind'))
    ? texto(sugerencia, 'suggested_value').trim() !== ''
    : json(texto(sugerencia, 'suggested_value')) !== null

export function filaDe(sugerencia: Registro): Fila | null {
  const tipo = texto(sugerencia, 'suggestion_kind')
  const destino = texto(sugerencia, 'target_object')
  const valor = texto(sugerencia, 'suggested_value')
  if (tipo === 'BORRADOR DE ACTA') return destino === 'engagement' && valor.trim() ? { fila: 'borrador', texto: valor } : null
  if (tipo === 'RESUMEN EJECUTIVO') return destino === 'project' && valor.trim() ? { fila: 'resumen', texto: valor } : null
  const v = json(valor)
  if (!v) return null
  if (tipo === 'CLASIFICACION') {
    const campo = cadena(v.field)
    return CLASIFICABLES[destino]?.includes(campo) && cadena(v.value) ? { fila: 'clasificacion', campo, valor: cadena(v.value) } : null
  }
  if (tipo === 'DUPLICADO') {
    const otro = cadena(v.other_record_id)
    return CON_DUPLICADO.includes(destino) && otro
      ? { fila: 'duplicado', otro, razones: Array.isArray(v.reasons) ? v.reasons.map(cadena).filter(Boolean) : [] }
      : null
  }
  if (tipo !== 'EXTRACCION') return null
  const campo = cadena(v.field)
  switch (v.item) {
    case 'actor':
      if (v.kind === 'organization' && destino === 'organization')
        return {
          fila: 'organizacion',
          nombre: cadena(v.name),
          tipo: cadena(v.organization_type),
          localidad: cadena(v.locality),
          tipoDeGrupo: tipoDeGrupo(v.stakeholder)
        }
      if (v.kind === 'person' && destino === 'person')
        return {
          fila: 'persona',
          nombre: cadena(v.name),
          existente: texto(sugerencia, 'target_record_id') || null,
          localidad: cadena(v.residence_locality),
          tipoDeGrupo: tipoDeGrupo(v.stakeholder)
        }
      return null
    case 'topic':
      return destino === 'engagement' && cadena(v.topic) ? { fila: 'tema', valor: cadena(v.topic) } : null
    case 'place':
      return destino === 'engagement' && (campo === 'locality' || campo === 'community') && cadena(v.value)
        ? { fila: 'lugar', campo, valor: cadena(v.value) }
        : null
    case 'date':
      return destino === 'agreement' && FECHAS.includes(campo) && cadena(v.value) ? { fila: 'fecha', campo, valor: cadena(v.value) } : null
    case 'clause':
      return destino === 'agreement' && cadena(v.clause_text)
        ? { fila: 'clausula', numero: cadena(v.clause_number), texto: cadena(v.clause_text), creaCompromiso: v.creates_commitment === true }
        : null
    default:
      return null
  }
}

// lo que la persona revisa antes de aceptar (decisión 15 del plan): la fila con sus valores corregidos. una persona nueva lleva
// los nombres que escribe quien acepta (la sugerencia solo guarda el marcador); un duplicado de queja lleva la respuesta
export type ValoresRevisados =
  | { fila: 'clasificacion'; campo: string; valor: string }
  | { fila: 'lugar'; campo: string; valor: string }
  | { fila: 'tema'; valor: string }
  | { fila: 'fecha'; campo: string; valor: string }
  | { fila: 'clausula'; numero: string; texto: string; creaCompromiso: boolean }
  | { fila: 'organizacion'; nombre: string; tipo: string; localidad: string; tipoDeGrupo: string | null }
  | { fila: 'persona'; existente: string | null; nombres: string; apellidos: string; sexo: string; localidad: string; tipoDeGrupo: string | null }
  | { fila: 'borrador'; texto: string }
  | { fila: 'duplicado'; otro: string; respuesta: string | null }

// los textos llegan con las personas legibles ya re-identificadas; lo demás queda como marcador para que la persona lo reemplace
export function valoresIniciales(fila: Fila, nombres: ReadonlyMap<string, string>): ValoresRevisados | null {
  switch (fila.fila) {
    case 'clasificacion':
    case 'lugar':
    case 'fecha':
    case 'tema':
      return { ...fila }
    case 'clausula':
      return { ...fila, texto: reidentificar(fila.texto, nombres) }
    case 'organizacion':
      return { ...fila, nombre: reidentificar(fila.nombre, nombres) }
    case 'persona':
      return { fila: 'persona', existente: fila.existente, nombres: '', apellidos: '', sexo: '', localidad: fila.localidad, tipoDeGrupo: fila.tipoDeGrupo }
    case 'borrador':
      return { fila: 'borrador', texto: reidentificar(fila.texto, nombres) }
    case 'duplicado':
      return { fila: 'duplicado', otro: fila.otro, respuesta: null }
    case 'resumen':
      return null
  }
}

const vacio = (texto: string | null): boolean => !texto || !texto.trim()

// lo obligatorio que falta, con el nombre del campo de la API (así un error del servidor sobre attributes.<campo> cae en el mismo
// lugar). tipoDeGrupo en null es «sin grupo de interés»; en '' es «con grupo, sin tipo todavía»
export function camposQueFaltan(v: ValoresRevisados): string[] {
  const faltan = (pares: [boolean, string][]) => pares.filter(([falta]) => falta).map(([, campo]) => campo)
  switch (v.fila) {
    case 'clasificacion':
    case 'lugar':
    case 'fecha':
      return faltan([[vacio(v.valor), 'value']])
    case 'tema':
      return faltan([[vacio(v.valor), 'topic']])
    case 'clausula':
      return faltan([[vacio(v.texto), 'clause_text']])
    case 'organizacion':
      return faltan([
        [vacio(v.nombre), 'name'],
        [vacio(v.tipo), 'organization_type'],
        [v.tipoDeGrupo !== null && vacio(v.tipoDeGrupo), 'stakeholder_type']
      ])
    case 'persona':
      return faltan([
        [!v.existente && vacio(v.nombres), 'given_names'],
        [!v.existente && vacio(v.apellidos), 'surnames'],
        [v.tipoDeGrupo !== null && vacio(v.tipoDeGrupo), 'stakeholder_type']
      ])
    case 'borrador':
      return faltan([[vacio(v.texto), 'minutes']])
    case 'duplicado':
      return faltan([[v.respuesta !== null && vacio(v.respuesta), 'response']])
  }
}

// los textos libres de lo revisado: ninguno puede llegar a un registro con un marcador (ai-architecture.md §4.2)
export function textosLibres(v: ValoresRevisados): string[] {
  switch (v.fila) {
    case 'clausula':
      return [v.numero, v.texto]
    case 'borrador':
      return [v.texto]
    case 'organizacion':
      return [v.nombre]
    case 'persona':
      return v.existente ? [] : [v.nombres, v.apellidos]
    case 'duplicado':
      return v.respuesta === null ? [] : [v.respuesta]
    default:
      return []
  }
}

const conGrupo = (tipo: string | null) => (tipo ? { stakeholder: { stakeholder_type: tipo } } : {})

// el cuerpo de POST /api/sgspe/ai-suggestions/{id}/accept: { attributes } con la forma de suggested_value de la fila
export function cuerpoDeAceptacion(v: ValoresRevisados): Record<string, unknown> {
  switch (v.fila) {
    case 'clasificacion':
      return { field: v.campo, value: v.valor }
    case 'lugar':
      return { item: 'place', field: v.campo, value: v.valor }
    case 'tema':
      return { item: 'topic', topic: v.valor }
    case 'fecha':
      return { item: 'date', field: v.campo, value: v.valor }
    case 'clausula':
      return { item: 'clause', clause_number: v.numero, clause_text: v.texto, creates_commitment: v.creaCompromiso }
    case 'organizacion':
      return {
        item: 'actor',
        kind: 'organization',
        name: v.nombre.trim(),
        organization_type: v.tipo,
        ...(v.localidad ? { locality: v.localidad } : {}),
        ...conGrupo(v.tipoDeGrupo)
      }
    case 'persona':
      return v.existente
        ? { item: 'actor', kind: 'person', ...conGrupo(v.tipoDeGrupo) }
        : {
            item: 'actor',
            kind: 'person',
            given_names: v.nombres.trim(),
            surnames: v.apellidos.trim(),
            ...(v.sexo ? { sex: v.sexo } : {}),
            ...(v.localidad ? { residence_locality: v.localidad } : {}),
            ...conGrupo(v.tipoDeGrupo)
          }
    case 'borrador':
      return { minutes: v.texto }
    case 'duplicado':
      return { other_record_id: v.otro, ...(v.respuesta !== null ? { response: v.respuesta.trim() } : {}) }
  }
}
