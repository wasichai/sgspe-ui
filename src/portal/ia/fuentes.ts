import { usePuedeDescargar } from '../documentos/api'
import { rutaParaAbrir } from '../datos/fichas'
import { atributo, texto, useRegistro, type Registro } from '../datos/registros'

// la fuente de una propuesta de la IA y si quien mira puede abrirla (ai-architecture.md §9.3, decisión 8 del plan): una
// evidencia se abre si se descarga (READ y, si es CONFIDENCIAL o DATOS PERSONALES, DOWNLOAD_RESTRICTED); la minuta de una
// interacción, si se lee minutes; otro registro (la QCS, la pregunta o la mención de AI-08), si se lee. «propia» es la de un
// candidato humano sin evidencia ni interacción: su cita la escribió quien lo registró. todo lo demás falla cerrado
export type Fuente = { estado: 'cargando' } | { estado: 'abrible'; enlace: string } | { estado: 'restringida' } | { estado: 'propia' }

export interface Referencia {
  objeto: string
  id: string
}

// input_reference de ai_interaction empieza con <objeto>:<id> (ai-architecture.md §9.2); lo que sigue (la huella, la versión)
// no le importa al portal. la de AI-05 es solo la huella de la pregunta («sha256:<hex>»): no es un registro
const REFERENCIA = /^(?!sha256:)([a-z_]+):([A-Za-z0-9-]+)/

export const referenciaDe = (valor: string | null | undefined): Referencia | null => {
  const m = valor ? REFERENCIA.exec(valor.trim()) : null
  return m ? { objeto: m[1], id: m[2] } : null
}

export function useFuente(referencia: Referencia | null): Fuente {
  const leida = useRegistro(referencia?.objeto ?? 'evidence', referencia?.id)
  const puedeDescargar = usePuedeDescargar()
  if (!referencia) return { estado: 'restringida' }
  if (leida.isPending) return { estado: 'cargando' }
  if (leida.isError || !leida.data) return { estado: 'restringida' }
  const abrible = referencia.objeto === 'evidence' ? puedeDescargar(leida.data) : referencia.objeto === 'engagement' ? 'minutes' in leida.data.attributes : true
  return abrible ? { estado: 'abrible', enlace: rutaParaAbrir(referencia.objeto, referencia.id) } : { estado: 'restringida' }
}

export function useFuenteDeCandidato(candidato: Registro): Fuente {
  const evidencia = atributo<string>(candidato, 'source_evidence')
  const interaccion = atributo<string>(candidato, 'engagement')
  const referencia = evidencia ? { objeto: 'evidence', id: evidencia } : interaccion ? { objeto: 'engagement', id: interaccion } : null
  const fuente = useFuente(referencia)
  return referencia ? fuente : { estado: 'propia' }
}

export function useFuenteDeSugerencia(sugerencia: Registro): Fuente {
  const id = atributo<string>(sugerencia, 'ai_interaction')
  const interaccion = useRegistro('ai_interaction', id)
  const fuente = useFuente(referenciaDe(texto(interaccion.data, 'input_reference')))
  if (!id) return { estado: 'restringida' }
  if (interaccion.isPending) return { estado: 'cargando' }
  if (interaccion.isError) return { estado: 'restringida' }
  return fuente
}
