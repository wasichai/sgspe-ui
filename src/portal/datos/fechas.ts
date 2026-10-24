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
