import { hoyEnLima } from '../datos/fechas'
import { diaPe } from '../i18n'

// una fecha de negocio como se lee en es-PE («24 set. 2026») dentro de un <time> con su día de máquina: así toda tabla y ficha
// la dice igual y la regla de index.css no la parte en dos líneas. un instante se dice por su día de Lima; sin fecha, «—»; lo
// que no es una fecha sale tal cual
export function Dia({ valor }: { valor: string | null | undefined }) {
  if (!valor) return <>—</>
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : diaDeInstante(valor)
  if (!dia) return <>{valor}</>
  return <time dateTime={dia}>{diaPe(dia)}</time>
}

function diaDeInstante(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(valor)) return null
  const instante = new Date(valor)
  return Number.isNaN(instante.getTime()) ? null : hoyEnLima(instante)
}
