import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { Cargando } from '../componentes/Estados'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { texto, useRegistros, type Registro } from '../datos/registros'
import { AvisoDeIa } from '../ia/AvisoDeIa'
import { useAceptarSugerencia, useCasoDeIa, useCorrida } from '../ia/contrato'
import { FalloDeCorrida } from '../ia/FalloDeCorrida'
import { MarcaDeIa } from '../ia/MarcaDeIa'
import { TextoDeIa } from '../ia/TextoDeIa'
import { fechaYHoraPe, NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { deSugerencia, listaParaUsar } from './menciones'
import { seccionDelTipo, useTiposDeEntregable } from './contrato'
import { esCalculada, seEditan } from './tipos'

// el panel de IA de una sección (spec §3.9, screens.md «Resumen ejecutivo y borrador de sección»): solo en las que el tipo marca
// con IA (assisted de GET /api/sgspe/deliverable-types, decisión 1 del plan). «Sugerir con IA» corre AI-04 sobre deliverable_section; la última BORRADOR DE SECCION propuesta se
// muestra al lado, re-identificada con los permisos de quien mira. «Usar…» manda el texto revisado (las personas ya como
// mención, decisión 11) con motivo; «Rechazar» es WF-K. el RESUMEN EJECUTIVO del proyecto se copia con { section, content }
// (decisión 15). con cambios sin guardar, usar se deshabilita: reemplazaría lo escrito (Review Focus 4)
export function SugerenciaDeSeccion({ entregable, seccion, sucio }: { entregable: Registro; seccion: Registro; sucio: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const caso = useCasoDeIa('AI-04')
  const proyecto = texto(entregable, 'project')
  const escribe = useEscribeEnProyecto(proyecto || undefined)
  const tipos = useTiposDeEntregable()
  // mientras los tipos se leen, o si no se pudieron leer, no se ofrece nada: la página dice el error de lectura
  const aplica = seccionDelTipo(tipos.data, texto(entregable, 'deliverable_type'), texto(seccion, 'section_key'))?.assisted === true && !esCalculada(seccion)
  const lee = can('ai_suggestion', 'READ')
  const corrida = useCorrida()
  const borradores = useRegistros(
    'ai_suggestion',
    { target_object: 'deliverable_section', target_record_id: seccion.id, suggestion_kind: 'BORRADOR DE SECCION', sort: 'created_at', dir: 'desc', size: 1 },
    aplica && lee
  )
  const resumenes = useRegistros(
    'ai_suggestion',
    { project: proyecto, target_object: 'project', suggestion_kind: 'RESUMEN EJECUTIVO', sort: 'created_at', dir: 'desc', size: 1 },
    aplica && lee
  )
  const [usando, setUsando] = useState<{ sugerencia: Registro; conSeccion: boolean } | null>(null)
  if (!aplica) return null
  const editable = seEditan(entregable) && can('deliverable_section', 'UPDATE') && escribe
  const genera = editable && can('ai_interaction', 'CREATE') && can('ai_suggestion', 'CREATE')
  const ultimo = borradores.data?.content[0]
  const propuesto = ultimo?.state === 'proposed' ? ultimo : undefined
  const ultimoResumen = resumenes.data?.content[0]
  const resumen = ultimoResumen?.state === 'proposed' ? ultimoResumen : undefined
  const sugerir = () => corrida.mutate({ caso: 'AI-04', objetivo: { object: 'deliverable_section', recordId: seccion.id } })
  const titulo = t('entregables.ia.titulo')
  return (
    <section aria-label={titulo} className="space-y-3 rounded-sg-lg border border-dashed border-sg-ai-border bg-sg-ai-soft p-4 text-sm">
      <div className="flex items-center gap-2">
        <MarcaDeIa clase="sugerencia" />
        <h3 className="text-sg-h3 font-semibold">{titulo}</h3>
      </div>
      {!caso.disponible ? (
        <AvisoDeIa motivo={caso.motivo} />
      ) : genera ? (
        <Button size="sm" variant="secondary" disabled={corrida.isPending} aria-busy={corrida.isPending} onClick={sugerir}>
          {corrida.isPending ? t('entregables.ia.redactando') : propuesto ? t('entregables.ia.sugerirDeNuevo') : t('entregables.ia.sugerir')}
        </Button>
      ) : null}
      {corrida.isError ? <FalloDeCorrida error={corrida.error} alReintentar={genera ? sugerir : null} /> : null}
      {lee && borradores.isPending ? <Cargando compacto /> : null}
      {propuesto ? (
        <div className="space-y-2">
          <p className="text-sg-caption text-sg-text-muted">
            {t('entregables.ia.redactada', { fecha: propuesto.createdAt ? fechaYHoraPe(new Date(propuesto.createdAt)) : '—' })}
          </p>
          <TextoDeIa texto={texto(propuesto, 'suggested_value')} markdown />
          {editable ? (
            <div className="flex flex-wrap items-start gap-2">
              <Button
                size="sm"
                disabled={sucio}
                title={sucio ? t('entregables.ia.guardeAntes') : undefined}
                onClick={() => setUsando({ sugerencia: propuesto, conSeccion: false })}
              >
                {t('entregables.ia.usar')}
              </Button>
              <BotonesDeTransicion objeto="ai_suggestion" registro={propuesto} solo={['reject']} proyecto={proyecto} />
            </div>
          ) : null}
          {editable && sucio ? <p className="text-sg-caption text-sg-warning">{t('entregables.ia.guardeAntes')}</p> : null}
        </div>
      ) : lee && !borradores.isPending ? (
        <p className="text-sg-text-secondary">{t('entregables.ia.sinSugerencia')}</p>
      ) : null}
      {resumen && editable ? (
        <Button size="sm" variant="ghost" disabled={sucio} onClick={() => setUsando({ sugerencia: resumen, conSeccion: true })}>
          {t('entregables.ia.usarResumen')}
        </Button>
      ) : null}
      {usando ? <UsarSugerencia sugerencia={usando.sugerencia} seccion={seccion} conSeccion={usando.conSeccion} alCerrar={() => setUsando(null)} /> : null}
    </section>
  )
}

function UsarSugerencia({ sugerencia, seccion, conSeccion, alCerrar }: { sugerencia: Registro; seccion: Registro; conSeccion: boolean; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const aceptar = useAceptarSugerencia()
  const cliente = useQueryClient()
  const releer = useReleer()
  const [contenido, setContenido] = useState(() => deSugerencia(texto(sugerencia, 'suggested_value')))
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const lista = listaParaUsar(contenido)
  const usar = () => {
    setIntentado(true)
    if (!lista || !motivo.trim() || !contenido.trim()) return
    aceptar.mutate(
      { sugerencia, atributos: conSeccion ? { section: seccion.id, content: contenido } : { content: contenido }, motivo: motivo.trim() },
      {
        onSuccess: () => {
          void cliente.invalidateQueries({ queryKey: ['records', 'deliverable_section'] })
          alCerrar()
        }
      }
    )
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-sg-h3 font-semibold">{t('entregables.ia.usarTitulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('entregables.ia.usarAyuda')}</DialogDescription>
        <div className="mt-4 space-y-3">
          <Campo etiqueta={t('entregables.ia.texto')}>
            {(p) => <Textarea {...p} rows={10} className="font-sg-mono" value={contenido} onChange={(e) => setContenido(e.target.value)} />}
          </Campo>
          {!lista ? <Alert tone="warning">{t('entregables.ia.quedanMarcadores')}</Alert> : null}
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && !motivo.trim() ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {aceptar.isError ? (
            <AvisoDeConflicto
              error={aceptar.error}
              releer={() => releer(['record', 'ai_suggestion', sugerencia.id], ['records', 'ai_suggestion'])}
              alRecargar={() => aceptar.reset()}
            />
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={usar} disabled={!lista || aceptar.isPending} aria-busy={aceptar.isPending}>
            {aceptar.isPending ? t('entregables.ia.usando') : t('entregables.ia.confirmar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
