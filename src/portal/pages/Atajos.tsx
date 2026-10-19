import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BotonCrear } from '../componentes/BotonCrear'
import { NS } from '../i18n'

// los atajos de creación del inicio (S02, revisión de UX, etapa 2): lo que la cuenta registra a menudo, según sus permisos.
// BotonCrear pide el proyecto entre los que puede escribir, o va directo si hay uno; un proyecto nuevo no lo necesita
const QCS = ['grievance', 'inquiry', 'stakeholder_request'] as const
const ATAJOS = [
  { clave: 'interaccion', objeto: ['engagement'], resto: 'engagements/new' },
  { clave: 'qcs', objeto: QCS, resto: 'attention/new' },
  { clave: 'compromiso', objeto: ['commitment'], resto: 'commitments/new' }
] as const

// lo que la cuenta puede crear desde el inicio: los atajos ofrecidos y si crea proyectos
export function useAtajos() {
  const { can } = useAuth()
  return { ofrecidos: ATAJOS.filter((a) => a.objeto.some((o) => can(o, 'CREATE'))), proyecto: can('project', 'CREATE') }
}

export function Atajos() {
  const { t } = useTranslation(NS)
  const { ofrecidos, proyecto } = useAtajos()
  if (ofrecidos.length === 0 && !proyecto) return null
  return (
    <section aria-labelledby="atajos" className="space-y-2">
      <h2 id="atajos" className="text-sg-h3 font-semibold">
        {t('miDia.atajos.titulo')}
      </h2>
      <div className="flex flex-wrap gap-2">
        {ofrecidos.map((a) => (
          <BotonCrear key={a.clave} objeto={a.objeto} etiqueta={t(`miDia.atajos.${a.clave}`)} resto={a.resto} />
        ))}
        {proyecto ? (
          <Button asChild size="sm" variant="secondary">
            <Link to="/projects/new">
              <Plus aria-hidden className="size-4" />
              {t('miDia.atajos.proyecto')}
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  )
}
