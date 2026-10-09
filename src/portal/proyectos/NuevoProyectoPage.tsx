import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useRef, useState } from 'react'
import { useForm, type FieldErrors } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { AvisoDeConflicto } from '../componentes/AvisoDeConflicto'
import { Campo, SelectNativo } from '../componentes/Campo'
import { useErroresDeCampo } from '../componentes/errores'
import { Cargando, ErrorDeCarga } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Pasos } from '../componentes/Pasos'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useMisAsignaciones } from '../contexto/proyectos'
import { usePedir } from '../datos/http'
import { atributo, campoDe, escribeAlgunCampo, texto, useActualizar, useCrear, useDefinicion, useRegistro, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useAplicarTransicion } from '../transiciones/api'
import { CampanaDelProyecto, EquipoDelProyecto, PartesDelProyecto } from './EquipoYPartes'
import { FormularioDeAsignacion } from './FormularioDeAsignacion'
import { aNumero, ParametroNumerico } from './ParametroNumerico'
import { PARAMETROS_F2, valoresPorDefecto } from './parametros'

// S07 · crear proyecto (screens.md §3, flujo 1): siete pasos; el proyecto nace en draft al salir del paso 1 y cada cambio
// de paso guarda el borrador si el formulario cambió (también «Anterior» y el indicador de pasos). un 409 por código
// repetido vuelve al paso 1 con el campo marcado. el paso 7 muestra las precondiciones de activación (ASM-062) y aplica
// submit_for_review. ?draft=<id> abre un borrador existente para completarlo; al crearlo, la URL recoge su id.
// P40: ProjectScopeGuard exige una asignación vigente para escribir en el proyecto, también en su borrador, y uno nuevo no
// tiene equipo. tras crear el borrador (o al abrir uno sin estar asignado), quien no es ADMIN se asigna a sí mismo con su rol
// antes de cualquier otra escritura (la de project_assignment está exenta, security.md §9.2, ítem 5); hasta entonces los
// demás pasos no se alcanzan y no sale ningún PUT
const esquema = z
  .object({
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    project_type: z.string(),
    stage: z.string(),
    exploration_phase: z.string(),
    start_date: z.string(),
    description: z.string(),
    working_crs: z.string(),
    latitud: z.string(),
    longitud: z.string(),
    parametros: z.record(z.string(), z.union([z.number(), z.boolean()]))
  })
  .superRefine((v, ctx) => {
    // la ubicación es un punto: latitud y longitud juntas o ambas vacías; un texto de solo espacios no es un número
    if (v.latitud === '' && v.longitud === '') return
    if (v.latitud === '' || v.longitud === '') {
      ctx.addIssue({ code: 'custom', path: [v.latitud === '' ? 'latitud' : 'longitud'], message: 'incompleta' })
    }
    if (v.latitud !== '' && fueraDeRango(v.latitud, 90)) ctx.addIssue({ code: 'custom', path: ['latitud'], message: 'fuera' })
    if (v.longitud !== '' && fueraDeRango(v.longitud, 180)) ctx.addIssue({ code: 'custom', path: ['longitud'], message: 'fuera' })
  })
type Valores = z.infer<typeof esquema>

const fueraDeRango = (texto: string, maximo: number): boolean => {
  const n = aNumero(texto)
  return !Number.isFinite(n) || Math.abs(n) > maximo
}

const CAMPOS_DEL_PROYECTO = ['code', 'name', 'project_type', 'stage', 'exploration_phase', 'start_date', 'description', 'working_crs'] as const
const PASO_IDENTIFICACION = 0
const PASO_UBICACION = 1
const PASO_PARAMETROS = 5
const PASO_REVISION = 6
// los pasos con campos del proyecto son un formulario; los de partes, campaña y equipo tienen los suyos y no pueden anidarse
const FORMULARIO = 'asistente-paso'
const conCampos = (paso: number) => paso === PASO_IDENTIFICACION || paso === PASO_UBICACION || paso === PASO_PARAMETROS
// el paso en que vive cada campo del formulario: un error de un campo que no se ve lleva a su paso
const PASO_DE_CAMPO: Record<string, number> = {
  code: PASO_IDENTIFICACION,
  name: PASO_IDENTIFICACION,
  project_type: PASO_IDENTIFICACION,
  stage: PASO_IDENTIFICACION,
  exploration_phase: PASO_IDENTIFICACION,
  start_date: PASO_IDENTIFICACION,
  description: PASO_IDENTIFICACION,
  working_crs: PASO_UBICACION,
  latitud: PASO_UBICACION,
  longitud: PASO_UBICACION,
  parametros: PASO_PARAMETROS
}

