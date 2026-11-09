import { useAuth } from '@wasichai/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Restringido } from '../componentes/Estados'
import { Nivel, Postura } from '../componentes/Nivel'
import { PanelDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { BarraDePuntaje } from '../componentes/Puntaje'
import { opcion } from '../datos/opciones'
import { atributo, puedeLeer, texto, useConteo, useDefinicion, useRegistro, useRelacionados, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'

// lo que la vista previa de un grupo de interés dice además de su estado (S06, la ficha acoplada de la lista): la evaluación
// vigente con sus barras de puntaje (interés, poder y confianza, de 1 a 5), las definiciones que deciden cómo relacionarse
// (postura, que puede estar restringida, prioridad, grupo de influencia y territorio) y la trazabilidad en conteos. los índices
// y la confianza son los vigentes del grupo (ASM-087): los mismos de su ficha
export function PreviaDeGrupo({ registro }: { registro: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const definicion = useDefinicion('stakeholder')
  const evaluado = registro.state === 'assessed' || Boolean(atributo(registro, 'influence_group'))
  const fecha = texto(registro, 'last_assessment_date')
  const localidad = useRegistro('locality', atributo<string>(registro, 'locality'))
  const interacciones = useRelacionados('stakeholder', registro.id, 'engagement_stakeholder')
  const compromisos = useRelacionados('stakeholder', can('commitment', 'READ') ? registro.id : undefined, 'commitment_stakeholder')
  const evaluaciones = useConteo('stakeholder_assessment', { stakeholder: registro.id }, can('stakeholder_assessment', 'READ'))
  const fila = (termino: string, valor: ReactNode) => (
    <>
      <dt className="text-sg-text-secondary">{termino}</dt>
      <dd className="min-w-0 text-sg-text">{valor}</dd>
    </>
  )
  return (
    <div className="space-y-4 text-sm">
      <section aria-label={t('grupos.previa.evaluacion')} className="space-y-2.5">
        <h3 className="text-sm font-semibold text-sg-text-secondary">
          {evaluado && fecha ? t('grupos.previa.evaluacionDel', { fecha: diaPe(fecha) }) : t('grupos.previa.evaluacion')}
        </h3>
        {evaluado ? (
          <>
            <BarraDePuntaje etiqueta={t('grupos.matriz.interes')} valor={atributo(registro, 'interest_index')} />
            <BarraDePuntaje etiqueta={t('grupos.matriz.poder')} valor={atributo(registro, 'power_index')} />
            <BarraDePuntaje etiqueta={t('grupos.previa.confianza')} valor={atributo(registro, 'trust_score')} />
          </>
        ) : (
          <p className="text-sg-text-muted">{t('grupos.ficha.sinEvaluar')}</p>
        )}
        <dl className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2 pt-1">
          {definicion.data
            ? fila(
                t('grupos.columnas.postura'),
                puedeLeer(definicion.data, 'stance') ? <Postura valor={atributo(registro, 'stance')} /> : <Restringido femenina />
              )
            : null}
          {fila(
            t('grupos.columnas.prioridad'),
            evaluado ? <Nivel valor={atributo(registro, 'information_priority')} escala="prioridad" /> : t('grupos.sinEvaluarValor')
          )}
          {fila(t('grupos.filtros.influence_group'), evaluado ? opcion(registro, 'influence_group') || '—' : t('grupos.sinEvaluarValor'))}
          {texto(localidad.data, 'name')
            ? fila(
                t('grupos.previa.territorio'),
                <span className="inline-flex rounded-sg-sm border border-sg-territory-border bg-sg-territory-soft px-1.5 text-sg-caption font-semibold text-sg-territory">
                  {texto(localidad.data, 'name')}
                </span>
              )
            : null}
        </dl>
      </section>
      <PanelDeTrazabilidad
        deDondeViene={[
          {
            clave: 'evaluaciones',
            titulo: t('grupos.ficha.evaluaciones'),
            contenido: typeof evaluaciones === 'number' && evaluaciones > 0 ? t('grupos.previa.evaluaciones', { count: evaluaciones }) : null
          }
        ]}
        queGenero={[
          {
            clave: 'interacciones',
            titulo: t('grupos.ficha.interacciones'),
            contenido: interacciones.data?.totalElements ? numeroPe(interacciones.data.totalElements) : null
          },
          {
            clave: 'compromisos',
            titulo: t('grupos.ficha.compromisos'),
            contenido: compromisos.data?.totalElements ? numeroPe(compromisos.data.totalElements) : null
          }
        ]}
      />
    </div>
  )
}
