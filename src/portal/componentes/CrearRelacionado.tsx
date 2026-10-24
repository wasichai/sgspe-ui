import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { NS } from '../i18n'
import { MasAcciones } from './Pagina'

// «Crear relacionado» del encabezado de una ficha (revisión de UX, etapa 5): las altas que nacen de este registro, con lo que
// ya se sabe precargado en la ruta (la interacción de origen, el grupo, la queja). solo las que la cuenta puede crear en el
// proyecto: sin ninguna, no se dibuja
export interface AccionRelacionada {
  // el objeto que se crea; con varios (las QCS), basta poder crear uno
  objeto: string | string[]
  etiqueta: string
  // la ruta del alta, con sus parámetros ya codificados
  a: string
}

export function CrearRelacionado({ proyecto, acciones }: { proyecto: string; acciones: AccionRelacionada[] }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const escribe = useEscribeEnProyecto(proyecto)
  const visibles = escribe ? acciones.filter((a) => [a.objeto].flat().some((o) => can(o, 'CREATE'))) : []
  if (visibles.length === 0) return null
  return (
    <MasAcciones etiqueta={t('paginas.crearRelacionado')}>
      {visibles.map((a) => (
        <Link key={a.a} to={a.a} className="rounded-sg-sm px-2.5 py-1.5 text-sm hover:bg-sg-surface-hover">
          {a.etiqueta}
        </Link>
      ))}
    </MasAcciones>
  )
}
