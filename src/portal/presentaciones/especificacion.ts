import { Deck, SCHEMA_VERSION, type DeckSpec } from '@wasichai/sgspe-slides'

// la especificación de una presentación tal como la dibuja el reproductor (ADR-0031, deliverables.md §16.3). la valida el
// esquema del paquete, el mismo que usa el compositor del PDF: lo que no pasa no se pinta y la página ofrece el PDF, que es la
// referencia. una versión de esquema distinta de la del paquete (un backend más nuevo o más viejo que el portal) tampoco se
// pinta. este módulo vive dentro del chunk diferido del reproductor: solo lo importa PresentadorImpl
export type Lectura = { admitida: true; deck: DeckSpec } | { admitida: false; motivo: 'version' | 'invalida' }

export function leerEspecificacion(json: unknown): Lectura {
  const version = json && typeof json === 'object' ? (json as { schema?: unknown }).schema : undefined
  if (typeof version === 'number' && version !== SCHEMA_VERSION) return { admitida: false, motivo: 'version' }
  const leida = Deck.safeParse(json)
  return leida.success ? { admitida: true, deck: leida.data } : { admitida: false, motivo: 'invalida' }
}
