import { useTranslation } from 'react-i18next'
import { useFeriados } from '../datos/feriados'
import { cuandoRelativo, hoyEnLima } from '../datos/fechas'
import { NS } from '../i18n'

// los días que faltan o que pasaron de un plazo, para decirlos junto a su situación (S10 y S11: «VENCIDO · 18 DÍAS», «AL DÍA · 9
// DÍAS HÁBILES»): de hoy en Lima al vencimiento, en días hábiles solo el plazo que el backend cuenta así (el acuse de una queja),
// con los feriados del año de hoy y del vencimiento, como CuandoVence. sin fecha, nada
export function useDiasDelPlazo(dia: unknown, habiles = false): string | undefined {
  const { t } = useTranslation(NS)
  const hoy = hoyEnLima()
  const año = Number(hoy.slice(0, 4))
  const añoDelVencimiento = typeof dia === 'string' && /^\d{4}/.test(dia) ? Number(dia.slice(0, 4)) : año
  const deHoy = useFeriados(año, habiles)
  const delVencimiento = useFeriados(añoDelVencimiento, habiles && añoDelVencimiento !== año)
  const relativo = cuandoRelativo(dia, hoy, habiles ? new Set([...deHoy, ...delVencimiento]) : undefined)
  if (!relativo) return undefined
  if (relativo.sentido === 'hoy') return t('comun.diasDelPlazo.hoy')
  return t(relativo.habiles ? 'comun.diasDelPlazo.habiles' : 'comun.diasDelPlazo.dias', { count: relativo.dias })
}