const valoresDe = (p: Registro | undefined): Valores => {
  const punto = p?.geometries?.location?.coordinates as [number, number] | undefined
  return {
    ...(Object.fromEntries(CAMPOS_DEL_PROYECTO.map((c) => [c, texto(p, c)])) as Record<(typeof CAMPOS_DEL_PROYECTO)[number], string>),
    longitud: punto ? String(punto[0]) : '',
    latitud: punto ? String(punto[1]) : '',
    parametros: {
      ...valoresPorDefecto(),
      ...Object.fromEntries(
        PARAMETROS_F2.filter((x) => p?.attributes[x.campo] !== undefined && p?.attributes[x.campo] !== null).map((x) => [
          x.campo,
          p!.attributes[x.campo] as number | boolean
        ])
      )
    }
  }
}

export function NuevoProyectoPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const [busqueda] = useSearchParams()
  const borrador = busqueda.get('draft')
  const existente = useRegistro('project', borrador ?? undefined)
  const definicion = useDefinicion('project')
  // una vez abierto el asistente se queda: al crear el borrador la URL recoge su id (?draft=) y eso no debe recargarlo
  const abierto = useRef(false)
  if (!abierto.current) {
    if (!borrador && !can('project', 'CREATE')) return <Alert tone="warning">{t('proyectos.asistente.sinCrear')}</Alert>
    if (borrador) {
      if (existente.isPending || definicion.isPending) return <Cargando />
      if (existente.isError)
        return existente.error instanceof ApiError && existente.error.status === 404 ? (
          <Alert tone="warning">{t('p360.asistente.noEncontrado')}</Alert>
        ) : (
          <ErrorDeCarga error={existente.error} alReintentar={() => void existente.refetch()} />
        )
      if (definicion.isError) return <ErrorDeCarga error={definicion.error} alReintentar={() => void definicion.refetch()} />
      if (existente.data?.state !== 'draft') return <Alert tone="warning">{t('p360.asistente.noEsBorrador')}</Alert>
      // completar un borrador pide UPDATE y algún campo escribible: un rol con "u" sobre project no tiene ninguno
      if (!(can('project', 'UPDATE') && escribeAlgunCampo('project', definicion.data)))
        return <Alert tone="warning">{t('proyectos.asistente.sinEditar')}</Alert>
    }
    abierto.current = true
  }
  return <Asistente inicial={existente.data} />
}

