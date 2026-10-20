import { hoyEnLima } from '../datos/fechas'
import { atributo, type Registro } from '../datos/registros'

// fechas del relacionamiento en America/Lima (RNF-I18N-002): la API guarda instantes en UTC y el día de negocio es el de
// Lima. una interacción realizada el 2026-10-02T03:00:00Z es del 1 de octubre. el cálculo es el de hoyEnLima
// (datos/fechas.ts); un instante que no es una fecha no tiene día (null), no rompe la pantalla
export function diaEnLima(iso: string): string | null {
  const instante = new Date(iso)
  return Number.isNaN(instante.getTime()) ? null : hoyEnLima(instante)
}

// el día de una interacción: el de su realización o, si aún no se realizó, el programado
export function diaDe(interaccion: Registro): string | null {
  const instante = atributo<string>(interaccion, 'held_at') || atributo<string>(interaccion, 'scheduled_at')
  return instante ? diaEnLima(instante) : null
}

// el mes actual en Lima, YYYY-MM
export const mesActual = (): string => hoyEnLima().slice(0, 7)

// ?month= y ?day= vienen de la URL: uno mal escrito no se usa
export const esMes = (valor: string | null): valor is string => valor !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor)
export const esDia = (valor: string | null): valor is string =>
  valor !== null &&
  /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
  !Number.isNaN(Date.parse(`${valor}T00:00:00Z`)) &&
  new Date(`${valor}T00:00:00Z`).toISOString().startsWith(valor)

export function sumarMeses(mes: string, n: number): string {
  const [anio, m] = mes.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, m - 1 + n, 1))
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`
}

// las semanas (de lunes a domingo) que cubren un mes, como listas de días YYYY-MM-DD; los días de otros meses van también
export function semanasDelMes(mes: string): string[][] {
  const [anio, m] = mes.split('-').map(Number)
  const primero = new Date(Date.UTC(anio, m - 1, 1))
  const desplazamiento = (primero.getUTCDay() + 6) % 7
  const inicio = new Date(Date.UTC(anio, m - 1, 1 - desplazamiento))
  const semanas: string[][] = []
  for (let s = 0; s < 6; s++) {
    const semana = Array.from({ length: 7 }, (_, d) => new Date(inicio.getTime() + (s * 7 + d) * 86_400_000).toISOString().slice(0, 10))
    if (s > 3 && !semana.some((dia) => dia.startsWith(mes))) break
    semanas.push(semana)
  }
  return semanas
}

// la semana (de lunes a domingo) que contiene un día
// el día siguiente (AAAA-MM-DD), de calendario: el límite excluido de un rango que termina en `dia`
export const diaSiguiente = (dia: string): string => new Date(Date.parse(`${dia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

export function semanaDe(dia: string): string[] {
  const fecha = new Date(`${dia}T00:00:00Z`)
  const lunes = new Date(fecha.getTime() - ((fecha.getUTCDay() + 6) % 7) * 86_400_000)
  return Array.from({ length: 7 }, (_, d) => new Date(lunes.getTime() + d * 86_400_000).toISOString().slice(0, 10))
}

// los tipos formales de RN-ENG-004: cierran con acta aprobada
export const TIPOS_FORMALES = ['REUNION', 'REUNION INFORMATIVA', 'TALLER', 'ASAMBLEA', 'MESA DE DIALOGO']
export const esFormal = (i: Registro) => TIPOS_FORMALES.includes(String(atributo(i, 'engagement_type') ?? ''))

// los estados de WF-C en que el acta se redacta: realizada y acta en borrador (una devolución la deja en borrador). en revisión,
// aprobada o cerrada ya no se edita
export const ESTADOS_DE_ACTA_EDITABLE = ['held', 'minutes_drafted']
