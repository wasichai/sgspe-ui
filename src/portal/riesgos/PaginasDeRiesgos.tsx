import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PestanasDesplazables } from '../componentes/PestanasDesplazables'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'

// las páginas de Riesgos en una sola fila de pestañas (DD-03, U-20; fase 10 de Civic Modern): el registro y la matriz, la alerta
// temprana, los incidentes, las señales, las menciones, los impactos y el tablero. antes competían tres controles en la cabecera
// (el selector de páginas, «Lista · Tablero» y las vistas del registro, que repetía «Registro y matriz»): ahora las páginas son
// esta navegación, debajo del encabezado, y las vistas del registro, el único selector de vista, van en su barra de filtros. las
// reglas de alerta son una acción («Ver reglas de alerta», S10) y no una pestaña más; en ellas ninguna pestaña está elegida. cada
// página conserva su ruta (rutasEnProyecto.ts; los incidentes viven en /incidents). fuera de un proyecto solo existen el registro
// y el tablero. la cuenta las ve como antes: cada página dice si no puede leerla. en una pantalla angosta la fila se desplaza
export type PaginaDeRiesgos = 'registro' | 'warnings' | 'incidents' | 'signals' | 'mentions' | 'impacts' | 'tablero' | 'rules'

const EN_PROYECTO: { id: Exclude<PaginaDeRiesgos, 'rules'>; resto: string }[] = [
  { id: 'registro', resto: 'risks' },
  { id: 'warnings', resto: 'risks/warnings' },
  { id: 'incidents', resto: 'incidents' },
  { id: 'signals', resto: 'risks/signals' },
  { id: 'mentions', resto: 'risks/mentions' },
  { id: 'impacts', resto: 'risks/impacts' },
  { id: 'tablero', resto: 'risks/dashboard' }
]
const GLOBALES: PaginaDeRiesgos[] = ['registro', 'tablero']

// la base de las rutas de Riesgos con el alcance de la barra: la del proyecto o la global
export function useBaseDeRiesgos(): string {
  const { scope } = useContextFilters()
  return scope.kind === 'project' ? `/projects/${encodeURIComponent(scope.projectId)}` : ''
}

export function PaginasDeRiesgos({ actual }: { actual: PaginaDeRiesgos }) {
  const { t } = useTranslation(NS)
  const base = useBaseDeRiesgos()
  const paginas = EN_PROYECTO.filter((p) => base || GLOBALES.includes(p.id))
  return (
    // como las pestañas de design-system.md §5.3: la fila con borde inferior de 2 px; cada página en 15 px 600 text-secondary y la
    // actual en primary-text 800 con un borde inferior de 4 px primary, sobre el de la fila
    <PestanasDesplazables
      etiqueta={t('comun.selectorDePagina.etiqueta', { modulo: t('secciones.risks') })}
      // el borde de la fila es una sombra interior: con el desplazamiento, un margen negativo sobre el borde se recortaría
      filaClassName="flex overflow-x-auto shadow-[inset_0_-2px_0_var(--sg-border)] [scrollbar-width:none]"
    >
      {paginas.map((p) => (
        <Link
          key={p.id}
          to={`${base}/${p.resto}`}
          aria-current={p.id === actual ? 'page' : undefined}
          // sin cn: tailwind-merge confunde el tamaño text-sg-body con un color
          className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap border-b-4 px-4 py-1.5 text-sg-body ${
            p.id === actual
              ? 'border-sg-primary font-extrabold text-sg-primary-text'
              : 'border-transparent font-semibold text-sg-text-secondary hover:text-sg-text'
          }`}
        >
          {t(`riesgos.paginas.${p.id}`)}
        </Link>
      ))}
    </PestanasDesplazables>
  )
}
