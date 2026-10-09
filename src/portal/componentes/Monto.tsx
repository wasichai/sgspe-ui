// un monto con su moneda en números es-PE (RNF-I18N-002): «S/ 1,250.50», «USD 300.00». un DECIMAL llega como número o como
// texto; una moneda que Intl no conoce se escribe con su código. sin valor, la raya: nunca un cero que no se registró
export function montoPe(valor: unknown, moneda: unknown): string {
  // un texto se valida y se formatea como texto: pasar por Number pierde precisión pasados 2^53 y acepta «0x10» o «1e3»
  const texto = typeof valor === 'string' ? valor.trim() : null
  const cifraDe: number | string | null =
    typeof valor === 'number' && Number.isFinite(valor) ? valor : texto !== null && /^-?\d+(\.\d+)?$/.test(texto) ? texto : null
  if (cifraDe === null) return '—'
  // la lib de TypeScript tipa format(number); el motor acepta el texto decimal y no pierde dígitos (ES2023)
  const codigo = typeof moneda === 'string' && moneda ? moneda : null
  if (codigo) {
    try {
      // Intl separa el símbolo con un espacio duro: se deja el espacio común, el mismo que escribe una persona al buscarlo
      return new Intl.NumberFormat('es-PE', { style: 'currency', currency: codigo, minimumFractionDigits: 2, maximumFractionDigits: 4 })
        .format(cifraDe as number)
        .replace(/\u00a0/g, ' ')
    } catch {
      // RangeError: un código que no es ISO 4217
    }
  }
  const cifra = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(cifraDe as number)
  return codigo ? `${codigo} ${cifra}` : cifra
}

export function Monto({ valor, moneda }: { valor: unknown; moneda: unknown }) {
  return <span className="tabular-nums">{montoPe(valor, moneda)}</span>
}

// un monto tecleado: sin espacios ni separadores de miles («1,250.50» es 1250.50) y dentro de las cotas de Amounts.parse del
// servidor (hasta 15 dígitos enteros y 4 decimales, no negativo; api.md §4.5). viaja como texto: un DECIMAL no pierde precisión
export const normalizarMonto = (tecleado: string): string => tecleado.trim().replace(/[\s,]/g, '')
export const esMontoValido = (tecleado: string): boolean => /^\d{1,15}(\.\d{1,4})?$/.test(normalizarMonto(tecleado))
