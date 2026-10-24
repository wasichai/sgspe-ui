import { cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { hoyEnLima } from '../datos/fechas'
import { NS } from '../i18n'
import { CONTROL } from './Campo'

// un campo de mes que muestra y lee el mes en es-PE en los dos idiomas (wasichai/sgspe#136): un <input type="month"> lo dibuja
// el navegador con su configuración regional («September 2026»). son dos select nativos, el mes por su nombre es-PE («Enero»…
// «Diciembre») y el año, dentro de un fieldset cuya leyenda es la etiqueta. el valor es el mes AAAA-MM, como el del campo
// nativo. min y max (AAAA-MM) acotan los años ofrecidos, apagan los meses de fuera y, al cambiar de año, el mes se ajusta al
// rango; sin ellos se ofrecen los diez años anteriores y el siguiente al mes elegido y al de hoy en Lima
export interface PropsDeCampoMes {
  valor: string
  alCambiar: (valor: string) => void
  etiqueta: string
  min?: string
  max?: string
  deshabilitado?: boolean
  // la clase de la leyenda, para igualar la de los demás filtros de una barra
  claseDeEtiqueta?: string
}

const MESES = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const FORMATO_DE_MES = new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone: 'America/Lima' })
// el nombre es-PE de un mes (01…12), con mayúscula inicial como encabeza una lista («Enero», «Setiembre»): se toma el mediodía
// de Lima del día 15, que no se corre de mes con ningún huso
const nombreDeMes = (mes: string): string => {
  const nombre = FORMATO_DE_MES.format(new Date(`2026-${mes}-15T12:00:00-05:00`))
  return nombre.charAt(0).toLocaleUpperCase('es-PE') + nombre.slice(1)
}

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/
const anioDe = (mes: string | undefined): number | undefined => {
  const partes = MES.exec(mes ?? '')
  return partes ? Number(partes[1]) : undefined
}

// el mes AAAA-MM dentro de min y max
const acotar = (mes: string, min?: string, max?: string): string => (min && mes < min ? min : max && mes > max ? max : mes)

export function CampoMes({ valor, alCambiar, etiqueta, min, max, deshabilitado, claseDeEtiqueta }: PropsDeCampoMes) {
  const { t } = useTranslation(NS)
  const partes = MES.exec(valor)
  const hoy = hoyEnLima().slice(0, 7)
  const anio = partes ? partes[1] : hoy.slice(0, 4)
  const mes = partes ? partes[2] : hoy.slice(5, 7)
  const elegido = Number(anio)
  const desde = Math.min(anioDe(min) ?? Math.min(elegido, Number(hoy.slice(0, 4))) - 10, elegido)
  const hasta = Math.max(anioDe(max) ?? Math.max(elegido, Number(hoy.slice(0, 4))) + 1, elegido)
  const anios = Array.from({ length: hasta - desde + 1 }, (_, i) => String(desde + i))
  const fuera = (m: string) => Boolean((min && `${anio}-${m}` < min) || (max && `${anio}-${m}` > max))
  const cambiar = (nuevoAnio: string, nuevoMes: string) => {
    const nuevo = acotar(`${nuevoAnio}-${nuevoMes}`, min, max)
    if (nuevo !== valor) alCambiar(nuevo)
  }
  return (
    <fieldset className="m-0 min-w-0 space-y-1 border-0 p-0" disabled={deshabilitado}>
      <legend className={claseDeEtiqueta ?? 'block text-sg-body-sm font-medium text-sg-text'}>{etiqueta}</legend>
      <div className="flex gap-2">
        <select aria-label={t('comun.campoMes.mes')} className={cn(CONTROL, 'w-36')} value={mes} onChange={(e) => cambiar(anio, e.target.value)}>
          {MESES.map((m) => (
            <option key={m} value={m} disabled={fuera(m)}>
              {nombreDeMes(m)}
            </option>
          ))}
        </select>
        <select aria-label={t('comun.campoMes.anio')} className={cn(CONTROL, 'w-24')} value={anio} onChange={(e) => cambiar(e.target.value, mes)}>
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  )
}
