import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useErroresDeCampo } from '../componentes/errores'
import { Cargando, Restringido, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { RegistrosSimples, type ColumnaSimple } from '../componentes/RegistrosSimples'
import { hoyEnLima } from '../datos/fechas'
import { codigoDelError } from '../datos/http'
import { entregaAbierta, EVIDENCIAS_DE_ENTREGA, monedaDe } from '../datos/inversion'
import { atributo, puedeEscribir, texto, useDefinicion, useTodos, type Registro } from '../datos/registros'
import { useEvidenciasDe, useNombreDeEvidencia } from '../documentos/api'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { FormularioDeEvidencia } from '../documentos/FormularioDeEvidencia'
import { diaPe, NS } from '../i18n'
import { useCorregirEntregaDeAporte, useRegistrarEntregaDeAporte } from './comandos'

// la entrega de un aporte en S44 (screens.md S44, spec F5 §3.5, decisión 2, P8): un aporte tiene como máximo una entrega. se
// registra solo en procured, sin monto entregado (el ejecutado de un aporte es su total, ASM-063), con la conformidad y las
// evidencias ACTA DE RECEPCION, FOTO y COMPROBANTE subidas antes (fuera del <form>) y vinculadas por id; el drawer propone la que
// falta. el acta firmada se imprime fuera de SGSPE mientras UPS-23 siga abierta (ASM-090). registrar no cambia el estado:
// «Registrar entrega» (register_delivery) es la transición que sigue. desde delivered, o anulado, la entrega no cambia
// (DELIVERY_FROZEN). quiénes dieron la conformidad y los receptores son restringidos (security.md §7.9)
export function EntregaDelAporte({ aporte, escribe }: { aporte: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const entregas = useTodos('delivery', { social_contribution: aporte.id })
  const [drawer, setDrawer] = useState<Registro | 'nueva' | null>(null)
  const [guardada, setGuardada] = useState(false)
  const abierta = entregaAbierta(aporte)
  const registra = escribe && abierta && can('delivery', 'CREATE') && can('social_contribution', 'UPDATE')
  const corrige = escribe && abierta && can('delivery', 'UPDATE')
  // vincular evidencias en el alta exige UPDATE sobre evidence y delivery; subirlas, CREATE (como en la entrega de un compromiso)
  const subeEvidencias = can('evidence', 'CREATE') && can('evidence', 'UPDATE') && can('delivery', 'UPDATE')
  const abrir = (cual: Registro | 'nueva') => {
    setGuardada(false)
    setDrawer(cual)
  }
  const entrega = entregas.data?.[0]
  return (
    <section aria-label={t('fichaAporte.entrega.titulo')} className="space-y-3 pt-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sg-h3 font-semibold">{t('fichaAporte.entrega.titulo')}</h2>
        {registra && entregas.data && !entrega ? (
          <Button size="sm" onClick={() => abrir('nueva')}>
            {t('fichaAporte.entrega.registrar')}
          </Button>
        ) : null}
      </div>
      <p className="text-sg-caption text-sg-text-muted">{t('fichaAporte.entrega.unaVez')}</p>
      <p className="text-sg-caption text-sg-text-muted">{t('fichaAporte.entrega.actaFuera')}</p>
      {entregas.isPending ? (
        <Cargando compacto />
      ) : entregas.isError && !entregas.data ? (
        <FalloDeLectura error={entregas.error} alReintentar={() => void entregas.refetch()} />
      ) : entrega ? (
        <TarjetaDeEntrega
          entrega={entrega}
          proyecto={texto(aporte, 'project')}
          escribe={escribe && abierta}
          alCorregir={corrige ? () => abrir(entrega) : undefined}
        />
      ) : (
        <Vacio titulo={t(abierta ? 'fichaAporte.entrega.sinEntrega' : 'fichaAporte.entrega.antesDeAdquirir')} />
      )}
      {entrega && !abierta ? <Alert tone="notice">{t('fichaAporte.entrega.congelada')}</Alert> : null}
      {guardada ? (
        <p role="status" className="text-sg-success">
          {t('fichaAporte.entrega.guardada')}
        </p>
      ) : null}
      {entrega ? <Requisitos entrega={entrega} /> : null}
      <Comprobantes aporte={aporte} />
      {drawer ? (
        <EntregaDrawer
          aporte={aporte}
          entrega={drawer === 'nueva' ? undefined : drawer}
          subeEvidencias={subeEvidencias}
          alCerrar={() => setDrawer(null)}
          alGuardar={() => {
            setDrawer(null)
            setGuardada(true)
          }}
        />
      ) : null}
    </section>
  )
}

function TarjetaDeEntrega({ entrega, proyecto, escribe, alCorregir }: { entrega: Registro; proyecto: string; escribe: boolean; alCorregir?: () => void }) {
  const { t } = useTranslation(NS)
  const leido = (campo: string) => (campo in entrega.attributes ? texto(entrega, campo) || '—' : <Restringido />)
  return (
    <article className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{t('entregas.tarjeta.titulo', { fecha: diaPe(texto(entrega, 'delivery_date')) })}</h3>
        {alCorregir ? (
          <Button size="sm" variant="secondary" onClick={alCorregir}>
            {t('fichaAporte.entrega.corregir')}
          </Button>
        ) : null}
      </div>
      <dl className="grid gap-1 sm:grid-cols-2">
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('entregas.campos.place')}</dt>
          <dd>{texto(entrega, 'place') || '—'}</dd>
        </div>
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('entregas.campos.delivered_items')}</dt>
          <dd>{texto(entrega, 'delivered_items') || '—'}</dd>
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
          <dt className="text-sg-caption text-sg-text-muted">{t('entregas.campos.recipients')}</dt>
          <dd>{leido('recipients')}</dd>
        </div>
      </dl>
      <EvidenciasDelRegistro
        objeto="delivery"
        registro={{ ...entrega, attributes: { project: proyecto, ...entrega.attributes } }}
        escribe={escribe}
        tipoInicial="ACTA DE RECEPCION"
        clasificacionInicial="DATOS PERSONALES"
        textoSubir={t('fichaAporte.entrega.subirActa')}
      />
    </article>
  )
}

