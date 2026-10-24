import { Button, cn } from '@wasichai/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useFeriados } from '../datos/feriados'
import { hoyEnLima } from '../datos/fechas'
import { NS } from '../i18n'

// la grilla de mes de CampoFecha (05-especificacion §1.5, DD-07), con el patrón «Date Picker Dialog» de WAI-ARIA APG, como
// diálogo no modal: lunes primero en los dos idiomas, las flechas mueven un día o una semana, RePág y AvPág un mes (con
// Mayús, un año), Inicio y Fin van al lunes y al domingo, Enter o Espacio eligen. los días son AAAA-MM-DD de calendario,
// sin huso: se cuentan en UTC para que el reloj del navegador no los corra; hoy es el de Lima. un feriado del mes visible
// (useFeriados, wasichai/sgspe#159) lleva un punto bajo el número, no solo un color, y « (feriado)» en su nombre
export interface PropsDeCalendario {
  // el día escrito en el campo, si es un día
  elegido: string | null
  // nombre del diálogo
  etiqueta: string
  // AAAA-MM-DD o AAAA-MM-DDTHH:mm: se juzga solo el día
  min?: string
  max?: string
  alElegir: (dia: string) => void
}

const aFecha = (dia: string) => new Date(`${dia.slice(0, 10)}T00:00:00Z`)
const aDia = (fecha: Date) => fecha.toISOString().slice(0, 10)
const sumarDias = (dia: string, n: number) => {
  const f = aFecha(dia)
  f.setUTCDate(f.getUTCDate() + n)
  return aDia(f)
}
// el mismo día n meses después; el 31 se queda en el último día del mes que no lo tiene
const sumarMeses = (dia: string, n: number) => {
  const f = aFecha(dia)
  const destino = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + n, 1))
  const ultimo = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate()
  destino.setUTCDate(Math.min(f.getUTCDate(), ultimo))
  return aDia(destino)
}
// 0 el lunes, 6 el domingo
const diaDeLaSemana = (dia: string) => (aFecha(dia).getUTCDay() + 6) % 7

// las semanas del mes de dia, de lunes a domingo; null en las celdas de otro mes
function semanasDe(dia: string): (string | null)[][] {
  const primero = `${dia.slice(0, 7)}-01`
  const dias: (string | null)[] = Array.from({ length: diaDeLaSemana(primero) }, () => null)
  for (let d = primero; d.slice(0, 7) === primero.slice(0, 7); d = sumarDias(d, 1)) dias.push(d)
  while (dias.length % 7 !== 0) dias.push(null)
  return Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7))
}

const mayuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase() + texto.slice(1)

