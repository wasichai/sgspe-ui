import { aDiezmilesimos, deDiezmilesimos } from './decimales'
import { hoyEnLima } from './fechas'
import { atributo, texto, type Registro } from './registros'

// BC-10 en el portal (spec F5 §3.3 a §3.6, domain-model.md §6.10): los estados de WF-P que cuentan, los términos que congela la
// aprobación, las evidencias que pide la entrega y las sumas exactas por moneda. los montos nunca se suman entre monedas (ASM-063)
// ni en coma flotante: se llevan a diezmilésimos (datos/decimales)

// «comprometido» de un aporte (dashboards.md §3.2, decisión 1): lo que cuenta para el tope de la campaña
export const APORTE_COMPROMETIDO: readonly string[] = ['approved', 'procured', 'delivered', 'closed']
// los estados finales de WF-P: el aporte ya no se edita
export const APORTE_TERMINADO: readonly string[] = ['closed', 'rejected', 'cancelled']
// los términos que juzgó la aprobación: fuera de requested no cambian (409 CONTRIBUTION_FROZEN, elección 7)
export const TERMINOS_APROBADOS: readonly string[] = [
  'currency',
  'contribution_type',
  'topic',
  'exploration_campaign',
  'has_institutional_synergy',
  'agreement',
  'guideline_deviation_justification',
  'project'
]

// los ítems y los términos se escriben solo con el aporte en requested (decisión 1); la entrega se captura y se corrige solo en
// procured (elección 10)
export const enSolicitud = (aporte: Registro): boolean => aporte.state === 'requested'
export const entregaAbierta = (aporte: Registro): boolean => aporte.state === 'procured'
// los comprobantes (receipt) se cargan hasta la entrega: desde delivered, o anulado, el servidor rechaza su alta, su cambio y su
// baja con DELIVERY_FROZEN sobre social_contribution (InvestmentWriteGuard)
export const COMPROBANTES_CONGELADOS: readonly string[] = ['delivered', 'closed', 'rejected', 'cancelled']
export const comprobantesCongelados = (aporte: Registro): boolean => COMPROBANTES_CONGELADOS.includes(String(aporte.state ?? ''))

// las tres evidencias de la entrega (P8), con el valor ENUM de evidence_type tal como se guarda
export const EVIDENCIAS_DE_ENTREGA = ['ACTA DE RECEPCION', 'FOTO', 'COMPROBANTE'] as const

export const MONEDA_POR_DEFECTO = 'PEN'
export const monedaDe = (r?: Registro): string => texto(r, 'currency') || MONEDA_POR_DEFECTO

export interface Suma {
  moneda: string
  total: string
}

// la suma exacta de un campo DECIMAL por moneda. un monto vacío no suma; uno que no es un decimal válido se omite y se cuenta,
// para decirlo, nunca para sumarlo como cero. las monedas salen en el orden en que aparecen
export function sumaPorMoneda(registros: readonly Registro[], campo: string, moneda: (r: Registro) => string = monedaDe): { sumas: Suma[]; invalidos: number } {
  const totales = new Map<string, bigint>()
  let invalidos = 0
  for (const r of registros) {
    const valor = atributo(r, campo)
    if (valor === null || valor === undefined || valor === '') continue
    const cantidad = aDiezmilesimos(valor)
    if (cantidad === null) {
      invalidos++
      continue
    }
    const clave = moneda(r)
    totales.set(clave, (totales.get(clave) ?? 0n) + cantidad)
  }
  return { sumas: [...totales].map(([m, total]) => ({ moneda: m, total: deDiezmilesimos(total) })), invalidos }
}

// el total que se aprobará (decisión 1, elección 6): la suma de line_amount de los ítems, en la moneda del aporte (los ítems no
// tienen moneda propia). sin ítems, null
export function totalDeItems(items: readonly Registro[], moneda: string): { total: string | null; invalidos: number } {
  if (items.length === 0) return { total: null, invalidos: 0 }
  const { sumas, invalidos } = sumaPorMoneda(items, 'line_amount', () => moneda)
  return { total: sumas[0]?.total ?? deDiezmilesimos(0n), invalidos }
}

// parte sobre base en porcentaje con dos decimales, en aritmética exacta; sin base positiva o con un monto inválido, null
export function porcentaje(parte: unknown, base: unknown): number | null {
  const p = aDiezmilesimos(parte)
  const b = aDiezmilesimos(base)
  if (p === null || b === null || b <= 0n) return null
  return Number((p * 10000n) / b) / 100
}

// el año presupuestal en curso es el de Lima (un presupuesto nuevo lo propone)
export const anioEnLima = (ahora: Date = new Date()): number => Number(hoyEnLima(ahora).slice(0, 4))
