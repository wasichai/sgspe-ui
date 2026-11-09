import { unir } from './clases'
import { rotuloDeOpcion } from '../datos/opciones'
import { ordinalDeNivel } from '../riesgos/niveles'

// la insignia de nivel con barras (design-system.md §4.3 y §5.3): riesgo, severidad de una alerta o de una queja y prioridad. cuatro
// barras de 5, 8, 11 y 14 px con las del nivel llenas, además del color y la palabra (nunca solo color). el riesgo y la severidad van
// sobre el relleno de su nivel (--sg-risk-*: MEDIO ámbar, CRITICO sólido); la prioridad, con las mismas barras en primario y sin color
// de riesgo. sin un nivel conocido, el valor tal cual o «—»
export type EscalaDeNivel = 'riesgo' | 'prioridad'

const RELLENO_DE_RIESGO: Record<1 | 2 | 3 | 4, { caja: string; barra: string }> = {
  1: { caja: 'bg-sg-risk-low border-sg-success text-sg-text', barra: 'bg-sg-text outline-sg-text' },
  2: { caja: 'bg-sg-risk-medium border-sg-level-medium-border text-sg-level-medium-ink', barra: 'bg-sg-level-medium-ink outline-sg-level-medium-ink' },
  3: { caja: 'bg-sg-risk-high border-sg-level-high-border text-sg-level-high-ink', barra: 'bg-sg-level-high-ink outline-sg-level-high-ink' },
  4: { caja: 'bg-sg-risk-critical border-sg-risk-critical text-sg-on-critical', barra: 'bg-sg-on-critical outline-sg-on-critical' }
}
const PRIORIDAD = { caja: 'bg-sg-surface border-sg-border-strong text-sg-text', barra: 'bg-sg-primary outline-sg-primary' }
const ALTOS = ['h-1.25', 'h-2', 'h-2.75', 'h-3.5']

export function Nivel({
  valor,
  nombre,
  rotulo,
  escala = 'riesgo',
  className
}: {
  valor: unknown
  // qué mide («Severidad», «Prioridad»): el nombre accesible es «<nombre>: <rótulo>»
  nombre?: string
  // el rótulo visible; por defecto, el de la opción («Muy alta»)
  rotulo?: string
  escala?: EscalaDeNivel
  className?: string
}) {
  const ordinal = ordinalDeNivel(valor)
  if (typeof valor !== 'string' || valor === '') return <span className="text-sg-text-muted">—</span>
  const texto = rotulo ?? rotuloDeOpcion(valor)
  if (!ordinal) return <span className={className}>{texto}</span>
  const relleno = escala === 'prioridad' ? PRIORIDAD : RELLENO_DE_RIESGO[ordinal]
  return (
    <span
      data-nivel={valor}
      aria-label={nombre ? `${nombre}: ${texto}` : undefined}
      className={unir(
        'inline-flex h-6 items-center gap-1.75 whitespace-nowrap rounded-sg-md border pr-1.75 pl-1.25 text-sg-caption font-extrabold tracking-wider uppercase',
        relleno.caja,
        className
      )}
    >
      <span aria-hidden className="inline-flex h-3.5 items-end gap-0.5">
        {ALTOS.map((alto, i) => (
          <i
            key={alto}
            data-barra={i < ordinal ? 'llena' : 'vacia'}
            className={unir('block w-1 rounded-sg-xs outline -outline-offset-1', alto, i < ordinal ? relleno.barra : 'bg-sg-border outline-sg-border-strong')}
          />
        ))}
      </span>
      {texto}
    </span>
  )
}

// la postura de un grupo de interés (design-system.md §5.3): un círculo de 12 px de su color con contorno y el valor en 13/700, que
// puede ir en dos líneas en una tabla
const COLOR_DE_POSTURA: Record<string, string> = {
  'A FAVOR': 'bg-sg-stance-favor',
  NEUTRAL: 'bg-sg-stance-neutral',
  'EN CONTRA PERO ABIERTO A ESCUCHAR': 'bg-sg-stance-open',
  'EN CONTRA': 'bg-sg-stance-against'
}

export function Postura({ valor, className }: { valor: unknown; className?: string }) {
  if (typeof valor !== 'string' || valor === '') return <span className="text-sg-text-muted">—</span>
  return (
    <span data-postura={valor} className={unir('inline-flex items-start gap-1.75 text-sg-caption font-bold tracking-wide', className)}>
      <span
        aria-hidden
        className={unir(
          'mt-0.5 inline-block size-3 flex-none rounded-full outline -outline-offset-1 outline-sg-border-strong',
          Object.hasOwn(COLOR_DE_POSTURA, valor) ? COLOR_DE_POSTURA[valor] : 'bg-sg-surface-sunken'
        )}
      />
      {rotuloDeOpcion(valor)}
    </span>
  )
}
