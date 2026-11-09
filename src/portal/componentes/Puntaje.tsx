import { useTranslation } from 'react-i18next'
import { NS, numeroPe } from '../i18n'

// la barra de puntaje de S06 (la evaluación de un grupo de interés en su vista previa y en su ficha): el nombre en 110 px, una
// barra de 10 px con borde y fondo hundido llena en primario en proporción, y el valor sobre la escala («4/5») en 700. es un
// medidor (role="meter") con su valor; sin valor no hay medidor: «—», nunca una barra en cero que diría «uno de cinco»
export function BarraDePuntaje({ etiqueta, valor, minimo = 1, maximo = 5 }: { etiqueta: string; valor: unknown; minimo?: number; maximo?: number }) {
  const numero = valor === null || valor === undefined || valor === '' ? Number.NaN : Number(valor)
  const hay = Number.isFinite(numero)
  const proporcion = hay ? Math.min(1, Math.max(0, (numero - minimo) / (maximo - minimo))) : 0
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)_52px] items-center gap-2.5 text-sm">
      <span className="text-sg-text">{etiqueta}</span>
      {hay ? (
        <span
          role="meter"
          aria-label={etiqueta}
          aria-valuenow={numero}
          aria-valuemin={minimo}
          aria-valuemax={maximo}
          aria-valuetext={`${numeroPe(numero)}/${numeroPe(maximo)}`}
          className="block h-2.5 overflow-hidden rounded-sg-xs border border-sg-border-strong bg-sg-surface-sunken"
        >
          <span data-relleno className="block h-full bg-sg-primary" style={{ width: `${Math.round(proporcion * 100)}%` }} />
        </span>
      ) : (
        <span aria-hidden />
      )}
      <b className="text-right font-bold tabular-nums text-sg-text">{hay ? `${numeroPe(numero)}/${numeroPe(maximo)}` : '—'}</b>
    </div>
  )
}

// los asistentes por sexo de S07: dos tramos de 10 px en proporción, mujeres en data-1 y hombres en data-2, con 2 px entre
// ellos. la leyenda va en texto al lado (quien la usa dice «21 mujeres, 17 hombres») y la barra la repite como nombre: el color
// nunca va solo. sin los dos conteos, o con ambos en cero, no hay barra
export function BarraPorSexo({ mujeres, hombres }: { mujeres: number | null | undefined; hombres: number | null | undefined }) {
  const { t } = useTranslation(NS)
  if (typeof mujeres !== 'number' || typeof hombres !== 'number' || mujeres + hombres <= 0) return null
  return (
    <div role="img" aria-label={t('comun.porSexo', { mujeres: numeroPe(mujeres), hombres: numeroPe(hombres) })} className="mt-1 flex h-2.5 gap-0.5">
      {[
        { clave: 'mujeres', n: mujeres, clase: 'rounded-l-sg-xs bg-sg-data-1' },
        { clave: 'hombres', n: hombres, clase: 'rounded-r-sg-xs bg-sg-data-2' }
      ]
        .filter((tramo) => tramo.n > 0)
        .map((tramo) => (
          <i key={tramo.clave} data-tramo={tramo.clave} className={`block ${tramo.clase}`} style={{ flexGrow: tramo.n, flexBasis: 0 }} />
        ))}
    </div>
  )
}
