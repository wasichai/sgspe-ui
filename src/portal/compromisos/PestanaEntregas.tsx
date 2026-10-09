import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useErroresDeCampo } from '../componentes/errores'
import { Cargando, Restringido, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { esMontoValido, montoPe, normalizarMonto } from '../componentes/Monto'
import { useNombreDeEvidencia } from '../documentos/api'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { FormularioDeEvidencia } from '../documentos/FormularioDeEvidencia'
import { hoyEnLima } from '../datos/fechas'
import { atributo, puedeEscribir, texto, useDefinicion, useTodos, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { ESTADOS_CONGELADOS, ESTADOS_DE_EJECUCION, useCorregirEntrega, useRegistrarEntrega } from './entregas'

// la pestaña Entregas de S29 y el drawer de S32 (screens.md §7, flujo 10): lo ejecutado frente a lo comprometido, cada
// entrega con su conformidad (quiénes la dieron y los receptores son restringidos, security.md §7.9) y sus evidencias, y el
// registro de una entrega con el acta y las fotos subidas antes de guardarla. guardar no cambia el estado: después viene
// «Registrar cumplimiento» (D9 y D10, en el diálogo de transición). con el compromiso cumplido las entregas no cambian
// (DELIVERY_FROZEN). el «Acta de entrega» como documento emitido espera a UPS-23 (plan 3.1): no se ofrece
export function PestanaEntregas({ compromiso, escribe }: { compromiso: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const entregas = useTodos('delivery', { commitment: compromiso.id, sort: 'delivery_date', dir: 'desc' })
  const [editando, setEditando] = useState<Registro | 'nueva' | null>(null)
  const estado = compromiso.state ?? ''
  const congelada = ESTADOS_CONGELADOS.includes(estado)
  const registra = escribe && ESTADOS_DE_EJECUCION.includes(estado) && can('delivery', 'CREATE') && can('commitment', 'UPDATE')
  const corrige = escribe && !congelada && can('delivery', 'UPDATE') && can('commitment', 'UPDATE')
  const recurso = texto(compromiso, 'resource_type')
  return (
    <section aria-label={t('entregas.titulo')} className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sg-h3 font-semibold">{t('entregas.titulo')}</h2>
        {registra ? (
          <Button size="sm" onClick={() => setEditando('nueva')}>
            {t('entregas.registrar')}
          </Button>
        ) : null}
      </div>
      <Ejecutado compromiso={compromiso} />
      {recurso === 'MATERIAL' || recurso === 'NO MATERIAL' ? <p className="text-sm text-sg-text-secondary">{t(`entregas.minima.${recurso}`)}</p> : null}
      <p className="text-sg-caption text-sg-text-muted">{t('entregas.sinActa')}</p>
      {congelada ? <Alert tone="notice">{estado === 'cancelled' ? t('entregas.congeladaCancelado') : t('entregas.congelada')}</Alert> : null}
      {entregas.isPending ? (
        <Cargando compacto />
      ) : entregas.isError && !entregas.data ? (
        <FalloDeLectura error={entregas.error} alReintentar={() => void entregas.refetch()} />
      ) : entregas.data.length === 0 ? (
        <Vacio titulo={t('entregas.vacia')} />
      ) : (
        <ul className="space-y-3">
          {entregas.data.map((e) => (
            <TarjetaDeEntrega
              key={e.id}
              entrega={e}
              compromiso={compromiso}
              escribe={escribe && !congelada}
              alCorregir={corrige ? () => setEditando(e) : undefined}
            />
          ))}
        </ul>
      )}
      {editando ? <EntregaDrawer compromiso={compromiso} entrega={editando === 'nueva' ? undefined : editando} alCerrar={() => setEditando(null)} /> : null}
    </section>
  )
}

export function Ejecutado({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const monto = Number(atributo(compromiso, 'amount') ?? 0)
  const ejecutado = atributo(compromiso, 'executed_amount')
  const moneda = atributo(compromiso, 'currency')
  const porcentaje = monto > 0 && ejecutado !== null && ejecutado !== undefined ? Math.min(100, (Number(ejecutado) / monto) * 100) : 0
  return (
    <div className="space-y-1 text-sm">
      <p>{t('entregas.ejecutado', { ejecutado: montoPe(ejecutado, moneda), monto: montoPe(atributo(compromiso, 'amount'), moneda) })}</p>
      <div className="h-2 overflow-hidden rounded-sg-sm bg-sg-surface-sunken" aria-hidden>
        <div className="h-full bg-sg-success" style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  )
}

function TarjetaDeEntrega({
  entrega,
  compromiso,
  escribe,
  alCorregir
}: {
  entrega: Registro
  compromiso: Registro
  escribe: boolean
  alCorregir?: () => void
}) {
  const { t } = useTranslation(NS)
  const leido = (campo: string) => (campo in entrega.attributes ? texto(entrega, campo) || '—' : <Restringido />)
  return (
    <li className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{t('entregas.tarjeta.titulo', { fecha: diaPe(texto(entrega, 'delivery_date')) })}</h3>
        {alCorregir ? (
          <Button size="sm" variant="secondary" onClick={alCorregir}>
            {t('entregas.corregir')}
          </Button>
        ) : null}
      </div>
      <p>{texto(entrega, 'delivered_items') || '—'}</p>
      <dl className="grid gap-1 sm:grid-cols-2">
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('entregas.tarjeta.monto')}</dt>
          <dd className="tabular-nums">{montoPe(atributo(entrega, 'delivered_amount'), atributo(compromiso, 'currency'))}</dd>
        </div>
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('entregas.tarjeta.conformidad')}</dt>
          <dd>{atributo(entrega, 'conformity_given') === true ? t('comun.si') : t('comun.no')}</dd>
        </div>
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('entregas.tarjeta.conformidadPor')}</dt>
          <dd>{leido('conformity_by')}</dd>
        </div>
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('entregas.tarjeta.receptores')}</dt>
          <dd>{leido('recipients')}</dd>
        </div>
      </dl>
      <EvidenciasDelRegistro
        objeto="delivery"
        registro={{ ...entrega, attributes: { project: texto(compromiso, 'project'), ...entrega.attributes } }}
        escribe={escribe}
      />
    </li>
  )
}

