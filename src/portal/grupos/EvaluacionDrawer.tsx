import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@wasichai/core'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, cn, Textarea } from '@wasichai/ui'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo, SelectNativo } from '../componentes/Campo'
import { CampoFecha } from '../componentes/CampoFecha'
import { Drawer } from '../componentes/Drawer'
import { Cargando, ErrorDeCarga } from '../componentes/Estados'
import { hoyEnLima } from '../datos/fechas'
import { campoDelError, codigoDelError, nuevaClave } from '../datos/http'
import { campoDe, useDefinicion, type Registro } from '../datos/registros'
import { MiniMatriz } from '../graficos/MiniMatriz'
import { NS, numeroPe } from '../i18n'
import { INDICADORES, useGuardarEvaluacion, useVistaPreviaDeEvaluacion, type EvaluacionGuardada } from './api'
import { Advertencias } from './Advertencias'
import { rotuloDeOpcion } from '../datos/opciones'

// S20 · nueva evaluación (screens.md §5, flujo 3): fecha, base, los 15 indicadores de 1 a 5 con su valor anterior, postura
// (restringida), apertura, confianza, razones, preocupaciones y expectativas, y el motivo obligatorio. la vista previa se
// pide 300 ms después del último cambio, sin guardar, con la fecha y la postura (las advertencias dependen de ellas), y
// solo si la cuenta lee el historial de evaluaciones; ajustar el grupo a mano exige justificación (RF-STK-009)
const nivel = z.number().int().min(1).max(5)
const esquema = z
  .object({
    assessment_date: z.string().min(1),
    basis: z.string().min(1),
    indicadores: z.object(Object.fromEntries(INDICADORES.map((i) => [i, nivel])) as Record<(typeof INDICADORES)[number], typeof nivel>),
    stance: z.string(),
    open_to_dialogue: z.boolean(),
    trust_score: z.string(),
    stance_reasons: z.string(),
    concerns: z.string(),
    expectations: z.string(),
    ajustar: z.boolean(),
    influence_group: z.string(),
    override_reason: z.string(),
    motivo: z.string().trim().min(1)
  })
  .refine((v) => !v.ajustar || (v.influence_group && v.override_reason.trim()), { path: ['override_reason'] })
type Valores = z.infer<typeof esquema>
type Indicador = (typeof INDICADORES)[number]

// U-29 (rediseño de UX, área 4.5a): las 15 escalas no caben de corrido en un drawer de 400 px. van en cinco temas de tres,
// plegables y uno abierto a la vez, con el avance a la vista: los dos de interés (afectación y oportunidad) y los tres de poder
// (recursos, acción y organización, redes y movilización). solo cambia cómo se piden: lo que se manda es lo mismo
const TEMAS: { clave: string; dimension: 'interes' | 'poder'; indicadores: Indicador[] }[] = [
  { clave: 'afectacion', dimension: 'interes', indicadores: ['affect_environment', 'affect_livelihood', 'affect_property_status'] },
  { clave: 'oportunidad', dimension: 'interes', indicadores: ['opportunity_work', 'opportunity_development', 'opportunity_benefits'] },
  { clave: 'recursos', dimension: 'poder', indicadores: ['power_legal_action', 'power_credibility', 'power_permit_control'] },
  { clave: 'accion', dimension: 'poder', indicadores: ['power_action_scope', 'power_organization_level', 'power_convening_capacity'] },
  { clave: 'redes', dimension: 'poder', indicadores: ['power_network_membership', 'power_group_mobilization', 'power_other_pressure'] }
]
const calificados = (tema: (typeof TEMAS)[number], valores: Partial<Record<Indicador, number>> | undefined) =>
  tema.indicadores.filter((i) => typeof valores?.[i] === 'number').length
const completo = (tema: (typeof TEMAS)[number], valores: Partial<Record<Indicador, number>> | undefined) =>
  calificados(tema, valores) === tema.indicadores.length

