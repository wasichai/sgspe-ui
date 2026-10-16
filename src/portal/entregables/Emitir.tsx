import { useAuth } from '@wasichai/core'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { codigoDelError } from '../datos/http'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { useEmitir, useEstadoDelBorrador, type EstadoDelBorrador } from './contrato'

// las acciones de S50 (deliverables.md §8.3 a §8.5): las transiciones de WF-H con motivo (issue es de comando y tiene su diálogo) y
// «Emitir…». «Aprobar» agrega al motivo el SHA-256 del modelo revisado (decisión 13 del plan); sin el estado del borrador leído no
// se ofrece. emitir es de approved con el borrador LISTO, ISSUE y la asignación vigente; un mapa fallido lo deshabilita con la
// razón. se emite exactamente el modelo que la persona ve (draftModelSha256) y la lista EXTERNO entera (deliverables.md §9.4)
const LISTA = ['narrativa', 'fotos', 'mapas', 'anexos'] as const

export function AccionesDelEntregable({ entregable }: { entregable: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const estado = useEstadoDelBorrador(entregable.id)
  const proyecto = texto(entregable, 'project') || undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const [emitiendo, setEmitiendo] = useState(false)
  const [emitida, setEmitida] = useState<string | null>(null)
  const sha = estado.data?.modelSha256
  const ofreceEmitir = entregable.state === 'approved' && estado.data?.status === 'LISTO' && can('deliverable', 'ISSUE') && escribe
  const mapaFallido = (estado.data?.warnings ?? []).some((a) => a.code === 'MAP_FAILED')
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <BotonesDeTransicion
          objeto="deliverable"
          registro={entregable}
          proyecto={proyecto}
          ocultar={sha ? [] : ['approve']}
          anexos={sha ? { approve: t('entregables.aprobar.anexo', { sha }) } : {}}
        />
        {ofreceEmitir ? (
          <Button
            size="sm"
            disabled={mapaFallido}
            title={mapaFallido ? t('entregables.emitir.mapaFallido') : undefined}
            onClick={() => {
              setEmitida(null)
              setEmitiendo(true)
            }}
          >
            {t('entregables.emitir.boton')}
          </Button>
        ) : null}
      </div>
      {emitida !== null ? (
        <p role="status" className="text-sm text-sg-success">
          {t('entregables.emitir.hecho', { revision: emitida })}
        </p>
      ) : null}
      {emitiendo && estado.data ? (
        <DialogoDeEmision
          entregable={entregable}
          estado={estado.data}
          alCerrar={() => setEmitiendo(false)}
          alEmitir={(revision) => {
            setEmitiendo(false)
            setEmitida(revision)
          }}
        />
      ) : null}
    </div>
  )
}

function DialogoDeEmision({
  entregable,
  estado,
  alCerrar,
  alEmitir
}: {
  entregable: Registro
  estado: EstadoDelBorrador
  alCerrar: () => void
  alEmitir: (revision: string) => void
}) {
  const { t } = useTranslation(NS)
  const emitir = useEmitir(entregable.id)
  const releer = useReleer()
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [motivo, setMotivo] = useState('')
  const listaEntera = LISTA.every((c) => marcadas.has(c))
  const puede = listaEntera && motivo.trim() !== '' && Boolean(estado.modelSha256) && !emitir.isPending
  const alternar = (clave: string) => {
    const siguiente = new Set(marcadas)
    if (siguiente.has(clave)) siguiente.delete(clave)
    else siguiente.add(clave)
    setMarcadas(siguiente)
  }
  const confirmar = () => {
    if (!puede || !estado.modelSha256) return
    emitir.mutate(
      { entregable, draftModelSha256: estado.modelSha256, checklistConfirmed: true, motivo: motivo.trim() },
      { onSuccess: (r) => alEmitir(texto(r.deliverable, 'current_revision')) }
    )
  }
  const modeloDistinto = emitir.isError && codigoDelError(emitir.error) === 'MODEL_MISMATCH'
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-sg-h3 font-semibold">{t('entregables.emitir.titulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('entregables.emitir.ayuda')}</DialogDescription>
        <div className="mt-4 space-y-3 text-sm">
          <div className="space-y-1">
            <p className="font-medium">{t('entregables.emitir.modelo')}</p>
            <p className="break-all font-sg-mono text-sg-caption">{estado.modelSha256}</p>
            <p className="font-medium">{t('entregables.emitir.candidatas')}</p>
            {estado.levels.map((n) => (
              <p key={n.level} className="break-all font-sg-mono text-sg-caption">
                {`${n.level}: ${n.candidateSha256 ?? '—'}`}
              </p>
            ))}
          </div>
          <fieldset className="space-y-1 rounded-sg-md border border-sg-border p-3">
            <legend className="px-1 font-medium">{t('entregables.emitir.lista.titulo')}</legend>
            {LISTA.map((c) => (
              <label key={c} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={marcadas.has(c)} onChange={() => alternar(c)} />
                {t(`entregables.emitir.lista.${c}`)}
              </label>
            ))}
          </fieldset>
          <Campo etiqueta={t('comun.motivoObligatorio')}>
            {(p) => <Textarea {...p} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {emitir.isError ? (
            <AvisoDeConflicto
              error={emitir.error}
              releer={() => releer(['record', 'deliverable', entregable.id], ['deliverable-draft', entregable.id])}
              alRecargar={() => emitir.reset()}
            >
              {modeloDistinto ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-2"
                  onClick={() => {
                    emitir.reset()
                    void releer(['deliverable-draft', entregable.id], ['record', 'deliverable', entregable.id])
                  }}
                >
                  {t('entregables.emitir.recargarBorrador')}
                </Button>
              ) : null}
            </AvisoDeConflicto>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={!puede} aria-busy={emitir.isPending}>
            {emitir.isPending ? t('entregables.emitir.emitiendo') : t('entregables.emitir.confirmar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
