import { useQueries } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { usePedir } from '../datos/http'
import { consulta, type Pagina } from '../datos/registros'

// las tres cifras de atención de cada proyecto del portafolio (S04): compromisos vencidos, QCS vencidas y riesgos altos. los
// vencidos salen de la lectura única de los conteos del proyecto (GET /api/sgspe/projects/{id}/counts, la misma consulta y la
// misma caché que la navegación local de Project 360, contexto/conteos.ts), con el alcance de la cuenta y null en lo que no lee.
// los riesgos altos son los activos de nivel ALTO o CRITICO, como KPI-RSK-01 (RiskKpis.ACTIVE_STATES de sgspe) y el filtro
// ?level=alto de la lista de riesgos, contados con la API genérica (size=1). undefined: todavía cargando; null: la cuenta no lee
// esa cifra o no se pudo leer (la tabla dice «—» con su nota al pie, nunca 0)
export interface CifrasDeProyecto {
  compromisos: number | null | undefined
  qcs: number | null | undefined
  riesgos: number | null | undefined
  // las QCS vencidas no cuentan las confidenciales que la cuenta no lee: el servidor dice que las hay, nunca cuántas
  confidenciales: boolean
}

interface ConteosDelServidor {
  counts: Record<string, number | null>
  confidentialHidden: boolean
}

const RIESGOS_ACTIVOS = 'identified,assessed,mitigating,monitoring'
const NIVELES_ALTOS = ['ALTO', 'CRITICO']

export function useCifrasDelPortafolio(proyectos: readonly string[]): Record<string, CifrasDeProyecto> {
  const { can } = useAuth()
  const pedir = usePedir()
  const conteos = useQueries({
    queries: proyectos.map((proyecto) => ({
      queryKey: ['project-counts', proyecto],
      queryFn: () => pedir<ConteosDelServidor>(`/sgspe/projects/${encodeURIComponent(proyecto)}/counts`),
      retry: false
    }))
  })
  const leeRiesgos = can('social_risk', 'READ')
  // la misma clave que useSumasDeConteos y useRegistros: una escritura de riesgos la deja vieja
  const pedidos = leeRiesgos
    ? proyectos.flatMap((proyecto) => NIVELES_ALTOS.map((nivel) => consulta({ project: proyecto, state: RIESGOS_ACTIVOS, risk_level: nivel, size: 1 })))
    : []
  const riesgos = useQueries({
    queries: pedidos.map((busqueda) => ({
      queryKey: ['records', 'social_risk', busqueda],
      queryFn: () => pedir<Pagina>(`/objects/social_risk/records?${busqueda}`)
    }))
  })
  // la suma de los dos niveles: mientras uno carga, undefined; si uno falló, null (una suma a medias engañaría)
  const riesgosDe = (i: number): number | null | undefined => {
    if (!leeRiesgos) return null
    const partes = riesgos.slice(i * NIVELES_ALTOS.length, (i + 1) * NIVELES_ALTOS.length)
    if (partes.some((r) => r.isError)) return null
    if (partes.some((r) => r.isPending)) return undefined
    const totales = partes.map((r) => r.data?.totalElements)
    return totales.every((n): n is number => typeof n === 'number') ? totales.reduce((suma, n) => suma + n, 0) : null
  }
  return Object.fromEntries(
    proyectos.map((proyecto, i) => {
      const lectura = conteos[i]
      const deLaLectura = (clave: string) => (lectura.isPending ? undefined : (lectura.data?.counts[clave] ?? null))
      return [
        proyecto,
        {
          compromisos: deLaLectura('commitments:accion'),
          qcs: deLaLectura('attention:accion'),
          riesgos: riesgosDe(i),
          confidenciales: lectura.data?.confidentialHidden === true
        }
      ]
    })
  )
}
