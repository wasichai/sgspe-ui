// P-03 · ficha 360 del proyecto: estado, lo que amenaza al proyecto priorizado y el paisaje social, sin muros de enlaces
import { Button, EstadoChip } from '../../kit/index'
import { useL } from '../idioma'
import { Marco, MigasDelProyecto, PestanasDelProyecto } from '../marco'
import { ListaPriorizada, Seccion } from '../piezas'

function Cifra({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle: string; tono?: 'danger' | 'warning' }) {
  return (
    <a className="block rounded-sg-md p-3 hover:bg-sg-surface-hover">
      <span className="block text-sg-overline font-semibold uppercase tracking-wide text-sg-text-muted">{titulo}</span>
      <span className={`block text-sg-kpi font-semibold tabular-nums ${tono === 'danger' ? 'text-sg-danger' : tono === 'warning' ? 'text-sg-warning' : ''}`}>
        {valor}
      </span>
      <span className="block text-sg-body-sm text-sg-text-secondary">{detalle}</span>
    </a>
  )
}

export function P03() {
  const l = useL()
  const posturas = [
    ['--sg-stance-favor', 23, l('A favor', 'In favour')],
    ['--sg-stance-neutral', 29, l('Neutral', 'Neutral')],
    ['--sg-stance-open', 25, l('En contra, abierta a escuchar', 'Against, open to listen')],
    ['--sg-stance-against', 8, l('En contra', 'Against')]
  ] as const
  return (
    <Marco activa="proyectos" proyecto="DEMO-T1 · Proyecto Wayra Ejemplo" persona="Jefatura del proyecto (demo)" insignias={{ qcs: 3 }}>
      <MigasDelProyecto />
      <PestanasDelProyecto
        activa="overview"
        conteos={{ stakeholders: [85], engagements: [100, 16], commitments: [12, 1], attention: [11, 3], risks: [5, 3], programs: [1], documents: [4] }}
      />
      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sg-caption text-sg-text-muted">
            {l('Proyecto · DEMO-T1 · Minería · Exploración inicial', 'Project · DEMO-T1 · Mining · Early exploration')}
          </p>
          <h1 className="text-sg-h1 font-semibold">Proyecto Wayra Ejemplo</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sg-body-sm text-sg-text-secondary">
            <EstadoChip objeto="project" estado="draft" />
            {l('Jefatura: Jefatura del proyecto (demo) · Campaña de perforación 2026', 'Lead: Jefatura del proyecto (demo) · 2026 drilling campaign')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary">
            {l('Ver en el mapa', 'View on map')}
          </Button>
          <Button>{l('Enviar a aprobación', 'Submit for approval')}</Button>
        </div>
      </header>

      <div className="mt-4 grid gap-1 rounded-sg-lg border border-sg-border bg-sg-surface p-1 sm:grid-cols-3 xl:grid-cols-5">
        <Cifra titulo={l('QCS fuera de plazo', 'Grievances overdue')} valor="0" detalle={l('9 abiertas · 3 vencen esta semana', '9 open · 3 due this week')} />
        <Cifra titulo={l('Riesgos altos', 'High risks')} valor="3" detalle={l('las 3 con revisión vencida', 'all 3 overdue for review')} tono="danger" />
        <Cifra
          titulo={l('Compromisos vencidos', 'Overdue commitments')}
          valor="1"
          detalle={l('11 abiertos · S/ 32,700', '11 open · PEN 32,700')}
          tono="warning"
        />
        <Cifra titulo={l('Reuniones del mes', 'Meetings this month')} valor="0 / 2" detalle={l('meta del proyecto', 'project target')} />
        <Cifra titulo={l('Actas por redactar', 'Minutes to draft')} valor="16" detalle={l('la más antigua, de mayo', 'oldest from May')} tono="warning" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Seccion
          titulo={l('Qué requiere atención', 'What needs attention')}
          descripcion={l('Lo más urgente de cada grupo, con su motivo.', 'The most urgent item in each group, with why.')}
        >
          <div className="grid gap-5 md:grid-cols-3">
            <ListaPriorizada
              titulo={l('Riesgos sin revisar', 'Risks to review')}
              total={3}
              verTodos={l('Ver los 3', 'See all 3')}
              entradas={[
                {
                  titulo: l('Bloqueo de la trocha durante la campaña', 'Road block during the campaign'),
                  motivo: l('Alto · revisión vencida', 'High · review overdue'),
                  cuando: '17 set.',
                  tono: 'danger'
                },
                {
                  titulo: l('Reactivación de la comunidad San Isidro', 'San Isidro community reactivation'),
                  motivo: l('Medio · revisión vencida', 'Medium · review overdue'),
                  cuando: '17 set.',
                  tono: 'warning'
                }
              ]}
            />
            <ListaPriorizada
              titulo={l('Actas por redactar', 'Minutes to draft')}
              total={16}
              verTodos={l('Ver las 16', 'See all 16')}
              entradas={[
                {
                  titulo: l('Devolución de hallazgos en Huaylla Alto', 'Findings feedback in Huaylla Alto'),
                  motivo: l('Realizada sin acta', 'Held, no minutes'),
                  cuando: l('hace 5 meses', '5 months ago'),
                  tono: 'warning'
                },
                {
                  titulo: l('Asamblea de Llamapampa', 'Llamapampa assembly'),
                  motivo: l('Realizada sin acta', 'Held, no minutes'),
                  cuando: l('hace 5 meses', '5 months ago'),
                  tono: 'warning'
                }
              ]}
            />
            <ListaPriorizada
              titulo={l('Grupos sin contacto', 'Stakeholders not contacted')}
              total={85}
              verTodos={l('Ver los 85', 'See all 85')}
              entradas={[
                { titulo: 'Teodoro Ccanto Huamaní', motivo: l('Estratégico · nunca contactado', 'Strategic · never contacted'), tono: 'neutral' },
                { titulo: 'Florencio Taipe Yauri', motivo: l('Estratégico · nunca contactado', 'Strategic · never contacted'), tono: 'neutral' }
              ]}
            />
          </div>
        </Seccion>
        <Seccion
          titulo={l('Paisaje de grupos de interés', 'Stakeholder landscape')}
          acciones={
            <Button size="sm" variant="ghost">
              {l('Matriz', 'Matrix')}
            </Button>
          }
        >
          <div className="flex h-3 overflow-hidden rounded-full">
            {posturas.map(([c, n]) => (
              <span key={c} style={{ width: `${(n / 85) * 100}%`, background: `var(${c})` }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-sg-body-sm">
            {posturas.map(([c, n, e]) => (
              <li key={c} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: `var(${c})` }} />
                <span className="flex-1">{e}</span>
                <span className="tabular-nums text-sg-text-secondary">{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sg-caption text-sg-text-muted">{l('85 grupos evaluados · postura vigente', '85 stakeholders assessed · current stance')}</p>
        </Seccion>
      </div>
    </Marco>
  )
}
