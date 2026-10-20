// lo que una pantalla dibuja mientras una lectura carga, falla o llega: nunca un vacío ni un cero por una consulta que no terminó
import type { UseQueryResult } from '@tanstack/react-query'
import { ApiError, type ObjectDefinition } from '@wasichai/core'
import { codigoDelError } from '../datos/http'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { Cargando, ErrorDeCarga, NoDisponible } from './Estados'

// un 403 es «no disponible» (la cuenta no lee eso); cualquier otro error, la alerta con su correlación y reintento. nunca
// un vacío: una consulta que carga o falla no se dibuja como una lista sin elementos
export function FalloDeLectura({ error, alReintentar }: { error: unknown; alReintentar: () => void }) {
  // un 403 con código (NOT_ASSIGNED…) dice su motivo; sin código, el texto neutro
  return error instanceof ApiError && error.status === 403 ? (
    <NoDisponible motivo={codigoDelError(error)} enLista />
  ) : (
    <ErrorDeCarga error={error} alReintentar={alReintentar} />
  )
}

// el contenido de una consulta de lista: carga, fallo o los datos
// una lista que responde 404 no es un registro que falta: el servidor no tiene ese objeto (un despliegue sin el módulo), y
// reintentar no sirve (rediseño de UX, 2026-10-20)
export function DeLista<T>({ consulta, children }: { consulta: UseQueryResult<T>; children: (datos: T) => React.ReactNode }) {
  if (consulta.isPending) return <Cargando compacto />
  if (consulta.isError && !consulta.data && consulta.error instanceof ApiError && consulta.error.status === 404) return <ListaNoDisponible />
  if (consulta.isError && !consulta.data) return <FalloDeLectura error={consulta.error} alReintentar={() => void consulta.refetch()} />
  return <>{children(consulta.data as T)}</>
}

function ListaNoDisponible() {
  const { t } = useTranslation(NS)
  return <p className="text-sm text-sg-text-muted">{t('comun.listaNoDisponible')}</p>
}

// las definiciones que el formulario necesita (opciones de los ENUM, qué campos lee la cuenta): hasta que llegan todas no se
// dibuja un formulario sin opciones, y si una falla se dice
export function ConDefiniciones({
  definiciones,
  children
}: {
  definiciones: UseQueryResult<ObjectDefinition>[]
  children: (datos: ObjectDefinition[]) => React.ReactNode
}) {
  const fallida = definiciones.find((d) => d.isError && !d.data)
  if (fallida) return <FalloDeLectura error={fallida.error} alReintentar={() => definiciones.forEach((d) => void d.refetch())} />
  if (definiciones.some((d) => d.isPending)) return <Cargando />
  return <>{children(definiciones.map((d) => d.data as ObjectDefinition))}</>
}
