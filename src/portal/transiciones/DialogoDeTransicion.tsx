import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Textarea } from '@wasichai/ui'
import type { AvailableTransition } from '@wasichai/workflow'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { useMensajeDeError } from '../componentes/errores'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useAplicarTransicion, useComprobacion } from './api'
import { useTextoDeAviso, type TextoDeAviso } from './avisos'
import { exigeMotivo } from './reglas'

// el diálogo de transición de design-system.md §6.2: de dónde a dónde, las reglas que la bloquearían o que piden
// justificación (transition-checks), qué pasará y el motivo, obligatorio cuando la transición lo exige o hay advertencias.
// un 412 dice "otra persona cambió este registro" con "Recargar", y lo escrito se conserva; un 403 o un 409 con código
// dice el texto de su código. cada regla se dice con useTextoDeAviso: el campo con su etiqueta y la acción con su nombre,
// nunca sus nombres de la API
export function DialogoDeTransicion({
  objeto,
  registro,
  transicion,
  alCerrar,
  alAplicar
}: {
  objeto: string
  registro: Registro
  transicion: AvailableTransition
  alCerrar: () => void
  // la transición se aplicó: quien abrió el diálogo lo confirma (transiciones.hecho)
  alAplicar?: () => void
}) {
  const { t } = useTranslation(NS)
  const etiquetas = useEtiquetasDeEstado(objeto)
  const comprobacion = useComprobacion(objeto, registro.id, transicion.name)
  const textoDe = useTextoDeAviso(objeto)
  const aplicar = useAplicarTransicion(objeto)
  const mensaje = useMensajeDeError()
  const releer = useReleer()
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)

  const advertencias = comprobacion.data?.warnings ?? []
  const bloqueos = comprobacion.data?.blocking ?? []
  const motivoRequerido = exigeMotivo(objeto, transicion.name) || advertencias.length > 0
  const faltaMotivo = motivoRequerido && motivo.trim() === ''
  const desde = etiquetas[registro.state ?? ''] ?? registro.state ?? ''
  // las reglas permiten el paso: la comprobación llegó, nada lo bloquea y el servidor lo da por permitido
  const reglasOk = comprobacion.isSuccess && comprobacion.data.allowed && bloqueos.length === 0
  const puede = reglasOk && !faltaMotivo && !aplicar.isPending

  const confirmar = () => {
    setIntentado(true)
    if (!puede) return
    aplicar.mutate(
      { registro, transicion: transicion.name, motivo: motivo.trim() || undefined },
      {
        onSuccess: () => {
          alAplicar?.()
          alCerrar()
        }
      }
    )
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{transicion.label}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('transiciones.deA', { de: desde, a: transicion.toLabel })}</DialogDescription>
        <div className="mt-4 space-y-3">
          <section aria-label={t('transiciones.reglas')} className="space-y-2">
            {comprobacion.isPending ? <p className="text-sm text-sg-text-muted">{t('transiciones.comprobando')}</p> : null}
            {comprobacion.isError ? (
              <Alert tone="danger">
                {mensaje(comprobacion.error)}
                <Button variant="secondary" size="sm" className="ml-2" onClick={() => void comprobacion.refetch()}>
                  {t('comun.reintentar')}
                </Button>
              </Alert>
            ) : null}
            {bloqueos.map((b) => (
              <Alert key={`${b.code}-${b.field ?? ''}-${b.message}`} tone="danger" title={t('transiciones.bloqueo')}>
                <TextoDelAviso {...textoDe(b, transicion)} />
              </Alert>
            ))}
            {advertencias.map((a) => (
              <Alert key={`${a.code}-${a.field ?? ''}-${a.message}`} tone="warning" title={t('transiciones.advertencia')}>
                <TextoDelAviso {...textoDe(a, transicion)} />
              </Alert>
            ))}
            {comprobacion.isSuccess && !comprobacion.data.allowed && bloqueos.length === 0 ? (
              <Alert tone="danger">{t('transiciones.noPermitido')}</Alert>
            ) : null}
            {reglasOk && advertencias.length === 0 ? <p className="text-sm text-sg-success">{t('transiciones.sinBloqueos')}</p> : null}
          </section>
          <section className="rounded-sg-md bg-sg-surface-sunken p-3 text-sm">
            <h3 className="font-medium">{t('transiciones.quePasara')}</h3>
            <p>{t('transiciones.quePasaraTexto', { a: transicion.toLabel })}</p>
          </section>
          <Campo
            etiqueta={motivoRequerido ? t('comun.motivoObligatorio') : t('comun.motivoOpcional')}
            error={intentado && faltaMotivo ? t('comun.motivoFalta') : undefined}
          >
            {(props) => <Textarea {...props} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {aplicar.isError ? (
            // se relee el registro, la lista de botones y las reglas que muestra este diálogo: si el estado cambió, todo lo
            // demás quedó viejo y confirmar sobre reglas obsoletas daría un STATE_MISMATCH
            <AvisoDeConflicto
              error={aplicar.error}
              releer={() => releer(['record', objeto, registro.id], ['transitions', objeto, registro.id], ['transition-check', objeto, registro.id])}
              alRecargar={() => aplicar.reset()}
            />
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={!reglasOk || aplicar.isPending} aria-busy={aplicar.isPending}>
            {aplicar.isPending ? t('transiciones.confirmando') : t('transiciones.confirmar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TextoDelAviso({ texto, campo }: TextoDeAviso) {
  const { t } = useTranslation(NS)
  return (
    <>
      <p>{texto}</p>
      {campo ? <p className="text-sg-caption">{t('transiciones.campo', { campo })}</p> : null}
    </>
  )
}
