import { cn } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EnlaceConRastro } from '../contexto/Rastro'
import { ResultadoDeLista } from '../contexto/Origen'
import { NS, numeroPe } from '../i18n'
import { Seccion } from './Seccion'

// un grupo de avisos que muestra solo lo más urgente, con su motivo, y «Ver los N» hacia la lista filtrada (hallazgo U-05,
// DD-13): reemplaza los «muros» de títulos subrayados. el orden lo da quien llama; el tono se marca con el borde izquierdo y,
// siempre, con el texto del motivo (nunca solo con color). sin una lista a la que ir, el resto se despliega en el lugar:
// ninguna entrada queda sin forma de verse
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
  const [desplegada, setDesplegada] = useState(false)
  if (entradas.length === 0 && !vacio) return null
  const plegables = !verTodos && entradas.length > limite
  const visibles = plegables && desplegada ? entradas : entradas.slice(0, limite)
  // sin conteo no se sabe si quedan más: el enlace se ofrece igual, sin número
  const quedan = total === null ? null : Math.max(0, total - visibles.length)
  const enlace =
    verTodos && (quedan === null || quedan > 0) ? (
      <Link to={verTodos.a} className="text-sg-caption font-medium text-sg-primary-text no-underline hover:underline focus-visible:underline">
        {verTodos.etiqueta ?? (total === null ? t('comun.listaPriorizada.verTodos') : t('comun.verTodos', { count: total }))}
      </Link>
    ) : plegables ? (
      <button
        type="button"
        aria-expanded={desplegada}
        onClick={() => setDesplegada((d) => !d)}
        className="text-sg-caption font-medium text-sg-primary-text hover:underline focus-visible:underline"
      >
        {desplegada ? t('comun.listaPriorizada.mostrarMenos') : t('comun.listaPriorizada.mostrarMas', { count: entradas.length - limite })}
      </button>
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
        // las entradas son un resultado (flujo F-C): la ficha abierta desde una ofrece volver aquí y pasar a la siguiente. el total
        // es el del grupo, no el de la pantalla: «Volver» no lleva conteo
        <ResultadoDeLista>
          <ul className="space-y-2">
            {visibles.map((e) => (
              <li key={e.clave} className={cn('border-l-2 pl-3', BORDE[e.tono])}>
                <EnlaceConRastro to={e.a} className="text-sm font-medium text-sg-primary-text no-underline hover:underline focus-visible:underline">
                  {e.titulo}
                </EnlaceConRastro>
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
        </ResultadoDeLista>
      )}
      {enlace}
    </Seccion>
  )
}
