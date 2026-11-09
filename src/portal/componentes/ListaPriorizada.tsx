import { Button, cn } from '@wasichai/ui'
import { AlertTriangle, CircleDot, Clock, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EnlaceConRastro } from '../contexto/Rastro'
import { ResultadoDeLista } from '../contexto/Origen'
import { NS, numeroPe } from '../i18n'
import type { Tono } from './apariencias'
import { Seccion } from './Seccion'

// un grupo de avisos que muestra solo lo más urgente, con su motivo, y «Ver los N» hacia la lista filtrada (hallazgo U-05,
// DD-13): reemplaza los «muros» de títulos subrayados. el orden lo da quien llama; el tono se marca con el borde izquierdo y,
// siempre, con el texto del motivo (nunca solo con color). sin una lista a la que ir, el resto se despliega en el lugar:
// ninguna entrada queda sin forma de verse
// el tono es el mismo vocabulario que el de los estados (apariencias.ts): danger, warning o neutral
export type TonoDeEntrada = Extract<Tono, 'danger' | 'warning' | 'neutral'>

export interface EntradaPriorizada {
  clave: string
  titulo: ReactNode
  a: string
  motivo: string
  cuando?: ReactNode
  tono: TonoDeEntrada
  // lo que se hace en la misma línea, sin abrir el registro («Tomar» una tarea; tercera pasada de UX, 3.2)
  accion?: ReactNode
  // en filas (S02): el verbo que abre la entrada («Revisar y aprobar», «Triar alerta») y los chips de estado y situación junto al
  // título; el ícono, si no, el de su tono
  verbo?: string
  chips?: ReactNode
  icono?: LucideIcon
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
  // «borde» (la de siempre: borde izquierdo del tono) o «filas», las de «Lo que me toca hoy» de S02: ícono del tono, título en
  // negrita con sus chips, motivo debajo y un verbo a la derecha, separadas por una línea
  variante?: 'borde' | 'filas'
  // en filas: el verbo de la primera entrada es la primaria de la pantalla (una sola por contexto, design-system.md §5.3)
  primeraPrimaria?: boolean
}

const ICONO: Record<TonoDeEntrada, LucideIcon> = { danger: AlertTriangle, warning: Clock, neutral: CircleDot }
const TINTA: Record<TonoDeEntrada, string> = { danger: 'text-sg-danger', warning: 'text-sg-warning', neutral: 'text-sg-text-secondary' }

const BORDE: Record<TonoDeEntrada, string> = {
  danger: 'border-sg-danger',
  warning: 'border-sg-warning-border',
  neutral: 'border-sg-border'
}

export function ListaPriorizada({ titulo, total, entradas, limite = 3, verTodos, vacio, variante = 'borde', primeraPrimaria = false }: PropsDeListaPriorizada) {
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
          {variante === 'filas' ? (
            <ul className="divide-y divide-sg-border-subtle">
              {visibles.map((e, i) => (
                <FilaDeTrabajo key={e.clave} entrada={e} primaria={primeraPrimaria && i === 0} />
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {visibles.map((e) => (
                <li key={e.clave} className={cn('flex items-start justify-between gap-3 border-l-4 py-0.5 pl-3', BORDE[e.tono])}>
                  <div className="min-w-0">
                    <EnlaceConRastro
                      to={e.a}
                      className="text-sg-body font-semibold text-sg-text no-underline hover:text-sg-primary-text hover:underline focus-visible:underline"
                    >
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
                  </div>
                  {e.accion ? <div className="shrink-0">{e.accion}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </ResultadoDeLista>
      )}
      {enlace}
    </Seccion>
  )
}

// una fila de trabajo de S02: el ícono de su tono, el título en negrita (el enlace de la entrada) con sus chips, el motivo y cuándo
// debajo, y a la derecha su acción propia («Tomar») o el verbo que la abre; el verbo dice también qué abre
function FilaDeTrabajo({ entrada: e, primaria }: { entrada: EntradaPriorizada; primaria: boolean }) {
  const Icono = e.icono ?? ICONO[e.tono]
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 first:pt-1 last:pb-1 sm:flex-nowrap">
      {/* en el teléfono el verbo baja a su propia línea: el título no se aprieta (M17) */}
      <div className="flex min-w-0 flex-1 items-start gap-3 max-sm:basis-full">
        <Icono aria-hidden data-tono={e.tono} className={cn('mt-0.5 size-5 shrink-0', TINTA[e.tono])} />
        <div className="min-w-0 flex-1 space-y-1">
          <EnlaceConRastro
            to={e.a}
            className="text-sg-body font-bold text-sg-text no-underline hover:text-sg-primary-text hover:underline focus-visible:underline"
          >
            {e.titulo}
          </EnlaceConRastro>
          {e.chips ? (
            <div data-parte="chips" className="flex flex-wrap items-center gap-2">
              {e.chips}
            </div>
          ) : null}
          <p data-parte="motivo" className="text-sg-body-sm text-sg-text-secondary">
            <span>{e.motivo}</span>
            {e.cuando ? (
              <>
                <span aria-hidden> · </span>
                <span>{e.cuando}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
      {e.accion ? (
        <div className="shrink-0 max-sm:w-full max-sm:pl-8">{e.accion}</div>
      ) : e.verbo ? (
        <Button asChild variant={primaria ? 'primary' : 'secondary'} size="sm" className="shrink-0 max-sm:ml-8">
          <EnlaceConRastro to={e.a}>
            {e.verbo}
            <span className="sr-only">: {e.titulo}</span>
          </EnlaceConRastro>
        </Button>
      ) : null}
    </li>
  )
}
