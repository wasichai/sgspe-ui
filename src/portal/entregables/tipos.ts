import { atributo, texto, type Registro } from '../datos/registros'

// lo que el portal fija de los tipos de F8 (deliverables.md §3): sus nombres, sus niveles y los parámetros que pide el borrador
export const T1 = 'DIAGNOSTICO SOCIAL'
export const T2 = 'INFORME DE CAMPO Y AVANCE'
// los dos tipos de F8 preparan INTERNO y EXTERNO (decisión 4 de la spec)
export const NIVELES_DE_ENTREGABLE = ['INTERNO', 'EXTERNO'] as const

// los parámetros que cada tipo exige para pedir un borrador (missingParameters), además del CRS de trabajo del proyecto
export type Parametro = 'community' | 'study' | 'area_of_influence' | 'period_start_date' | 'period_end_date' | 'cutoff_date'
export const PARAMETROS: Readonly<Record<string, readonly Parametro[]>> = {
  [T2]: ['community', 'period_start_date', 'period_end_date'],
  [T1]: ['study', 'area_of_influence', 'period_start_date', 'period_end_date', 'cutoff_date']
}

// las secciones de cada tipo, con su marca de IA y su guía, no se copian aquí: las da el backend (useTiposDeEntregable en
// contrato.ts, decisión 1 del plan)

// a dónde lleva un entregable (S50): desde un proyecto, bajo ese proyecto, para que «Volver» vuelva a sus Reportes; si no, la ruta
// global de Reportes
export const rutaDeEntregable = (id: string, proyecto?: string | null): string =>
  proyecto ? `/projects/${encodeURIComponent(proyecto)}/reports/deliverables/${encodeURIComponent(id)}` : `/reports/deliverables/${encodeURIComponent(id)}`

// deliverables.md §8.3: el editor solo permite editar las secciones en draft y observed
export const EDITABLE_EN: readonly string[] = ['draft', 'observed']
export const seEditan = (entregable: Registro): boolean => EDITABLE_EN.includes(entregable.state ?? '')

export const ORIGEN_IA = 'ASISTIDO POR IA'
export const ORIGEN_CALCULADO = 'CALCULADO'

// una sección CALCULADA nace con origen CALCULADO y su contenido lo arma el tipo al generar (DeliverableSectionsListener)
export const esCalculada = (seccion: Registro): boolean => texto(seccion, 'section_kind') === 'CALCULADA'

// una sección editada después de congelar el modelo bloquea el envío, la aprobación y la emisión (409 SECTIONS_CHANGED). se
// compara por instante: las precisiones de los dos textos pueden ser distintas
export function cambioDespuesDelBorrador(seccion: Registro, generadoEl: string | null | undefined): boolean {
  const cambio = seccion.updatedAt ? Date.parse(seccion.updatedAt) : NaN
  const generado = generadoEl ? Date.parse(generadoEl) : NaN
  return Number.isFinite(cambio) && Number.isFinite(generado) && cambio > generado
}

export const ESTADOS_DE_WF_H = ['draft', 'in_review', 'observed', 'approved', 'issued', 'voided'] as const

// el código de un grupo de interés en EXTERNO (RegisterSheets.code): GI- y los 12 primeros dígitos hexadecimales del id
export const codigoGi = (id: string): string => `GI-${id.replace(/-/g, '').slice(0, 12).toUpperCase()}`

// el texto de una sección leída: el Markdown guardado, o vacío
export const contenidoDe = (seccion: Registro): string => String(atributo(seccion, 'content') ?? '')
