import type { ReactNode } from 'react'
import { numeroPe } from '../i18n'

// el medidor de un monto frente a su tope o su presupuesto, en una sola moneda (design-system.md §5.3 «Medidores», S03): la moneda
// y su avance arriba, la barra de 16 px y debajo lo que se dice («S/ 15,000.00 de S/ 40,000.00») y el tope. un medidor por moneda,
// nunca uno que sume monedas (ASM-063). sin avance (no hay ejecutado registrado o el tope es cero) la barra queda vacía y la cifra
// dice «—», nunca 0 %
export function MedidorDeMonto({
  moneda,
  avance,
  etiqueta,
  children
}: {
  moneda: string
  // el porcentaje ya calculado (porcentaje() de datos/inversion.ts); null si no se puede decir
  avance: number | null
  // el nombre accesible de la barra («Avance de lo ejecutado en PEN»)
  etiqueta: string
  // las líneas de debajo: lo ejecutado frente al tope, el tope
  children?: ReactNode
}) {
  const dicho = avance === null ? '—' : `${numeroPe(avance)} %`
  return (
    <div role="group" aria-label={moneda} className="space-y-1.5 text-sg-body-sm">
      <div className="flex items-baseline justify-between gap-3 text-sg-body font-bold">
        <span>{moneda}</span>
        <span className="tabular-nums">{dicho}</span>
      </div>
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={avance ?? undefined}
        aria-valuetext={dicho}
        className="h-4 overflow-hidden rounded-sg-xs border border-sg-border-strong bg-sg-surface-sunken"
      >
        <div className="h-full bg-sg-primary" style={{ width: `${Math.min(100, Math.max(0, avance ?? 0))}%` }} />
      </div>
      {children}
    </div>
  )
}
