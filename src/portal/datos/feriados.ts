import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { usePedir } from './http'

// los feriados nacionales de un año (wasichai/sgspe#159, ASM-096): GET /api/sgspe/calendar/holidays?year=AAAA da
// { year, configured, holidays[] }, la misma lista con la que el backend cuenta los días hábiles, por despliegue y no por
// organización. solo marcan el calendario de CampoFecha: sin respuesta (cargando, error, un backend sin la ruta) no hay
// feriados y el calendario es el de siempre
const SIN_FERIADOS: ReadonlySet<string> = new Set()

// solo los días AAAA-MM-DD del año pedido; cualquier otra forma no marca nada
export function feriadosDe(respuesta: unknown, año: number): ReadonlySet<string> {
  const dias = respuesta && typeof respuesta === 'object' ? (respuesta as { holidays?: unknown }).holidays : null
  if (!Array.isArray(dias)) return SIN_FERIADOS
  return new Set(dias.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d.startsWith(`${año}-`)))
}

// una lectura por año y por sesión: la lista cambia solo con un despliegue. activo en falso no la pide (un plazo de calendario)
export function useFeriados(año: number, activo = true): ReadonlySet<string> {
  const { user } = useAuth()
  const pedir = usePedir()
  const consulta = useQuery({
    queryKey: ['calendar-holidays', año],
    queryFn: async () => feriadosDe(await pedir<unknown>(`/sgspe/calendar/holidays?year=${año}`), año),
    enabled: Boolean(user) && activo,
    staleTime: Infinity,
    retry: false
  })
  return consulta.data ?? SIN_FERIADOS
}
