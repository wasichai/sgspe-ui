// el shell propuesto (docs/ux/redesign/02 §3): barra superior de seis controles y navegación con títulos de bloque
import { Insignia, cn } from '../kit/index'
import {
  Bell,
  Ellipsis,
  Menu,
  ChartColumn,
  ChevronDown,
  FileText,
  FolderKanban,
  Handshake,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  MapIcon,
  MessageSquareWarning,
  MessagesSquare,
  Mountain,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Users
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useL } from './idioma'

export type Seccion =
  | 'inicio'
  | 'proyectos'
  | 'territorio'
  | 'grupos'
  | 'relacionamiento'
  | 'compromisos'
  | 'qcs'
  | 'riesgos'
  | 'programas'
  | 'documentos'
  | 'tareas'
  | 'reportes'
  | 'admin'

export function Marco({
  activa,
  proyecto,
  persona,
  ocultas = [],
  insignias = {},
  children
}: {
  activa: Seccion
  proyecto?: string
  persona: string
  ocultas?: Seccion[]
  insignias?: Partial<Record<Seccion, number>>
  children: ReactNode
}) {
  const l = useL()
  const bloques: { titulo?: string; items: { id: Seccion; etiqueta: string; Icono: typeof Bell }[] }[] = [
    { items: [{ id: 'inicio', etiqueta: l('Inicio', 'Home'), Icono: LayoutDashboard }] },
    {
      titulo: l('Proyectos y territorio', 'Projects and territory'),
      items: [
        { id: 'proyectos', etiqueta: l('Proyectos', 'Projects'), Icono: FolderKanban },
        { id: 'territorio', etiqueta: l('Territorio', 'Territory'), Icono: MapIcon }
      ]
    },
    {
      titulo: l('Trabajo con las comunidades', 'Work with communities'),
      items: [
        { id: 'grupos', etiqueta: l('Grupos de interés', 'Stakeholders'), Icono: Users },
        { id: 'relacionamiento', etiqueta: l('Relacionamiento', 'Engagement'), Icono: MessagesSquare },
        { id: 'compromisos', etiqueta: l('Compromisos', 'Commitments'), Icono: Handshake },
        { id: 'qcs', etiqueta: l('Quejas y solicitudes', 'Grievances and requests'), Icono: MessageSquareWarning }
      ]
    },
    {
      titulo: l('Riesgos e inversión social', 'Risks and social investment'),
      items: [
        { id: 'riesgos', etiqueta: l('Riesgos', 'Risks'), Icono: ShieldAlert },
        { id: 'programas', etiqueta: l('Programas sociales', 'Social programs'), Icono: HeartHandshake }
      ]
    },
    {
      titulo: l('Documentos y seguimiento', 'Documents and follow-up'),
      items: [
        { id: 'documentos', etiqueta: l('Documentos', 'Documents'), Icono: FileText },
        { id: 'tareas', etiqueta: l('Tareas', 'Tasks'), Icono: ListChecks },
        { id: 'reportes', etiqueta: l('Reportes', 'Reports'), Icono: ChartColumn }
      ]
    },
    { items: [{ id: 'admin', etiqueta: l('Administración', 'Administration'), Icono: Settings }] }
  ]
  return (
    <div className="min-h-screen bg-sg-bg text-sg-text">
      <header className="flex h-14 items-center gap-3 border-b border-sg-border bg-sg-surface px-4">
        <button type="button" aria-label={l('Menú', 'Menu')} className="-ml-1 rounded-sg-md p-1.5 md:hidden">
          <Menu aria-hidden className="size-5" />
        </button>
        <span className="flex items-center gap-2 font-semibold text-sg-primary-text md:w-56">
          <Mountain aria-hidden className="size-5" /> SGSPE
        </span>
        <button
          type="button"
          className="hidden h-9 w-80 items-center justify-between rounded-sg-md border border-sg-border-strong bg-sg-surface px-3 text-sg-body md:flex"
        >
          <span className="truncate">{proyecto ?? l('Todos mis proyectos', 'All my projects')}</span>
          <ChevronDown aria-hidden className="size-4 text-sg-text-muted" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          aria-label={l('Buscar', 'Search')}
          className="flex h-9 items-center gap-2 rounded-sg-md border border-sg-border bg-sg-surface-sunken px-2.5 text-sg-body-sm text-sg-text-muted lg:w-56 lg:px-3"
        >
          <Search aria-hidden className="size-4" /> <span className="hidden lg:inline">{l('Buscar', 'Search')}</span>
          <kbd className="ml-auto hidden rounded-sg-xs border border-sg-border px-1 font-sg-mono text-sg-caption lg:inline">⌘K</kbd>
        </button>
        <button
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-sg-md border border-dashed border-sg-ai-border bg-sg-ai-soft px-3 text-sg-body-sm font-medium text-sg-ai md:flex"
        >
          <Sparkles aria-hidden className="size-4" /> {l('Preguntar', 'Ask')}
        </button>
        <span className="relative flex size-9 items-center justify-center rounded-sg-md hover:bg-sg-surface-hover">
          <Bell aria-hidden className="size-5 text-sg-text-secondary" />
          <span className="absolute -right-0.5 -top-0.5">
            <Insignia n={2} id="avisos" descripcion={l('2 avisos sin leer', '2 unread notices')} />
          </span>
        </span>
        <button type="button" className="flex items-center gap-2 rounded-sg-md px-2 py-1 hover:bg-sg-surface-hover">
          <span className="flex size-8 items-center justify-center rounded-full bg-sg-primary-soft text-sg-caption font-semibold text-sg-primary-text">
            {persona
              .replace(/\(.*\)/, '')
              .trim()
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </span>
          <span className="hidden text-sg-body-sm lg:inline">{persona}</span>
          <ChevronDown aria-hidden className="hidden size-4 text-sg-text-muted lg:inline" />
        </button>
      </header>
      <div className="flex">
        <nav
          aria-label={l('Secciones', 'Sections')}
          className="hidden min-h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-sg-border bg-sg-surface px-3 py-3 md:block"
        >
          {bloques.map((b, i) => {
            const visibles = b.items.filter((x) => !ocultas.includes(x.id))
            if (!visibles.length) return null
            return (
              <div key={i} className={cn(i > 0 && 'mt-4')}>
                {b.titulo ? <p className="mb-1 px-2 text-sg-overline font-semibold uppercase tracking-wide text-sg-text-muted">{b.titulo}</p> : null}
                <ul className="space-y-0.5">
                  {visibles.map(({ id, etiqueta, Icono }) => (
                    <li key={id}>
                      <a
                        aria-current={id === activa ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2.5 rounded-sg-md px-2 py-1.5 text-sg-body',
                          id === activa ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : 'text-sg-text-secondary hover:bg-sg-surface-hover'
                        )}
                      >
                        <Icono aria-hidden className="size-[18px]" />
                        <span className="flex-1">{etiqueta}</span>
                        {insignias[id] ? <Insignia n={insignias[id]} id={`n-${id}`} descripcion={etiqueta} /> : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
      <nav aria-label={l('Accesos', 'Shortcuts')} className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-sg-border bg-sg-surface md:hidden">
        {[
          [l('Inicio', 'Home'), LayoutDashboard, activa === 'inicio'],
          [l('Tareas', 'Tasks'), ListChecks, activa === 'tareas'],
          [l('Avisos', 'Notices'), Bell, false],
          [l('Más', 'More'), Ellipsis, activa !== 'inicio' && activa !== 'tareas']
        ].map(([e, Icono, on]) => {
          const I = Icono as typeof Bell
          return (
            <a
              key={e as string}
              aria-current={on ? 'page' : undefined}
              className={cn('flex flex-col items-center gap-0.5 py-2 text-sg-caption', on ? 'font-medium text-sg-primary-text' : 'text-sg-text-secondary')}
            >
              <I aria-hidden className="size-5" />
              {e as string}
            </a>
          )
        })}
      </nav>
    </div>
  )
}

// la sub-navegación del proyecto en una sola fila (DD-03), con su pestaña siempre marcada
export function PestanasDelProyecto({ activa, conteos = {} }: { activa: string; conteos?: Record<string, [number, number?]> }) {
  const l = useL()
  const pestanas = [
    ['overview', l('Resumen', 'Overview')],
    ['map', l('Mapa', 'Map')],
    ['stakeholders', l('Grupos de interés', 'Stakeholders')],
    ['engagements', l('Relacionamiento', 'Engagement')],
    ['commitments', l('Compromisos', 'Commitments')],
    ['attention', 'QCS'],
    ['risks', l('Riesgos', 'Risks')],
    ['programs', l('Programas', 'Programs')],
    ['documents', l('Documentos', 'Documents')]
  ]
  return (
    <nav
      aria-label={l('Secciones del proyecto', 'Project sections')}
      className="-mx-4 flex items-end gap-1 overflow-x-auto border-b border-sg-border px-4 md:mx-0 md:px-0"
    >
      {pestanas.map(([id, etiqueta]) => {
        const [total, accion] = conteos[id] ?? []
        return (
          <a
            key={id}
            aria-current={id === activa ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sg-body',
              id === activa ? 'border-sg-primary font-medium text-sg-text' : 'border-transparent text-sg-text-secondary hover:text-sg-text'
            )}
          >
            {etiqueta}
            {total !== undefined ? <span className="tabular-nums text-sg-caption text-sg-text-muted">{total}</span> : null}
            {accion ? <span className="rounded-full bg-sg-danger px-1.5 text-sg-overline font-semibold tabular-nums text-sg-on-critical">{accion}</span> : null}
          </a>
        )
      })}
      <a className="flex items-center gap-1 px-3 py-2 text-sg-body text-sg-text-secondary">
        {l('Más', 'More')} <ChevronDown aria-hidden className="size-4" />
      </a>
    </nav>
  )
}

// las migas del proyecto: dicen el nombre del módulo, nunca el segmento de la ruta (U-04)
export function MigasDelProyecto({ modulo, registro, estado }: { modulo?: string; registro?: string; estado?: ReactNode }) {
  const l = useL()
  return (
    <div className="mb-2 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-sg-caption text-sg-text-muted">
      <a className="hover:underline">{l('Proyectos', 'Projects')}</a>/<a className="hover:underline">DEMO-T1 · Proyecto Wayra Ejemplo</a>
      {modulo ? (
        <>
          /<a className="hover:underline">{modulo}</a>
        </>
      ) : null}
      {registro ? (
        <>
          /<span className="font-medium text-sg-text-secondary">{registro}</span>
        </>
      ) : null}
      {estado}
    </div>
  )
}
