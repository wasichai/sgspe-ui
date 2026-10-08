import { ApiError, type ObjectDefinition } from '@wasichai/core'
import type { UseQueryResult } from '@tanstack/react-query'
import { Alert } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando, ErrorDeCarga, NoDisponible } from '../componentes/Estados'
import { texto } from '../datos/registros'
import { NS } from '../i18n'
import { GuardadoParcial } from './guardarInteraccion'

// un 403 es «no disponible» (la cuenta no lee eso); cualquier otro error, la alerta con su correlación y reintento. nunca
// un vacío: una consulta que carga o falla no se dibuja como una lista sin elementos
export function FalloDeLectura({ error, alReintentar }: { error: unknown; alReintentar: () => void }) {
  return error instanceof ApiError && error.status === 403 ? <NoDisponible /> : <ErrorDeCarga error={error} alReintentar={alReintentar} />
}

// el contenido de una consulta de lista: carga, fallo o los datos
export function DeLista<T>({ consulta, children }: { consulta: UseQueryResult<T>; children: (datos: T) => React.ReactNode }) {
  if (consulta.isPending) return <Cargando compacto />
  if (consulta.isError && !consulta.data) return <FalloDeLectura error={consulta.error} alReintentar={() => void consulta.refetch()} />
  return <>{children(consulta.data as T)}</>
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

// el error de guardar: si fue a mitad, lo ya creado queda y el aviso enlaza a la interacción para completarla
export function ErrorDeGuardado({ error, proyecto }: { error: unknown; proyecto: string }) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  if (error instanceof GuardadoParcial)
    return (
      <Alert tone="danger">
        <p>{t('relacionamiento.registro.parcial')}</p>
        <p>{mensaje(error.causa)}</p>
        <Link to={`/projects/${proyecto}/engagements/${error.interaccion.id}`} className="underline">
          {t('relacionamiento.registro.abrirCreada', { titulo: texto(error.interaccion, 'title') })}
        </Link>
      </Alert>
    )
  return <Alert tone="danger">{mensaje(error)}</Alert>
}