// lo que pide «Registrar entrega» (P8): la conformidad dada, quiénes la dieron (restringido: quien no lo lee no puede aplicar la
// transición, FIELD_NOT_READABLE) y una evidencia de cada tipo vinculada a la entrega. la consulta en seco del botón lo confirma
function Requisitos({ entrega }: { entrega: Registro }) {
  const { t } = useTranslation(NS)
  const evidencias = useEvidenciasDe('delivery', entrega.id)
  const tipos = new Set((evidencias.data?.content ?? []).map((e) => texto(e, 'evidence_type')))
  const situacion = (listo: boolean | null) =>
    listo === null ? t('fichaAporte.entrega.requisitos.noLee') : listo ? t('fichaAporte.entrega.requisitos.lista') : t('fichaAporte.entrega.requisitos.falta')
  const filas: [string, boolean | null][] = [
    [t('fichaAporte.entrega.requisitos.conformidad'), atributo(entrega, 'conformity_given') === true],
    [t('fichaAporte.entrega.requisitos.quienes'), 'conformity_by' in entrega.attributes ? texto(entrega, 'conformity_by') !== '' : null]
  ]
  return (
    <section aria-label={t('fichaAporte.entrega.requisitos.titulo')} className="space-y-1 rounded-sg-md border border-sg-border p-3">
      <h3 className="font-medium">{t('fichaAporte.entrega.requisitos.titulo')}</h3>
      <ul className="space-y-1">
        {filas.map(([etiqueta, listo]) => (
          <li key={etiqueta} className="flex justify-between gap-2">
            <span>{etiqueta}</span>
            <span className={listo ? 'text-sg-success' : 'text-sg-warning'}>{situacion(listo)}</span>
          </li>
        ))}
        {evidencias.isPending ? (
          <li>
            <Cargando compacto />
          </li>
        ) : evidencias.isError && !evidencias.data ? (
          <li>
            <FalloDeLectura error={evidencias.error} alReintentar={() => void evidencias.refetch()} />
          </li>
        ) : (
          EVIDENCIAS_DE_ENTREGA.map((tipo) => (
            <li key={tipo} className="flex justify-between gap-2">
              <span>{tipo}</span>
              <span className={tipos.has(tipo) ? 'text-sg-success' : 'text-sg-warning'}>{situacion(tipos.has(tipo))}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

// el comprobante estructurado (receipt, opcional, spec §2.2): su escaneo es la evidencia COMPROBANTE. ninguna regla lo compara con
// el total aprobado
function Comprobantes({ aporte }: { aporte: Registro }) {
  const { t } = useTranslation(NS)
  const moneda = monedaDe(aporte)
  const filtros = useMemo(() => ({ social_contribution: aporte.id }), [aporte.id])
  const iniciales = useMemo(() => ({ currency: moneda }), [moneda])
  const columnas: ColumnaSimple[] = [
    {
      id: 'tipo',
      encabezado: t('fichaAporte.entrega.comprobantes.tipo'),
      celda: (r) => texto(r, 'receipt_type') || t('fichaAporte.entrega.comprobantes.sinTipo')
    },
    { id: 'emisor', encabezado: t('fichaAporte.entrega.comprobantes.emisor'), celda: (r) => texto(r, 'issuer_name') || '—' },
    { id: 'fecha', encabezado: t('fichaAporte.entrega.comprobantes.fecha'), celda: (r) => (texto(r, 'issue_date') ? diaPe(texto(r, 'issue_date')) : '—') },
    { id: 'monto', encabezado: t('fichaAporte.entrega.comprobantes.monto'), celda: (r) => montoPe(atributo(r, 'amount'), atributo(r, 'currency')) }
  ]
  return (
    <RegistrosSimples
      objeto="receipt"
      titulo={t('fichaAporte.entrega.comprobantes.titulo')}
      filtros={filtros}
      fijos={filtros}
      iniciales={iniciales}
      columnas={columnas}
      campos={['receipt_type', 'receipt_number', 'issuer_name', 'issued_to_name', 'issued_to_organization', 'issue_date', 'amount', 'currency']}
      proyecto={texto(aporte, 'project')}
      textoNuevo={t('fichaAporte.entrega.comprobantes.nuevo')}
      textoVacio={t('fichaAporte.entrega.comprobantes.vacio')}
      ayuda={<p className="text-sg-caption text-sg-text-muted">{t('fichaAporte.entrega.comprobantes.ayuda')}</p>}
    />
  )
}

const esquema = z.object({
  delivery_date: z.string().min(1),
  place: z.string(),
  delivered_items: z.string(),
  recipients: z.string(),
  conformity_given: z.boolean(),
  conformity_by: z.string(),
  motivo: z.string().trim().min(1)
})
type Valores = z.infer<typeof esquema>
const CAMPOS = ['delivery_date', 'place', 'delivered_items', 'recipients', 'conformity_given', 'conformity_by'] as const
type CampoDeEntrega = (typeof CAMPOS)[number]

const iniciales = (e?: Registro): Valores => ({
  delivery_date: e ? texto(e, 'delivery_date') : hoyEnLima(),
  place: texto(e, 'place'),
  delivered_items: texto(e, 'delivered_items'),
  recipients: texto(e, 'recipients'),
  conformity_given: atributo(e, 'conformity_given') === true,
  conformity_by: texto(e, 'conformity_by'),
  motivo: ''
})

// lo que viaja de cada campo, igual para lo tecleado y para lo leído (así se compara al corregir): el texto vacío como null y quiénes
// dieron la conformidad solo si se dio
const normalizados = (v: Valores): Record<CampoDeEntrega, unknown> =>
  Object.fromEntries(
    CAMPOS.map((c) => {
      if (c === 'conformity_by' && !v.conformity_given) return [c, null]
      const x = v[c]
      return [c, typeof x === 'string' ? x.trim() || null : x]
    })
  ) as Record<CampoDeEntrega, unknown>

function EntregaDrawer({
  aporte,
  entrega,
  subeEvidencias,
  alCerrar,
  alGuardar
}: {
  aporte: Registro
  entrega?: Registro
  subeEvidencias: boolean
  alCerrar: () => void
  alGuardar: () => void
}) {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion('delivery')
  const registrar = useRegistrarEntregaDeAporte(aporte)
  const corregir = useCorregirEntregaDeAporte(aporte.id)
  const releer = useReleer()
  const erroresDeCampo = useErroresDeCampo()
  const nombreDeEvidencia = useNombreDeEvidencia()
  const [subidas, setSubidas] = useState<Registro[]>([])
  const { register, handleSubmit, formState, control } = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: iniciales(entrega) })
  const conformidad = useWatch({ control, name: 'conformity_given' })
  const lista = definicion.data !== undefined
  const escribible = (campo: CampoDeEntrega) => puedeEscribir(definicion.data, campo)
  const comando = entrega ? corregir : registrar
  const delServidor = Object.fromEntries(Object.entries(erroresDeCampo(comando.error)).map(([c, x]) => [c.replace(/^attributes\./, ''), x]))
  const faltan = EVIDENCIAS_DE_ENTREGA.filter((tipo) => !subidas.some((e) => texto(e, 'evidence_type') === tipo))
  const siguiente = faltan[0] ?? ''
  const error = (campo: keyof Valores) => {
    if (delServidor[campo]) return delServidor[campo]
    if (!formState.errors[campo]) return undefined
    if (campo === 'delivery_date') return t('entregas.errores.fecha')
    if (campo === 'motivo') return t('comun.motivoFalta')
    return undefined
  }
  // otra persona ya registró la entrega: se relee la lista, que la mostrará al cerrar el drawer
  const alFallar = (e: unknown) => {
    if (codigoDelError(e) === 'DELIVERY_EXISTS') void releer(['records', 'delivery'])
  }
  const guardar = handleSubmit((v) => {
    if (!lista) return
    const ahora = normalizados(v)
    const enviados = CAMPOS.filter(escribible)
    if (entrega) {
      const antes = normalizados(iniciales(entrega))
      const cambios = Object.fromEntries(enviados.filter((c) => antes[c] !== ahora[c]).map((c) => [c, ahora[c]]))
      corregir.mutate({ entrega, cambios, motivo: v.motivo.trim() }, { onSuccess: alGuardar, onError: alFallar })
    } else {
      const atributos = Object.fromEntries(enviados.filter((c) => ahora[c] !== null).map((c) => [c, ahora[c]]))
      registrar.mutate({ atributos, evidencias: subidas.map((e) => e.id), motivo: v.motivo.trim() }, { onSuccess: alGuardar, onError: alFallar })
    }
  })
  const delFormulario = ['delivery_date', 'place', 'delivered_items', 'recipients', 'conformity_by', 'reason']
  return (
    <Drawer
      titulo={t(entrega ? 'fichaAporte.entrega.corregirTitulo' : 'fichaAporte.entrega.registrarTitulo')}
      descripcion={t('fichaAporte.entrega.ayuda')}
      abierto
      alCerrar={() => !comando.isPending && alCerrar()}
      pie={
        <>
          <Button variant="secondary" onClick={alCerrar} disabled={comando.isPending}>
            {t('comun.cancelar')}
          </Button>
          {lista ? (
            <Button type="submit" form="entrega-de-aporte" disabled={comando.isPending} aria-busy={comando.isPending}>
              {comando.isPending ? t('entregas.guardando') : t('entregas.guardar')}
            </Button>
          ) : null}
        </>
      }
    >
      {definicion.isPending ? <Cargando /> : null}
      {!lista && definicion.isError ? <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} /> : null}
      {lista ? (
        <form id="entrega-de-aporte" className="space-y-3" onSubmit={(e) => void guardar(e)}>
          {escribible('delivery_date') ? (
            <Campo etiqueta={t('entregas.campos.delivery_date')} error={error('delivery_date')}>
              {(p) => <Input {...p} type="date" {...register('delivery_date')} />}
            </Campo>
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
              propios={{ STATE_MISMATCH: t('fichaAporte.entrega.errores.estado'), DELIVERY_FROZEN: t('fichaAporte.entrega.congelada') }}
              releer={() => releer(['records', 'delivery'], ['record', 'social_contribution', aporte.id])}
              alRecargar={() => comando.reset()}
            />
          ) : null}
        </form>
      ) : null}
      {entrega || !lista || !subeEvidencias ? null : (
        <section aria-label={t('fichaAporte.entrega.evidencias')} className="space-y-3 border-t border-sg-border pt-3">
          <h3 className="font-medium">{t('fichaAporte.entrega.evidencias')}</h3>
          <p className="text-sg-caption text-sg-text-muted">{t('fichaAporte.entrega.evidenciasAyuda')}</p>
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
          {faltan.length > 0 ? (
            <p className="text-sg-caption text-sg-warning">{t('fichaAporte.entrega.faltan', { tipos: faltan.join(', ') })}</p>
          ) : (
            <p className="text-sg-caption text-sg-success">{t('fichaAporte.entrega.completas')}</p>
          )}
          <FormularioDeEvidencia
            key={siguiente || 'otra'}
            proyecto={texto(aporte, 'project')}
            tipoInicial={siguiente}
            clasificacionInicial={siguiente === 'ACTA DE RECEPCION' || siguiente === 'FOTO' ? 'DATOS PERSONALES' : ''}
            alRegistrar={(e) => setSubidas((s) => [...s, e])}
          />
        </section>
      )}
    </Drawer>
  )
}
