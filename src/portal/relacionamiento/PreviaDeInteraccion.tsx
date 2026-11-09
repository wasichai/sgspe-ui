import { useAuth } from '@wasichai/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { BarraPorSexo } from '../componentes/Puntaje'
import { atributo, texto, useRelacionados, useTodos, type Registro } from '../datos/registros'
import { fechaYHoraPe, NS, numeroPe } from '../i18n'

// un conteo que no llegó (el servidor aún no lo calculó, o la cuenta no lo lee) es «—», nunca un cero
const conteo = (registro: Registro, campo: string): number | null => {
  const valor = atributo(registro, campo)
  return valor === undefined || valor === null || valor === '' ? null : Number(valor)
}

// los asistentes de una interacción: el total y, si llegaron los dos conteos, «21 mujeres, 17 hombres» con su barra (S07)
export function AsistentesPorSexo({ interaccion }: { interaccion: Registro }) {
  const { t } = useTranslation(NS)
  const total = conteo(interaccion, 'attendees_total_count')
  const mujeres = conteo(interaccion, 'attendees_female_count')
  const hombres = conteo(interaccion, 'attendees_male_count')
  if (total === null) return <span className="text-sg-text-muted">—</span>
  return (
    <div className="min-w-0">
      <p>
        <b className="font-bold tabular-nums">{numeroPe(total)}</b>
        {mujeres !== null && hombres !== null ? (
          <span className="text-sg-text-secondary"> · {t('comun.porSexo', { mujeres: numeroPe(mujeres), hombres: numeroPe(hombres) })}</span>
        ) : null}
      </p>
      <BarraPorSexo mujeres={mujeres} hombres={hombres} />
    </div>
  )
}

// lo que la vista previa de una interacción dice además de su estado y su panel de decisión (S07, la interacción elegida acoplada a
// la lista): la fecha, el lugar, los asistentes por sexo y la trazabilidad en conteos (los grupos de interés con quienes fue y los
// compromisos que nacieron de ella)
export function PreviaDeInteraccion({ registro }: { registro: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const instante = texto(registro, 'held_at') || texto(registro, 'scheduled_at')
  const grupos = useRelacionados('engagement', registro.id, 'engagement_stakeholder')
  const compromisos = useTodos('commitment', { origin_engagement: registro.id }, can('commitment', 'READ'))
  const fila = (termino: string, valor: ReactNode) => (
    <>
      <dt className="text-sg-text-secondary">{termino}</dt>
      <dd className="min-w-0 text-sg-text">{valor}</dd>
    </>
  )
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2">
        {fila(t('relacionamiento.columnas.fecha'), instante ? fechaYHoraPe(new Date(instante)) : '—')}
        {fila(t('relacionamiento.columnas.lugar'), texto(registro, 'place') || '—')}
        {fila(t('relacionamiento.columnas.asistentes'), <AsistentesPorSexo interaccion={registro} />)}
      </dl>
      <PanelDeTrazabilidad
        deDondeViene={[
          {
            clave: 'grupos',
            titulo: t('relacionamiento.ficha.grupos'),
            contenido: grupos.data?.totalElements ? numeroPe(grupos.data.totalElements) : null
          }
        ]}
        queGenero={[
          {
            clave: 'compromisos',
            titulo: t('relacionamiento.ficha.compromisos'),
            contenido: compromisos.data?.length ? numeroPe(compromisos.data.length) : null
          }
        ]}
      />
    </div>
  )
}
