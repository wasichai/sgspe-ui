import { NoDisponible } from '../componentes/Estados'
import { desglose, type Indicador } from '../datos/indicadores'

// la mini matriz interés × poder de S08 y S20 (KPI-STK-03): puntos de un solo color sobre los umbrales del proyecto, sin
// etiquetas; la matriz completa y accesible es S19
export interface Punto {
  x: number
  y: number
  destacado?: boolean
}

export const puntosDeMatriz = (indicador: Indicador | undefined): Punto[] =>
  desglose(indicador, 'stakeholder').flatMap((f) => (typeof f.interest === 'number' && typeof f.power === 'number' ? [{ x: f.interest, y: f.power }] : []))

export function MiniMatriz({
  puntos,
  umbralInteres = 3,
  umbralPoder = 3,
  etiqueta,
  disponible = true
}: {
  puntos: Punto[]
  umbralInteres?: number
  umbralPoder?: number
  etiqueta: string
  disponible?: boolean
}) {
  if (!disponible) return <NoDisponible />
  // de 1 a 5 en los dos ejes, en un cuadro de 100 × 100
  const escala = (v: number) => ((v - 1) / 4) * 100
  return (
    <svg role="img" aria-label={etiqueta} viewBox="-4 -4 108 108" className="h-32 w-32 text-sg-text-muted">
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <line x1={escala(umbralInteres)} y1="0" x2={escala(umbralInteres)} y2="100" stroke="currentColor" strokeDasharray="2 2" strokeWidth="0.5" />
      <line x1="0" y1={100 - escala(umbralPoder)} x2="100" y2={100 - escala(umbralPoder)} stroke="currentColor" strokeDasharray="2 2" strokeWidth="0.5" />
      {puntos.map((p, i) => (
        <circle key={i} cx={escala(p.x)} cy={100 - escala(p.y)} r={p.destacado ? 4 : 2.5} fill={p.destacado ? 'var(--sg-data-2)' : 'var(--sg-data-1)'} />
      ))}
    </svg>
  )
}
