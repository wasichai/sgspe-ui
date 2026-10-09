import { useEffect, useState } from 'react'
import { alCambiarTema } from '../mapa/colores'

// el escape del HTML que arma un tooltip de ECharts: los nombres vienen de la API y no se insertan sin escapar
export const escapar = (texto: string): string => texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// cambia cada vez que cambia el tema: un gráfico que resuelve colores de tokens al armar sus opciones lo pone entre las
// dependencias de su useMemo para recalcularlos (los colores fijos en las opciones quedarían los del tema anterior)
export function useVersionDeTema(): number {
  const [version, fijar] = useState(0)
  useEffect(() => alCambiarTema(() => fijar((n) => n + 1)), [])
  return version
}
