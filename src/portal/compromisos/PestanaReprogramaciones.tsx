import { useAuth } from '@wasichai/core'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { useErroresDeCampo } from '../componentes/errores'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { diaPe, fechaPe, NS } from '../i18n'
import { ESTADOS_REPROGRAMABLES, useReprogramar } from './reprogramaciones'
import { Dia } from '../componentes/Dia'

// la pestaña Reprogramaciones de S29 (screens.md §7, RF-COM-003): el historial inmutable de fechas y el diálogo de
// reprogramación (fecha anterior, nueva, motivo y «acordado con el grupo de interés»). solo en approved, in_progress o blocked,
// con la guarda del proyecto (escribe) y los permisos de los dos objetos que escribe el comando. un 412 ofrece «Recargar» y
// conserva lo escrito; STATE_MISMATCH dice que el estado cambió
export function PestanaReprogramaciones({ compromiso, escribe }: { compromiso: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const historial = useTodos('commitment_reschedule', { commitment: compromiso.id, sort: 'created_at', dir: 'desc' })
  const [abierto, setAbierto] = useState(false)
  const [hecha, setHecha] = useState<string | null>(null)
  const reprograma = escribe && ESTADOS_REPROGRAMABLES.includes(compromiso.state ?? '') && can('commitment_reschedule', 'CREATE') && can('commitment', 'UPDATE')
  return (
    <section aria-label={t('reprogramaciones.titulo')} className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sg-h3 font-semibold">{t('reprogramaciones.titulo')}</h2>
        {reprograma ? (
          <Button
            size="sm"
            onClick={() => {
              setHecha(null)
              setAbierto(true)
            }}
          >
            {t('reprogramaciones.reprogramar')}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-sg-text-secondary">{t('reprogramaciones.ayuda')}</p>
      {hecha ? (
        <p role="status" className="text-sm text-sg-success">
          {t('reprogramaciones.hecha', { fecha: diaPe(hecha) })}
        </p>
      ) : null}
      {historial.isPending ? (
        <Cargando compacto />
      ) : historial.isError && !historial.data ? (
        <FalloDeLectura error={historial.error} alReintentar={() => void historial.refetch()} />
      ) : historial.data.length === 0 ? (
        <Vacio titulo={t('reprogramaciones.vacia')} />
      ) : (
        <Table aria-label={t('reprogramaciones.titulo')}>
          <thead>
            <tr>
              {(['cuando', 'anterior', 'nueva', 'motivo', 'acordada'] as const).map((c) => (
                <Th key={c} scope="col">
                  {t(`reprogramaciones.columnas.${c}`)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historial.data.map((r) => (
              <tr key={r.id}>
                <Td className="text-sm">{r.createdAt ? fechaPe(new Date(r.createdAt)) : '—'}</Td>
                <Td className="text-sm">
                  <Dia valor={texto(r, 'previous_due_date')} />
                </Td>
                <Td className="text-sm">
                  <Dia valor={texto(r, 'new_due_date')} />
                </Td>
                <Td className="text-sm">{texto(r, 'reschedule_reason')}</Td>
                <Td className="text-sm">{atributo(r, 'agreed_with_stakeholder') === true ? t('comun.si') : t('comun.no')}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {abierto ? (
        <DialogoDeReprogramacion
          compromiso={compromiso}
          alCerrar={() => setAbierto(false)}
          alReprogramar={(fecha) => {
            setHecha(fecha)
            setAbierto(false)
          }}
        />
      ) : null}
    </section>
  )
}

function DialogoDeReprogramacion({
  compromiso,
  alCerrar,
  alReprogramar
}: {
  compromiso: Registro
  alCerrar: () => void
  alReprogramar: (fecha: string) => void
}) {
  const { t } = useTranslation(NS)
  const reprogramar = useReprogramar(compromiso)
  const releer = useReleer()
  const erroresDeCampo = useErroresDeCampo()
  const [nueva, setNueva] = useState('')
  const [motivo, setMotivo] = useState('')
  const [acordada, setAcordada] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const vigente = texto(compromiso, 'due_date')
  const delServidor = erroresDeCampo(reprogramar.error)
  const errorDeFecha =
    delServidor['attributes.new_due_date'] ??
    (intentado ? (!nueva ? t('reprogramaciones.errores.fecha') : nueva === vigente ? t('reprogramaciones.errores.misma') : undefined) : undefined)
  const errorDeMotivo =
    delServidor['attributes.reschedule_reason'] ?? delServidor.reason ?? (intentado && !motivo.trim() ? t('reprogramaciones.errores.motivo') : undefined)
  const confirmar = () => {
    setIntentado(true)
    if (!nueva || nueva === vigente || !motivo.trim()) return
    reprogramar.mutate({ nueva, motivo: motivo.trim(), acordada }, { onSuccess: () => alReprogramar(nueva) })
  }
  const deCampo = Object.keys(delServidor).some((c) => ['attributes.new_due_date', 'attributes.reschedule_reason', 'reason'].includes(c))
  // el error del servidor junto a un campo era del valor enviado: al cambiar la fecha o el motivo deja de valer
  const alEditar = () => {
    if (deCampo) reprogramar.reset()
  }
  return (
    <Dialog open onOpenChange={(abrir) => !abrir && !reprogramar.isPending && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('reprogramaciones.dialogo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">
          {t('reprogramaciones.anterior', { fecha: vigente ? diaPe(vigente) : '—' })}
        </DialogDescription>
        <div className="mt-3 space-y-3">
          <Campo etiqueta={t('reprogramaciones.nueva')} error={errorDeFecha}>
            {(p) => (
              <Input
                {...p}
                type="date"
                value={nueva}
                onChange={(e) => {
                  setNueva(e.target.value)
                  alEditar()
                }}
              />
            )}
          </Campo>
          <Campo etiqueta={t('reprogramaciones.motivo')} error={errorDeMotivo}>
            {(p) => (
              // X-Change-Reason admite 500 caracteres (api.md §3.7)
              <Textarea
                {...p}
                value={motivo}
                maxLength={500}
                onChange={(e) => {
                  setMotivo(e.target.value)
                  alEditar()
                }}
              />
            )}
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={acordada} onChange={(e) => setAcordada(e.target.checked)} />
            {t('reprogramaciones.acordada')}
          </label>
          {reprogramar.isError && !deCampo ? (
            <AvisoDeConflicto
              error={reprogramar.error}
              propios={{ STATE_MISMATCH: t('reprogramaciones.errores.estado') }}
              releer={() => releer(['record', 'commitment', compromiso.id], ['transitions', 'commitment', compromiso.id])}
              alRecargar={() => reprogramar.reset()}
            />
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar} disabled={reprogramar.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={reprogramar.isPending} aria-busy={reprogramar.isPending}>
            {reprogramar.isPending ? t('reprogramaciones.guardando') : t('reprogramaciones.guardar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
