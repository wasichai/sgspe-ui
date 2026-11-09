import { useTranslation } from 'react-i18next'
import { hoyEnLima } from '../datos/fechas'
import { NS } from '../i18n'

// los atajos de un periodo de dos CampoFecha (design-system.md §5, DatePicker y DateRangePicker): llenan «Desde» y «Hasta»
// según el día de hoy en Lima. un periodo que empieza hoy o antes termina hoy, nunca en un día que no llegó («Este mes» va del
// día 1 a hoy); los pasados son completos. el botón del periodo actual lleva aria-pressed
export const ATAJOS = ['esteMes', 'mesPasado', 'ultimos30', 'esteAno', 'anoPasado'] as const
export type Atajo = (typeof ATAJOS)[number]

const dos = (n: number) => String(n).padStart(2, '0')
const dia = (fecha: Date) => `${fecha.getUTCFullYear()}-${dos(fecha.getUTCMonth() + 1)}-${dos(fecha.getUTCDate())}`

// las fechas AAAA-MM-DD del atajo, con hoy como lo da hoyEnLima: un día de calendario, sin huso (Date.UTC solo hace las cuentas)
export function periodoDelAtajo(atajo: Atajo, hoy: string = hoyEnLima()): { desde: string; hasta: string } {
  const [anio, mes, d] = hoy.split('-').map(Number)
  switch (atajo) {
    case 'esteMes':
      return { desde: `${anio}-${dos(mes)}-01`, hasta: hoy }
    case 'mesPasado':
      return { desde: dia(new Date(Date.UTC(anio, mes - 2, 1))), hasta: dia(new Date(Date.UTC(anio, mes - 1, 0))) }
    case 'ultimos30':
      return { desde: dia(new Date(Date.UTC(anio, mes - 1, d - 29))), hasta: hoy }
    case 'esteAno':
      return { desde: `${anio}-01-01`, hasta: hoy }
    case 'anoPasado':
      return { desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31` }
  }
}

export function AtajosDePeriodo({
  desde,
  hasta,
  alElegir,
  deshabilitado = false
}: {
  desde: string | null | undefined
  hasta: string | null | undefined
  alElegir: (periodo: { desde: string; hasta: string }) => void
  deshabilitado?: boolean
}) {
  const { t } = useTranslation(NS)
  const hoy = hoyEnLima()
  return (
    <div role="group" aria-label={t('comun.atajosDePeriodo.grupo')} className="flex flex-wrap gap-2">
      {ATAJOS.map((atajo) => {
        const periodo = periodoDelAtajo(atajo, hoy)
        const elegido = periodo.desde === (desde ?? '') && periodo.hasta === (hasta ?? '')
        return (
          <button
            key={atajo}
            type="button"
            aria-pressed={elegido}
            disabled={deshabilitado}
            onClick={() => alElegir(periodo)}
            // como los chips de la barra de filtros (design-system.md §5.3): 32 px, borde de 1 px border-strong; el elegido, borde de 2 px
            // primary sobre primary-soft y en 700
            className={`h-8 rounded-sg-md px-2.5 text-sm disabled:cursor-not-allowed disabled:border-sg-border disabled:bg-sg-surface-sunken disabled:text-sg-text-muted ${
              elegido
                ? 'border-2 border-sg-primary bg-sg-primary-soft font-bold text-sg-primary-text'
                : 'border border-sg-border-strong bg-sg-surface text-sg-text hover:bg-sg-surface-hover'
            }`}
          >
            {t(`comun.atajosDePeriodo.${atajo}`)}
          </button>
        )
      })}
    </div>
  )
}
