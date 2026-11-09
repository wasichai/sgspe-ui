import { useContextFilters } from '../shell/context'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NS } from '../i18n'

// «Lista · Tablero» (revisión de UX, etapa 7): cada módulo aterriza en su lista de trabajo y su tablero es otra vista del mismo
// módulo, en el mismo lugar del encabezado, con el alcance de la barra (el proyecto o todos). sin tablero disponible, la lista
// no lo ofrece
export type ModuloConTablero = 'stakeholders' | 'engagements' | 'commitments' | 'attention' | 'programs' | 'risks'

const RUTAS: Record<ModuloConTablero, { lista: string; tablero: string }> = {
  stakeholders: { lista: 'stakeholders', tablero: 'stakeholders/dashboard' },
  engagements: { lista: 'engagements', tablero: 'engagements/dashboard' },
  commitments: { lista: 'commitments', tablero: 'commitments/dashboard' },
  attention: { lista: 'attention', tablero: 'attention/dashboard' },
  programs: { lista: 'programs', tablero: 'programs/dashboard' },
  risks: { lista: 'risks', tablero: 'risks/dashboard' }
}

export function VistasDelModulo({ modulo, actual, conTablero = true }: { modulo: ModuloConTablero; actual: 'lista' | 'tablero'; conTablero?: boolean }) {
  const { t } = useTranslation(NS)
  const { scope } = useContextFilters()
  if (!conTablero && actual === 'lista') return null
  const base = scope.kind === 'project' ? `/projects/${encodeURIComponent(scope.projectId)}` : ''
  return (
    // como las pestañas de design-system.md §5.3: la fila con borde inferior de 2 px border; cada vista de 15 px 600
    // text-secondary y la actual en primary-text 800 con un borde inferior de 4 px primary, montado sobre el de la fila
    <nav aria-label={t('paginas.vistasDelModulo.titulo')} className="inline-flex border-b-2 border-sg-border">
      {(['lista', 'tablero'] as const).map((vista) => {
        const resto = RUTAS[modulo][vista]
        return (
          <Link
            key={vista}
            to={`${base}/${resto}`}
            aria-current={vista === actual ? 'page' : undefined}
            // sin cn: tailwind-merge confunde el tamaño text-sg-body con un color
            className={`-mb-0.5 inline-flex min-h-8 items-center border-b-4 px-4 py-1.5 text-sg-body ${
              vista === actual
                ? 'border-sg-primary font-extrabold text-sg-primary-text'
                : 'border-transparent font-semibold text-sg-text-secondary hover:text-sg-text'
            }`}
          >
            {t(`paginas.vistasDelModulo.${vista}`)}
          </Link>
        )
      })}
    </nav>
  )
}
