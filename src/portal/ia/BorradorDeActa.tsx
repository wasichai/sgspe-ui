import { useAuth } from '@wasichai/core'
import { Alert, Button, Textarea } from '@wasichai/ui'
import { useAvailableTransitions } from '@wasichai/workflow'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { Cargando } from '../componentes/Estados'
import { texto, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { useAceptarSugerencia } from './contrato'
import { MarcaDeIa } from './MarcaDeIa'
import { personasCitadas, quedanMarcadores, reidentificar } from './marcadores'
import { confianzaDe, cuerpoDeAceptacion } from './sugerencias'
import { nombresReales, TextoDeIa, useNombresDePersonas } from './TextoDeIa'

// S25 · el borrador del acta de la IA (AI-02; screens.md S25, ai-architecture.md §4.2 fila BORRADOR DE ACTA): nunca escribe el
// acta solo. «Insertar y editar…» acepta la sugerencia con el texto completo del acta que la persona revisó (el actual más el
// borrador) y su motivo (decisión 21 del plan); «Rechazar» es la transición de WF-K con motivo
export const combinarActa = (actual: string, borrador: string): string => (actual.trim() ? `${actual.trimEnd()}\n\n${borrador}` : borrador)

export function BorradorDeActa({
  interaccion,
  actual,
  listo,
  alInsertado
}: {
  interaccion: Registro
  // el acta guardada: lo que el borrador completa
  actual: string
  // el acta está guardada y se puede editar: sin cambios pendientes ni guardado en pausa
  listo: boolean
  alInsertado: (minutes: string) => void
}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const borradores = useTodos(
    'ai_suggestion',
    { target_object: 'engagement', target_record_id: interaccion.id, suggestion_kind: 'BORRADOR DE ACTA', sort: 'created_at', dir: 'desc' },
    can('ai_suggestion', 'READ')
  )
  const borrador = (borradores.data ?? []).find((s) => s.state === 'proposed')
  const transiciones = useAvailableTransitions('ai_suggestion', borrador?.id ?? '')
  const [insertando, setInsertando] = useState(false)
  if (!borrador) return null
  const acepta = (transiciones.data ?? []).some((tr) => tr.name === 'accept' && tr.allowed)
  const confianza = confianzaDe(borrador)
  const proyecto = texto(interaccion, 'project')
  return (
    <section
      aria-label={t('borradorDeActa.titulo')}
      className="space-y-2 rounded-sg-lg border border-dashed border-sg-ai-border bg-sg-ai-soft p-3 text-sm text-sg-text"
    >
      <div className="flex flex-wrap items-center gap-2">
        <MarcaDeIa clase="sugerencia" />
        <h2 className="font-semibold">{t('borradorDeActa.titulo')}</h2>
        {confianza !== null ? <span className="text-sg-caption text-sg-text-muted">{t('ia.confianza', { n: Math.round(confianza * 100) })}</span> : null}
      </div>
      <p className="text-sg-caption text-sg-text-secondary">{t('borradorDeActa.ayuda')}</p>
      <div className="max-h-64 overflow-y-auto rounded-sg-md border border-sg-border bg-sg-surface p-2">
        <TextoDeIa texto={texto(borrador, 'suggested_value')} markdown />
      </div>
      {acepta ? (
        <div className="space-y-1">
          <Button size="sm" disabled={!listo} onClick={() => setInsertando(true)}>
            {t('borradorDeActa.insertar')}
          </Button>
          {!listo ? <p className="text-sg-caption text-sg-text-muted">{t('borradorDeActa.esperaGuardado')}</p> : null}
        </div>
      ) : null}
      <BotonesDeTransicion objeto="ai_suggestion" registro={borrador} solo={['reject']} proyecto={proyecto} />
      {insertando ? (
        <Insertar
          key={borrador.id}
          borrador={borrador}
          actual={actual}
          alCerrar={() => setInsertando(false)}
          alInsertado={(minutes) => {
            setInsertando(false)
            alInsertado(minutes)
          }}
        />
      ) : null}
    </section>
  )
}

function Insertar({
  borrador,
  actual,
  alCerrar,
  alInsertado
}: {
  borrador: Registro
  actual: string
  alCerrar: () => void
  alInsertado: (minutes: string) => void
}) {
  const { t } = useTranslation(NS)
  const sugerido = texto(borrador, 'suggested_value')
  const { nombres, listo } = useNombresDePersonas(personasCitadas(sugerido))
  if (!listo)
    return (
      <Drawer titulo={t('borradorDeActa.dialogo')} abierto alCerrar={alCerrar}>
        <Cargando />
      </Drawer>
    )
  return (
    <FormularioDeInsercion
      borrador={borrador}
      inicial={combinarActa(actual, reidentificar(sugerido, nombresReales(nombres)))}
      alCerrar={alCerrar}
      alInsertado={alInsertado}
    />
  )
}

function FormularioDeInsercion({
  borrador,
  inicial,
  alCerrar,
  alInsertado
}: {
  borrador: Registro
  inicial: string
  alCerrar: () => void
  alInsertado: (minutes: string) => void
}) {
  const { t } = useTranslation(NS)
  const aceptar = useAceptarSugerencia()
  const releer = useReleer()
  const [acta, setActa] = useState(inicial)
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const conMarcadores = quedanMarcadores(acta)
  const cerrar = () => {
    aceptar.nuevaAccion()
    alCerrar()
  }
  const confirmar = () => {
    setIntentado(true)
    if (!acta.trim() || conMarcadores || !motivo.trim()) return
    aceptar.mutate(
      { sugerencia: borrador, atributos: cuerpoDeAceptacion({ fila: 'borrador', texto: acta }), motivo: motivo.trim() },
      { onSuccess: () => alInsertado(acta) }
    )
  }
  return (
    <Drawer
      titulo={t('borradorDeActa.dialogo')}
      descripcion={t('borradorDeActa.dialogoAyuda')}
      abierto
      alCerrar={cerrar}
      pie={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={aceptar.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={aceptar.isPending} aria-busy={aceptar.isPending}>
            {aceptar.isPending ? t('borradorDeActa.insertando') : t('borradorDeActa.confirmar')}
          </Button>
        </>
      }
    >
      <Campo etiqueta={t('borradorDeActa.texto')} error={intentado && !acta.trim() ? t('bandejaIa.aceptacion.obligatorio') : undefined}>
        {(p) => <Textarea {...p} className="min-h-[320px] font-sg-mono text-sg-body-sm" value={acta} onChange={(e) => setActa(e.target.value)} />}
      </Campo>
      {intentado && conMarcadores ? <Alert tone="warning">{t('ia.marcadores.quedan')}</Alert> : null}
      <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && !motivo.trim() ? t('comun.motivoFalta') : undefined}>
        {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
      </Campo>
      {aceptar.isError ? (
        <AvisoDeConflicto
          error={aceptar.error}
          propios={{ STATE_MISMATCH: t('borradorDeActa.errores.STATE_MISMATCH') }}
          releer={() => releer(['records', 'ai_suggestion'], ['record', 'ai_suggestion', borrador.id])}
          alRecargar={() => aceptar.reset()}
        />
      ) : null}
    </Drawer>
  )
}
