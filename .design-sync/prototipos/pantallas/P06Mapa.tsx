// P-06 · visualización geográfica: el mapa primero, capas y lista como paneles plegables (DD-11)
import { Button } from '../../kit/index'
import { Layers, List, Minus, Plus, X } from 'lucide-react'
import { useL } from '../idioma'
import { Marco } from '../marco'

export function P06() {
  const l = useL()
  const lugares = [
    [210, 170],
    [280, 170],
    [350, 230],
    [420, 230],
    [490, 230],
    [560, 230],
    [630, 230],
    [210, 290],
    [280, 290],
    [350, 350],
    [420, 350],
    [700, 300],
    [770, 300]
  ]
  return (
    <Marco activa="territorio" persona="Gestión social (demo)">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sg-h1 font-semibold">{l('Territorio', 'Territory')}</h1>
          <p className="text-sg-body-sm text-sg-text-secondary">{l('Todo el territorio · 13 lugares visibles', 'Whole territory · 13 places in view')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary">
            {l('Tablero territorial', 'Territory dashboard')}
          </Button>
          <Button size="sm" variant="secondary">
            {l('Exportar…', 'Export…')}
          </Button>
        </div>
      </div>
      <div className="relative h-[680px] overflow-hidden rounded-sg-lg border border-sg-border" style={{ background: 'var(--sg-map-ground)' }}>
        <svg viewBox="0 0 1000 680" className="absolute inset-0 size-full" aria-label={l('Mapa del territorio', 'Territory map')}>
          <path d="M120 80 L640 60 L760 160 L820 420 L560 560 L180 520 Z" className="fill-sg-territory-soft stroke-sg-territory-border" strokeWidth="2" />
          <path d="M300 120 L470 110 L520 260 L330 300 Z" className="fill-sg-primary-soft stroke-sg-primary" strokeWidth="2" strokeDasharray="6 4" />
          <path d="M140 400 C 300 360, 500 420, 900 380" fill="none" className="stroke-sg-border-strong" strokeWidth="3" />
          {lugares.map(([x, y], i) => (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={i === 3 ? 11 : 7}
                className={i === 3 ? 'fill-sg-primary stroke-sg-surface' : 'fill-sg-danger stroke-sg-surface'}
                strokeWidth="2"
              />
            </g>
          ))}
          <text x="360" y="200" className="fill-sg-text text-[13px] font-semibold">
            Caserío Huaylla Alto
          </text>
        </svg>
        <div className="absolute left-3 top-3 w-72 rounded-sg-lg border border-sg-border bg-sg-surface-raised p-3 shadow-sg-md">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sg-body font-semibold">
              <Layers aria-hidden className="size-4" /> {l('Capas · 3', 'Layers · 3')}
            </span>
            <X aria-hidden className="size-4 text-sg-text-muted" />
          </div>
          {[
            [l('Centros poblados', 'Settlements'), true, 'var(--sg-danger)'],
            [l('Territorio comunal', 'Communal land'), true, 'var(--sg-territory)'],
            [l('Área de influencia', 'Area of influence'), true, 'var(--sg-primary)'],
            [l('Quejas y solicitudes', 'Grievances and requests'), false, 'var(--sg-data-2)'],
            [l('Compromisos', 'Commitments'), false, 'var(--sg-data-1)']
          ].map(([e, on, c]) => (
            <label key={e as string} className="flex items-center gap-2 py-1 text-sg-body-sm">
              <input type="checkbox" defaultChecked={on as boolean} />
              <span className="size-2.5 rounded-full" style={{ background: c as string }} />
              {e as string}
            </label>
          ))}
          <button type="button" className="mt-1 text-sg-body-sm font-medium text-sg-primary-text">
            {l('Todas las capas (24)', 'All layers (24)')}
          </button>
        </div>
        <div className="absolute right-3 top-3 w-80 rounded-sg-lg border border-sg-border bg-sg-surface-raised p-4 shadow-sg-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sg-caption text-sg-text-muted">{l('Centro poblado · Caserío', 'Settlement · Hamlet')}</p>
              <h2 className="text-sg-h3 font-semibold">Caserío Huaylla Alto</h2>
            </div>
            <X aria-hidden className="size-4 text-sg-text-muted" />
          </div>
          <ul className="mt-3 divide-y divide-sg-border-subtle text-sg-body-sm">
            {[
              [l('Grupos de interés', 'Stakeholders'), '12'],
              [l('Interacciones del año', 'Interactions this year'), '18'],
              [l('Quejas y solicitudes abiertas', 'Open grievances and requests'), '2'],
              [l('Compromisos abiertos', 'Open commitments'), '3']
            ].map(([e, n]) => (
              <li key={e} className="flex justify-between py-2">
                <a className="hover:text-sg-primary-text">{e}</a>
                <span className="tabular-nums font-medium">{n}</span>
              </li>
            ))}
          </ul>
          <Button size="sm" className="mt-3 w-full">
            {l('Abrir la ficha del lugar', 'Open place record')}
          </Button>
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="rounded-sg-md border border-sg-border bg-sg-surface-raised px-2 py-1 text-sg-caption text-sg-text-secondary">
            {l('Sin mapa base · se configura en Administración', 'No base map · set it up in Administration')}
          </span>
          <span className="rounded-sg-md border border-sg-border bg-sg-surface-raised px-2 py-1 font-sg-mono text-sg-caption">1 km</span>
        </div>
        <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-sg-md border border-sg-border bg-sg-surface-raised">
          <button type="button" aria-label={l('Acercar', 'Zoom in')} className="p-2">
            <Plus aria-hidden className="size-4" />
          </button>
          <button type="button" aria-label={l('Alejar', 'Zoom out')} className="border-t border-sg-border p-2">
            <Minus aria-hidden className="size-4" />
          </button>
          <button type="button" aria-label={l('Lista de lugares', 'Places list')} className="border-t border-sg-border p-2">
            <List aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-sg-caption text-sg-text-muted">
        {l(
          'Mapa ilustrativo del prototipo: en el portal es MapLibre con las capas públicas por el proxy WMS.',
          'Prototype map is illustrative: the portal uses MapLibre with public layers through the WMS proxy.'
        )}
      </p>
    </Marco>
  )
}
