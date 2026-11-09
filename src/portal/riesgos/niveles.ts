import type { Tono } from '../componentes/apariencias'
import { atributo, type Registro } from '../datos/registros'

// los niveles de riesgo (ASM-004, RN-RSK-002): puntaje P × I de 1 a 25 y los umbrales del proyecto (risk_medium_min_score,
// risk_high_min_score y risk_critical_min_score; 5, 10 y 15 por defecto, plan 4.2a). el nivel guardado lo calcula el servidor en
// cada revisión; el portal solo lo anticipa (la vista previa de «Nueva revisión») y colorea las celdas del mapa de calor
export const NIVELES = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const
export type Nivel = (typeof NIVELES)[number]

export interface Umbrales {
  medio: number
  alto: number
  critico: number
}

export const UMBRALES_POR_DEFECTO: Umbrales = { medio: 5, alto: 10, critico: 15 }

// los umbrales vigentes del proyecto: el guardado o, vacío, el por defecto
export function umbralesDe(proyecto: Registro | undefined): Umbrales {
  const valor = (campo: string, porDefecto: number) => {
    const n = Number(atributo(proyecto, campo))
    return Number.isInteger(n) && n > 0 ? n : porDefecto
  }
  return {
    medio: valor('risk_medium_min_score', UMBRALES_POR_DEFECTO.medio),
    alto: valor('risk_high_min_score', UMBRALES_POR_DEFECTO.alto),
    critico: valor('risk_critical_min_score', UMBRALES_POR_DEFECTO.critico)
  }
}

export function nivelDePuntaje(puntaje: number, umbrales: Umbrales = UMBRALES_POR_DEFECTO): Nivel {
  if (puntaje >= umbrales.critico) return 'CRITICO'
  if (puntaje >= umbrales.alto) return 'ALTO'
  if (puntaje >= umbrales.medio) return 'MEDIO'
  return 'BAJO'
}

// el tono de un nivel donde hace falta uno de estado: MEDIO es ámbar (design-system.md §4.3), nunca el azul de información
export const TONO_DE_NIVEL: Record<Nivel, Tono> = { BAJO: 'success', MEDIO: 'warning', ALTO: 'danger', CRITICO: 'danger' }

// la celda del mapa de calor de probabilidad por impacto: la zona de su nivel (--sg-zone-*), no un tono de estado
export const CLASE_DE_ZONA: Record<Nivel, string> = { BAJO: 'bg-sg-zone-1', MEDIO: 'bg-sg-zone-2', ALTO: 'bg-sg-zone-3', CRITICO: 'bg-sg-zone-4' }

// el ordinal de 1 a 4 de un nivel de riesgo o de severidad de alerta (BAJO…CRITICO), de una severidad de queja (BAJA…CRITICA) o de
// una prioridad (BAJA…MUY ALTA): las barras de la insignia (componentes/Nivel.tsx). otro valor no tiene nivel
const ORDINALES: Record<string, 1 | 2 | 3 | 4> = {
  BAJO: 1,
  BAJA: 1,
  MEDIO: 2,
  MEDIA: 2,
  ALTO: 3,
  ALTA: 3,
  CRITICO: 4,
  CRITICA: 4,
  'MUY ALTA': 4
}
export const ordinalDeNivel = (valor: unknown): 1 | 2 | 3 | 4 | undefined =>
  typeof valor === 'string' && Object.hasOwn(ORDINALES, valor) ? ORDINALES[valor] : undefined

export const esNivel = (valor: unknown): valor is Nivel => typeof valor === 'string' && (NIVELES as readonly string[]).includes(valor)
