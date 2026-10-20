import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { NS } from '../i18n'
import { ITEM_DE_MENU, MasAcciones } from './Pagina'

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

// las que la cuenta puede crear en el proyecto
export function useRelacionadas(proyecto: string, acciones: AccionRelacionada[]): AccionRelacionada[] {
  const { can } = useAuth()
  const escribe = useEscribeEnProyecto(proyecto)
  return escribe ? acciones.filter((a) => [a.objeto].flat().some((o) => can(o, 'CREATE'))) : []
}

export function CrearRelacionado({ proyecto, acciones }: { proyecto: string; acciones: AccionRelacionada[] }) {
  const { t } = useTranslation(NS)
  const visibles = useRelacionadas(proyecto, acciones)
  if (visibles.length === 0) return null
  return (
    <MasAcciones etiqueta={t('paginas.crearRelacionado')}>
      <ItemsRelacionados acciones={visibles} />
    </MasAcciones>
  )
}

// las altas relacionadas dentro de otro menú («Más acciones» de una ficha con muchas acciones, rediseño de UX, 2026-10-20)
export function ItemsRelacionados({ acciones }: { acciones: AccionRelacionada[] }) {
  return (
    <>
      {acciones.map((a) => (
        <Link key={a.a} to={a.a} className={ITEM_DE_MENU}>
          {a.etiqueta}
        </Link>
      ))}
    </>
  )
}
