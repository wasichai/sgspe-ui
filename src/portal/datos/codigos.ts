import { useQuery } from '@tanstack/react-query'
import { usePedir } from './http'

// el código que el backend propone en un alta (GET /api/sgspe/codes/next, decisión 6 de la revisión de UX): PREFIJO-AAAA-NNN con
// el siguiente número del proyecto. es una propuesta: el campo sigue editable. un backend sin el endpoint (404) o un fallo no
// proponen nada y el alta sigue con el campo vacío, como antes
export const OBJETOS_CON_CODIGO = [
  'commitment',
  'agreement',
  'grievance',
  'inquiry',
  'stakeholder_request',
  'social_risk',
  'incident',
  'social_contribution',
  'social_program'
] as const

export function useCodigoPropuesto(objeto: string | undefined, proyecto: string | undefined): { codigo?: string; cargando: boolean } {
  const pedir = usePedir()
  const habilitado = Boolean(objeto && proyecto && (OBJETOS_CON_CODIGO as readonly string[]).includes(objeto))
  const consulta = useQuery({
    queryKey: ['codigo-propuesto', objeto, proyecto],
    queryFn: () => pedir<{ code: string }>(`/sgspe/codes/next?object=${encodeURIComponent(objeto ?? '')}&project=${encodeURIComponent(proyecto ?? '')}`),
    enabled: habilitado,
    // cada alta pide el siguiente: otro pudo registrar uno entre tanto
    staleTime: 0,
    gcTime: 0,
    retry: false
  })
  return { codigo: consulta.data?.code, cargando: habilitado && consulta.isLoading }
}
