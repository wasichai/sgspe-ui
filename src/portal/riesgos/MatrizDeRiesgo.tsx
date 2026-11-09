import { cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Nivel as InsigniaDeNivel } from '../componentes/Nivel'
import { NS, numeroPe } from '../i18n'
import { CLASE_DE_ZONA, NIVELES, type Nivel, type Umbrales } from './niveles'

// la matriz probabilidad × impacto de Civic Modern (S10, design-system.md §6.7): una sola pieza para el registro de riesgos (que
// la usa para filtrar), el tablero de riesgos y el de Proyecto 360 (que solo la leen). filas de probabilidad (5 arriba) y
// columnas de impacto (1 a la izquierda), celdas de 50 px de alto sobre la zona de su nivel (--sg-zone-*), la cifra en 17 px
// 800 y el cero en text-muted; una celda con riesgos lleva un contorno de 2 px y, si es crítica, la cifra sobre el relleno de
// CRITICO. el nivel de cada celda se dice con texto a los lectores de pantalla (nunca solo color). sin nivel conocido (el tablero
// de varios proyectos, cada uno con sus umbrales) la celda va sin zona. la leyenda dice el rango de cada nivel cuando hay
// umbrales; sin ellos, no se inventa
const ESCALA = [1, 2, 3, 4, 5] as const

export interface CeldaDeMatriz {
  // cuántos riesgos tiene; null, sin cifra (el tablero que no la manda)
  n: number | null
  nivel: Nivel | null
}

export function MatrizDeRiesgo({
  etiqueta,
  celda,
  umbrales,
  elegida,
  alElegir
}: {
  // el nombre de la tabla para los lectores de pantalla
  etiqueta: string
  celda: (probabilidad: number, impacto: number) => CeldaDeMatriz
  // los umbrales con que se calcularon los niveles: la leyenda dice el rango de cada uno
  umbrales?: Umbrales
  // «p-i» de la celda elegida (el filtro del registro)
  elegida?: string
  // con él, cada celda es un botón que la elige
  alElegir?: (celda: string) => void
}) {
  const { t } = useTranslation(NS)
  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-1">
        {/* el nombre del eje vertical, girado como en el lienzo; la tabla ya dice a cada celda su probabilidad */}
        <span
          aria-hidden
          className="flex items-center justify-center pt-14 text-sg-caption font-bold text-sg-text-secondary [writing-mode:vertical-rl] rotate-180"
        >
          {t('riesgos.mapa.ejeProbabilidad')}
        </span>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-full max-w-[22rem] table-fixed border-separate border-spacing-0.5 text-center">
            <caption className="sr-only">{etiqueta}</caption>
            {/* los encabezados de impacto van debajo, como en el lienzo, sin dejar de ser los primeros del árbol */}
            <thead className="table-footer-group">
              <tr>
                <td className="w-10" />
                {ESCALA.map((i) => (
                  <th key={i} scope="col" className="h-8 text-sg-caption font-bold text-sg-text-secondary">
                    <span className="sr-only">{t('riesgos.mapa.ejeImpacto')}</span> {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...ESCALA].reverse().map((p) => (
                <tr key={p}>
                  <th scope="row" className="w-10 text-sg-caption font-bold text-sg-text-secondary">
                    <span className="sr-only">{t('riesgos.mapa.ejeProbabilidad')}</span> {p}
                  </th>
                  {ESCALA.map((i) => (
                    <td key={i} className="p-0">
                      <Celda p={p} i={i} valor={celda(p, i)} elegida={elegida === `${p}-${i}`} alElegir={alElegir} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p aria-hidden className="max-w-[22rem] pl-10 text-center text-sg-caption font-bold text-sg-text-secondary">
            {t('riesgos.mapa.ejeImpacto')}
          </p>
        </div>
      </div>
      {umbrales ? <Leyenda umbrales={umbrales} /> : null}
    </div>
  )
}

function Celda({ p, i, valor, elegida, alElegir }: { p: number; i: number; valor: CeldaDeMatriz; elegida: boolean; alElegir?: (celda: string) => void }) {
  const { t } = useTranslation(NS)
  const { n, nivel } = valor
  const conRiesgos = typeof n === 'number' && n > 0
  const rotuloDelNivel = nivel ? t(`tableroRiesgos.niveles.${nivel}`) : null
  const nombre =
    n === null
      ? t('riesgos.mapa.celdaSinCifra', { p, i })
      : rotuloDelNivel
        ? t('riesgos.mapa.celda', { p, i, count: n, nivel: rotuloDelNivel })
        : t('riesgos.mapa.celdaSinNivel', { p, i, count: n })
  const clases = cn(
    'grid h-12.5 w-full place-items-center rounded-sg-xs tabular-nums',
    nivel ? CLASE_DE_ZONA[nivel] : 'bg-sg-surface-sunken',
    conRiesgos ? 'text-sg-h3 font-extrabold text-sg-text outline-2 -outline-offset-2 outline-sg-text' : 'text-sg-body-sm font-medium text-sg-text-muted',
    elegida && 'ring-3 ring-sg-primary ring-offset-2 ring-offset-sg-surface'
  )
  const cifra = (
    <span aria-hidden className={cn(conRiesgos && nivel === 'CRITICO' && 'rounded-sg-md bg-sg-risk-critical px-2 text-sg-on-critical')} data-cifra={n ?? ''}>
      {n === null ? '—' : numeroPe(n)}
    </span>
  )
  if (!alElegir)
    return (
      <div role="img" aria-label={nombre} className={clases}>
        {cifra}
      </div>
    )
  return (
    <button type="button" aria-pressed={elegida} aria-label={nombre} onClick={() => alElegir(`${p}-${i}`)} className={cn(clases, 'hover:brightness-95')}>
      {cifra}
    </button>
  )
}

// los niveles con su rango de puntaje P × I (BAJO 1–4, MEDIO 5–9, ALTO 10–14, CRITICO 15+ con los umbrales por defecto): la insignia
// de barras de cada uno, como en la tabla
function Leyenda({ umbrales }: { umbrales: Umbrales }) {
  const { t } = useTranslation(NS)
  const rangos: Record<Nivel, string> = {
    BAJO: rango(1, umbrales.medio - 1),
    MEDIO: rango(umbrales.medio, umbrales.alto - 1),
    ALTO: rango(umbrales.alto, umbrales.critico - 1),
    CRITICO: `${numeroPe(umbrales.critico)}+`
  }
  return (
    <ul aria-label={t('riesgos.mapa.leyendaDeNiveles')} className="flex flex-wrap gap-2">
      {NIVELES.map((nivel) => (
        <li key={nivel}>
          <InsigniaDeNivel valor={nivel} rotulo={`${t(`tableroRiesgos.niveles.${nivel}`)} ${rangos[nivel]}`} />
        </li>
      ))}
    </ul>
  )
}

const rango = (desde: number, hasta: number) => (hasta <= desde ? numeroPe(desde) : `${numeroPe(desde)}–${numeroPe(hasta)}`)
