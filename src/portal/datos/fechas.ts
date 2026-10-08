// la fecha de negocio es la de Lima (UTC-5, sin horario de verano): a las 19:00 de Lima ya es "mañana" en UTC. devuelve
// AAAA-MM-DD, que se compara como texto con las fechas de la API (start_date, end_date…)
export const hoyEnLima = (ahora: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
