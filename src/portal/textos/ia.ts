// lo común de la IA en el portal: la marca de procedencia (design-system.md §4.4), los marcadores re-identificados al
// mostrar (ai-architecture.md §12.2), la cita y su fuente, y por qué la IA no está disponible (design-system.md §6.5).
// CONTACTO, DATO_SENSIBLE y CITA son los marcadores tipados que el plan 7.2a suma para los campos restringidos (contact_value;
// postura, religión y proceso electoral; evidence_quote): llegan sin número ni valor, como PERSONA, y nunca se resuelven
export const ES_IA = {
  titulo: 'Inteligencia artificial',
  marcas: { sugerencia: 'Sugerencia de IA', resumen: 'Resumen de IA' },
  marcadores: {
    PERSONA: 'persona',
    DOCUMENTO: 'documento reservado',
    TELEFONO: 'teléfono reservado',
    CORREO: 'correo reservado',
    CONTACTO: 'contacto reservado',
    DATO_SENSIBLE: 'dato sensible reservado',
    CITA: 'cita reservada',
    cargo: '{{cargo}} (cargo)',
    ayuda: 'Dato reservado: la IA no lo guarda; quien puede abrir la fuente lo lee allí.',
    quedan: 'Reemplace los datos reservados (persona, documento, teléfono, correo u otro dato reservado) por lo que corresponda antes de aceptar.'
  },
  cita: { fuenteRestringida: 'Fuente restringida', abrirFuente: 'Abrir la fuente' },
  sinIa: {
    organizacion: 'Su organización no tiene la IA activada. Las propuestas ya registradas se siguen revisando en la bandeja de cada proyecto.',
    proveedor: 'El servicio de IA no responde en este momento.',
    rol: 'La IA no está disponible para su rol.',
    rolDocumentos: 'Preguntar a los documentos pide además poder leer los nombres de las personas.',
    sinServidor: 'La IA no está disponible en esta instalación.',
    reintentar: 'Reintentar'
  },
  confianza: 'Confianza {{n}} %',
  modelo: 'Modelo: {{modelo}}',
  instruccion: 'Instrucción: {{version}}'
}

export const EN_IA: typeof ES_IA = {
  titulo: 'Artificial intelligence',
  marcas: { sugerencia: 'AI suggestion', resumen: 'AI summary' },
  marcadores: {
    PERSONA: 'person',
    DOCUMENTO: 'withheld document',
    TELEFONO: 'withheld phone',
    CORREO: 'withheld email',
    CONTACTO: 'withheld contact',
    DATO_SENSIBLE: 'withheld sensitive data',
    CITA: 'withheld quote',
    cargo: '{{cargo}} (position)',
    ayuda: 'Withheld data: the AI does not store it; whoever can open the source reads it there.',
    quedan: 'Replace the withheld data (person, document, phone, email or other withheld data) with the right values before accepting.'
  },
  cita: { fuenteRestringida: 'Restricted source', abrirFuente: 'Open the source' },
  sinIa: {
    organizacion: 'Your organization does not have AI enabled. Proposals already recorded can still be reviewed in each project tray.',
    proveedor: 'The AI service is not responding right now.',
    rol: 'AI is not available for your role.',
    rolDocumentos: 'Asking the documents also requires reading the names of people.',
    sinServidor: 'AI is not available in this installation.',
    reintentar: 'Retry'
  },
  confianza: 'Confidence {{n}} %',
  modelo: 'Model: {{modelo}}',
  instruccion: 'Instruction: {{version}}'
}
