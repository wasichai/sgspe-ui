import palabras from './option-words.json'
import { texto, type Registro } from './registros'

// una opción de un enum del modelo se ve en forma de oración con tildes («EN SEPARACION» → «En separación»), igual que en los
// entregables: option-words.json es copia exacta del de sgspe (src/main/resources/sgspe/deliverable/), que clasifica toda
// palabra de todo enum del modelo; si cambia allá, se copia de nuevo y se verifica con cmp. solo el texto que se ve pasa por
// aquí: filtrar, comparar y escribir siguen con el valor crudo
const SIGLAS = new Set(palabras.acronyms)
const TILDES: Record<string, string> = palabras.accents
// una palabra de opción es solo letras mayúsculas: un código («DEMO-C-04», «T5») o un número no se tocan
const PALABRA_DE_OPCION = /^[A-ZÁÉÍÓÚÜÑ]+$/

// un valor que no está todo en mayúsculas ya lo escribió una persona y se ve igual
export function rotuloDeOpcion(valor: string): string {
  if (valor === '' || valor !== valor.toUpperCase()) return valor
  const rotulo = valor
    .split(' ')
    .map((p) => (SIGLAS.has(p) || !PALABRA_DE_OPCION.test(p) ? p : (TILDES[p] ?? p.toLowerCase())))
    .join(' ')
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1)
}

// el campo de opción de un registro tal como se ve; vacío si no tiene valor
export const opcion = (registro: Registro | undefined | null, campo: string): string => rotuloDeOpcion(texto(registro, campo))

// la fila de un desglose de un indicador tal como se ve: su rótulo o, si no trae, su clave (a menudo el valor del enum)
export const rotuloDeFila = (fila: { key: string; label?: string | null }): string => rotuloDeOpcion(fila.label ?? fila.key)