const esquema = z.object({
  delivery_date: z.string().min(1),
  place: z.string(),
  delivered_items: z.string(),
  delivered_amount: z.string().refine((v) => v.trim() === '' || esMontoValido(v)),
  recipients: z.string(),
  conformity_given: z.boolean(),
  conformity_by: z.string(),
  motivo: z.string().trim().min(1)
})
type Valores = z.infer<typeof esquema>
const CAMPOS = ['delivery_date', 'place', 'delivered_items', 'delivered_amount', 'recipients', 'conformity_given', 'conformity_by'] as const

const iniciales = (e?: Registro): Valores => ({
  delivery_date: e ? texto(e, 'delivery_date') : hoyEnLima(),
  place: texto(e, 'place'),
  delivered_items: texto(e, 'delivered_items'),
  delivered_amount: texto(e, 'delivered_amount'),
  recipients: texto(e, 'recipients'),
  conformity_given: atributo(e, 'conformity_given') === true,
  conformity_by: texto(e, 'conformity_by'),
  motivo: ''
})

// el drawer de S32 (?drawer=delivery): alta o corrección. las evidencias se suben fuera del <form> de la entrega (un formulario
// dentro de otro se enviaría con el de afuera, revisión del plan 2.3) y viajan por id al guardar
function EntregaDrawer({ compromiso, entrega, alCerrar }: { compromiso: Registro; entrega?: Registro; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const nombreDeEvidencia = useNombreDeEvidencia()
  const definicion = useDefinicion('delivery')
  const registrar = useRegistrarEntrega(compromiso.id)
  const corregir = useCorregirEntrega(compromiso.id)
  const releer = useReleer()
  const erroresDeCampo = useErroresDeCampo()
  const [subidas, setSubidas] = useState<Registro[]>([])
  const { register, handleSubmit, formState, control } = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: iniciales(entrega) })
  const conformidad = useWatch({ control, name: 'conformity_given' })
  const escribible = (campo: string) => puedeEscribir(definicion.data, campo)
  const comando = entrega ? corregir : registrar
  const delServidor = Object.fromEntries(Object.entries(erroresDeCampo(comando.error)).map(([c, x]) => [c.replace(/^attributes\./, ''), x]))
  const recurso = texto(compromiso, 'resource_type')
  const tipoInicial = recurso === 'MATERIAL' ? 'ACTA DE ENTREGA' : recurso === 'NO MATERIAL' ? 'ACTA' : ''
  const error = (campo: keyof Valores) => {
    if (delServidor[campo]) return delServidor[campo]
    if (!formState.errors[campo]) return undefined
    if (campo === 'delivery_date') return t('entregas.errores.fecha')
    if (campo === 'delivered_amount') return t('entregas.errores.monto')
    if (campo === 'motivo') return t('comun.motivoFalta')
    return undefined
  }
  const guardar = handleSubmit((v) => {
    const valores: Record<string, unknown> = {}
    for (const campo of CAMPOS) {
      if (campo !== 'delivery_date' && campo !== 'conformity_given' && !escribible(campo)) continue
      const valor = campo === 'delivered_amount' ? normalizarMonto(v.delivered_amount) : v[campo]
      valores[campo] = typeof valor === 'string' ? valor.trim() || null : valor
    }
    if (entrega) {
      const antes = iniciales(entrega)
      const cambios = Object.fromEntries(Object.entries(valores).filter(([c, x]) => (antes[c as keyof Valores] || null) !== x))
      corregir.mutate({ entrega, cambios, motivo: v.motivo.trim() }, { onSuccess: alCerrar })
    } else {
      const atributos = Object.fromEntries(Object.entries(valores).filter(([, x]) => x !== null))
      registrar.mutate({ atributos, evidencias: subidas.map((e) => e.id), motivo: v.motivo.trim() }, { onSuccess: alCerrar })
    }
  })
  const delFormulario = ['delivery_date', 'place', 'delivered_items', 'delivered_amount', 'recipients', 'conformity_by', 'reason']
  return (
    <Drawer
      titulo={entrega ? t('entregas.corregirTitulo') : t('entregas.registrarTitulo')}
      descripcion={t('entregas.ayuda')}
      abierto
      alCerrar={() => !comando.isPending && alCerrar()}
      pie={
        <>
          <Button variant="secondary" onClick={alCerrar} disabled={comando.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" form="entrega" disabled={comando.isPending} aria-busy={comando.isPending}>
            {comando.isPending ? t('entregas.guardando') : t('entregas.guardar')}
          </Button>
        </>
      }
    >
      <form id="entrega" className="space-y-3" onSubmit={(e) => void guardar(e)}>
        <Campo etiqueta={t('entregas.campos.delivery_date')} error={error('delivery_date')}>
          {(p) => <Input {...p} type="date" {...register('delivery_date')} />}
        </Campo>
        <Campo etiqueta={t('entregas.campos.place')} error={error('place')}>
          {(p) => <Input {...p} {...register('place')} maxLength={300} />}
        </Campo>
        <Campo etiqueta={t('entregas.campos.delivered_items')} error={error('delivered_items')}>
          {(p) => <Textarea {...p} {...register('delivered_items')} maxLength={4000} />}
        </Campo>
        <Campo etiqueta={t('entregas.campos.delivered_amount')} error={error('delivered_amount')}>
          {(p) => <Input {...p} inputMode="decimal" {...register('delivered_amount')} />}
        </Campo>
        {escribible('recipients') ? (
          <Campo etiqueta={t('entregas.campos.recipients')} error={error('recipients')}>
            {(p) => <Textarea {...p} {...register('recipients')} maxLength={4000} />}
          </Campo>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('conformity_given')} />
          {t('entregas.campos.conformity_given')}
        </label>
        {conformidad && escribible('conformity_by') ? (
          <Campo etiqueta={t('entregas.campos.conformity_by')} error={error('conformity_by')}>
            {(p) => <Textarea {...p} {...register('conformity_by')} maxLength={4000} />}
          </Campo>
        ) : null}
        <Campo etiqueta={t('comun.motivoObligatorio')} error={error('motivo') ?? delServidor.reason}>
          {(p) => <Textarea {...p} {...register('motivo')} maxLength={500} />}
        </Campo>
        {comando.isError && !Object.keys(delServidor).some((c) => delFormulario.includes(c)) ? (
          <AvisoDeConflicto
            error={comando.error}
            propios={{ STATE_MISMATCH: t('entregas.errores.estado') }}
            releer={() => releer(['records', 'delivery'], ['record', 'commitment', compromiso.id])}
            alRecargar={() => comando.reset()}
          />
        ) : null}
      </form>
      {entrega ? null : (
        <section aria-label={t('entregas.evidencias')} className="space-y-3 border-t border-sg-border pt-3">
          <h3 className="font-medium">{t('entregas.evidencias')}</h3>
          <p className="text-sg-caption text-sg-text-muted">{t('entregas.evidenciasAyuda')}</p>
          <h4 className="text-sm font-medium">{t('entregas.subidas')}</h4>
          {subidas.length === 0 ? (
            <p className="text-sm text-sg-text-muted">{t('entregas.sinSubidas')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {subidas.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  {nombreDeEvidencia(e)} · {texto(e, 'evidence_type')}
                  <button
                    type="button"
                    className="text-sg-caption text-sg-primary-text underline"
                    aria-label={t('entregas.quitarSubida', { nombre: nombreDeEvidencia(e) })}
                    onClick={() => setSubidas(subidas.filter((x) => x.id !== e.id))}
                  >
                    {t('comun.quitar')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <FormularioDeEvidencia proyecto={texto(compromiso, 'project')} tipoInicial={tipoInicial} alRegistrar={(e) => setSubidas((s) => [...s, e])} />
        </section>
      )}
    </Drawer>
  )
}
