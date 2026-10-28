import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { CampoFecha } from '../componentes/CampoFecha'
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
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { ESTADOS_CONGELADOS, ESTADOS_DE_EJECUCION, useCorregirEntrega, useRegistrarEntrega } from './entregas'
import { opcion, rotuloDeOpcion } from '../datos/opciones'

// la pestaña Entregas de S29 y el drawer de S32 (screens.md §7, flujo 10): lo ejecutado frente a lo comprometido, cada
// entrega con su conformidad (quiénes la dieron y los receptores son restringidos, security.md §7.9) y sus evidencias, y el
// registro de una entrega con el acta y las fotos subidas antes de guardarla. guardar no cambia el estado: después viene
// «Registrar cumplimiento» (D9 y D10, en el diálogo de transición). con el compromiso cumplido las entregas no cambian
// (DELIVERY_FROZEN). el «Acta de entrega» como documento emitido espera a UPS-23 (plan 3.1): no se ofrece. guardada la entrega,
// «Registrar cumplimiento» se ofrece en el mismo lugar, con sus reglas comprobadas (tercera pasada de UX, 1.6)
export function PestanaEntregas({ compromiso, escribe }: { compromiso: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const entregas = useTodos('delivery', { commitment: compromiso.id, sort: 'delivery_date', dir: 'desc' })
  const [editando, setEditando] = useState<Registro | 'nueva' | null>(null)
  // la confirmación de la última entrega guardada: se va al abrir otro drawer
  const [guardada, setGuardada] = useState(false)
  const estado = compromiso.state ?? ''
  const congelada = ESTADOS_CONGELADOS.includes(estado)
  const registra = escribe && ESTADOS_DE_EJECUCION.includes(estado) && can('delivery', 'CREATE') && can('commitment', 'UPDATE')
  const corrige = escribe && !congelada && can('delivery', 'UPDATE') && can('commitment', 'UPDATE')
  // vincular evidencias en el alta exige además UPDATE sobre evidence y delivery (Deliveries.kt, create); subirlas, CREATE
  const subeEvidencias = can('evidence', 'CREATE') && can('evidence', 'UPDATE') && can('delivery', 'UPDATE')
  const abrir = (cual: Registro | 'nueva') => {
    setGuardada(false)
    setEditando(cual)
  }
  const recurso = texto(compromiso, 'resource_type')
  return (
    <section aria-label={t('entregas.titulo')} className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sg-h3 font-semibold">{t('entregas.titulo')}</h2>
        {registra ? (
          <Button size="sm" onClick={() => abrir('nueva')}>
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
              alCorregir={corrige ? () => abrir(e) : undefined}
            />
          ))}
        </ul>
      )}
      {guardada ? (
        <div className="space-y-2">
          <p role="status" className="text-sm text-sg-success">
            {t('entregas.guardada')}
          </p>
          <BotonesDeTransicion
            objeto="commitment"
            registro={compromiso}
            proyecto={texto(compromiso, 'project')}
            solo={['register_fulfillment']}
            comprobarAntes={['register_fulfillment']}
            sinPrimaria
          />
        </div>
      ) : null}
      {editando ? (
        <EntregaDrawer
          compromiso={compromiso}
          entrega={editando === 'nueva' ? undefined : editando}
          subeEvidencias={subeEvidencias}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null)
            setGuardada(true)
          }}
        />
      ) : null}
    </section>
  )
}