function Asistente({ inicial }: { inicial?: Registro }) {
  const { t } = useTranslation(NS)
  // el texto de cada parámetro numérico, para que un cambio de paso no lo pierda (un inválido es NaN en el formulario)
  const textosDeParametros = useRef<Record<string, string>>({})
  const navegar = useNavigate()
  const erroresDeCampo = useErroresDeCampo()
  const cliente = useQueryClient()
  const pedir = usePedir()
  const definicion = useDefinicion('project')
  const crear = useCrear('project')
  const actualizar = useActualizar('project')
  const enviarARevision = useAplicarTransicion('project')
  const [proyecto, setProyecto] = useState<Registro | undefined>(inicial)
  const misAsignaciones = useMisAsignaciones()
  const escribeEnElProyecto = useEscribeEnProyecto(proyecto?.id)
  // P40: el borrador existe y la cuenta todavía no puede escribir en él
  const faltaAsignarse = Boolean(proyecto) && !escribeEnElProyecto
  const [paso, setPaso] = useState(0)
  const [visitados, setVisitados] = useState(0)
  // el último error de escritura que no quedó junto a un campo
  const [fallo, setFallo] = useState<unknown>(null)
  // se salió de un paso con datos inválidos: siguen en el formulario, pero no se guardaron
  const [sinGuardar, setSinGuardar] = useState(false)
  const formulario = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: valoresDe(inicial) })
  const { register, handleSubmit, setError, formState, watch, setValue, reset } = formulario
  const sucio = formState.isDirty
  const guardando = crear.isPending || actualizar.isPending
  const pasos = t('proyectos.asistente.pasos', { returnObjects: true }) as string[]
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const rotulo = (campo: string) => campoDe(definicion.data, campo)?.label ?? campo

  const guardar = async (v: Valores): Promise<Registro> => {
    const atributos = { ...Object.fromEntries(CAMPOS_DEL_PROYECTO.map((c) => [c, v[c]])), ...v.parametros }
    const hayPunto = v.latitud.trim() !== '' && v.longitud.trim() !== ''
    const geometrias = hayPunto ? { location: { type: 'Point', coordinates: [aNumero(v.longitud), aNumero(v.latitud)] } } : undefined
    const guardado = proyecto
      ? await actualizar.mutateAsync({ registro: proyecto, cambios: atributos, geometrias })
      : await crear.mutateAsync({ atributos, geometrias })
    // el borrador ya existe: la URL lo recoge para que recargar o volver no pierda el asistente
    if (!proyecto) navegar(`?draft=${guardado.id}`, { replace: true })
    setProyecto(guardado)
    return guardado
  }

  // un 412: otra persona cambió el borrador (la PMG lo completa, S07). se relee y el asistente sigue con la versión nueva: lo
  // tecleado (sucio) se conserva y lo no tocado toma los valores nuevos, así el siguiente guardado, con su If-Match, no pisa
  // el cambio de la otra persona (re-revisión, N1)
  const releerBorrador = async () => {
    if (!proyecto) return
    const id = proyecto.id
    const releido = await cliente.fetchQuery({
      queryKey: ['record', 'project', id],
      queryFn: () => pedir<Registro>(`/objects/project/records/${id}`),
      staleTime: 0
    })
    reset(valoresDe(releido), { keepDirtyValues: true })
    setProyecto(releido)
  }

  const ir = (siguiente: number) => {
    setPaso(siguiente)
    setVisitados((v) => Math.max(v, siguiente))
  }

  // un error del servidor: el código repetido (un 409 sin campo o sobre code) marca el código en el paso 1; un error de
  // un campo del proyecto queda junto a su control, en su paso; lo demás, a la vista al pie. nunca el código crudo
  const alFallar = (e: unknown) => {
    if (!(e instanceof ApiError)) return setFallo(e)
    if (e.status === 409 && (e.violations.length === 0 || e.violations.some((v) => v.field === 'code'))) {
      setError('code', { type: 'manual', message: t('proyectos.asistente.codigoRepetido') })
      return ir(PASO_IDENTIFICACION)
    }
    const porCampo = erroresDeCampo(e)
    const propios = Object.entries(porCampo).filter(([campo]) => (CAMPOS_DEL_PROYECTO as readonly string[]).includes(campo))
    for (const [campo, texto] of propios) setError(campo as (typeof CAMPOS_DEL_PROYECTO)[number], { type: 'manual', message: texto })
    if (propios.length > 0) ir(Math.min(...propios.map(([campo]) => PASO_DE_CAMPO[campo] ?? paso)))
    if (propios.length === 0 || propios.length < Object.keys(porCampo).length) setFallo(e)
  }

  const persistir = async (v: Valores): Promise<Registro | null> => {
    setFallo(null)
    try {
      const guardado = await guardar(v)
      reset(v)
      return guardado
    } catch (e) {
      alFallar(e)
      return null
    }
  }

  // un error de validación en un campo que no se ve (la latitud tecleada y luego un «Anterior») lleva al paso que lo tiene
  const alInvalidar = (errores: FieldErrors<Valores>) => {
    const pasosConError = Object.keys(errores).map((campo) => PASO_DE_CAMPO[campo] ?? paso)
    if (pasosConError.length > 0 && !pasosConError.includes(paso)) ir(Math.min(...pasosConError))
  }

  // cualquier movimiento (Siguiente, Anterior, el indicador) guarda el borrador si lo tecleado cambió o aún no existe.
  // Siguiente exige datos válidos; Anterior y el indicador (libre) no quedan bloqueados por ellos: se mueven sin guardar y
  // avisan, y lo inválido sigue en el formulario con su error, nunca se descarta
  const moverA =
    (destino: number, libre = false) =>
    (e?: React.BaseSyntheticEvent) => {
      // sin la asignación propia (P40) nada se guarda ni se avanza
      if (faltaAsignarse) return
      setSinGuardar(false)
      return handleSubmit(
        async (v) => {
          if ((!proyecto || sucio) && !(await persistir(v))) return
          ir(destino)
        },
        (errores) => {
          if (!libre) return alInvalidar(errores)
          setSinGuardar(true)
          ir(destino)
        }
      )(e)
    }

  const guardarYSalir = handleSubmit(async (v) => {
    // sin la asignación propia (P40) se sale sin escribir: el borrador ya existe y se completa al volver
    const guardado = faltaAsignarse ? proyecto : !proyecto || sucio ? await persistir(v) : proyecto
    if (guardado) navegar(`/projects/${guardado.id}/overview`)
  }, alInvalidar)

  const siguiente = (e?: React.BaseSyntheticEvent) => void moverA(Math.min(paso + 1, PASO_REVISION))(e)

  const enviar = () => {
    if (!proyecto) return
    enviarARevision.mutate({ registro: proyecto, transicion: 'submit_for_review' }, { onSuccess: () => navegar(`/projects/${proyecto.id}/overview`) })
  }

  // el mensaje de un error del servidor (setError) o, el de Zod, en el idioma del portal
  const errorDe = (campo: (typeof CAMPOS_DEL_PROYECTO)[number]) => {
    const error = formState.errors[campo]
    return error ? (error.type === 'manual' ? error.message : t('proyectos.asistente.obligatorio')) : undefined
  }
  const errorDeUbicacion = (campo: 'latitud' | 'longitud') => {
    const error = formState.errors[campo]
    if (!error) return undefined
    return error.message === 'incompleta'
      ? t('p360.asistente.ubicacionIncompleta')
      : t(campo === 'latitud' ? 'p360.asistente.latitudFuera' : 'p360.asistente.longitudFuera')
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[220px_1fr]">
      <div className="space-y-2">
        <h1 className="text-sg-h2 font-semibold">{proyecto ? t('proyectos.asistente.completar') : t('proyectos.asistente.titulo')}</h1>
        <Pasos pasos={pasos} actual={paso} visitados={visitados} alIr={(i) => void moverA(i, true)()} />
      </div>
      <div role="group" className="space-y-4" aria-label={faltaAsignarse ? t('proyectos.asistente.asignarse.titulo') : pasos[paso]}>
        {faltaAsignarse && proyecto ? (
          <AsignacionPropia proyecto={proyecto.id} asignaciones={misAsignaciones} />
        ) : (
          <h2 className="text-sg-h3 font-semibold">{pasos[paso]}</h2>
        )}
        {faltaAsignarse ? null : paso === 0 ? (
          <form id={FORMULARIO} onSubmit={siguiente} className="grid gap-3 md:grid-cols-2">
            <Campo etiqueta={rotulo('code')} error={errorDe('code')}>
              {(p) => <Input {...p} {...register('code')} />}
            </Campo>
            <Campo etiqueta={rotulo('name')} error={errorDe('name')}>
              {(p) => <Input {...p} {...register('name')} />}
            </Campo>
            {(['project_type', 'stage', 'exploration_phase'] as const).map((c) => (
              <Campo key={c} etiqueta={rotulo(c)} error={errorDe(c)}>
                {(p) => <SelectNativo {...p} opciones={opciones(c)} {...register(c)} />}
              </Campo>
            ))}
            <Campo etiqueta={rotulo('start_date')} error={errorDe('start_date')}>
              {(p) => <Input {...p} type="date" {...register('start_date')} />}
            </Campo>
            <div className="md:col-span-2">
              <Campo etiqueta={rotulo('description')} error={errorDe('description')}>
                {(p) => <Textarea {...p} {...register('description')} />}
              </Campo>
            </div>
          </form>
        ) : null}
        {!faltaAsignarse && paso === 1 ? (
          <form id={FORMULARIO} onSubmit={siguiente} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Campo etiqueta={t('proyectos.asistente.crs')} ayuda={t('proyectos.asistente.crsAyuda')} error={errorDe('working_crs')}>
                {(p) => <SelectNativo {...p} opciones={opciones('working_crs')} {...register('working_crs')} />}
              </Campo>
            </div>
            <Campo etiqueta={t('proyectos.asistente.latitud')} error={errorDeUbicacion('latitud')}>
              {(p) => <Input {...p} inputMode="decimal" {...register('latitud')} />}
            </Campo>
            <Campo etiqueta={t('proyectos.asistente.longitud')} error={errorDeUbicacion('longitud')}>
              {(p) => <Input {...p} inputMode="decimal" {...register('longitud')} />}
            </Campo>
          </form>
        ) : null}
        {!faltaAsignarse && paso === 2 && proyecto ? <PartesDelProyecto proyecto={proyecto.id} /> : null}
        {!faltaAsignarse && paso === 3 && proyecto ? <CampanaDelProyecto proyecto={proyecto.id} /> : null}
        {!faltaAsignarse && paso === 4 && proyecto ? <EquipoDelProyecto proyecto={proyecto.id} /> : null}
        {!faltaAsignarse && paso === PASO_PARAMETROS ? (
          <form id={FORMULARIO} onSubmit={siguiente}>
            <ul className="space-y-3">
              {PARAMETROS_F2.map((par) => {
                const valor = watch(`parametros.${par.campo}`)
                const marca = valor === par.porDefecto ? t('proyectos.asistente.porDefecto') : t('proyectos.asistente.cambiado')
                return (
                  <li key={par.campo} className="flex items-center justify-between gap-4">
                    <label htmlFor={`par-${par.campo}`} className="text-sm">
                      {t(`p360.parametros.${par.campo}`)} <span className="text-sg-caption text-sg-text-muted">({marca})</span>
                    </label>
                    {par.tipo === 'politica' ? (
                      <input
                        id={`par-${par.campo}`}
                        type="checkbox"
                        checked={Boolean(valor)}
                        onChange={(e) => setValue(`parametros.${par.campo}`, e.target.checked, { shouldDirty: true })}
                      />
                    ) : (
                      <ParametroNumerico
                        id={`par-${par.campo}`}
                        valor={Number(valor)}
                        porDefecto={Number(par.porDefecto)}
                        entero={campoDe(definicion.data, par.campo)?.type === 'INTEGER'}
                        intentoDeGuardar={formState.submitCount > 0}
                        textoInicial={textosDeParametros.current[par.campo]}
                        alEscribir={(x) => (textosDeParametros.current[par.campo] = x)}
                        alCambiar={(n) => setValue(`parametros.${par.campo}`, n, { shouldDirty: true })}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </form>
        ) : null}
        {!faltaAsignarse && paso === PASO_REVISION && proyecto ? <Revision proyecto={proyecto} /> : null}
        {sinGuardar ? <Alert tone="notice">{t('proyectos.asistente.sinGuardar')}</Alert> : null}
        {fallo ? <AvisoDeConflicto error={fallo} releer={releerBorrador} alRecargar={() => setFallo(null)} /> : null}
        {enviarARevision.isError ? <AvisoDeConflicto error={enviarARevision.error} releer={releerBorrador} alRecargar={() => enviarARevision.reset()} /> : null}
        <p className="text-sg-caption text-sg-text-muted">{t('proyectos.asistente.guardadoAuto')}</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-sg-border pt-3">
          <Button type="button" variant="ghost" disabled={guardando} onClick={() => void guardarYSalir()}>
            {t('proyectos.asistente.guardarYSalir')}
          </Button>
          {paso > 0 && !faltaAsignarse ? (
            <Button type="button" variant="secondary" disabled={guardando} onClick={() => void moverA(paso - 1, true)()}>
              {t('comun.anterior')}
            </Button>
          ) : null}
          {faltaAsignarse ? null : paso < PASO_REVISION ? (
            <Button
              type={conCampos(paso) ? 'submit' : 'button'}
              form={conCampos(paso) ? FORMULARIO : undefined}
              onClick={conCampos(paso) ? undefined : () => siguiente()}
              disabled={guardando}
            >
              {guardando ? t('comun.guardando') : t('comun.siguiente')}
            </Button>
          ) : (
            <Button type="button" onClick={enviar} disabled={enviarARevision.isPending || !proyecto}>
              {enviarARevision.isPending ? t('proyectos.asistente.enviando') : t('proyectos.asistente.crearYEnviar')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// P40: el paso previo a toda escritura sobre el borrador. dice por qué, y sin CREATE sobre project_assignment, a quién pedirlo
// si las asignaciones de la cuenta no se pudieron leer no se ofrece asignarse (podría estarlo ya): se dice el fallo
// tras asignarse, el asistente sigue cuando la relectura de las asignaciones trae la nueva; si esa relectura falla, no se
// ofrece asignarse otra vez (sería una asignación duplicada): se pide reintentar la lectura (re-revisión, menor 2)
function AsignacionPropia({ proyecto, asignaciones }: { proyecto: string; asignaciones: UseQueryResult<unknown> }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const [asignada, setAsignada] = useState(false)
  if (asignaciones.isPending) return <Cargando />
  if (asignaciones.isError && !asignaciones.data) return <FalloDeLectura error={asignaciones.error} alReintentar={() => void asignaciones.refetch()} />
  if (asignada) {
    if (asignaciones.isFetching) return <Cargando />
    return (
      <Alert tone="warning">
        {t('proyectos.asistente.asignarse.yaAsignada')}
        <Button type="button" variant="secondary" size="sm" className="ml-2" onClick={() => void asignaciones.refetch()}>
          {t('comun.reintentar')}
        </Button>
      </Alert>
    )
  }
  return (
    <section className="space-y-3">
      <h2 className="text-sg-h3 font-semibold">{t('proyectos.asistente.asignarse.titulo')}</h2>
      <p className="text-sm text-sg-text-secondary">{t('proyectos.asistente.asignarse.porQue')}</p>
      {can('project_assignment', 'CREATE') ? (
        <FormularioDeAsignacion proyecto={proyecto} propia alGuardar={() => setAsignada(true)} />
      ) : (
        <Alert tone="warning">{t('proyectos.asistente.asignarse.sinPermiso')}</Alert>
      )}
    </section>
  )
}

function Revision({ proyecto }: { proyecto: Registro }) {
  const { t } = useTranslation(NS)
  const partes = useTodos('project_party', { project: proyecto.id })
  const conParte = (partes.data ?? []).some((p) => ['CLIENTE', 'OPERADOR'].includes(texto(p, 'party_role')))
  const conCrs = Boolean(atributo(proyecto, 'working_crs'))
  const definicion = useDefinicion('project')
  return (
    <section className="space-y-3">
      <h3 className="font-medium">{t('proyectos.asistente.revisar')}</h3>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        {CAMPOS_DEL_PROYECTO.map((c) => (
          <div key={c} className="contents">
            <dt className="text-sg-text-muted">{campoDe(definicion.data, c)?.label ?? c}</dt>
            <dd>{texto(proyecto, c) || '—'}</dd>
          </div>
        ))}
      </dl>
      <h3 className="font-medium">{t('proyectos.asistente.precondiciones')}</h3>
      <ul className="text-sm">
        <li data-cumple={conCrs}>
          {conCrs ? '✓' : '✗'} {t('proyectos.asistente.preCrs')}
        </li>
        <li data-cumple={conParte}>
          {conParte ? '✓' : '✗'} {t('proyectos.asistente.preParte')}
        </li>
      </ul>
      <Alert tone="notice" title={t('proyectos.asistente.quePasara')}>
        {t('proyectos.asistente.quePasaraTexto')}
      </Alert>
    </section>
  )
}
