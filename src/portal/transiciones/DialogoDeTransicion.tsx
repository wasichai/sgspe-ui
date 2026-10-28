import { useFocoDeRegreso } from '../componentes/foco'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Textarea } from '@wasichai/ui'
import type { AvailableTransition } from '@wasichai/workflow'
import type { FieldMeta } from '@wasichai/core'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { useMensajeDeError } from '../componentes/errores'
import { atributo, useActualizar, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useAplicarTransicion, useComprobacion } from './api'
import { useTextoDeAviso, type TextoDeAviso } from './avisos'
import { DatoDelPaso, datoVacio, useBloqueosDelPaso, valorInicial, valorParaEnviar } from './DatosDelPaso'
import { esDestructiva, exigeMotivo } from './reglas'

// el diálogo de transición de design-system.md §6.2: de dónde a dónde, las reglas que la bloquearían o que piden
// justificación (transition-checks), qué pasará y el motivo, obligatorio cuando la transición lo exige o hay advertencias.
// un 412 dice "otra persona cambió este registro" con "Recargar", y lo escrito se conserva; un 403 o un 409 con código
// dice el texto de su código. cada regla se dice con useTextoDeAviso: el campo con su etiqueta y la acción con su nombre,
// nunca sus nombres de la API. los datos que el paso exige y quien mira puede escribir (useBloqueosDelPaso) se piden aquí, con el
// mismo motivo: se guardan primero y la transición se aplica sobre la versión nueva (tercera pasada de UX, 1.2). el botón repite el
// verbo de la transición («Resolver», no «Confirmar») y «Qué pasará» suma lo que el paso hace además del estado (1.3)
// X-Change-Reason admite 500 caracteres (RQ-AUD-002): con un anexo, lo que la persona escribe deja sitio al anexo y al separador
const LIMITE_DEL_MOTIVO = 500
const SEPARADOR = ' · '

