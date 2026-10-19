import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, PdfDialog, Textarea } from '@wasichai/ui'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { guardarArchivo, usePedir } from '../datos/http'
import { texto, type Registro } from '../datos/registros'
import { fechaYHoraPe, NS } from '../i18n'
import { rutaDelBorrador, useEstadoDelBorrador, usePedirBorrador } from './contrato'
import { EDITABLE_EN } from './tipos'
import { Huella } from '../componentes/Huella'
import { rotuloDeOpcion } from '../datos/opciones'

// el panel del borrador de S50 (deliverables.md §8.2, api.md §4.12): el estado, la letra, los avisos con su sección y la huella de
// cada candidata (que nunca se descarga). mientras está pendiente se consulta cada 5 s (useEstadoDelBorrador) y, al terminar, se
// relee el entregable y sus secciones (las marcas de «cambió después del borrador» dependen de draft_generated_at). los archivos,
// siempre con la marca BORRADOR, solo para quien tiene DOWNLOAD_RESTRICTED: el PDF de cada nivel en PdfDialog y el DOCX INTERNO.
// pedir un borrador es de draft u observed, con GENERATE y UPDATE y la asignación vigente, y lleva motivo
type Nivel = 'INTERNO' | 'EXTERNO'

export function PanelDelBorrador({ entregable, secciones }: { entregable: Registro; secciones: Registro[] }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const pedir = usePedir()
  const cliente = useQueryClient()
  const mensaje = useMensajeDeError()
  const estado = useEstadoDelBorrador(entregable.id)
  const escribe = useEscribeEnProyecto(texto(entregable, 'project') || undefined)
  const [pidiendo, setPidiendo] = useState(false)
  const [viendo, setViendo] = useState<Nivel | null>(null)
  const [falloDeDescarga, setFalloDeDescarga] = useState<unknown>(null)
  const pendienteAntes = useRef<boolean | undefined>(undefined)
  const pendiente = estado.data?.pending
  useEffect(() => {
    if (pendienteAntes.current === true && pendiente === false) {
      void cliente.invalidateQueries({ queryKey: ['record', 'deliverable', entregable.id] })
      void cliente.invalidateQueries({ queryKey: ['records', 'deliverable_section'] })
    }
    pendienteAntes.current = pendiente
  }, [pendiente, cliente, entregable.id])
  const descarga = can('deliverable', 'DOWNLOAD_RESTRICTED')
  const pide = EDITABLE_EN.includes(entregable.state ?? '') && can('deliverable', 'GENERATE') && can('deliverable', 'UPDATE') && escribe
  const tituloDe = (clave: string | null): string => {
    const seccion = secciones.find((s) => texto(s, 'section_key') === clave)
    return seccion ? texto(seccion, 'title') : (clave ?? '')
  }
  const titulo = t('entregables.borrador.titulo')
  const descargarDocx = () => {
    setFalloDeDescarga(null)
    return pedir
      .archivo(rutaDelBorrador(entregable.id, 'INTERNO', 'docx'))
      .then((a) => guardarArchivo(a, `${texto(entregable, 'document_code') || 'borrador'}-borrador.docx`))
      .catch(setFalloDeDescarga)
  }
  return (
    <section aria-label={titulo} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
      {estado.isPending ? (
        <Cargando compacto />
      ) : estado.isError && !estado.data ? (
        <FalloDeLectura error={estado.error} alReintentar={() => void estado.refetch()} />
      ) : estado.data ? (
        <>
          <p>{t('entregables.borrador.estado', { estado: rotuloDeOpcion(estado.data.status ?? 'SIN GENERAR') })}</p>
          {estado.data.revision ? <p>{t('entregables.borrador.letra', { letra: estado.data.revision })}</p> : null}
          {estado.data.generatedAt ? (
            <p className="text-sg-caption text-sg-text-muted">
              {t('entregables.borrador.congelado', { fecha: fechaYHoraPe(new Date(estado.data.generatedAt)) })}
            </p>
          ) : null}
          {estado.data.pending ? (
            <p role="status" className="text-sg-text-secondary">
              {t('entregables.borrador.consultando')}
            </p>
          ) : null}
          {estado.isError ? (
            <Alert tone="warning">
              {t('entregables.borrador.sinActualizar')}
              <Button size="sm" variant="secondary" className="ml-2" onClick={() => void estado.refetch()}>
                {t('comun.reintentar')}
              </Button>
            </Alert>
          ) : null}
          {estado.data.warnings.length > 0 ? (
            <ul aria-label={t('entregables.borrador.avisosDelBorrador')} className="space-y-1">
              {estado.data.warnings.map((a, i) => (
                <li key={`${a.code}-${a.section ?? ''}-${i}`} className={a.code === 'MAP_FAILED' ? 'text-sg-danger' : 'text-sg-warning'}>
                  {t(`entregables.borrador.avisos.${a.code}`, { seccion: tituloDe(a.section), defaultValue: t('entregables.borrador.avisos.otro') })}
                </li>
              ))}
            </ul>
          ) : null}
          {estado.data.levels.map((n) =>
            n.candidateSha256 ? (
              <div key={n.level} className="space-y-1">
                <Huella etiqueta={t('entregables.borrador.huella', { nivel: rotuloDeOpcion(n.level) })} valor={n.candidateSha256} />
                {descarga ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setViendo(n.level)}>
                      {t('entregables.borrador.verPdf', { nivel: rotuloDeOpcion(n.level) })}
                    </Button>
                    {n.level === 'INTERNO' ? (
                      <Button size="sm" variant="ghost" onClick={() => void descargarDocx()}>
                        {t('entregables.borrador.descargarDocx')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null
          )}
          {!descarga ? <p className="text-sg-caption text-sg-text-muted">{t('entregables.borrador.sinDescarga')}</p> : null}
          {falloDeDescarga ? <Alert tone="danger">{mensaje(falloDeDescarga)}</Alert> : null}
          {pide ? (
            <Button size="sm" disabled={estado.data.pending} onClick={() => setPidiendo(true)}>
              {estado.data.status ? t('entregables.borrador.otro') : t('entregables.borrador.pedir')}
            </Button>
          ) : null}
        </>
      ) : null}
      {pidiendo ? <PedirBorrador entregable={entregable} alCerrar={() => setPidiendo(false)} /> : null}
      {viendo ? (
        <PdfDialog
          title={t('entregables.borrador.vistaPrevia', { nivel: rotuloDeOpcion(viendo) })}
          source={rutaDelBorrador(entregable.id, viendo, 'pdf')}
          load={(ruta) => pedir.archivo(ruta).then((a) => ({ blob: a.blob, filename: a.nombre ?? `borrador-${viendo}.pdf` }))}
          onClose={() => setViendo(null)}
          renderError={(error) => <p>{mensaje(error)}</p>}
        />
      ) : null}
    </section>
  )
}

function PedirBorrador({ entregable, alCerrar }: { entregable: Registro; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const pedirBorrador = usePedirBorrador(entregable.id)
  const releer = useReleer()
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const confirmar = () => {
    setIntentado(true)
    if (!motivo.trim()) return
    pedirBorrador.mutate({ motivo: motivo.trim() }, { onSuccess: alCerrar })
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('entregables.borrador.pedir')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('entregables.borrador.pedirAyuda')}</DialogDescription>
        <div className="mt-4 space-y-3">
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && !motivo.trim() ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {pedirBorrador.isError ? (
            <AvisoDeConflicto
              error={pedirBorrador.error}
              propios={{ 'STATE_MISMATCH:record': t('entregables.borrador.fueraDeEstado'), 'STATE_MISMATCH:state': t('entregables.borrador.fueraDeEstado') }}
              releer={() => releer(['record', 'deliverable', entregable.id], ['deliverable-draft', entregable.id])}
              alRecargar={() => pedirBorrador.reset()}
            />
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={pedirBorrador.isPending} aria-busy={pedirBorrador.isPending}>
            {pedirBorrador.isPending ? t('entregables.borrador.pidiendo') : t('entregables.borrador.confirmar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
