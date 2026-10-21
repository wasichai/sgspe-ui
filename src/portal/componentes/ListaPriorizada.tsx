import { cn } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NS, numeroPe } from '../i18n'
import { Seccion } from './Seccion'

// un grupo de avisos que muestra solo lo más urgente, con su motivo, y «Ver los N» hacia la lista filtrada (hallazgo U-05,
// DD-13): reemplaza los «muros» de títulos subrayados. el orden lo da quien llama; el tono se marca con el borde izquierdo y,
// siempre, con el texto del motivo (nunca solo con color)
export type TonoDeEntrada = 'peligro' | 'aviso' | 'neutro'

export interface EntradaPriorizada {
  clave: string
  titulo: ReactNode
  a: string
  motivo: string
  cuando?: ReactNode
  tono: TonoDeEntrada
}

export interface PropsDeListaPriorizada {
  titulo: string
  // nulo: sin conteo (con QCS confidenciales ocultas; entonces quien llama pone NotaDeConfidenciales)
  total: number | null
  entradas: EntradaPriorizada[]
  limite?: number
  // sin etiqueta, «Ver los N» (o «Ver todos» cuando no hay conteo)
  verTodos?: { etiqueta?: string; a: string }
  vacio?: string
}

const BORDE: Record<TonoDeEntrada, string> = {
  peligro: 'border-sg-danger',
  aviso: 'border-sg-warning',
  neutro: 'border-sg-border'
}

export function ListaPriorizada({ titulo, total, entradas, limite = 3, verTodos, vacio }: PropsDeListaPriorizada) {
  const { t } = useTranslation(NS)
  if (entradas.length === 0 && !vacio) return null
  const visibles = entradas.slice(0, limite)
  // sin conteo no se sabe si quedan más: el enlace se ofrece igual, sin número
  const quedan = total === null ? null : Math.max(0, total - visibles.length)
  const enlace =
    verTodos && (quedan === null || quedan > 0) ? (
      <Link to={verTodos.a} className="text-sg-caption font-medium text-sg-primary-text no-underline hover:underline focus-visible:underline">
        {verTodos.etiqueta ?? (total === null ? t('comun.listaPriorizada.verTodos') : t('comun.verTodos', { count: total }))}
      </Link>
    ) : quedan ? (
      <p className="text-sg-caption text-sg-text-muted">{t('comun.listaPriorizada.yMas', { count: quedan })}</p>
    ) : null
  return (
    <Seccion
      titulo={
        <>
          {titulo}
          {total !== null ? <span className="ml-2 text-sg-body-sm font-normal tabular-nums text-sg-text-muted">{numeroPe(total)}</span> : null}
        </>
      }
    >
      {entradas.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{vacio}</p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((e) => (
            <li key={e.clave} className={cn('border-l-2 pl-3', BORDE[e.tono])}>
              <Link to={e.a} className="text-sm font-medium text-sg-primary-text no-underline hover:underline focus-visible:underline">
                {e.titulo}
              </Link>
              <p className="text-sg-caption text-sg-text-secondary">
                <span>{e.motivo}</span>
                {e.cuando ? (
                  <>
                    <span aria-hidden> · </span>
                    <span>{e.cuando}</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
      {enlace}
    </Seccion>
  )
}
