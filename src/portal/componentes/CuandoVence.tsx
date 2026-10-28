import { useTranslation } from 'react-i18next'
import { useFeriados } from '../datos/feriados'
import { cuandoRelativo, hoyEnLima } from '../datos/fechas'
import { NS } from '../i18n'
import { Dia } from './Dia'

// un plazo dicho desde hoy (tercera pasada de UX, 1.7; DD-35), junto a su fecha exacta, que va aparte en <time>: «vence en 3 días»,
// «venció hace 2 días hábiles». en días hábiles solo el plazo que el backend cuenta así (el acuse de una queja), con los feriados
// del año de hoy y del vencimiento; sin fecha, nada
export function CuandoVence({ dia, habiles = false, className }: { dia: unknown; habiles?: boolean; className?: string }) {
  const { t } = useTranslation(NS)
  const hoy = hoyEnLima()
  const año = Number(hoy.slice(0, 4))
  const añoDelVencimiento = typeof dia === 'string' && /^\d{4}/.test(dia) ? Number(dia.slice(0, 4)) : año
  const deHoy = useFeriados(año, habiles)
  const delVencimiento = useFeriados(añoDelVencimiento, habiles && añoDelVencimiento !== año)
  const relativo = cuandoRelativo(dia, hoy, habiles ? new Set([...deHoy, ...delVencimiento]) : undefined)
  if (!relativo) return null
  const clave = relativo.sentido === 'futuro' || relativo.sentido === 'pasado' ? `${relativo.sentido}${relativo.habiles ? 'Habiles' : ''}` : relativo.sentido
  return <span className={className}>{t(`comun.cuando.${clave}`, { count: relativo.dias })}</span>
}

// la fecha de un plazo con su relativo debajo, solo mientras corre: JOB-01 deja la situación vacía fuera de esos estados (una tarea
// hecha no «venció hace 40 días»). para las columnas de plazo de las listas
export function FechaDePlazo({ dia, situacion, habiles = false }: { dia: string | null | undefined; situacion: unknown; habiles?: boolean }) {
  return (
    <>
      <Dia valor={dia} />
      {dia && typeof situacion === 'string' && situacion !== '' ? (
        <CuandoVence dia={dia} habiles={habiles} className="block text-sg-caption text-sg-text-muted" />
      ) : null}
    </>
  )
}
