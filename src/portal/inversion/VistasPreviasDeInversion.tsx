import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AccionesDeVistaPrevia, DatosDeVistaPrevia, TrazabilidadDeVistaPrevia } from '../componentes/AccionesDeVistaPrevia'
import { tituloQueDiceQueEs } from '../componentes/CabeceraDeFicha'
import { EstadoChip } from '../componentes/EstadoChip'
import { montoPe } from '../componentes/Monto'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { opcion } from '../datos/opciones'
import { monedaDe } from '../datos/inversion'
import { atributo, texto, type Registro } from '../datos/registros'
import { useEvidenciasDe } from '../documentos/api'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { diaPe, NS, numeroPe } from '../i18n'
import { COMPROBAR_DEL_APORTE, TrazabilidadDelAporte } from './FichaAportePage'
import { COMPROBAR_DEL_PROGRAMA, TrazabilidadDelPrograma } from './FichaProgramaPage'

// las vistas previas acopladas de programas e inversión (fase 13a de Civic Modern), con la anatomía de la de un compromiso (S08):
// el estado, las acciones de la ficha, el panel de decisión, sus datos en filas de término y valor y la trazabilidad. un monto que
// no vino se dice, nunca como cero

// un monto en su moneda, o lo que dice que falta
function Monto({ valor, moneda, sinMonto }: { valor: unknown; moneda: string; sinMonto: string }) {
  const monto = montoPe(valor, moneda)
  return monto === '—' ? <span className="text-sg-text-muted">{sinMonto}</span> : <span className="font-bold tabular-nums">{monto}</span>
}

const vinculo = (registro: Registro, objeto: string, campo: string) =>
  texto(registro, campo) ? <RegistroVinculado objeto={objeto} id={texto(registro, campo)} /> : null

// el título del panel de un programa: su nombre
export const tituloDelPrograma = (programa: Registro): string => texto(programa, 'name')

export function VistaPreviaDePrograma({ registro: programa }: { registro: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(programa, 'project')
  const siguiente = useSiguienteAccion('social_program', programa, COMPROBAR_DEL_PROGRAMA)
  const evidencias = useEvidenciasDe('social_program', programa.id)
  const desde = texto(programa, 'start_date')
  const hasta = texto(programa, 'end_date')
  const periodo = desde && hasta ? t('fichaPrograma.previa.delAl', { desde: diaPe(desde), hasta: diaPe(hasta) }) : desde || hasta ? diaPe(desde || hasta) : null
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <EstadoChip objeto="social_program" estado={programa.state} />
      </div>
      <AccionesDeVistaPrevia objeto="social_program" registro={programa} proyecto={proyecto} comprobarAntes={COMPROBAR_DEL_PROGRAMA} falta={siguiente?.falta} />
      <PanelDeDecision
        objeto="social_program"
        proyecto={proyecto}
        estado={programa.state}
        desde={texto(programa, 'state_changed_at') || null}
        por={texto(programa, 'state_changed_by') || null}
        siguiente={siguiente}
        vencimiento={hasta || null}
      />
      <DatosDeVistaPrevia
        filas={[
          {
            clave: 'presupuesto',
            termino: t('fichaPrograma.previa.presupuesto'),
            valor: <Monto valor={atributo(programa, 'total_budget')} moneda={monedaDe(programa)} sinMonto={t('fichaPrograma.previa.sinPresupuesto')} />
          },
          { clave: 'periodo', termino: t('fichaPrograma.previa.periodo'), valor: periodo },
          { clave: 'socio', termino: t('fichaPrograma.socio'), valor: vinculo(programa, 'organization', 'partner_organization') },
          { clave: 'tema', termino: t('fichaPrograma.campos.tema'), valor: vinculo(programa, 'topic', 'topic') }
        ]}
      />
      <TrazabilidadDeVistaPrevia>
        <TrazabilidadDelPrograma programa={programa} evidencias={evidencias.data?.content ?? []} />
      </TrazabilidadDeVistaPrevia>
    </div>
  )
}

// el título del panel de un aporte: lo que dice su propósito (como su ficha) o, sin él, «Aporte <código>»
export function useTituloDelAporte(): (aporte: Registro) => string {
  const { t } = useTranslation(NS)
  // estable mientras no cambie el idioma: la pantalla la anota con su cuerpo (useCuerpoDeVistaPrevia)
  return useCallback(
    (aporte: Registro) => tituloQueDiceQueEs(texto(aporte, 'declared_purpose'), t('fichaAporte.titulo', { codigo: texto(aporte, 'code') })),
    [t]
  )
}

export function VistaPreviaDeAporte({ registro: aporte }: { registro: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(aporte, 'project')
  const siguiente = useSiguienteAccion('social_contribution', aporte, COMPROBAR_DEL_APORTE)
  const evidencias = useEvidenciasDe('social_contribution', aporte.id)
  const beneficiarios = atributo(aporte, 'beneficiaries_count')
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <EstadoChip objeto="social_contribution" estado={aporte.state} />
        {opcion(aporte, 'contribution_type') ? <span className="text-sg-text-secondary">{opcion(aporte, 'contribution_type')}</span> : null}
      </div>
      <AccionesDeVistaPrevia
        objeto="social_contribution"
        registro={aporte}
        proyecto={proyecto}
        comprobarAntes={COMPROBAR_DEL_APORTE}
        falta={siguiente?.falta}
      />
      <PanelDeDecision
        objeto="social_contribution"
        proyecto={proyecto}
        estado={aporte.state}
        desde={texto(aporte, 'state_changed_at') || null}
        por={texto(aporte, 'state_changed_by') || null}
        siguiente={siguiente}
      />
      <DatosDeVistaPrevia
        filas={[
          {
            clave: 'total',
            termino: t('fichaAporte.previa.total'),
            valor: <Monto valor={atributo(aporte, 'total_amount')} moneda={monedaDe(aporte)} sinMonto={t('fichaAporte.previa.sinMonto')} />
          },
          { clave: 'ocasion', termino: t('fichaAporte.paraQue.ocasion'), valor: texto(aporte, 'occasion') || null },
          {
            clave: 'beneficiarios',
            termino: t('fichaAporte.paraQue.beneficiarios'),
            valor: beneficiarios === null || beneficiarios === undefined ? null : <span className="tabular-nums">{numeroPe(Number(beneficiarios))}</span>
          },
          { clave: 'recibe', termino: t('fichaAporte.paraQue.recibe'), valor: vinculo(aporte, 'organization', 'recipient_organization') },
          { clave: 'grupo', termino: t('fichaAporte.paraQue.grupo'), valor: vinculo(aporte, 'stakeholder', 'stakeholder') },
          { clave: 'localidad', termino: t('fichaAporte.paraQue.localidad'), valor: vinculo(aporte, 'locality', 'locality') }
        ]}
      />
      <TrazabilidadDeVistaPrevia>
        <TrazabilidadDelAporte aporte={aporte} evidencias={evidencias.data?.content ?? []} />
      </TrazabilidadDeVistaPrevia>
    </div>
  )
}
