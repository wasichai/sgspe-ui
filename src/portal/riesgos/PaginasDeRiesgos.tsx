import { useTranslation } from 'react-i18next'
import { SelectorDePagina } from '../componentes/SelectorDeVista'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'

// las páginas de Riesgos en un solo selector (DD-03, U-20): el registro y la matriz, la alerta temprana, las señales, las menciones,
// los impactos, los incidentes y las reglas. antes vivían en «Más» del registro, sin subnavegación visible desde las demás.
// cada una conserva su ruta (rutasEnProyecto.ts; los incidentes viven en /incidents). fuera de un proyecto solo existen el
// registro y las reglas de la organización. la cuenta las ve como antes las veía en «Más»: cada página dice si no puede leerla
export type PaginaDeRiesgos = 'registro' | 'warnings' | 'signals' | 'mentions' | 'impacts' | 'incidents' | 'rules'

const EN_PROYECTO: { id: PaginaDeRiesgos; resto: string }[] = [
  { id: 'registro', resto: 'risks' },
  { id: 'warnings', resto: 'risks/warnings' },
  { id: 'signals', resto: 'risks/signals' },
  { id: 'mentions', resto: 'risks/mentions' },
  { id: 'impacts', resto: 'risks/impacts' },
  { id: 'incidents', resto: 'incidents' },
  { id: 'rules', resto: 'risks/rules' }
]
const GLOBALES: PaginaDeRiesgos[] = ['registro', 'rules']

export function PaginasDeRiesgos({ actual }: { actual: PaginaDeRiesgos }) {
  const { t } = useTranslation(NS)
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
  const paginas = EN_PROYECTO.filter((p) => proyecto || GLOBALES.includes(p.id)).map((p) => ({
    id: p.id,
    etiqueta: p.id === 'registro' ? t('riesgos.vistas.registro') : t(`riesgos.mas.${p.id}`),
    a: `${base}/${p.resto}`
  }))
  return <SelectorDePagina etiqueta={t('comun.selectorDePagina.etiqueta', { modulo: t('secciones.risks') })} paginas={paginas} actual={actual} />
}