// la fecha por defecto es hoy en America/Lima (nunca UTC): el servidor rechaza una evaluación con fecha futura según el día
// de Lima, y a las 19:00 de Lima ya es "mañana" en UTC
const valoresIniciales = (): Valores => ({
  assessment_date: hoyEnLima(),
  basis: '',
  indicadores: {} as Valores['indicadores'],
  stance: '',
  open_to_dialogue: false,
  trust_score: '',
  stance_reasons: '',
  concerns: '',
  expectations: '',
  ajustar: false,
  influence_group: '',
  override_reason: '',
  motivo: ''
})

export function atributosDeEvaluacion(v: Valores, leePostura: boolean): Record<string, unknown> {
  return {
    assessment_date: v.assessment_date,
    basis: v.basis,
    ...v.indicadores,
    ...(leePostura
      ? { stance: v.stance || null, stance_reasons: v.stance_reasons || null, concerns: v.concerns || null, expectations: v.expectations || null }
      : {}),
    open_to_dialogue: v.open_to_dialogue,
    trust_score: v.trust_score ? Number(v.trust_score) : null,
    ...(v.ajustar ? { group_overridden: true, influence_group: v.influence_group, override_reason: v.override_reason } : { group_overridden: false })
  }
}

export function EvaluacionDrawer({
  grupo,
  anterior,
  abierto,
  alCerrar,
  alGuardar
}: {
  grupo: Registro
  anterior?: Registro
  abierto: boolean
  alCerrar: () => void
  alGuardar: (r: EvaluacionGuardada) => void
}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const definicion = useDefinicion('stakeholder_assessment')
  const guardar = useGuardarEvaluacion(grupo)
  const cliente = useQueryClient()
  const releer = useReleer()
  // una clave de idempotencia por evaluación: al guardar se renueva, porque el drawer sigue montado y la siguiente
  // evaluación no puede repetir la de la anterior (el servidor devolvería la primera)
  const [clave, setClave] = useState(nuevaClave)
  const leePostura = definicion.data?.fields.some((f) => f.name === 'stance') ?? false
  const opciones = (c: string) => definicion.data?.fields.find((f) => f.name === c)?.enumOptions ?? []
  const { register, handleSubmit, control, formState, setValue, reset } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciales()
  })
  const indicadores = useWatch({ control, name: 'indicadores' })
  const ajustar = useWatch({ control, name: 'ajustar' })
  const fecha = useWatch({ control, name: 'assessment_date' })
  const postura = useWatch({ control, name: 'stance' })
  const completos = INDICADORES.every((i) => typeof indicadores?.[i] === 'number')
  // el tema abierto: el primero al empezar; calificar el último indicador de un tema abre el siguiente sin calificar
  const [temaAbierto, setTemaAbierto] = useState<number | null>(0)
  const temasHechos = TEMAS.filter((tema) => completo(tema, indicadores)).length
  const primeroSinCalificar = (valores: Partial<Record<Indicador, number>> | undefined, desde = 0): number | null => {
    const orden = [...TEMAS.keys()].map((k) => (k + desde) % TEMAS.length)
    return orden.find((k) => !completo(TEMAS[k], valores)) ?? null
  }
  const calificar = (indice: number, indicador: Indicador, n: number) => {
    const antes = indicadores
    setValue(`indicadores.${indicador}`, n, { shouldValidate: formState.isSubmitted })
    const despues = { ...antes, [indicador]: n }
    if (!completo(TEMAS[indice], antes) && completo(TEMAS[indice], despues)) setTemaAbierto(primeroSinCalificar(despues, indice + 1))
  }
  // la vista previa lee el historial (READ sobre stakeholder_assessment): sin él, el servidor responde 403 y no se pide
  const conVistaPrevia = can('stakeholder_assessment', 'READ')
  // la vista previa espera 300 ms sin cambios antes de pedir el cálculo; la fecha y la postura van para que salgan
  // BACKDATED_ASSESSMENT y STANCE_DIVERGENCE
  const [pedido, setPedido] = useState<Record<string, unknown> | null>(null)
  useEffect(() => {
    if (!completos || !conVistaPrevia) {
      setPedido(null)
      return
    }
    const espera = setTimeout(
      () => setPedido({ ...indicadores, ...(fecha ? { assessment_date: fecha } : {}), ...(leePostura && postura ? { stance: postura } : {}) }),
      300
    )
    return () => clearTimeout(espera)
  }, [completos, conVistaPrevia, JSON.stringify(indicadores), fecha, postura, leePostura])
  const previa = useVistaPreviaDeEvaluacion(grupo.id, pedido)
  const enviar = handleSubmit(
    (v) =>
      guardar.mutate(
        { atributos: atributosDeEvaluacion(v, leePostura), motivo: v.motivo, clave },
        {
          onSuccess: (r) => {
            setClave(nuevaClave())
            reset(valoresIniciales())
            setTemaAbierto(0)
            alGuardar(r)
          }
        }
      ),
    // con indicadores sin calificar, se abre el primer tema que falta
    (errores) => {
      if (errores.indicadores) setTemaAbierto(primeroSinCalificar(indicadores))
    }
  )
  const desajuste = codigoDelError(guardar.error) === 'STATE_MISMATCH'
  const retirado = grupo.state === 'retired' || desajuste
  // el servidor dice que el grupo de interés ya no está en el estado de partida: se relee para que la ficha muestre su
  // estado actual y deje de ofrecer evaluarlo
  useEffect(() => {
    if (desajuste) void cliente.invalidateQueries({ queryKey: ['record', 'stakeholder', grupo.id] })
  }, [desajuste])
  // cancelar o cerrar descarta lo escrito, el error y la fecha del primer montaje (que pasada la medianoche de Lima sería la de ayer)
  // mientras se guarda no se cierra: guardar.reset() desengancha la mutación en curso y su onSuccess ya no correría (la clave
  // no se renovaría ni se reiniciaría el formulario si el servidor guardó)
  const cerrar = () => {
    if (guardar.isPending) return
    reset(valoresIniciales())
    setTemaAbierto(0)
    guardar.reset()
    alCerrar()
  }
  // el campo que el servidor dice que no se puede escribir, con su etiqueta de la metadata (un campo restringido no está en ella)
  const campoNoEscribible = (() => {
    const campo = campoDelError(guardar.error)
    return campo ? campoDe(definicion.data, campo)?.label : undefined
  })()

  return (
    <Drawer
      titulo={t('grupos.evaluacion.titulo')}
      descripcion={t('grupos.evaluacion.descripcion')}
      abierto={abierto}
      alCerrar={cerrar}
      pie={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={guardar.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={() => void enviar()} disabled={guardar.isPending || !definicion.data || grupo.state === 'retired'}>
            {guardar.isPending ? t('grupos.evaluacion.guardando') : t('grupos.evaluacion.guardar')}
          </Button>
        </>
      }
    >
      {retirado ? <Alert tone="warning">{t('grupos.evaluacion.retirado')}</Alert> : null}
      {definicion.isPending ? <Cargando /> : null}
      {definicion.isError && !definicion.data ? <ErrorDeCarga error={definicion.error} alReintentar={() => void definicion.refetch()} /> : null}
      <form hidden={!definicion.data} className="space-y-4" onSubmit={(e) => void enviar(e)} aria-label={t('grupos.evaluacion.titulo')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* U-07: el día como dd/mm/aaaa; el valor sigue siendo el día AAAA-MM-DD de Lima que se manda */}
          <CampoFecha
            etiqueta={t('grupos.evaluacion.fecha')}
            requerido
            valor={fecha || null}
            alCambiar={(v) => setValue('assessment_date', v ?? '', { shouldValidate: formState.isSubmitted })}
            error={formState.errors.assessment_date ? t('proyectos.asistente.obligatorio') : undefined}
          />
          <Campo etiqueta={t('grupos.evaluacion.base')} error={formState.errors.basis ? t('proyectos.asistente.obligatorio') : undefined}>
            {(p) => <SelectNativo {...p} opciones={opciones('basis')} {...register('basis')} />}
          </Campo>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium" aria-live="polite">
              {t('grupos.evaluacion.avance', { hechos: temasHechos, total: TEMAS.length })}
            </p>
            <span aria-hidden className="flex w-24 gap-1">
              {TEMAS.map((tema) => (
                <span key={tema.clave} className={cn('h-1.5 flex-1 rounded-full', completo(tema, indicadores) ? 'bg-sg-primary' : 'bg-sg-border')} />
              ))}
            </span>
          </div>
          {TEMAS.map((tema, indice) => (
            <div key={tema.clave}>
              {indice === 0 || TEMAS[indice - 1].dimension !== tema.dimension ? (
                <h3 className="mb-1 mt-3 text-sg-overline font-semibold uppercase text-sg-text-muted">{t(`grupos.evaluacion.${tema.dimension}`)}</h3>
              ) : null}
              <TemaDeIndicadores
                titulo={t(`grupos.evaluacion.temas.${tema.clave}`)}
                avance={t('grupos.evaluacion.avanceDelTema', { hechos: calificados(tema, indicadores), total: tema.indicadores.length })}
                hecho={completo(tema, indicadores)}
                abierto={temaAbierto === indice}
                alAlternar={() => setTemaAbierto(temaAbierto === indice ? null : indice)}
              >
                {tema.indicadores.map((i) => (
                  <div
                    key={i}
                    role="radiogroup"
                    aria-label={t(`grupos.evaluacion.indicadores.${i}`)}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {t(`grupos.evaluacion.indicadores.${i}`)}
                      {anterior && anterior.attributes[i] !== undefined && anterior.attributes[i] !== null ? (
                        <span className="ml-1 text-sg-caption text-sg-text-muted">
                          ({t('grupos.evaluacion.anterior', { valor: String(anterior.attributes[i]) })})
                        </span>
                      ) : null}
                    </span>
                    <span className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n} className="flex items-center gap-0.5">
                          <input type="radio" name={i} value={n} checked={indicadores?.[i] === n} onChange={() => calificar(indice, i, n)} />
                          {n}
                        </label>
                      ))}
                    </span>
                  </div>
                ))}
              </TemaDeIndicadores>
            </div>
          ))}
        </div>
        {formState.errors.indicadores ? <p className="text-sg-caption text-sg-danger">{t('grupos.evaluacion.incompleto')}</p> : null}
        <fieldset className="grid gap-3 sm:grid-cols-2">
          {leePostura ? (
            <>
              <Campo etiqueta={t('grupos.evaluacion.postura')}>{(p) => <SelectNativo {...p} opciones={opciones('stance')} {...register('stance')} />}</Campo>
              <Campo etiqueta={t('grupos.ficha.razones')}>{(p) => <Textarea {...p} {...register('stance_reasons')} />}</Campo>
              <Campo etiqueta={t('grupos.ficha.preocupaciones')}>{(p) => <Textarea {...p} {...register('concerns')} />}</Campo>
              <Campo etiqueta={t('grupos.ficha.expectativas')}>{(p) => <Textarea {...p} {...register('expectations')} />}</Campo>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('open_to_dialogue')} />
            {t('grupos.evaluacion.apertura')}
          </label>
          <Campo etiqueta={t('grupos.evaluacion.confianza')}>
            {(p) => <SelectNativo {...p} opciones={['1', '2', '3', '4', '5']} {...register('trust_score')} />}
          </Campo>
        </fieldset>
        <section aria-label={t('grupos.evaluacion.vistaPrevia')} className="space-y-2 rounded-sg-lg bg-sg-surface-sunken p-3 text-sm">
          <h3 className="font-medium">{t('grupos.evaluacion.vistaPrevia')}</h3>
          {!conVistaPrevia ? <p className="text-sg-text-muted">{t('grupos.evaluacion.sinVistaPrevia')}</p> : null}
          {previa.isFetching ? <p className="text-sg-text-muted">{t('grupos.evaluacion.calculando')}</p> : null}
          {previa.isError && !previa.data ? <ErrorDeCarga error={previa.error} alReintentar={() => void previa.refetch()} /> : null}
          {previa.data ? (
            <div className="flex flex-wrap items-center gap-6">
              <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3">
                <dt>{t('grupos.evaluacion.indiceInteres')}</dt>
                <dd>{numeroPe(previa.data.computed.interest_index)}</dd>
                <dt>{t('grupos.evaluacion.indicePoder')}</dt>
                <dd>{numeroPe(previa.data.computed.power_index)}</dd>
                <dt>{t('grupos.evaluacion.influencia')}</dt>
                <dd>{numeroPe(previa.data.computed.influence_score)}</dd>
                <dt>{t('grupos.evaluacion.grupo')}</dt>
                <dd>{rotuloDeOpcion(previa.data.computed.influence_group)}</dd>
                {previa.data.computed.information_priority ? (
                  <>
                    <dt>{t('grupos.evaluacion.prioridad')}</dt>
                    <dd>{rotuloDeOpcion(previa.data.computed.information_priority)}</dd>
                  </>
                ) : null}
              </dl>
              <MiniMatriz
                etiqueta={t('grupos.evaluacion.vistaPrevia')}
                puntos={[{ x: previa.data.computed.interest_index, y: previa.data.computed.power_index, destacado: true }]}
              />
            </div>
          ) : null}
          <Advertencias advertencias={previa.data?.warnings ?? []} />
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('ajustar')} />
            {t('grupos.evaluacion.ajustar')}
          </label>
          {ajustar ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta={t('grupos.evaluacion.grupo')}>
                {(p) => <SelectNativo {...p} opciones={opciones('influence_group')} {...register('influence_group')} />}
              </Campo>
              <Campo
                etiqueta={t('grupos.evaluacion.justificacion')}
                error={formState.errors.override_reason ? t('grupos.evaluacion.justificacionFalta') : undefined}
              >
                {(p) => <Textarea {...p} {...register('override_reason')} />}
              </Campo>
            </div>
          ) : null}
        </section>
        <Campo etiqueta={t('comun.motivoObligatorio')} error={formState.errors.motivo ? t('comun.motivoFalta') : undefined}>
          {(p) => <Textarea {...p} maxLength={500} {...register('motivo')} />}
        </Campo>
        {guardar.isError && !retirado ? (
          // otra persona cambió el grupo de interés: se relee su versión y se conserva lo escrito; el aviso se quita cuando
          // ya llegó el updatedAt nuevo, para que el siguiente guardado no vuelva a mandar la versión vieja (otro 412)
          <AvisoDeConflicto
            error={guardar.error}
            propios={{
              FIELD_NOT_WRITABLE: campoNoEscribible
                ? t('grupos.evaluacion.errores.FIELD_NOT_WRITABLE', { campo: campoNoEscribible })
                : t('grupos.evaluacion.errores.FIELD_NOT_WRITABLE_SIN_CAMPO'),
              ROLE_REQUIRED: t('grupos.evaluacion.errores.ROLE_REQUIRED')
            }}
            releer={() => releer(['record', 'stakeholder', grupo.id])}
            alRecargar={() => guardar.reset()}
          />
        ) : null}
      </form>
    </Drawer>
  )
}

// un tema plegable: el encabezado dice su avance («2 de 3») y abre o pliega sus escalas
function TemaDeIndicadores({
  titulo,
  avance,
  hecho,
  abierto,
  alAlternar,
  children
}: {
  titulo: string
  avance: string
  hecho: boolean
  abierto: boolean
  alAlternar: () => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="rounded-sg-md border border-sg-border">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={`${id}-panel`}
        onClick={alAlternar}
        className="flex w-full items-center justify-between gap-2 rounded-sg-md px-3 py-2 text-left text-sm hover:bg-sg-surface-hover"
      >
        <span id={`${id}-titulo`} className="font-medium">
          {titulo}
        </span>{' '}
        <span className={cn('flex items-center gap-1 text-sg-caption', hecho ? 'text-sg-success' : 'text-sg-text-muted')}>
          {hecho ? <Check aria-hidden className="size-3.5" /> : null}
          {avance}
          <ChevronDown aria-hidden className={cn('size-4 transition-transform', abierto ? 'rotate-180' : '')} />
        </span>
      </button>
      {abierto ? (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-titulo`} className="space-y-2 border-t border-sg-border px-3 py-2">
          {children}
        </div>
      ) : null}
    </div>
  )
}
