// el huso de toda fecha con hora del portal y de /admin: DynamicForm lee y escribe en él los DATETIME (core 0.6.0), sea
// cual sea el huso del navegador
export const ZONA_DE_LIMA = 'America/Lima'

// la fecha de negocio es la de Lima (UTC-5, sin horario de verano): a las 19:00 de Lima ya es "mañana" en UTC. devuelve
// AAAA-MM-DD, que se compara como texto con las fechas de la API (start_date, end_date…)
export const hoyEnLima = (ahora: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)

// los días de calendario de desde a hasta (AAAA-MM-DD, o una marca de tiempo de la que se toma el día): sin horas, así que no
// depende del huso. null si la fecha no es una fecha
export const diasEntre = (desde: unknown, hasta: string): number | null => {
  const dia = (v: string) => Date.parse(`${v.slice(0, 10)}T00:00:00Z`)
  if (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(desde)) return null
  return Math.round((dia(hasta) - dia(desde)) / 86_400_000)
}

// lo que se teclea en un datetime-local (AAAA-MM-DDTHH:mm[:ss]) es la hora de Lima, no la del reloj del navegador: una laptop
// con otro huso registraría mal la hora. Lima no tiene horario de verano (UTC-5). viaja como instante UTC; lo que no es una
// fecha, vacío
export const instanteDeLima = (local: string): string => {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!partes) return ''
  const [, a, m, d, h, min, s = '00'] = partes
  const fecha = new Date(`${a}-${m}-${d}T${h}:${min}:${s}-05:00`)
  if (Number.isNaN(fecha.getTime())) return ''
  // Date puede aceptar un 31 de febrero corriéndolo: solo vale si el día y la hora siguen siendo los tecleados
  const enLima = new Date(fecha.getTime() - 5 * 3_600_000).toISOString()
  return enLima.startsWith(`${a}-${m}-${d}T${h}:${min}:${s}`) ? fecha.toISOString() : ''
}

// la hora de Lima de ahora, como la escribe un datetime-local (AAAA-MM-DDTHH:mm)
export function ahoraEnLima(ahora: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(ahora)
      .map((x) => [x.type, x.value])
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

// un día escrito como dd/mm/aaaa, ddmmaaaa o dd-mm-aaaa (hallazgo U-07: el orden es-PE en los dos idiomas, nunca el del
// navegador) como AAAA-MM-DD; null si no es un día que exista. un día de calendario no tiene huso: Date.UTC solo comprueba
// que el 31 de febrero no se corra al 3 de marzo
export function diaDeTexto(texto: string): string | null {
  const partes = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texto.trim()) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(texto.trim())
  if (!partes) return null
  const [d, m, a] = partes.slice(1).map(Number)
  const fecha = new Date(Date.UTC(a, m - 1, d))
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// un día AAAA-MM-DD (o el día de un AAAA-MM-DDTHH:mm) como lo muestra CampoFecha: dd/mm/aaaa; lo que no es un día, vacío
export const textoDeDia = (dia: string): string => {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia)
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : ''
}

// una hora de 24 h escrita como HH:mm, H:mm o HHmm como HH:mm; null si no es una hora
export function horaDeTexto(texto: string): string | null {
  const partes = /^(\d{1,2}):?(\d{2})$/.exec(texto.trim())
  if (!partes) return null
  const [h, min] = partes.slice(1).map(Number)
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null
}

// cuándo vence un plazo dicho desde hoy (tercera pasada de UX, 1.7; DD-35): «hoy», «mañana», «ayer» o los días que faltan o que
// pasaron. con feriados, en días hábiles (de lunes a viernes, sin feriados), como el backend cuenta el acuse de una queja
// (BusinessDays); sin ellos, en días de calendario. el día y hoy son AAAA-MM-DD (o el día de una marca de tiempo); null si no es
// una fecha
export interface Relativo {
  sentido: 'hoy' | 'manana' | 'ayer' | 'futuro' | 'pasado'
  dias: number
  habiles: boolean
}

const esHabil = (dia: Date, feriados: ReadonlySet<string>): boolean => {
  const semana = dia.getUTCDay()
  return semana !== 0 && semana !== 6 && !feriados.has(dia.toISOString().slice(0, 10))
}

export function cuandoRelativo(dia: unknown, hoy: string, feriados?: ReadonlySet<string>): Relativo | null {
  const diferencia = diasEntre(hoy, typeof dia === 'string' ? dia.slice(0, 10) : '')
  if (diferencia === null || typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dia)) return null
  const habiles = feriados !== undefined
  if (diferencia === 0) return { sentido: 'hoy', dias: 0, habiles }
  if (diferencia === 1) return { sentido: 'manana', dias: 1, habiles }
  if (diferencia === -1) return { sentido: 'ayer', dias: 1, habiles }
  if (!feriados) return { sentido: diferencia > 0 ? 'futuro' : 'pasado', dias: Math.abs(diferencia), habiles }
  // los días hábiles entre los dos, sin contar el de partida: de hoy al vencimiento o del vencimiento a hoy
  const desde = Date.parse(`${(diferencia > 0 ? hoy : dia).slice(0, 10)}T00:00:00Z`)
  let cuenta = 0
  for (let i = 1; i <= Math.abs(diferencia); i++) if (esHabil(new Date(desde + i * 86_400_000), feriados)) cuenta++
  return { sentido: diferencia > 0 ? 'futuro' : 'pasado', dias: cuenta, habiles }
}
