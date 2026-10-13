// los marcadores de seudonimización que guardan las salidas de la IA (ai-architecture.md §12.2, api.md §4.14): una persona
// registrada es [PERSONA:<id>]; los nombres sin registro, [PERSONA]; lo detectado por formato, [DOCUMENTO], [TELEFONO],
// [CORREO] y, para los campos restringidos, [CONTACTO], [DATO_SENSIBLE] y [CITA]. los marcadores por llamada ([PERSONA_1]) no deberían llegar guardados, pero el resumen de un paso del asistente
// los trae: se dicen como reservados (decisión 10 del plan). el portal re-identifica al mostrar, nunca al guardar
export type ClaseDeMarcador = 'PERSONA' | 'DOCUMENTO' | 'TELEFONO' | 'CORREO' | 'CONTACTO' | 'DATO_SENSIBLE' | 'CITA'

export type Segmento = { tipo: 'texto'; texto: string } | { tipo: 'persona'; id: string } | { tipo: 'reservado'; clase: ClaseDeMarcador }

const PATRON = '\\[(PERSONA|DOCUMENTO|TELEFONO|CORREO|CONTACTO|DATO_SENSIBLE|CITA)(?::([A-Za-z0-9-]+)|_\\d+)?\\]'

export function partirMarcadores(texto: string): Segmento[] {
  const segmentos: Segmento[] = []
  let desde = 0
  for (const m of texto.matchAll(new RegExp(PATRON, 'g'))) {
    const inicio = m.index ?? 0
    if (inicio > desde) segmentos.push({ tipo: 'texto', texto: texto.slice(desde, inicio) })
    const clase = m[1] as ClaseDeMarcador
    segmentos.push(clase === 'PERSONA' && m[2] ? { tipo: 'persona', id: m[2] } : { tipo: 'reservado', clase })
    desde = inicio + m[0].length
  }
  if (desde < texto.length) segmentos.push({ tipo: 'texto', texto: texto.slice(desde) })
  return segmentos
}

// el texto cortado a n puntos de código sin partir un marcador: el que cruza el límite entra entero (el texto puede pasar de n),
// de modo que sigue a la vista de quedanMarcadores y el formulario bloquea
export function recortar(texto: string, n: number): string {
  let salida = ''
  let usados = 0
  for (const s of partirMarcadores(texto)) {
    if (usados >= n) break
    const parte = s.tipo === 'texto' ? s.texto : comoMarcador(s)
    if (s.tipo === 'texto') {
      const puntos = Array.from(parte)
      salida += puntos.slice(0, n - usados).join('')
      usados += puntos.length
    } else {
      salida += parte
      usados += Array.from(parte).length
    }
  }
  return salida
}

// un texto que todavía lleva un marcador no puede llegar a un registro de dominio (ai-architecture.md §4.2)
export const quedanMarcadores = (texto: string): boolean => new RegExp(PATRON).test(texto)

export const personasCitadas = (texto: string): string[] => [...new Set(partirMarcadores(texto).flatMap((s) => (s.tipo === 'persona' ? [s.id] : [])))]

const comoMarcador = (s: Exclude<Segmento, { tipo: 'texto' }>): string => (s.tipo === 'persona' ? `[PERSONA:${s.id}]` : `[${s.clase}]`)

// el texto para prellenar un formulario: cada persona cuyo nombre se lee pasa a su nombre; lo demás queda como marcador, que
// la persona debe reemplazar antes de aceptar
export function reidentificar(texto: string, nombres: ReadonlyMap<string, string>): string {
  return partirMarcadores(texto)
    .map((s) => (s.tipo === 'texto' ? s.texto : s.tipo === 'persona' && nombres.has(s.id) ? nombres.get(s.id)! : comoMarcador(s)))
    .join('')
}
