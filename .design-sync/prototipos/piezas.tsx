// los componentes nuevos del rediseño (docs/ux/redesign/05), en versión de prototipo: componen primitivos reales del kit.
// la versión del producto se escribe con pruebas en src/portal/componentes (plan de implementación, tareas 2 a 9)
import { Button, cn, MasAcciones } from '../kit/index'
import { ChevronDown, Lock, X } from 'lucide-react'
import type { ReactNode } from 'react'

// Seccion: la superficie con título de toda página (reemplaza las tarjetas escritas a mano). anidada, pierde el borde
export function Seccion({
  titulo,
  descripcion,
  acciones,
  children,
  anidada,
  className
}: {
  titulo?: ReactNode
  descripcion?: ReactNode
  acciones?: ReactNode
  children: ReactNode
  anidada?: boolean
  className?: string
}) {
  return (
    <section className={cn(anidada ? '' : 'rounded-sg-lg border border-sg-border bg-sg-surface p-4', className)}>
      {titulo || acciones ? (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {titulo ? <h2 className="text-sg-h3 font-semibold text-sg-text">{titulo}</h2> : null}
            {descripcion ? <p className="mt-0.5 text-sg-body-sm text-sg-text-secondary">{descripcion}</p> : null}
          </div>
          {acciones ? <div className="flex shrink-0 items-center gap-2">{acciones}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

// CabeceraDeFicha: la regla de la acción principal (DD-02). la primaria es la siguiente acción; si está bloqueada, su
// motivo va debajo; hasta dos secundarias; lo destructivo, en «Más acciones»
export function CabeceraDeFicha({
  antetitulo,
  titulo,
  chips,
  primaria,
  bloqueo,
  secundarias = [],
  mas = [],
  volver
}: {
  antetitulo: ReactNode
  titulo: string
  chips?: ReactNode
  primaria?: { etiqueta: string; deshabilitada?: boolean }
  bloqueo?: ReactNode
  secundarias?: string[]
  mas?: { etiqueta: string; destructiva?: boolean }[]
  volver?: ReactNode
}) {
  return (
    <header className="space-y-1">
      {volver ? <p className="text-sg-body-sm">{volver}</p> : null}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-96 space-y-1">
          <p className="text-sg-caption text-sg-text-muted">{antetitulo}</p>
          <h1 className="text-sg-h1 font-semibold text-sg-text">{titulo}</h1>
          {chips ? <div className="flex flex-wrap items-center gap-2 pt-1 text-sg-body-sm text-sg-text-secondary">{chips}</div> : null}
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 pt-4 md:flex">
          <div className="flex items-center gap-2">
            {secundarias.map((s) => (
              <Button key={s} size="sm" variant="secondary">
                {s}
              </Button>
            ))}
            {mas.length ? (
              <MasAcciones>
                {mas.map((m) => (
                  <button
                    key={m.etiqueta}
                    type="button"
                    className={cn('block w-full px-3 py-2 text-left text-sm hover:bg-sg-surface-hover', m.destructiva && 'text-sg-danger')}
                  >
                    {m.etiqueta}
                  </button>
                ))}
              </MasAcciones>
            ) : null}
            {primaria ? <Button disabled={primaria.deshabilitada}>{primaria.etiqueta}</Button> : null}
          </div>
          {bloqueo ? <p className="max-w-xs text-right text-sg-body-sm text-sg-warning">{bloqueo}</p> : null}
        </div>
      </div>
      {bloqueo ? <p className="text-sg-body-sm text-sg-warning md:hidden">{bloqueo}</p> : null}
      {/* en el teléfono, la acción principal y «Más» en una barra fija sobre la de accesos (e2e/responsivo.spec.ts) */}
      <div className="fixed inset-x-0 bottom-14 z-10 flex items-center gap-2 border-t border-sg-border bg-sg-surface px-4 py-2 md:hidden">
        {secundarias.length || mas.length ? (
          <MasAcciones>
            {[...secundarias.map((s) => ({ etiqueta: s, destructiva: false })), ...mas].map((m) => (
              <button key={m.etiqueta} type="button" className={cn('block w-full px-3 py-2 text-left text-sm', m.destructiva && 'text-sg-danger')}>
                {m.etiqueta}
              </button>
            ))}
          </MasAcciones>
        ) : null}
        {primaria ? (
          <Button className="flex-1" disabled={primaria.deshabilitada}>
            {primaria.etiqueta}
          </Button>
        ) : null}
      </div>
    </header>
  )
}

// SelectorDeVista: las vistas de un módulo con su conteo, en una sola fila (DD-03); el resto, en «Más vistas»
export function SelectorDeVista({ vistas, actual, etiqueta }: { vistas: { id: string; etiqueta: string; n?: number }[]; actual: string; etiqueta: string }) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="inline-flex max-w-full overflow-x-auto whitespace-nowrap rounded-sg-md border border-sg-border bg-sg-surface p-0.5"
    >
      {vistas.map((v) => {
        const activa = v.id === actual
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={activa}
            className={cn(
              'flex items-center gap-1.5 rounded-sg-sm px-3 py-1 text-sg-body-sm',
              activa ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : 'text-sg-text-secondary hover:bg-sg-surface-hover'
            )}
          >
            {v.etiqueta}
            {v.n !== undefined ? <span className="tabular-nums text-sg-caption text-sg-text-muted">{v.n}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

// BarraDeFiltros: vista, búsqueda, filtros frecuentes, «Más filtros» y los chips de lo aplicado (DD-04)
export function BarraDeFiltros({
  vista,
  busqueda,
  filtros,
  aplicados = [],
  masFiltros,
  limpiar
}: {
  vista?: ReactNode
  busqueda: string
  filtros: { etiqueta: string; valor: string }[]
  aplicados?: string[]
  masFiltros: string
  limpiar: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {vista}
        <input
          aria-label={busqueda}
          placeholder={busqueda}
          className="h-8 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-3 text-sg-body-sm placeholder:text-sg-text-muted sm:w-56"
        />
        {filtros.map((f) => (
          <button
            key={f.etiqueta}
            type="button"
            className="hidden h-8 items-center gap-1 rounded-sg-md border border-sg-border-strong bg-sg-surface px-3 text-sg-body-sm text-sg-text md:flex"
          >
            <span className="text-sg-text-muted">{f.etiqueta}:</span> {f.valor}
            <ChevronDown aria-hidden className="size-3.5 text-sg-text-muted" />
          </button>
        ))}
        <Button size="sm" variant="ghost">
          {masFiltros}
        </Button>
      </div>
      {aplicados.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {aplicados.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 rounded-full bg-sg-primary-soft px-2.5 py-0.5 text-sg-caption font-medium text-sg-primary-text"
            >
              {a}
              <X aria-hidden className="size-3" />
            </span>
          ))}
          <button type="button" className="text-sg-caption font-medium text-sg-primary-text hover:underline">
            {limpiar}
          </button>
        </div>
      ) : null}
    </div>
  )
}

// ListaPriorizada: las entradas más urgentes con su motivo y fecha, y «Ver los N» (en lugar de un muro de enlaces)
export function ListaPriorizada({
  titulo,
  total,
  verTodos,
  entradas
}: {
  titulo: string
  total: number
  verTodos: string
  entradas: { titulo: string; motivo: ReactNode; cuando?: string; tono?: 'danger' | 'warning' | 'neutral' }[]
}) {
  const borde = { danger: 'border-sg-danger', warning: 'border-sg-warning', neutral: 'border-sg-border-strong' }
  return (
    <div>
      <h3 className="mb-2 flex items-baseline justify-between text-sg-body font-semibold text-sg-text">
        <span>{titulo}</span>
        <span className="tabular-nums text-sg-body-sm font-normal text-sg-text-muted">{total}</span>
      </h3>
      <ul className="space-y-1.5">
        {entradas.map((e) => (
          <li key={e.titulo} className={cn('border-l-2 py-0.5 pl-3', borde[e.tono ?? 'neutral'])}>
            <a className="block text-sg-body font-medium text-sg-text hover:text-sg-primary-text">{e.titulo}</a>
            <p className="text-sg-body-sm text-sg-text-secondary">
              {e.motivo}
              {e.cuando ? <span className="text-sg-text-muted"> · {e.cuando}</span> : null}
            </p>
          </li>
        ))}
      </ul>
      {total > entradas.length ? <a className="mt-2 inline-block text-sg-body-sm font-medium text-sg-primary-text hover:underline">{verTodos}</a> : null}
    </div>
  )
}

// CampoFecha: dd/mm/aaaa y 24 h, propio del portal y no del navegador (DD-07)
export function CampoFecha({ etiqueta, valor, hora, ayuda }: { etiqueta: string; valor: string; hora?: string; ayuda?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sg-label font-medium text-sg-text">{etiqueta}</span>
      <span className="flex gap-2">
        <span className="flex h-9 w-40 items-center justify-between rounded-sg-md border border-sg-border-strong bg-sg-surface px-3 text-sg-body tabular-nums">
          {valor}
          <span aria-hidden className="text-sg-text-muted">
            ▦
          </span>
        </span>
        {hora ? (
          <span className="flex h-9 w-24 items-center rounded-sg-md border border-sg-border-strong bg-sg-surface px-3 text-sg-body tabular-nums">{hora}</span>
        ) : null}
      </span>
      {ayuda ? <span className="block text-sg-body-sm text-sg-text-muted">{ayuda}</span> : null}
    </label>
  )
}

// EstadoSinAcceso: qué no puede ver, a quién pedirlo y cómo volver (U-09)
export function EstadoSinAcceso({ titulo, porque, pedir, volver }: { titulo: string; porque: string; pedir: string; volver: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-sg-lg border border-sg-border bg-sg-surface p-6 text-center">
      <Lock aria-hidden className="mx-auto size-6 text-sg-text-muted" />
      <h2 className="mt-2 text-sg-h3 font-semibold text-sg-text">{titulo}</h2>
      <p className="mt-1 text-sg-body text-sg-text-secondary">{porque}</p>
      <p className="mt-3 text-sg-body-sm text-sg-text-secondary">{pedir}</p>
      <div className="mt-4">
        <Button variant="secondary">{volver}</Button>
      </div>
    </div>
  )
}
