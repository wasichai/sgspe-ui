import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BotonCrear } from '../componentes/BotonCrear'
import { Seccion } from '../componentes/Seccion'
import { useMisAsignaciones, vigenciaDeAsignacion } from '../contexto/proyectos'
import { NS } from '../i18n'

// los atajos de creación del inicio (S02, revisión de UX, etapa 2): lo que la cuenta registra a menudo, según sus permisos.
// BotonCrear pide el proyecto entre los que puede escribir, o va directo si hay uno; un proyecto nuevo no lo necesita
const QCS = ['grievance', 'inquiry', 'stakeholder_request'] as const
const ATAJOS = [
  { clave: 'interaccion', objeto: ['engagement'], resto: 'engagements/new' },
  { clave: 'qcs', objeto: QCS, resto: 'attention/new' },
  { clave: 'compromiso', objeto: ['commitment'], resto: 'commitments/new' }
] as const

// lo que la cuenta puede crear desde el inicio: los atajos ofrecidos y si crea proyectos. sin una asignación vigente (y sin
// administrar) no hay proyecto donde registrar: los atajos no se ofrecen y el inicio dice a quién pedirla (tercera pasada de UX,
// 3.1). mientras las asignaciones se leen, se ofrecen: BotonCrear espera a saber dónde
export function useAtajos() {
  const { can, isAdmin } = useAuth()
  const asignaciones = useMisAsignaciones()
  const sinDonde = !isAdmin && asignaciones.isSuccess && !(asignaciones.data ?? []).some((a) => vigenciaDeAsignacion(a) === 'vigente')
  const crea = ATAJOS.filter((a) => a.objeto.some((o) => can(o, 'CREATE')))
  return { ofrecidos: sinDonde ? [] : crea, sinDonde: sinDonde && crea.length > 0, proyecto: can('project', 'CREATE') }
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

// lo que se consulta a menudo y no tiene sección propia (tercera pasada de UX, 3.1): el monitoreo de la Tabla 9.5 y el catálogo de
// indicadores, que antes iban en el encabezado del inicio con el peso de una acción. a quien lee indicator o
// indicator_measurement, el monitoreo; a quien lee indicator, el catálogo
export function Consultas() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const conCatalogo = can('indicator', 'READ')
  const conMonitoreo = conCatalogo || can('indicator_measurement', 'READ')
  if (!conMonitoreo) return null
  return (
    <section aria-labelledby="consultas" className="space-y-2">
      <h2 id="consultas" className="text-sg-h3 font-semibold">
        {t('miDia.consultas.titulo')}
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary">
          <Link to="/dashboards/monitoring">{t('tablerosF8.monitoreo.titulo')}</Link>
        </Button>
        {conCatalogo ? (
          <Button asChild size="sm" variant="secondary">
            <Link to="/dashboards/indicators">{t('tablerosF8.catalogo.titulo')}</Link>
          </Button>
        ) : null}
      </div>
    </section>
  )
}

// sin una asignación vigente, el inicio dice por qué no hay dónde registrar y a quién pedirla, con la misma frase que el resto del
// portal (comun.codigos.NOT_ASSIGNED)
export function SinAsignacion() {
  const { t } = useTranslation(NS)
  const { sinDonde } = useAtajos()
  if (!sinDonde) return null
  return <Seccion titulo={t('miDia.sinAsignacion.titulo')} descripcion={t('miDia.sinAsignacion.texto')} />
}
