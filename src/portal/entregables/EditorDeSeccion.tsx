import { useAuth } from '@wasichai/core'
import { Badge, Button, Textarea } from '@wasichai/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { atributo, texto, useActualizar, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { VistaMarkdown } from '../relacionamiento/markdown'
import { EditorMarkdown } from './EditorMarkdown'
import { partirMenciones } from './menciones'
import { contenidoDe, esCalculada, ORIGEN_IA, seEditan } from './tipos'

// una mención leída: su tipo y los ocho primeros caracteres del id (decisión 10 del plan); la vista PDF del borrador la resuelve
export function ConMenciones({ texto: contenido }: { texto: string }) {
  const { t } = useTranslation(NS)
  return (
    <>
      {partirMenciones(contenido).map((trozo, i) =>
        trozo.tipo === 'texto' ? (
          <span key={i}>{trozo.texto}</span>
        ) : (
          <span key={i} className="rounded-sg-md bg-sg-primary-soft px-1 text-sg-primary-text">
            @{t(`entregables.menciones.tipos.${trozo.clase}`)} {trozo.id.slice(0, 8)}
          </span>
        )
      )}
    </>
  )
}

// el editor de una sección de S50 (decisión 12 del plan): se edita en draft u observed (deliverables.md §8.3), con UPDATE sobre
// deliverable_section y la asignación vigente; una CALCULADA no tiene editor. guardar es el PUT genérico con If-Match; una sección
// ASISTIDO POR IA lleva motivo (DeliverableWriteGuard: 400 FIELD_REASON_REQUIRED) y conserva su origen (422 AI_ORIGIN_LOCKED si
// algo intentara cambiarlo). la pantalla la vuelve a montar con la versión guardada; alCambiarSucio avisa de cambios sin guardar
export function EditorDeSeccion({
  entregable,
  seccion,
  guia,
  alCambiarSucio
}: {
  entregable: Registro
  seccion: Registro
  // la guía de redacción del tipo para esta sección (guide de GET /api/sgspe/deliverable-types); sin ella, nada
  guia?: string
  alCambiarSucio?: (sucio: boolean) => void
}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const escribe = useEscribeEnProyecto(texto(entregable, 'project') || undefined)
  const actualizar = useActualizar('deliverable_section')
  const releer = useReleer()
  const original = contenidoDe(seccion)
  const revisadaAntes = atributo(seccion, 'reviewed') === true
  const [contenido, setContenido] = useState(original)
  const [revisada, setRevisada] = useState(revisadaAntes)
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const asistida = texto(seccion, 'content_origin') === ORIGEN_IA
  const calculada = esCalculada(seccion)
  const edita = seEditan(entregable) && can('deliverable_section', 'UPDATE') && escribe && !calculada
  const sucio = contenido !== original || revisada !== revisadaAntes
  useEffect(() => {
    alCambiarSucio?.(sucio)
  }, [sucio, alCambiarSucio])
  const faltaMotivo = asistida && motivo.trim() === ''
  const guardar = () => {
    setIntentado(true)
    if (faltaMotivo) return
    actualizar.mutate({ registro: seccion, cambios: { content: contenido, reviewed: revisada }, motivo: motivo.trim() || null })
  }
  return (
    <section aria-label={texto(seccion, 'title')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sg-h3 font-semibold">{texto(seccion, 'title')}</h2>
        <Badge className={asistida ? 'border border-dashed border-sg-ai-border bg-sg-ai-soft text-sg-ai' : 'bg-sg-neutral-soft text-sg-neutral'}>
          {texto(seccion, 'content_origin')}
        </Badge>
      </div>
      {guia ? (
        <div className="rounded-sg-md bg-sg-surface-sunken p-3 text-sm">
          <p className="text-sg-label font-medium">{t('entregables.seccion.guia')}</p>
          <p className="text-sg-text-secondary">{guia}</p>
        </div>
      ) : null}
      {calculada ? (
        <p className="text-sm text-sg-text-muted">{t('entregables.seccion.calculada')}</p>
      ) : edita ? (
        <>
          <EditorMarkdown etiqueta={t('entregables.seccion.texto')} valor={contenido} alCambiar={setContenido} proyecto={texto(entregable, 'project')} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={revisada} onChange={(e) => setRevisada(e.target.checked)} />
            {t('entregables.seccion.revisada')}
          </label>
          <Campo
            etiqueta={asistida ? t('comun.motivoObligatorio') : t('comun.motivoOpcional')}
            error={intentado && faltaMotivo ? t('comun.motivoFalta') : undefined}
          >
            {(p) => <Textarea {...p} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {asistida ? <p className="text-sg-caption text-sg-text-muted">{t('entregables.seccion.asistidaAyuda')}</p> : null}
          {actualizar.isError ? (
            <AvisoDeConflicto
              error={actualizar.error}
              releer={() => releer(['record', 'deliverable_section', seccion.id], ['records', 'deliverable_section'])}
              alRecargar={() => actualizar.reset()}
            />
          ) : null}
          <div className="flex justify-end">
            <Button onClick={guardar} disabled={!sucio || actualizar.isPending} aria-busy={actualizar.isPending}>
              {actualizar.isPending ? t('comun.guardando') : t('entregables.seccion.guardar')}
            </Button>
          </div>
        </>
      ) : (
        <>
          {!seEditan(entregable) ? <p className="text-sm text-sg-text-muted">{t('entregables.seccion.soloEnBorrador')}</p> : null}
          {original ? (
            <VistaMarkdown texto={original} enLinea={(linea) => <ConMenciones texto={linea} />} />
          ) : (
            <p className="text-sm text-sg-text-muted">{t('entregables.seccion.vacia')}</p>
          )}
        </>
      )}
    </section>
  )
}
