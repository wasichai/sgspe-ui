import { useAuth } from '@wasichai/core'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Textarea } from '@wasichai/ui'
import { useAvailableTransitions } from '../datos/flujos'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { OBJETOS_DE_QCS, rutaDeQcs, type ObjetoDeQcs } from '../datos/atencion'
import { texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useReclasificar } from './comandos'

// «Reclasificar…» se ofrece cuando el estado tiene una transición de reclasificación que el rol de quien mira puede dar: las
// close_reclassified_* son de comando (no son botones), pero GET …/transitions las lista con allowed
export function useOfreceReclasificar(objeto: ObjetoDeQcs, registro: Registro): boolean {
  const transiciones = useAvailableTransitions(objeto, registro.id)
  return (transiciones.data ?? []).some((tr) => tr.allowed && tr.name.startsWith('close_reclassified'))
}

// el diálogo de reclasificación (RF-GRV-007, ASM-072, api.md §4.6): el tipo nuevo (entre los que la cuenta puede crear), el código
// del registro nuevo (cada tipo numera los suyos) y el motivo, obligatorio. el servidor copia los datos comunes y la fecha de
// recepción del primer registro de la cadena y cierra el original; al terminar se abre la ficha del registro nuevo. un 412 ofrece
// «Recargar»; un reintento tras un corte repite la misma Idempotency-Key, así que el planteamiento no se reclasifica dos veces
export function DialogoDeReclasificacion({ objeto, registro, alCerrar }: { objeto: ObjetoDeQcs; registro: Registro; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const releer = useReleer()
  const reclasificar = useReclasificar(objeto)
  const destinos = OBJETOS_DE_QCS.filter((o) => o !== objeto && can(o, 'CREATE'))
  const [elegido, setDestino] = useState<ObjetoDeQcs | undefined>()
  const destino = elegido ?? destinos[0]
  const [codigo, setCodigo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const faltaCodigo = codigo.trim() === ''
  const faltaMotivo = motivo.trim() === ''
  const confirmar = () => {
    setIntentado(true)
    if (!destino || faltaCodigo || faltaMotivo) return
    reclasificar.mutate(
      { registro, destino, atributos: { code: codigo.trim() }, motivo: motivo.trim() },
      { onSuccess: ({ created }) => navegar(rutaDeQcs(texto(registro, 'project'), destino, created.id)) }
    )
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('piezas.reclasificar.titulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">
          {t('piezas.reclasificar.descripcion', { tipo: t(`comun.qcs.${objeto}`).toLowerCase(), codigo: texto(registro, 'code') })}
        </DialogDescription>
        <div className="mt-4 space-y-3">
          {destinos.length === 0 ? (
            <p className="text-sm text-sg-text-muted">{t('piezas.reclasificar.sinDestino')}</p>
          ) : (
            <fieldset className="space-y-1">
              <legend className="text-sg-body-sm font-medium">{t('piezas.reclasificar.destino')}</legend>
              {destinos.map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="destino" checked={destino === o} onChange={() => setDestino(o)} />
                  {t(`comun.qcs.${o}`)}
                </label>
              ))}
            </fieldset>
          )}
          <Campo
            etiqueta={t('piezas.reclasificar.codigo')}
            ayuda={t('piezas.reclasificar.codigoAyuda')}
            error={intentado && faltaCodigo ? t('piezas.reclasificar.codigoFalta') : undefined}
          >
            {(p) => <Input {...p} value={codigo} maxLength={60} onChange={(e) => setCodigo(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && faltaMotivo ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {reclasificar.isError ? (
            <AvisoDeConflicto
              error={reclasificar.error}
              releer={() => releer(['record', objeto, registro.id], ['transitions', objeto, registro.id])}
              alRecargar={() => reclasificar.reset()}
            />
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={!destino || reclasificar.isPending} aria-busy={reclasificar.isPending}>
            {reclasificar.isPending ? t('piezas.reclasificar.confirmando') : t('piezas.reclasificar.confirmar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
