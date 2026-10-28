import { zodResolver } from '@hookform/resolvers/zod'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth, type ObjectDefinition } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useId, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { CampoFecha } from '../componentes/CampoFecha'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { Cargando, NoDisponible } from '../componentes/Estados'
import { ConDefiniciones, DeLista, FalloDeLectura } from '../componentes/LecturaConEstados'
import { FormularioPorPasos, useSalidaPermitida } from '../componentes/FormularioPorPasos'
import { useAsignadoAlProyecto } from '../contexto/ProyectoLayout'
import { useMisAsignaciones } from '../contexto/proyectos'
import { nuevaClave } from '../datos/http'
import { puedeLeer, texto, useDefinicion, useRegistro, useTodos, type Registro } from '../datos/registros'
import { instanteDeLima } from '../datos/fechas'
import { fechaYHoraPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { ErrorDeGuardado } from './ErrorDeGuardado'
import { ConmutadorDeModo } from './ConmutadorDeModo'
import { GuardadoParcial, useGuardarInteraccion, type NuevaInteraccion } from './guardarInteraccion'
import { RegistroRapido } from './RegistroRapido'
import { Mapa } from '../mapa/Mapa'
import { LugaresDelPunto } from '../territorio/LugaresDelPunto'

// S24 · registrar interacción (screens.md §6, flujos 4 y 5): cinco pasos con participantes sin pedir datos personales que
// no hacen falta (filas de persona o de grupo sin nombres, con personas ≥ 1) y totales en vivo; al final "Guardar como
// realizada" (register_held_unplanned) o "Programar" (schedule). abierta desde S16 trae los grupos de interés elegidos
// (?stakeholders=); el territorio sale del chip. en el teléfono, o con ?mode=quick, el modo rápido de campo, que se
// enciende y se apaga con el conmutador de la cabecera. F-D: el paso 1 es solo tipo, título, «¿Ya se realizó?» y su fecha
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

// lo que se teclea (CampoFecha) es la hora de Lima y viaja como instante UTC (instanteDeLima); uno que no es fecha no viaja
const instante = instanteDeLima
// en la revisión, lo tecleado se dice como fecha y hora es-PE
const instanteDicho = (local: string) => (instanteDeLima(local) ? fechaYHoraPe(new Date(instanteDeLima(local))) : local || '—')

export function RegistrarInteraccionPage() {
  const [busqueda] = useSearchParams()
  const { projectId = '' } = useParams()
  const { can, isAdmin } = useAuth()
  const asignaciones = useMisAsignaciones()
  const asignado = useAsignadoAlProyecto(projectId)
  const definicion = useDefinicion('engagement')
  const definicionDeParticipante = useDefinicion('engagement_participant')
  // ?mode=quick es el modo rápido, ?mode=full el asistente aunque la pantalla sea angosta; sin él, el teléfono usa el rápido
  const modo = busqueda.get('mode')
  const rapido = modo === 'quick' || (modo !== 'full' && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches)
  // sin permiso para crear, o sin asignación vigente (el servidor rechazaría el alta), no hay formulario que llenar en vano
  if (!can('engagement', 'CREATE')) return <NoDisponible />
  if (!isAdmin) {
    if (asignaciones.isPending) return <Cargando />
    if (asignaciones.isError && !asignaciones.data) return <FalloDeLectura error={asignaciones.error} alReintentar={() => void asignaciones.refetch()} />
    if (!asignado) return <NoDisponible motivo="NOT_ASSIGNED" />
  }
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
  const { register, control, handleSubmit, formState, trigger, setValue, reset } = formulario
  const participantes = useFieldArray({ control, name: 'participantes' })
  const preguntas = useFieldArray({ control, name: 'preguntas' })
  const v = useWatch({ control }) as Valores
  const localidad = useRegistro('locality', v.locality || undefined)
  const comunidad = useRegistro('community', v.community || undefined)
  // el punto de la interacción marcado en el mapa del paso «Lugar» (decisión 20 del plan 6.3): propone sus lugares y viaja como
  // location (si la cuenta la escribe; geometriasDeEscritura lo decide)
  const [punto, setPunto] = useState<[number, number] | null>(null)
  const salida = useSalidaPermitida()
  const capaDelPunto = useMemo(
    () =>
      punto
        ? [
            {
              id: 'punto',
              color: '--sg-primary',
              seleccionable: false,
              datos: {
                type: 'FeatureCollection' as const,
                features: [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: punto }, properties: { __id: 'punto' } }]
              }
            }
          ]
        : [],
    [punto]
  )
  const asistentes = (v.participantes ?? []).filter((p) => p.attended)
  const total = asistentes.reduce((s, p) => s + (Number(p.represented_people_count) || 0), 0)
  const porSexo = (sexo: string) => asistentes.filter((p) => p.sex === sexo).reduce((s, p) => s + (Number(p.represented_people_count) || 0), 0)

  // el paso de cada campo con error, para llevar a la persona adonde está lo que debe corregir
  const PASO_DEL_CAMPO: Partial<Record<keyof Valores, number>> = {
    engagement_type: 0,
    title: 0,
    held_at: 0,
    scheduled_at: 0,
    participantes: 2,
    preguntas: 3
  }
  const CAMPOS_DEL_PASO: (keyof Valores)[][] = [['engagement_type', 'title', 'held_at'], [], ['participantes'], ['preguntas'], []]
  const ir = async (siguiente: number) => {
    if (siguiente > paso && !(await trigger(CAMPOS_DEL_PASO[paso]))) return
    setPaso(siguiente)
    setVisitados((x) => Math.max(x, siguiente))
  }

  const [faltaAsistente, setFaltaAsistente] = useState(false)
  // «Programar» sin fecha no se deshabilita en silencio: lleva al paso de la fecha y lo dice ahí (tercera pasada de UX, 2.8)
  const [faltaProgramada, setFaltaProgramada] = useState(false)
  const [conErrores, setConErrores] = useState<number | null>(null)
  const irA = (destino: number) => {
    setPaso(destino)
    setVisitados((x) => Math.max(x, destino))
  }
  const hayAsistentes = asistentes.some((p) => Number(p.represented_people_count) >= 1)

  // «Anterior» y el indicador de pasos no validan: lo que falla al guardar puede estar en un paso que no se ve, así que se lleva
  // a la persona al primero con error y se le dice (nunca un botón que no hace nada)
  const alFallar = (errores: FieldErrors<Valores>) => {
    const destino = Math.min(4, ...Object.keys(errores).map((c) => PASO_DEL_CAMPO[c as keyof Valores] ?? 4))
    setConErrores(destino)
    irA(destino)
  }

  const enviar = (transicion: NuevaInteraccion['transicion']) =>
    handleSubmit((valores) => {
      setConErrores(null)
      // register_held_unplanned exige al menos un participante que asistió (RF-ENG-004): comprobarlo antes de escribir evita
      // dejar una interacción planificada y con fecha de realización, a medias
      if (transicion === 'register_held_unplanned' && !valores.participantes.some((p) => p.attended && Number(p.represented_people_count) >= 1)) {
        setFaltaAsistente(true)
        return irA(2)
      }
      setFaltaAsistente(false)
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
        ubicacion: punto ? { type: 'Point', coordinates: punto } : null,
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
          // React Router navega en una transición: si se vuelve atrás antes de que se confirme la ficha, el asistente sigue
          // montado; sin limpiar, lo escrito quedaría con una clave nueva y otro «Guardar» duplicaría la interacción
          setClave(nuevaClave())
          reset()
          setPunto(null)
          setPaso(0)
          setVisitados(0)
          salida.current = true
          navegar(`/projects/${encodeURIComponent(projectId)}/engagements/${encodeURIComponent(i.id)}`)
        }
      })
    }, alFallar)

  // lo ya creado queda: guardar otra vez dejaría una interacción duplicada, así que lo que falta se completa desde su ficha
  const parcial = guardar.error instanceof GuardadoParcial
  const errorDeFecha = formState.errors.held_at ? t('relacionamiento.registro.faltaFecha') : undefined

  // la forma común de las altas largas (FormularioPorPasos, revisión de UX, etapa 5): «Cancelar» vuelve a donde se abrió (la
  // visita de campo o la lista) y, con cambios, salir pide confirmar. «Completar después» guarda en el servidor y hace de
  // «Guardar y salir», así que no hay otro
  const visita = busqueda.get('field_visit')
  const volverA = visita
    ? `/projects/${encodeURIComponent(projectId)}/field-visits/${encodeURIComponent(visita)}`
    : `/projects/${encodeURIComponent(projectId)}/engagements`
  return (
    <FormularioPorPasos
      titulo={t('relacionamiento.registro.titulo')}
      accionesDeCabecera={<ConmutadorDeModo rapido={false} />}
      pasos={pasos}
      actual={paso}
      visitados={visitados}
      alIr={(i) => void ir(i)}
      alEnviar={(e) => {
        e.preventDefault()
        if (paso < 4) void ir(paso + 1)
      }}
      alAnterior={() => setPaso(paso - 1)}
      anteriorDeshabilitado={paso === 0 || guardar.isPending}
      alCancelar={() => navegar(volverA)}
      ocupado={guardar.isPending}
      conCambios={formState.isDirty || punto !== null}
      salidaPermitida={salida}
      acciones={
        paso < 4 ? undefined : (
          <>
            <Button type="button" variant="ghost" disabled={guardar.isPending || parcial} onClick={() => void enviar(null)()}>
              {t('relacionamiento.registro.completarDespues')}
            </Button>
            {v.realizada ? (
              <Button type="button" disabled={guardar.isPending || parcial} onClick={() => void enviar('register_held_unplanned')()}>
                {guardar.isPending ? t('relacionamiento.registro.guardando') : t('relacionamiento.registro.guardarRealizada')}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={guardar.isPending || parcial}
                onClick={() => {
                  setFaltaProgramada(!v.scheduled_at)
                  if (!v.scheduled_at) return irA(0)
                  void enviar('schedule')()
                }}
              >
                {guardar.isPending ? t('relacionamiento.registro.guardando') : t('relacionamiento.registro.programar')}
              </Button>
            )}
          </>
        )
      }
    >
      {paso === 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Campo etiqueta={t('relacionamiento.registro.tipo')} error={formState.errors.engagement_type ? t('relacionamiento.registro.faltaTitulo') : undefined}>
            {(p) => <SelectNativo {...p} opciones={opciones('engagement_type')} {...register('engagement_type')} />}
          </Campo>
          <Campo etiqueta={t('relacionamiento.registro.tituloCampo')} error={formState.errors.title ? t('relacionamiento.registro.faltaTitulo') : undefined}>
            {(p) => <Input {...p} {...register('title')} />}
          </Campo>
          <div className="md:col-span-2">
            <Controller
              control={control}
              name="realizada"
              render={({ field }) => <SelectorDeRealizada valor={field.value} alCambiar={field.onChange} alSalir={field.onBlur} />}
            />
          </div>
          {/* el valor es la hora de Lima como la escribía el datetime-local: instanteDeLima la manda como antes */}
          {v.realizada ? (
            <Controller
              key="held_at"
              control={control}
              name="held_at"
              render={({ field }) => (
                <CampoFecha
                  etiqueta={t('relacionamiento.registro.realizadaEl')}
                  conHora
                  requerido
                  error={errorDeFecha}
                  valor={field.value || null}
                  alCambiar={(x) => field.onChange(x ?? '')}
                />
              )}
            />
          ) : (
            <Controller
              key="scheduled_at"
              control={control}
              name="scheduled_at"
              render={({ field }) => (
                <CampoFecha
                  etiqueta={t('relacionamiento.registro.programada')}
                  conHora
                  error={faltaProgramada && !field.value ? t('relacionamiento.registro.faltaProgramada') : undefined}
                  valor={field.value || null}
                  alCambiar={(x) => field.onChange(x ?? '')}
                />
              )}
            />
          )}
        </div>
      ) : null}
      {paso === 1 ? (
        <div className="space-y-3">
          <Campo etiqueta={t('relacionamiento.registro.objetivo')}>{(p) => <Textarea {...p} {...register('objective')} />}</Campo>
          <Campo etiqueta={t('relacionamiento.registro.lugar')}>{(p) => <Input {...p} {...register('place')} />}</Campo>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <LugarElegido etiqueta={t('relacionamiento.registro.localidad')} id={v.locality} consulta={localidad} />
              <BuscadorDeRegistro
                objeto="locality"
                etiqueta={t('relacionamiento.registro.localidad')}
                rotulo={(r) => texto(r, 'name')}
                alElegir={(r) => setValue('locality', r.id)}
              />
            </div>
            <div className="space-y-1">
              <LugarElegido etiqueta={t('relacionamiento.registro.comunidad')} id={v.community} consulta={comunidad} />
              <BuscadorDeRegistro
                objeto="community"
                etiqueta={t('relacionamiento.registro.comunidad')}
                rotulo={(r) => texto(r, 'name')}
                alElegir={(r) => setValue('community', r.id)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sg-label font-medium">{t('ubicar.mapa')}</p>
            <p className="text-sg-caption text-sg-text-muted">{t('ubicar.ayuda')}</p>
            <Mapa
              etiqueta={t('ubicar.mapa')}
              className="relative h-56 w-full overflow-hidden rounded-sg-lg border border-sg-border"
              capas={capaDelPunto}
              alPulsar={setPunto}
            />
            {punto ? <p className="text-sg-caption">{t('ubicar.punto', { lat: punto[1].toFixed(5), lon: punto[0].toFixed(5) })}</p> : null}
            <LugaresDelPunto
              punto={punto}
              alUsar={({ locality, community }) => {
                if (locality) setValue('locality', locality.id)
                if (community) setValue('community', community.id)
              }}
            />
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
              <Campo etiqueta={t('relacionamiento.registro.representa')}>{(p) => <Input {...p} {...register(`participantes.${i}.represented_group`)} />}</Campo>
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
          {faltaAsistente && !hayAsistentes ? <Alert tone="warning">{t('relacionamiento.registro.sinAsistentes')}</Alert> : null}
        </div>
      ) : null}
      {paso === 3 ? (
        <div className="space-y-3">
          {preguntas.fields.map((campo, i) => (
            <fieldset key={campo.id} className="grid gap-2 rounded-sg-md border border-sg-border p-3 md:grid-cols-2">
              <legend className="px-1 text-sm">{t('relacionamiento.registro.pregunta')}</legend>
              <div className="md:col-span-2">
                <Campo
                  etiqueta={t('relacionamiento.registro.pregunta')}
                  error={formState.errors.preguntas?.[i]?.question_text ? t('relacionamiento.registro.preguntaVacia') : undefined}
                >
                  {(p) => <Textarea {...p} {...register(`preguntas.${i}.question_text`)} />}
                </Campo>
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
              ? `${t('relacionamiento.registro.realizadaEl')}: ${instanteDicho(v.held_at)}`
              : `${t('relacionamiento.registro.programada')}: ${instanteDicho(v.scheduled_at)}`}
          </p>
          <p>{t('relacionamiento.registro.totales', { total: numeroPe(total), f: numeroPe(porSexo('FEMENINO')), m: numeroPe(porSexo('MASCULINO')) })}</p>
          <p>
            {t('relacionamiento.registro.grupos')}: {(v.grupos ?? []).length} · {t('relacionamiento.ficha.preguntas')}: {(v.preguntas ?? []).length}
          </p>
          <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.registro.sinConexion')}</p>
        </section>
      ) : null}
      {conErrores !== null && Object.keys(formState.errors).length > 0 ? (
        <Alert tone="warning">{t('relacionamiento.registro.revisarPaso', { paso: pasos[conErrores] })}</Alert>
      ) : null}
      {guardar.isError ? <ErrorDeGuardado error={guardar.error} proyecto={projectId} /> : null}
    </FormularioPorPasos>
  )
}

// «¿Ya se realizó?» (F-D, 02-arquitectura-de-informacion.md §6): dos opciones con su efecto dicho, no una casilla. planificada
// primero, porque es lo que se registra si no se elige
function SelectorDeRealizada({ valor, alCambiar, alSalir }: { valor: boolean; alCambiar: (v: boolean) => void; alSalir: () => void }) {
  const { t } = useTranslation(NS)
  const id = useId()
  const opciones = [
    { valor: false, etiqueta: t('relacionamiento.registro.realizadaNo'), efecto: t('relacionamiento.registro.realizadaNoEfecto') },
    { valor: true, etiqueta: t('relacionamiento.registro.realizadaSi'), efecto: t('relacionamiento.registro.realizadaSiEfecto') }
  ]
  return (
    <div className="space-y-1">
      <p id={`${id}-leyenda`} className="text-sg-label font-medium">
        {t('relacionamiento.registro.realizada')}
      </p>
      <div role="radiogroup" aria-labelledby={`${id}-leyenda`} className="grid gap-2 sm:grid-cols-2">
        {opciones.map((o) => {
          const clave = `${id}-${String(o.valor)}`
          return (
            <div
              key={clave}
              className={`flex items-start gap-2 rounded-sg-md border p-3 ${
                valor === o.valor ? 'border-sg-primary bg-sg-primary-soft' : 'border-sg-border bg-sg-surface'
              }`}
            >
              <input
                id={clave}
                type="radio"
                name={`${id}-realizada`}
                className="mt-0.5"
                checked={valor === o.valor}
                onChange={() => alCambiar(o.valor)}
                onBlur={alSalir}
                aria-describedby={`${clave}-efecto`}
              />
              <div className="space-y-0.5">
                <label htmlFor={clave} className="block text-sm font-medium">
                  {o.etiqueta}
                </label>
                <p id={`${clave}-efecto`} className="text-sg-caption text-sg-text-muted">
                  {o.efecto}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// la localidad o la comunidad elegida (o la del chip de territorio): el nombre llega de la API, así que mientras carga o si no
// se puede leer se dice eso y no «—», que significa «ninguna»
function LugarElegido({ etiqueta, id, consulta }: { etiqueta: string; id: string; consulta: UseQueryResult<Registro> }) {
  const { t } = useTranslation(NS)
  return (
    <div className="space-y-1">
      <p className="text-sg-label font-medium">
        {etiqueta}: {!id ? '—' : consulta.isPending ? t('comun.cargando') : consulta.data ? texto(consulta.data, 'name') : null}
      </p>
      {id && consulta.isError && !consulta.data ? <FalloDeLectura error={consulta.error} alReintentar={() => void consulta.refetch()} /> : null}
    </div>
  )
}
