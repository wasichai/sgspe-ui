import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth, type ObjectDefinition } from '@wasichai/core'
import { Button, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { NoDisponible } from '../componentes/Estados'
import { Pasos } from '../componentes/Pasos'
import { useAsignadoAlProyecto } from '../contexto/ProyectoLayout'
import { useMisAsignaciones } from '../contexto/proyectos'
import { nuevaClave } from '../datos/http'
import { puedeLeer, texto, useDefinicion, useRegistro, useTodos } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { ConDefiniciones, DeLista, ErrorDeGuardado } from './Avisos'
import { GuardadoParcial, useGuardarInteraccion, type NuevaInteraccion } from './guardarInteraccion'
import { RegistroRapido } from './RegistroRapido'

// S24 · registrar interacción (screens.md §6, flujos 4 y 5): cinco pasos con participantes sin pedir datos personales que
// no hacen falta (filas de persona o de grupo sin nombres, con personas ≥ 1) y totales en vivo; al final "Guardar como
// realizada" (register_held_unplanned) o "Programar" (schedule). abierta desde S16 trae los grupos de interés elegidos
// (?stakeholders=); el territorio sale del chip. en el teléfono, o con ?mode=quick, el modo rápido de campo
const fila = z.object({
  tipo: z.enum(['persona', 'grupo']),
  participant_name: z.string(),
  represented_group: z.string(),
  sex: z.string(),
  participant_scope: z.string(),
  represented_people_count: z.coerce.number<number>().int().min(1),
  attended: z.boolean()
})
const pregunta = z.object({
  question_text: z.string().trim().min(1),
  answered_on_site: z.boolean(),
  answer: z.string(),
  raised_by_role: z.string(),
  topic: z.string()
})
const esquema = z
  .object({
    engagement_type: z.string().min(1),
    title: z.string().trim().min(1),
    objective: z.string(),
    realizada: z.boolean(),
    held_at: z.string(),
    scheduled_at: z.string(),
    place: z.string(),
    locality: z.string(),
    community: z.string(),
    grupos: z.array(z.string()),
    convener: z.string(),
    participantes: z.array(fila),
    preguntas: z.array(pregunta),
    temas: z.array(z.string())
  })
  .refine((v) => !v.realizada || v.held_at !== '', { path: ['held_at'] })
type Valores = z.infer<typeof esquema>

// lo que se teclea es la hora del reloj de quien teclea (datetime-local) y viaja como instante UTC; uno que no es una fecha no viaja
const instante = (local: string) => {
  const fecha = new Date(local)
  return local && !Number.isNaN(fecha.getTime()) ? fecha.toISOString() : ''
}

export function RegistrarInteraccionPage() {
  const [busqueda] = useSearchParams()
  const { projectId = '' } = useParams()
  const { can, isAdmin } = useAuth()
  const asignaciones = useMisAsignaciones()
  const asignado = useAsignadoAlProyecto(projectId)
  const definicion = useDefinicion('engagement')
  const definicionDeParticipante = useDefinicion('engagement_participant')
  const rapido = busqueda.get('mode') === 'quick' || (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches)
  // sin permiso para crear, o sin asignación vigente (el servidor rechazaría el alta), no hay formulario que llenar en vano
  if (!can('engagement', 'CREATE')) return <NoDisponible />
  if (asignaciones.isSuccess && !asignado && !isAdmin) return <NoDisponible motivo="NOT_ASSIGNED" />
  return (
    <ConDefiniciones definiciones={[definicion, definicionDeParticipante]}>
      {([engagement, participante]) =>
        rapido ? (
          <RegistroRapido definicion={engagement} definicionDeParticipante={participante} />
        ) : (
          <Asistente definicion={engagement} definicionDeParticipante={participante} />
        )
      }
    </ConDefiniciones>
  )
}

function Asistente({ definicion, definicionDeParticipante }: { definicion: ObjectDefinition; definicionDeParticipante: ObjectDefinition }) {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { territory } = useContextFilters()
  const [busqueda] = useSearchParams()
  const navegar = useNavigate()
  const guardar = useGuardarInteraccion()
  const grupos = useTodos('stakeholder', { project: projectId })
  const temas = useTodos('topic', { active: true, sort: 'name', dir: 'asc' })
  // una clave de idempotencia por registro: al guardarlo se renueva, para que el siguiente sea otra acción
  const [clave, setClave] = useState(nuevaClave)
  const [paso, setPaso] = useState(0)
  const [visitados, setVisitados] = useState(0)
  const pasos = t('relacionamiento.registro.pasos', { returnObjects: true }) as string[]
  const leeNombres = puedeLeer(definicionDeParticipante, 'participant_name')
  const opciones = (c: string) => definicion.fields.find((f) => f.name === c)?.enumOptions ?? []
  const opcionesDe = (c: string) => definicionDeParticipante.fields.find((f) => f.name === c)?.enumOptions ?? []
  const formulario = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      engagement_type: '',
      title: '',
      objective: '',
      realizada: false,
      held_at: '',
      scheduled_at: '',
      place: '',
      locality: territory?.kind === 'locality' ? territory.id : '',
      community: territory?.kind === 'community' ? territory.id : '',
      grupos: busqueda.get('stakeholders')?.split(',').filter(Boolean) ?? [],
      convener: '',
      participantes: [],
      preguntas: [],
      temas: []
    }
  })
  const { register, control, handleSubmit, formState, trigger, setValue } = formulario
  const participantes = useFieldArray({ control, name: 'participantes' })
  const preguntas = useFieldArray({ control, name: 'preguntas' })
  const v = useWatch({ control }) as Valores
  const localidad = useRegistro('locality', v.locality || undefined)
  const comunidad = useRegistro('community', v.community || undefined)
  const asistentes = (v.participantes ?? []).filter((p) => p.attended)
  const total = asistentes.reduce((s, p) => s + (Number(p.represented_people_count) || 0), 0)
  const porSexo = (sexo: string) => asistentes.filter((p) => p.sex === sexo).reduce((s, p) => s + (Number(p.represented_people_count) || 0), 0)

  const CAMPOS_DEL_PASO: (keyof Valores)[][] = [['engagement_type', 'title', 'held_at'], [], ['participantes'], ['preguntas'], []]
  const ir = async (siguiente: number) => {
    if (siguiente > paso && !(await trigger(CAMPOS_DEL_PASO[paso]))) return
    setPaso(siguiente)
    setVisitados((x) => Math.max(x, siguiente))
  }

  const enviar = (transicion: NuevaInteraccion['transicion']) =>
    handleSubmit((valores) => {
      const nueva: NuevaInteraccion = {
        proyecto: projectId,
        atributos: {
          engagement_type: valores.engagement_type,
          title: valores.title,
          objective: valores.objective,
          held_at: valores.realizada ? instante(valores.held_at) : '',
          scheduled_at: valores.realizada ? '' : instante(valores.scheduled_at),
          place: valores.place,
          locality: valores.locality,
          community: valores.community,
          convener: valores.convener,
          // abierta desde una visita de campo (S26): la interacción queda en esa visita
          field_visit: busqueda.get('field_visit') ?? ''
        },
        grupos: valores.grupos,
        temas: valores.temas,
        participantes: valores.participantes.map(({ tipo, ...p }) => ({
          ...p,
          participant_name: tipo === 'persona' && leeNombres ? p.participant_name : undefined
        })),
        preguntas: valores.preguntas.map((q) => ({ ...q, answer: q.answer || undefined })),
        transicion,
        clave
      }
      guardar.mutate(nueva, {
        onSuccess: (i) => {
          setClave(nuevaClave())
          navegar(`/projects/${projectId}/engagements/${i.id}`)
        }
      })
    })

  // lo ya creado queda: guardar otra vez dejaría una interacción duplicada, así que lo que falta se completa desde su ficha
  const parcial = guardar.error instanceof GuardadoParcial
  const errorDeFecha = formState.errors.held_at ? t('relacionamiento.registro.faltaFecha') : undefined

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[220px_1fr]">
      <div className="space-y-2">
        <h1 className="text-sg-h2 font-semibold">{t('relacionamiento.registro.titulo')}</h1>
        <Pasos pasos={pasos} actual={paso} visitados={visitados} alIr={(i) => void ir(i)} />
        <Link to="?mode=quick" className="text-sg-caption text-sg-primary-text underline">
          {t('relacionamiento.registro.rapido')}
        </Link>
      </div>
      <form className="space-y-4" aria-label={pasos[paso]} onSubmit={(e) => e.preventDefault()}>
        <h2 className="text-sg-h3 font-semibold">{pasos[paso]}</h2>
        {paso === 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Campo
              etiqueta={t('relacionamiento.registro.tipo')}
              error={formState.errors.engagement_type ? t('relacionamiento.registro.faltaTitulo') : undefined}
            >
              {(p) => <SelectNativo {...p} opciones={opciones('engagement_type')} {...register('engagement_type')} />}
            </Campo>
            <Campo etiqueta={t('relacionamiento.registro.tituloCampo')} error={formState.errors.title ? t('relacionamiento.registro.faltaTitulo') : undefined}>
              {(p) => <Input {...p} {...register('title')} />}
            </Campo>
            <div className="md:col-span-2">
              <Campo etiqueta={t('relacionamiento.registro.objetivo')}>{(p) => <Textarea {...p} {...register('objective')} />}</Campo>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('realizada')} />
              {t('relacionamiento.registro.realizada')}
            </label>
            {v.realizada ? (
              <Campo etiqueta={t('relacionamiento.registro.realizadaEl')} error={errorDeFecha}>
                {(p) => <Input {...p} type="datetime-local" {...register('held_at')} />}
              </Campo>
            ) : (
              <Campo etiqueta={t('relacionamiento.registro.programada')}>{(p) => <Input {...p} type="datetime-local" {...register('scheduled_at')} />}</Campo>
            )}
          </div>
        ) : null}
        {paso === 1 ? (
          <div className="space-y-3">
            <Campo etiqueta={t('relacionamiento.registro.lugar')}>{(p) => <Input {...p} {...register('place')} />}</Campo>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sg-label font-medium">
                  {t('relacionamiento.registro.localidad')}: {texto(localidad.data, 'name') || '—'}
                </p>
                <BuscadorDeRegistro
                  objeto="locality"
                  etiqueta={t('relacionamiento.registro.localidad')}
                  rotulo={(r) => texto(r, 'name')}
                  alElegir={(r) => setValue('locality', r.id)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sg-label font-medium">
                  {t('relacionamiento.registro.comunidad')}: {texto(comunidad.data, 'name') || '—'}
                </p>
                <BuscadorDeRegistro
                  objeto="community"
                  etiqueta={t('relacionamiento.registro.comunidad')}
                  rotulo={(r) => texto(r, 'name')}
                  alElegir={(r) => setValue('community', r.id)}
                />
              </div>
            </div>
            <fieldset className="space-y-1">
              <legend className="text-sg-label font-medium">{t('relacionamiento.registro.grupos')}</legend>
              <DeLista consulta={grupos}>
                {(todos) => (
                  <ul className="max-h-60 overflow-y-auto rounded-sg-md border border-sg-border p-2 text-sm">
                    {todos
                      .filter((g) => g.state !== 'retired')
                      .map((g) => (
                        <li key={g.id}>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" value={g.id} {...register('grupos')} />
                            <NombreDelGrupo grupo={g} />
                          </label>
                        </li>
                      ))}
                  </ul>
                )}
              </DeLista>
            </fieldset>
            <Campo etiqueta={t('relacionamiento.registro.convocante')}>
              {(p) => (
                <select {...p} {...register('convener')} className="h-9 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-2.5 text-sm">
                  <option value="">{t('comun.ninguno')}</option>
                  {(grupos.data ?? [])
                    .filter((g) => (v.grupos ?? []).includes(g.id))
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        <NombreDelGrupo grupo={g} />
                      </option>
                    ))}
                </select>
              )}
            </Campo>
          </div>
        ) : null}
        {paso === 2 ? (
          <div className="space-y-3">
            {participantes.fields.map((campo, i) => (
              <fieldset key={campo.id} className="grid gap-2 rounded-sg-md border border-sg-border p-3 md:grid-cols-6">
                <legend className="px-1 text-sm">
                  {campo.tipo === 'persona' ? t('relacionamiento.registro.persona') : t('relacionamiento.registro.grupoAnonimo')}
                </legend>
                {campo.tipo === 'persona' && leeNombres ? (
                  <Campo etiqueta={t('relacionamiento.registro.nombre')}>{(p) => <Input {...p} {...register(`participantes.${i}.participant_name`)} />}</Campo>
                ) : null}
                <Campo etiqueta={t('relacionamiento.registro.representa')}>
                  {(p) => <Input {...p} {...register(`participantes.${i}.represented_group`)} />}
                </Campo>
                <Campo etiqueta={t('relacionamiento.registro.sexo')}>
                  {(p) => <SelectNativo {...p} opciones={opcionesDe('sex')} {...register(`participantes.${i}.sex`)} />}
                </Campo>
                <Campo etiqueta={t('relacionamiento.registro.ambito')}>
                  {(p) => <SelectNativo {...p} opciones={opcionesDe('participant_scope')} {...register(`participantes.${i}.participant_scope`)} />}
                </Campo>
                {campo.tipo === 'grupo' ? (
                  <Campo
                    etiqueta={t('relacionamiento.registro.personas')}
                    error={formState.errors.participantes?.[i]?.represented_people_count ? t('relacionamiento.registro.personasInvalidas') : undefined}
                  >
                    {(p) => <Input {...p} type="number" min={1} {...register(`participantes.${i}.represented_people_count`)} />}
                  </Campo>
                ) : null}
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" {...register(`participantes.${i}.attended`)} />
                    {t('relacionamiento.ficha.asistio')}
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => participantes.remove(i)}>
                    {t('comun.quitar')}
                  </Button>
                </div>
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  participantes.append({
                    tipo: 'persona',
                    participant_name: '',
                    represented_group: '',
                    sex: '',
                    participant_scope: '',
                    represented_people_count: 1,
                    attended: true
                  })
                }
              >
                {t('relacionamiento.registro.agregarPersona')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  participantes.append({
                    tipo: 'grupo',
                    participant_name: '',
                    represented_group: '',
                    sex: '',
                    participant_scope: '',
                    represented_people_count: 1,
                    attended: true
                  })
                }
              >
                {t('relacionamiento.registro.agregarGrupoSinNombres')}
              </Button>
            </div>
            <p role="status" className="text-sm font-medium">
              {t('relacionamiento.registro.totales', { total: numeroPe(total), f: numeroPe(porSexo('FEMENINO')), m: numeroPe(porSexo('MASCULINO')) })}
            </p>
          </div>
        ) : null}
        {paso === 3 ? (
          <div className="space-y-3">
            {preguntas.fields.map((campo, i) => (
              <fieldset key={campo.id} className="grid gap-2 rounded-sg-md border border-sg-border p-3 md:grid-cols-2">
                <legend className="px-1 text-sm">{t('relacionamiento.registro.pregunta')}</legend>
                <div className="md:col-span-2">
                  <Campo etiqueta={t('relacionamiento.registro.pregunta')}>{(p) => <Textarea {...p} {...register(`preguntas.${i}.question_text`)} />}</Campo>
                </div>
                <Campo etiqueta={t('relacionamiento.registro.cargo')}>{(p) => <Input {...p} {...register(`preguntas.${i}.raised_by_role`)} />}</Campo>
                <Campo etiqueta={t('relacionamiento.registro.tema')}>
                  {(p) => (
                    <SelectNativo
                      {...p}
                      opciones={(temas.data ?? []).map((x) => ({ valor: x.id, etiqueta: texto(x, 'name') }))}
                      {...register(`preguntas.${i}.topic`)}
                    />
                  )}
                </Campo>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register(`preguntas.${i}.answered_on_site`)} />
                  {t('relacionamiento.registro.respondidaEnElLugar')}
                </label>
                {v.preguntas?.[i]?.answered_on_site ? (
                  <Campo etiqueta={t('relacionamiento.registro.respuesta')}>{(p) => <Textarea {...p} {...register(`preguntas.${i}.answer`)} />}</Campo>
                ) : null}
              </fieldset>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => preguntas.append({ question_text: '', answered_on_site: false, answer: '', raised_by_role: '', topic: '' })}
            >
              {t('relacionamiento.registro.agregarPreguntaFila')}
            </Button>
            <fieldset className="space-y-1">
              <legend className="text-sg-label font-medium">{t('relacionamiento.ficha.temas')}</legend>
              <DeLista consulta={temas}>
                {(todos) => (
                  <div className="flex flex-wrap gap-3 text-sm">
                    {todos.map((x) => (
                      <label key={x.id} className="flex items-center gap-1">
                        <input type="checkbox" value={x.id} {...register('temas')} />
                        {texto(x, 'name')}
                      </label>
                    ))}
                  </div>
                )}
              </DeLista>
            </fieldset>
          </div>
        ) : null}
        {paso === 4 ? (
          <section className="space-y-2 text-sm" aria-label={t('relacionamiento.registro.revisar')}>
            <h3 className="font-medium">{t('relacionamiento.registro.revisar')}</h3>
            <p>
              {v.engagement_type} · {v.title}
            </p>
            <p>
              {v.realizada
                ? `${t('relacionamiento.registro.realizadaEl')}: ${v.held_at}`
                : `${t('relacionamiento.registro.programada')}: ${v.scheduled_at || '—'}`}
            </p>
            <p>{t('relacionamiento.registro.totales', { total: numeroPe(total), f: numeroPe(porSexo('FEMENINO')), m: numeroPe(porSexo('MASCULINO')) })}</p>
            <p>
              {t('relacionamiento.registro.grupos')}: {(v.grupos ?? []).length} · {t('relacionamiento.ficha.preguntas')}: {(v.preguntas ?? []).length}
            </p>
            <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.registro.sinConexion')}</p>
          </section>
        ) : null}
        {guardar.isError ? <ErrorDeGuardado error={guardar.error} proyecto={projectId} /> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-sg-border pt-3">
          {paso > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setPaso(paso - 1)}>
              {t('comun.anterior')}
            </Button>
          ) : null}
          {paso < 4 ? (
            <Button type="button" onClick={() => void ir(paso + 1)}>
              {t('comun.siguiente')}
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" disabled={guardar.isPending || parcial} onClick={() => void enviar(null)()}>
                {t('relacionamiento.registro.completarDespues')}
              </Button>
              {v.realizada ? (
                <Button type="button" disabled={guardar.isPending || parcial} onClick={() => void enviar('register_held_unplanned')()}>
                  {guardar.isPending ? t('relacionamiento.registro.guardando') : t('relacionamiento.registro.guardarRealizada')}
                </Button>
              ) : (
                <Button type="button" disabled={guardar.isPending || parcial || !v.scheduled_at} onClick={() => void enviar('schedule')()}>
                  {guardar.isPending ? t('relacionamiento.registro.guardando') : t('relacionamiento.registro.programar')}
                </Button>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  )
}
