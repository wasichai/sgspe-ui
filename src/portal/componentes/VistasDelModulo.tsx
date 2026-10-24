import { useContextFilters } from '../shell/context'
import { cn } from '@wasichai/ui'
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
    <nav aria-label={t('paginas.vistasDelModulo.titulo')} className="inline-flex rounded-sg-md border border-sg-border p-0.5 text-sm">
      {(['lista', 'tablero'] as const).map((vista) => {
        const resto = RUTAS[modulo][vista]
        return (
          <Link
            key={vista}
            to={`${base}/${resto}`}
            aria-current={vista === actual ? 'page' : undefined}
            className={cn(
              'rounded-sg-sm px-2.5 py-1',
              vista === actual ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : 'text-sg-text-secondary hover:bg-sg-surface-hover'
            )}
          >
            {t(`paginas.vistasDelModulo.${vista}`)}
          </Link>
        )
      })}
    </nav>
  )
}
