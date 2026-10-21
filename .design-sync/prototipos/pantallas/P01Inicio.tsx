// P-01 · Inicio «Mi trabajo» (docs/ux/redesign/02 §4): bloques ofrecidos por capacidad, ordenados por urgencia
import { Button, EstadoChip, KpiCard, SituacionDePlazo } from '../../kit/index'
import { CalendarDays, Plus } from 'lucide-react'
import { useL } from '../idioma'
import { Marco } from '../marco'
import { ListaPriorizada, Seccion } from '../piezas'

export function P01() {
  const l = useL()
  return (
    <Marco activa="inicio" persona="Gestión social (demo)" insignias={{ qcs: 9, tareas: 2 }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-sg-h1 font-semibold">{l('Buenos días, Gestión social', 'Good morning, Gestión social')}</h1>
          <p className="text-sg-body text-sg-text-secondary">
            {l(
              'Martes 20 de octubre · 3 cosas vencen esta semana y 1 aprobación espera su decisión.',
              'Tuesday, 20 October · 3 things are due this week and 1 approval awaits your decision.'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary">
            <Plus aria-hidden className="mr-1 size-4" />
            {l('Registrar interacción', 'Log an interaction')}
          </Button>
          <Button size="sm" variant="secondary">
            <Plus aria-hidden className="mr-1 size-4" />
            {l('Registrar QCS', 'Log a grievance or request')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Seccion
            titulo={l('Lo que me toca hoy', 'My work today')}
            descripcion={l('Vencido y por vencer a su cargo, lo más urgente primero.', 'Overdue and due soon, most urgent first.')}
          >
            <ul className="divide-y divide-sg-border-subtle">
              {[
                {
                  t: l('Coordinar la inspección conjunta del canal de Huaylla Alto', 'Coordinate the joint inspection of the Huaylla Alto canal'),
                  tipo: l('Tarea', 'Task'),
                  estado: <SituacionDePlazo valor="VENCIDO" />,
                  meta: l('Venció el 17 oct. · origen: queja DEMO-Q-01', 'Due 17 Oct · from grievance DEMO-Q-01')
                },
                {
                  t: l('Queja DEMO-Q-03 · turno de mano de obra no respetado', 'Grievance DEMO-Q-03 · labour rotation not honoured'),
                  tipo: 'QCS',
                  estado: <SituacionDePlazo valor="POR VENCER" />,
                  meta: l('Resolver hasta el 21 oct. · Media', 'Resolve by 21 Oct · Medium')
                },
                {
                  t: l('Preparar el plan de capacitación de las JASS', 'Prepare the JASS training plan'),
                  tipo: l('Tarea', 'Task'),
                  estado: <SituacionDePlazo valor="POR VENCER" />,
                  meta: l('Vence el 23 oct.', 'Due 23 Oct')
                },
                {
                  t: l('Segundo monitoreo participativo de agua en la época seca', 'Second participatory water monitoring in the dry season'),
                  tipo: l('Compromiso', 'Commitment'),
                  estado: <EstadoChip objeto="commitment" estado="in_progress" />,
                  meta: l('Vence el 31 oct. · falta registrar la entrega', 'Due 31 Oct · delivery not yet logged')
                }
              ].map((f) => (
                <li key={f.t} className="flex items-center gap-3 py-2.5">
                  <span className="w-24 shrink-0 text-sg-caption text-sg-text-muted">{f.tipo}</span>
                  <div className="min-w-0 flex-1">
                    <a className="block truncate text-sg-body font-medium hover:text-sg-primary-text">{f.t}</a>
                    <p className="text-sg-body-sm text-sg-text-secondary">{f.meta}</p>
                  </div>
                  {f.estado}
                </li>
              ))}
            </ul>
            <a className="mt-2 inline-block text-sg-body-sm font-medium text-sg-primary-text hover:underline">
              {l('Ver todo mi trabajo (7)', 'See all my work (7)')}
            </a>
          </Seccion>

          <Seccion titulo={l('Esperan su decisión', 'Awaiting your decision')}>
            <div className="grid gap-4 md:grid-cols-2">
              <ListaPriorizada
                titulo={l('Aprobaciones', 'Approvals')}
                total={1}
                verTodos=""
                entradas={[
                  {
                    titulo: l('Aporte DEMO-AP-01 · Apoyo en especie', 'Contribution DEMO-AP-01 · In-kind support'),
                    motivo: l('S/ 1,400.00 · Campaña de perforación 2026', 'PEN 1,400.00 · 2026 drilling campaign'),
                    cuando: l('desde hoy', 'since today'),
                    tono: 'warning'
                  }
                ]}
              />
              <ListaPriorizada
                titulo={l('Alertas por triar', 'Alerts to triage')}
                total={1}
                verTodos=""
                entradas={[
                  {
                    titulo: l('Convocatoria a bloqueo de la trocha en redes sociales', 'Call to block the access road on social media'),
                    motivo: l('Severidad alta · registrada a mano', 'High severity · logged manually'),
                    cuando: l('hoy, 4:49', 'today, 4:49'),
                    tono: 'danger'
                  }
                ]}
              />
            </div>
          </Seccion>

          <Seccion
            anidada
            titulo={l('Visión ejecutiva', 'Executive view')}
            descripcion={l('Mes en curso · calculado hoy a las 6:00', 'Current month · computed today at 6:00')}
            acciones={
              <Button size="sm" variant="ghost">
                {l('Abrir la revisión completa', 'Open the full review')}
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                titulo={l('Compromisos abiertos', 'Open commitments')}
                indicador={{ code: 'KPI-EXE-02', label: '', available: true, value: 11, unit: l('compromisos', 'commitments') }}
              />
              <KpiCard titulo={l('QCS abiertas', 'Open grievances')} indicador={{ code: 'KPI-EXE-04', label: '', available: true, value: 9, unit: 'QCS' }} />
              <KpiCard
                titulo={l('Riesgos altos o críticos', 'High or critical risks')}
                indicador={{ code: 'KPI-EXE-05', label: '', available: true, value: 3, unit: l('riesgos', 'risks') }}
              />
              <KpiCard
                titulo={l('Alertas activas', 'Active alerts')}
                indicador={{ code: 'KPI-EXE-07', label: '', available: true, value: 1, unit: l('alertas', 'alerts') }}
              />
            </div>
          </Seccion>
        </div>

        <div className="space-y-4">
          <Seccion titulo={l('Agenda de la semana', 'This week')}>
            <ul className="space-y-3">
              {[
                ['mié 21', '10:00', l('Asamblea comunal de Llamapampa', 'Llamapampa community assembly'), l('Local comunal', 'Community hall')],
                [
                  'jue 22',
                  '15:00',
                  l('Reunión con la JASS de Huaylla Alto', 'Meeting with the Huaylla Alto water board'),
                  l('Caserío Huaylla Alto', 'Huaylla Alto')
                ],
                ['vie 23', '09:30', l('Visita al canal principal', 'Visit to the main canal'), l('Tramo Yanaccocha', 'Yanaccocha stretch')]
              ].map(([d, h, t, lugar]) => (
                <li key={t} className="flex gap-3">
                  <span className="w-14 shrink-0 text-center">
                    <span className="block text-sg-caption uppercase text-sg-text-muted">{d.split(' ')[0]}</span>
                    <span className="block text-sg-h3 font-semibold tabular-nums">{d.split(' ')[1]}</span>
                  </span>
                  <div className="min-w-0">
                    <a className="block text-sg-body font-medium hover:text-sg-primary-text">{t}</a>
                    <p className="flex items-center gap-1 text-sg-body-sm text-sg-text-secondary">
                      <CalendarDays aria-hidden className="size-3.5" /> {h} · {lugar}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Seccion>

          <Seccion titulo={l('Mis proyectos', 'My projects')}>
            <a className="block rounded-sg-md p-2 hover:bg-sg-surface-hover">
              <span className="flex items-center justify-between">
                <span className="text-sg-body font-medium">Proyecto Wayra Ejemplo</span>
                <EstadoChip objeto="project" estado="draft" />
              </span>
              <span className="mt-1 flex flex-wrap gap-x-3 text-sg-body-sm text-sg-text-secondary">
                <span>{l('16 actas por redactar', '16 minutes to draft')}</span>
                <span>{l('9 QCS abiertas', '9 open grievances')}</span>
                <span className="text-sg-danger">{l('3 riesgos altos', '3 high risks')}</span>
              </span>
            </a>
          </Seccion>
        </div>
      </div>
    </Marco>
  )
}
