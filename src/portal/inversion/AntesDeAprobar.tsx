import { useQueryClient } from '@tanstack/react-query'
import { Button, Textarea } from '@wasichai/ui'
import { useAvailableTransitions } from '@wasichai/workflow'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { Cargando } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useProyecto } from '../contexto/proyectos'
import { atributo, puedeEscribir, texto, useDefinicion, usePuedeEditar, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useComprobacion, type Aviso } from '../transiciones/api'
import { useTextoDeAviso } from '../transiciones/avisos'
import { leerLineamientos, type Situacion } from './lineamientos'
import { Seccion } from '../componentes/Seccion'

// «Antes de aprobar» de S44 (screens.md S44, spec F5 §3.3 y §3.4): la consulta en seco (transition-checks) de la aprobación que
// el rol tiene, approve o approve_direct (si no tiene ninguna, approve: la consulta no juzga roles, api.md §4.1, y dice a quien
// registró qué falta), leída fila por fila con leerLineamientos; cada hallazgo con el texto de su regla, nunca el código. la
// justificación de la desviación se pide si un lineamiento que ella cubre está incumplido y se escribe con motivo (el aporte es
// requiresReason); al guardarla se vuelve a consultar. la sinergia sin acuerdo vigente (P6) no se justifica y se dice
const CLASE: Record<Situacion, string> = {
  cumple: 'text-sg-success',
  bloquea: 'text-sg-danger',
  advierte: 'text-sg-warning',
  noAplica: 'text-sg-text-muted'
}
const JUSTIFICACION = ['guideline_deviation_justification']

export function AntesDeAprobar({ aporte, escribe }: { aporte: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const transiciones = useAvailableTransitions('social_contribution', aporte.id)
  const propias = (transiciones.data ?? []).filter((x) => x.allowed)
  const elegida = propias.find((x) => x.name === 'approve') ?? propias.find((x) => x.name === 'approve_direct')
  const transicion = elegida?.name ?? 'approve'
  const accion = elegida?.label ?? t('fichaAporte.antes.aprobar')
  // sin las transiciones leídas no se sabe qué aprobación consultar: un error se dice, no se consulta «Aprobar» a ciegas
  const comprobacion = useComprobacion('social_contribution', aporte.id, transiciones.isPending || transiciones.isError ? null : transicion)
  const proyecto = useProyecto(texto(aporte, 'project'))
  const textoDe = useTextoDeAviso('social_contribution')
  const dicho = (a: Aviso) => textoDe(a, { name: transicion, label: accion }).texto ?? t('transiciones.reglaSinTexto')
  // el panel se dibuja cuando se sabe qué aprobación consulta: antes diría «Aprobar» a quien solo aprueba sin revisión interna
  if (transiciones.isPending) return <Cargando compacto etiqueta={t('fichaAporte.antes.comprobando')} />
  if (transiciones.isError && !transiciones.data)
    return (
      <Seccion titulo={t('fichaAporte.antes.titulo')} className="space-y-3 text-sm">
        <FalloDeLectura error={transiciones.error} alReintentar={() => void transiciones.refetch()} />
      </Seccion>
    )
  let cuerpo
  if (comprobacion.isPending || proyecto.isPending) cuerpo = <Cargando compacto etiqueta={t('fichaAporte.antes.comprobando')} />
  else if (comprobacion.isError) cuerpo = <FalloDeLectura error={comprobacion.error} alReintentar={() => void comprobacion.refetch()} />
  else if (proyecto.isError && !proyecto.data) cuerpo = <FalloDeLectura error={proyecto.error} alReintentar={() => void proyecto.refetch()} />
  else {
    const lectura = leerLineamientos(comprobacion.data, {
      politicas: proyecto.data?.attributes ?? {},
      conCampana: texto(aporte, 'exploration_campaign') !== '',
      conSinergia: atributo(aporte, 'has_institutional_synergy') === true
    })
    const sinergiaBloquea = lectura.filas.some((f) => f.fila === 'sinergia' && f.situacion === 'bloquea')
    cuerpo = (
      <>
        <ul className="space-y-2">
          {lectura.filas.map(({ fila, situacion, avisos }) => (
            <li key={fila} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span>{t(`fichaAporte.antes.filas.${fila}`)}</span>
                <span className={`font-medium ${CLASE[situacion]}`}>{t(`fichaAporte.antes.situaciones.${situacion}`)}</span>
              </div>
              {avisos.map((a, i) => (
                <p key={i} className="text-sg-caption">
                  {dicho(a)}
                </p>
              ))}
            </li>
          ))}
        </ul>
        {lectura.otros.length > 0 ? (
          <div className="space-y-1">
            <h3 className="font-medium">{t('fichaAporte.antes.otras')}</h3>
            <ul className="space-y-1 text-sg-caption">
              {lectura.otros.map((a, i) => (
                <li key={i}>{dicho(a)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {sinergiaBloquea ? <p className="text-sg-caption text-sg-warning">{t('fichaAporte.antes.sinergiaNoSeJustifica')}</p> : null}
        <Justificacion aporte={aporte} escribe={escribe} pide={lectura.pideJustificacion} />
      </>
    )
  }
  return (
    <Seccion titulo={t('fichaAporte.antes.titulo')} className="space-y-3 text-sm">
      <p className="text-sg-caption text-sg-text-muted">{t('fichaAporte.antes.ayuda', { accion })}</p>
      {cuerpo}
    </Seccion>
  )
}

function Justificacion({ aporte, escribe, pide }: { aporte: Registro; escribe: boolean; pide: boolean }) {
  const { t } = useTranslation(NS)
  const cliente = useQueryClient()
  const definicion = useDefinicion('social_contribution')
  const puedeEditar = usePuedeEditar('social_contribution')
  // la clave que el GET no trajo es un campo que la cuenta no lee: el PUT no la mandaría (atributosDeEscritura)
  const edita =
    escribe && puedeEditar && puedeEscribir(definicion.data, 'guideline_deviation_justification') && 'guideline_deviation_justification' in aporte.attributes
  const actual = texto(aporte, 'guideline_deviation_justification')
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const cerrar = () => {
    setAbierto(false)
    setMotivo('')
  }
  if (!pide && !actual) return null
  return (
    <div className="space-y-1 border-t border-sg-border pt-3">
      <h3 className="font-medium">{t('fichaAporte.antes.justificacion.titulo')}</h3>
      <p className="whitespace-pre-line">{actual || t('fichaAporte.antes.justificacion.sin')}</p>
      {pide && !actual ? <p className="text-sg-caption text-sg-warning">{t('fichaAporte.antes.justificacion.pide')}</p> : null}
      {edita ? (
        <Button size="sm" variant="secondary" onClick={() => setAbierto(true)}>
          {t(actual ? 'fichaAporte.antes.justificacion.cambiar' : 'fichaAporte.antes.justificacion.escribir')}
        </Button>
      ) : null}
      <Drawer titulo={t('fichaAporte.antes.justificacion.titulo')} descripcion={t('fichaAporte.antes.justificacion.ayuda')} abierto={abierto} alCerrar={cerrar}>
        <Campo etiqueta={t('fichaAporte.motivo')}>
          {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
        </Campo>
        {abierto ? (
          <FormularioDeRegistro
            objeto="social_contribution"
            registro={aporte}
            campos={JUSTIFICACION}
            motivo={motivo.trim() || undefined}
            alGuardar={() => {
              void cliente.invalidateQueries({ queryKey: ['transition-check', 'social_contribution', aporte.id] })
              cerrar()
            }}
            alCancelar={cerrar}
          />
        ) : null}
      </Drawer>
    </div>
  )
}
