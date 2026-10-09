// aritmética exacta de montos DECIMAL (hasta 4 decimales, api.md §4.5): un monto se lleva a diezmilésimos enteros (BigInt) y se
// vuelve a escribir como texto decimal. la coma flotante no suma 10000.10 + 20000.20 en 30000.30 ni guarda los dígitos pasados
// 2^53; montoPe formatea el texto sin pasar por Number
const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,4}))?$/

// un DECIMAL que llega como texto o como número (el número se lee por su texto, que es el que mandó el servidor); null si no
// es un decimal de hasta 4 decimales
export function aDiezmilesimos(valor: unknown): bigint | null {
  const texto = typeof valor === 'string' ? valor.trim() : typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : null
  const partes = texto === null ? null : DECIMAL.exec(texto)
  if (!partes) return null
  const [, signo, enteros, decimales = ''] = partes
  const absoluto = BigInt(enteros) * 10000n + BigInt(decimales.padEnd(4, '0'))
  return signo === '-' ? -absoluto : absoluto
}

// el texto decimal con cuatro decimales y su signo («-5000.0000»); el cero nunca lleva signo
export function deDiezmilesimos(cantidad: bigint): string {
  const absoluto = cantidad < 0n ? -cantidad : cantidad
  const decimales = String(absoluto % 10000n).padStart(4, '0')
  return `${cantidad < 0n ? '-' : ''}${absoluto / 10000n}.${decimales}`
}