export function Ejecutado({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const monto = Number(atributo(compromiso, 'amount') ?? 0)
  const ejecutado = atributo(compromiso, 'executed_amount')
  const moneda = atributo(compromiso, 'currency')
  const porcentaje = monto > 0 && ejecutado !== null && ejecutado !== undefined ? Math.min(100, (Number(ejecutado) / monto) * 100) : 0
  // sin monto ejecutado registrado, lo dice sin una barra vacía que se lee como «0 %» (revisión de UX, etapa 4)
  if (ejecutado === null || ejecutado === undefined)
    return <p className="text-sm text-sg-text-secondary">{t('entregas.sinEjecucion', { monto: montoPe(atributo(compromiso, 'amount'), moneda) })}</p>
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

// la evidencia mínima de D9 (Fulfillment.kt): con material, las dos; sin material, una de las tres
const EVIDENCIA_MATERIAL = ['ACTA DE ENTREGA', 'FOTO']
const EVIDENCIA_NO_MATERIAL = ['ACTA', 'CARTA', 'OTRO']

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

type Campo = (typeof CAMPOS)[number]

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

// lo que viaja de cada campo, igual para lo tecleado y para lo leído (así se compara al corregir): el monto sin separadores,
// el texto vacío como null y quiénes dieron la conformidad solo si se dio (desmarcarla lo borra: react-hook-form conserva el
// valor del campo que ya no se dibuja)
const normalizados = (v: Valores): Record<Campo, unknown> => {
  const valor = (campo: Campo): unknown => {
    if (campo === 'conformity_by' && !v.conformity_given) return null
    const x = campo === 'delivered_amount' ? normalizarMonto(v.delivered_amount) : v[campo]
    return typeof x === 'string' ? x.trim() || null : x
  }
  return Object.fromEntries(CAMPOS.map((c) => [c, valor(c)])) as Record<Campo, unknown>
}

// el drawer de S32 (?drawer=delivery): alta o corrección. las evidencias se suben fuera del <form> de la entrega (un formulario
// dentro de otro se enviaría con el de afuera, revisión del plan 2.3) y viajan por id al guardar. cada campo se dibuja y se
// envía con la misma condición, la definición de delivery de quien mira: sin ella no hay formulario ni «Guardar entrega»,
// porque se enviaría sin los campos que no sabe escribibles (revisión de la Tarea 11)
function EntregaDrawer({
  compromiso,
  entrega,
  subeEvidencias,
  alCerrar,
  alGuardar
}: {
  compromiso: Registro
  entrega?: Registro
  subeEvidencias: boolean
  alCerrar: () => void
  alGuardar: () => void
}) {
  const { t, i18n } = useTranslation(NS)
  const nombreDeEvidencia = useNombreDeEvidencia()
  const definicion = useDefinicion('delivery')
  const registrar = useRegistrarEntrega(compromiso.id)
  const corregir = useCorregirEntrega(compromiso.id)
  const releer = useReleer()
  const erroresDeCampo = useErroresDeCampo()
  const [subidas, setSubidas] = useState<Registro[]>([])
  const { register, handleSubmit, formState, control } = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: iniciales(entrega) })
  const conformidad = useWatch({ control, name: 'conformity_given' })
  const lista = definicion.data !== undefined
  const escribible = (campo: Campo) => puedeEscribir(definicion.data, campo)
  const comando = entrega ? corregir : registrar
  const delServidor = Object.fromEntries(Object.entries(erroresDeCampo(comando.error)).map(([c, x]) => [c.replace(/^attributes\./, ''), x]))
  const recurso = texto(compromiso, 'resource_type')
  // lo que le falta a esta entrega para el cumplimiento (D9), como en la entrega de un aporte: con material, «Acta de entrega» y
  // «Foto»; sin material, una de «Acta», «Carta» u «Otro». la evidencia que se sube propone el tipo que sigue (tercera pasada de UX,
  // 1.6)
  const subidos = new Set(subidas.map((e) => texto(e, 'evidence_type')))
  const faltan =
    recurso === 'MATERIAL'
      ? EVIDENCIA_MATERIAL.filter((tipo) => !subidos.has(tipo))
      : recurso === 'NO MATERIAL' && !EVIDENCIA_NO_MATERIAL.some((tipo) => subidos.has(tipo))
        ? ['ACTA']
        : []
  const tipoInicial = faltan[0] ?? ''
  const error = (campo: keyof Valores) => {
    if (delServidor[campo]) return delServidor[campo]
    if (!formState.errors[campo]) return undefined
    if (campo === 'delivery_date') return t('entregas.errores.fecha')
    if (campo === 'delivered_amount') return t('entregas.errores.monto')
    if (campo === 'motivo') return t('comun.motivoFalta')
    return undefined
  }
  const guardar = handleSubmit((v) => {
    if (!lista) return
    const ahora = normalizados(v)
    const enviados = CAMPOS.filter(escribible)
    if (entrega) {
      const antes = normalizados(iniciales(entrega))
      const cambios = Object.fromEntries(enviados.filter((c) => antes[c] !== ahora[c]).map((c) => [c, ahora[c]]))
      corregir.mutate({ entrega, cambios, motivo: v.motivo.trim() }, { onSuccess: alGuardar })
    } else {
      const atributos = Object.fromEntries(enviados.filter((c) => ahora[c] !== null).map((c) => [c, ahora[c]]))
      registrar.mutate({ atributos, evidencias: subidas.map((e) => e.id), motivo: v.motivo.trim() }, { onSuccess: alGuardar })
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
          {lista ? (
            <Button type="submit" form="entrega" disabled={comando.isPending} aria-busy={comando.isPending}>
              {comando.isPending ? t('entregas.guardando') : t('entregas.guardar')}
            </Button>
          ) : null}
        </>
      }
    >
      {definicion.isPending ? <Cargando /> : null}
      {!lista && definicion.isError ? <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} /> : null}
      {lista ? (
        <form id="entrega" className="space-y-3" onSubmit={(e) => void guardar(e)}>
          {escribible('delivery_date') ? (
            <Controller
              control={control}
              name="delivery_date"
              render={({ field }) => (
                <CampoFecha
                  etiqueta={t('entregas.campos.delivery_date')}
                  requerido
                  error={error('delivery_date')}
                  valor={field.value || null}
                  alCambiar={(v) => field.onChange(v ?? '')}
                />
              )}
            />
          ) : null}
          {escribible('place') ? (
            <Campo etiqueta={t('entregas.campos.place')} error={error('place')}>
              {(p) => <Input {...p} {...register('place')} maxLength={300} />}
            </Campo>
          ) : null}
          {escribible('delivered_items') ? (
            <Campo etiqueta={t('entregas.campos.delivered_items')} error={error('delivered_items')}>
              {(p) => <Textarea {...p} {...register('delivered_items')} maxLength={4000} />}
            </Campo>
          ) : null}
          {escribible('delivered_amount') ? (
            <Campo etiqueta={t('entregas.campos.delivered_amount')} error={error('delivered_amount')}>
              {(p) => <Input {...p} inputMode="decimal" {...register('delivered_amount')} />}
            </Campo>
          ) : null}
          {escribible('recipients') ? (
            <Campo etiqueta={t('entregas.campos.recipients')} error={error('recipients')}>
              {(p) => <Textarea {...p} {...register('recipients')} maxLength={4000} />}
            </Campo>
          ) : null}
          {escribible('conformity_given') ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('conformity_given')} />
              {t('entregas.campos.conformity_given')}
            </label>
          ) : null}
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
      ) : null}
      {entrega || !lista || !subeEvidencias ? null : (
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
                  {nombreDeEvidencia(e)} · {opcion(e, 'evidence_type')}
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
          {recurso === 'MATERIAL' && faltan.length > 0 ? (
            <p className="text-sg-caption text-sg-warning">
              {t('entregas.faltan', {
                tipos: new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(faltan.map((tipo) => `«${rotuloDeOpcion(tipo)}»`))
              })}
            </p>
          ) : recurso === 'NO MATERIAL' && faltan.length > 0 ? (
            <p className="text-sg-caption text-sg-warning">{t('entregas.faltaUnaDe')}</p>
          ) : recurso === 'MATERIAL' || recurso === 'NO MATERIAL' ? (
            <p className="text-sg-caption text-sg-success">{t('entregas.completas')}</p>
          ) : null}
          <FormularioDeEvidencia
            key={tipoInicial || 'otra'}
            proyecto={texto(compromiso, 'project')}
            tipoInicial={tipoInicial}
            alRegistrar={(e) => setSubidas((s) => [...s, e])}
          />
        </section>
      )}
    </Drawer>
  )
}
