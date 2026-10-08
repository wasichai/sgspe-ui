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
