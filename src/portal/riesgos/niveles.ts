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

export const TONO_DE_NIVEL: Record<Nivel, Tono> = { BAJO: 'success', MEDIO: 'info', ALTO: 'warning', CRITICO: 'danger' }

export const esNivel = (valor: unknown): valor is Nivel => typeof valor === 'string' && (NIVELES as readonly string[]).includes(valor)