export function DialogoDeTransicion({
  objeto,
  registro,
  transicion,
  alCerrar,
  alAplicar,
  focoAlAplicar,
  anexo
}: {
  objeto: string
  registro: Registro
  transicion: AvailableTransition
  alCerrar: () => void
  // la transición se aplicó: quien abrió el diálogo lo confirma (transiciones.hecho)
  alAplicar?: () => void
  // a dónde va el foco tras aplicar (la confirmación, que dice qué sigue); sin él, vuelve a quien abrió el diálogo
  focoAlAplicar?: () => HTMLElement | null
  // lo que la pantalla agrega al motivo que escribe la persona (decisión 13 del plan 8.3: «Aprobar» un entregable lleva el SHA-256
  // del modelo revisado); se muestra antes de confirmar
  anexo?: string
}) {
  const { t, i18n } = useTranslation(NS)
  const etiquetas = useEtiquetasDeEstado(objeto)
  const comprobacion = useComprobacion(objeto, registro.id, transicion.name)
  const textoDe = useTextoDeAviso(objeto)
  const aplicar = useAplicarTransicion(objeto)
  const actualizar = useActualizar(objeto)
  const mensaje = useMensajeDeError()
  const releer = useReleer()
  const [motivo, setMotivo] = useState('')
  const [datos, setDatos] = useState<Record<string, string>>({})
  const [intentado, setIntentado] = useState(false)
  const aplicado = useRef(false)

  const advertencias = comprobacion.data?.warnings ?? []
  const { pedidos, otros } = useBloqueosDelPaso(objeto, comprobacion.data?.blocking ?? [])
  const valorDe = (campo: FieldMeta) => datos[campo.name] ?? valorInicial(campo, atributo(registro, campo.name))
  const faltanDatos = pedidos.some((campo) => datoVacio(campo, valorDe(campo)))
  const motivoRequerido = exigeMotivo(objeto, transicion.name) || advertencias.length > 0
  const faltaMotivo = motivoRequerido && motivo.trim() === ''
  const desde = etiquetas[registro.state ?? ''] ?? registro.state ?? ''
  // las reglas permiten el paso: la comprobación llegó, nada que el diálogo no pida lo bloquea y el servidor lo da por permitido (o
  // solo lo impiden los datos que se piden aquí)
  const reglasOk = comprobacion.isSuccess && otros.length === 0 && (comprobacion.data.allowed || pedidos.length > 0)
  const ocupado = actualizar.isPending || aplicar.isPending
  const puede = reglasOk && !faltaMotivo && !faltanDatos && !ocupado

  const confirmar = () => {
    setIntentado(true)
    if (!puede) return
    const motivoDelPaso = [motivo.trim(), anexo].filter(Boolean).join(SEPARADOR) || undefined
    const aplicarSobre = (version: Registro) =>
      aplicar.mutate(
        { registro: version, transicion: transicion.name, motivo: motivoDelPaso },
        {
          onSuccess: () => {
            aplicado.current = true
            alAplicar?.()
            alCerrar()
          }
        }
      )
    if (pedidos.length === 0) return aplicarSobre(registro)
    const cambios = Object.fromEntries(pedidos.map((campo) => [campo.name, valorParaEnviar(campo, valorDe(campo))]))
    actualizar.mutate({ registro, cambios, motivo: motivoDelPaso }, { onSuccess: aplicarSobre })
  }
  const error = actualizar.error ?? aplicar.error
  const lista = new Intl.ListFormat(i18n.language, { type: 'conjunction' })
  const efecto = t(`transiciones.efectos.${objeto}.${transicion.name}`, { defaultValue: '' })
  // el verbo, con el objeto si el paso cierra el registro («Cancelar el compromiso»), como su botón en la ficha; si aun así se lee
  // igual que cerrar el diálogo (en inglés el objeto no se nombra), cerrar dice «Volver»
  const destructiva = esDestructiva(transicion)
  const verbo = destructiva ? [transicion.label, t(`transiciones.elObjeto.${objeto}`, { defaultValue: '' })].filter(Boolean).join(' ') : transicion.label
  const cerrarDice = verbo.trim().toLowerCase() === t('comun.cancelar').toLowerCase() ? t('transiciones.volver') : t('comun.cancelar')

  // el foco vuelve al botón que abrió el diálogo (revisión de UX, etapa 8) o, aplicado el paso, a lo que dice qué sigue (1.4)
  const regreso = useFocoDeRegreso()
  const alCerrarElFoco = (evento: Event) => {
    const destino = aplicado.current ? focoAlAplicar?.() : null
    if (!destino) return regreso.onCloseAutoFocus(evento)
    evento.preventDefault()
    destino.focus()
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg" onOpenAutoFocus={regreso.onOpenAutoFocus} onCloseAutoFocus={alCerrarElFoco}>
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
            {otros.map((b) => (
              <Alert key={`${b.code}-${b.field ?? ''}-${b.message}`} tone="danger" title={t('transiciones.bloqueo')}>
                <TextoDelAviso {...textoDe(b, transicion)} />
              </Alert>
            ))}
            {advertencias.map((a) => (
              <Alert key={`${a.code}-${a.field ?? ''}-${a.message}`} tone="warning" title={t('transiciones.advertencia')}>
                <TextoDelAviso {...textoDe(a, transicion)} />
              </Alert>
            ))}
            {comprobacion.isSuccess && !comprobacion.data.allowed && otros.length === 0 && pedidos.length === 0 ? (
              <Alert tone="danger">{t('transiciones.noPermitido')}</Alert>
            ) : null}
            {reglasOk && advertencias.length === 0 ? (
              <p className="text-sm text-sg-success">{pedidos.length > 0 ? t('transiciones.soloFaltanDatos') : t('transiciones.sinBloqueos')}</p>
            ) : null}
          </section>
          {reglasOk && pedidos.length > 0 ? (
            <section aria-label={t('transiciones.datosDelPaso')} className="space-y-3">
              {pedidos.map((campo) => (
                <DatoDelPaso
                  key={campo.name}
                  campo={campo}
                  valor={valorDe(campo)}
                  alCambiar={(valor) => setDatos((d) => ({ ...d, [campo.name]: valor }))}
                  error={intentado && datoVacio(campo, valorDe(campo)) ? t('transiciones.datoFalta') : undefined}
                  ayuda={t(`transiciones.ayudasDelPaso.${objeto}.${transicion.name}.${campo.name}`, { defaultValue: '' }) || undefined}
                />
              ))}
            </section>
          ) : null}
          <section className="rounded-sg-md bg-sg-surface-sunken p-3 text-sm">
            <h3 className="font-medium">{t('transiciones.quePasara')}</h3>
            <p>{t('transiciones.quePasaraTexto', { a: transicion.toLabel })}</p>
            {efecto ? <p>{efecto}</p> : null}
            {reglasOk && pedidos.length > 0 ? (
              <p>{t('transiciones.seGuardan', { campos: lista.format(pedidos.map((campo) => `«${campo.label || campo.name}»`)) })}</p>
            ) : null}
          </section>
          <Campo
            etiqueta={motivoRequerido ? t('comun.motivoObligatorio') : t('comun.motivoOpcional')}
            error={intentado && faltaMotivo ? t('comun.motivoFalta') : undefined}
          >
            {(props) => (
              <Textarea
                {...props}
                maxLength={LIMITE_DEL_MOTIVO - (anexo ? anexo.length + SEPARADOR.length : 0)}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            )}
          </Campo>
          {anexo ? <p className="text-sg-caption text-sg-text-muted">{t('transiciones.anexo', { anexo })}</p> : null}
          {error ? (
            // se relee el registro, la lista de botones y las reglas que muestra este diálogo: si el estado cambió, todo lo
            // demás quedó viejo y confirmar sobre reglas obsoletas daría un STATE_MISMATCH
            <AvisoDeConflicto
              error={error}
              releer={() => releer(['record', objeto, registro.id], ['transitions', objeto, registro.id], ['transition-check', objeto, registro.id])}
              alRecargar={() => {
                actualizar.reset()
                aplicar.reset()
              }}
            />
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {cerrarDice}
          </Button>
          <Button variant={destructiva ? 'danger' : 'primary'} onClick={confirmar} disabled={!reglasOk || ocupado} aria-busy={ocupado}>
            {ocupado ? t('transiciones.confirmando') : verbo}
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