export function CalendarioDeFecha({ elegido, etiqueta, min, max, alElegir }: PropsDeCalendario) {
  const { t, i18n } = useTranslation(NS)
  // el idioma del portal, nunca el del navegador
  const local = i18n.language?.startsWith('en') ? 'en' : 'es-PE'
  const hoy = hoyEnLima()
  const desde = min?.slice(0, 10)
  const hasta = max?.slice(0, 10)
  const fuera = (dia: string) => (desde !== undefined && dia < desde) || (hasta !== undefined && dia > hasta)
  // sin día elegido, hoy; o el borde del rango si hoy queda fuera
  const inicial = elegido ?? (desde && hoy < desde ? desde : hasta && hoy > hasta ? hasta : hoy)
  const [foco, setFoco] = useState(inicial)
  // el foco va a la celda al abrir y al moverse con el teclado; no al cambiar de mes con los botones
  const enfocar = useRef(true)
  const grilla = useRef<HTMLTableElement>(null)
  const tituloId = useId()
  const feriados = useFeriados(Number(foco.slice(0, 4)))

  useLayoutEffect(() => {
    if (!enfocar.current) return
    grilla.current?.querySelector<HTMLElement>(`[data-dia="${foco}"]`)?.focus()
  }, [foco])

  const formato = (opciones: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(local, { ...opciones, timeZone: 'UTC' })
  const titulo = mayuscula(formato({ month: 'long', year: 'numeric' }).format(aFecha(foco)))
  const largo = formato({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const nombreDia = formato({ weekday: 'long' })
  const corto = formato({ weekday: 'short' })
  // un lunes cualquiera y los seis días que le siguen
  const semana = Array.from({ length: 7 }, (_, i) => aFecha(sumarDias('2026-10-19', i)))

  const mover = (dia: string) => {
    enfocar.current = true
    setFoco(dia)
  }
  const cambiarMes = (n: number) => {
    enfocar.current = false
    setFoco((d) => sumarMeses(d, n))
  }
  const elegir = (dia: string) => {
    if (!fuera(dia)) alElegir(dia)
  }

  const alTeclear = (e: KeyboardEvent<HTMLTableElement>) => {
    const pasos: Record<string, () => string> = {
      ArrowRight: () => sumarDias(foco, 1),
      ArrowLeft: () => sumarDias(foco, -1),
      ArrowDown: () => sumarDias(foco, 7),
      ArrowUp: () => sumarDias(foco, -7),
      PageDown: () => sumarMeses(foco, e.shiftKey ? 12 : 1),
      PageUp: () => sumarMeses(foco, e.shiftKey ? -12 : -1),
      Home: () => sumarDias(foco, -diaDeLaSemana(foco)),
      End: () => sumarDias(foco, 6 - diaDeLaSemana(foco))
    }
    if (pasos[e.key]) {
      e.preventDefault()
      mover(pasos[e.key]())
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      elegir(foco)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t('comun.campoFecha.calendario', { etiqueta })}
      className="absolute left-0 top-full z-50 mt-1 w-72 rounded-sg-md border border-sg-border bg-sg-surface-raised p-3 text-sg-text shadow-sg-overlay"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label={t('comun.campoFecha.mesAnterior')} onClick={() => cambiarMes(-1)}>
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
        <p id={tituloId} aria-live="polite" className="text-sm font-medium">
          {titulo}
        </p>
        <Button type="button" variant="ghost" size="icon" aria-label={t('comun.campoFecha.mesSiguiente')} onClick={() => cambiarMes(1)}>
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <table ref={grilla} role="grid" aria-labelledby={tituloId} className="w-full border-collapse text-center text-sm" onKeyDown={alTeclear}>
        <thead>
          <tr>
            {semana.map((d) => (
              <th key={d.toISOString()} scope="col" className="pb-1 text-sg-caption font-medium text-sg-text-muted">
                <span aria-hidden="true">{corto.format(d)}</span>
                <span className="sr-only">{nombreDia.format(d)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanasDe(foco).map((fila, i) => (
            <tr key={i}>
              {fila.map((dia, j) =>
                dia === null ? (
                  <td key={`v${j}`} role="gridcell" />
                ) : (
                  <td
                    key={dia}
                    role="gridcell"
                    data-dia={dia}
                    tabIndex={dia === foco ? 0 : -1}
                    aria-label={feriados.has(dia) ? t('comun.campoFecha.feriado', { dia: largo.format(aFecha(dia)) }) : largo.format(aFecha(dia))}
                    aria-selected={dia === elegido}
                    aria-current={dia === hoy ? 'date' : undefined}
                    aria-disabled={fuera(dia) || undefined}
                    onClick={() => elegir(dia)}
                    className={cn(
                      'h-8 cursor-pointer rounded-sg-sm focus-visible:outline-2 focus-visible:outline-sg-focus',
                      dia === elegido ? 'bg-sg-primary text-sg-on-primary' : 'hover:bg-sg-surface-hover',
                      dia === hoy && dia !== elegido && 'font-semibold text-sg-primary-text underline',
                      fuera(dia) && 'cursor-not-allowed text-sg-text-muted line-through hover:bg-transparent'
                    )}
                  >
                    <span className="relative inline-flex flex-col items-center leading-none">
                      {Number(dia.slice(8))}
                      {feriados.has(dia) && (
                        <span
                          data-testid="feriado"
                          aria-hidden="true"
                          className={cn('mt-0.5 size-1 rounded-full', dia === elegido ? 'bg-sg-on-primary' : 'bg-sg-warning')}
                        />
                      )}
                    </span>
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
