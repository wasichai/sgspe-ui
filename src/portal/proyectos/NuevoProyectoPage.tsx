import { zodResolver } from '@hookform/resolvers/zod'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Campo, SelectNativo } from '../componentes/Campo'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { Pasos } from '../componentes/Pasos'
import { atributo, escribeAlgunCampo, texto, useActualizar, useCrear, useDefinicion, useRegistro, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useAplicarTransicion } from '../transiciones/api'
import { CampanaDelProyecto, EquipoDelProyecto, PartesDelProyecto } from './EquipoYPartes'
import { PARAMETROS_F2, valoresPorDefecto } from './parametros'

// S07 · crear proyecto (screens.md §3, flujo 1): siete pasos; el proyecto nace en draft al salir del paso 1 y cada paso
// guarda el borrador. un 409 por código repetido vuelve al paso 1 con el campo marcado. el paso 7 muestra las
// precondiciones de activación (ASM-062) y aplica submit_for_review. ?draft=<id> abre un borrador existente para completarlo
const esquema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  project_type: z.string(),
  stage: z.string(),
  exploration_phase: z.string(),
  start_date: z.string(),
  description: z.string(),
  working_crs: z.string(),
  latitud: z.string().refine((v) => v === '' || (Number(v) >= -90 && Number(v) <= 90)),
  longitud: z.string().refine((v) => v === '' || (Number(v) >= -180 && Number(v) <= 180)),
  parametros: z.record(z.string(), z.union([z.number(), z.boolean()]))
})
type Valores = z.infer<typeof esquema>

const CAMPOS_DEL_PROYECTO = ['code', 'name', 'project_type', 'stage', 'exploration_phase', 'start_date', 'description', 'working_crs'] as const
const PASO_IDENTIFICACION = 0
const PASO_PARAMETROS = 5
const PASO_REVISION = 6

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
  if (!borrador && !can('project', 'CREATE')) return <Alert tone="warning">{t('proyectos.asistente.sinCrear')}</Alert>
  if (borrador && (existente.isPending || definicion.isPending)) return <Cargando />
  // completar un borrador pide UPDATE y algún campo escribible: un rol con "u" sobre project no tiene ninguno
  if (borrador && !(can('project', 'UPDATE') && escribeAlgunCampo('project', definicion.data)))
    return <Alert tone="warning">{t('proyectos.asistente.sinEditar')}</Alert>
  return <Asistente inicial={existente.data} />
}

function Asistente({ inicial }: { inicial?: Registro }) {
  const { t } = useTranslation(NS)
  const navegar = useNavigate()
  const mensaje = useMensajeDeError()
  const definicion = useDefinicion('project')
  const crear = useCrear('project')
  const actualizar = useActualizar('project')
  const enviarARevision = useAplicarTransicion('project')
  const [proyecto, setProyecto] = useState<Registro | undefined>(inicial)
  const [paso, setPaso] = useState(0)
  const [visitados, setVisitados] = useState(0)
  const formulario = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: valoresDe(inicial) })
  const { register, handleSubmit, setError, formState, watch, setValue } = formulario
  const pasos = t('proyectos.asistente.pasos', { returnObjects: true }) as string[]
  const opciones = (campo: string) => definicion.data?.fields.find((f) => f.name === campo)?.enumOptions ?? []

  const guardar = async (v: Valores): Promise<Registro> => {
    const atributos = { ...Object.fromEntries(CAMPOS_DEL_PROYECTO.map((c) => [c, v[c]])), ...v.parametros }
    const geometrias = v.latitud && v.longitud ? { location: { type: 'Point', coordinates: [Number(v.longitud), Number(v.latitud)] } } : undefined
    const guardado = proyecto
      ? await actualizar.mutateAsync({ registro: proyecto, cambios: atributos, geometrias })
      : await crear.mutateAsync({ atributos, geometrias })
    setProyecto(guardado)
    return guardado
  }

  const ir = (siguiente: number) => {
    setPaso(siguiente)
    setVisitados((v) => Math.max(v, siguiente))
  }

  const avanzar = handleSubmit(async (v) => {
    if (paso === PASO_IDENTIFICACION || paso === 1 || paso === PASO_PARAMETROS || !proyecto) {
      try {
        await guardar(v)
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setError('code', { type: 'manual', message: t('proyectos.asistente.codigoRepetido') })
          ir(PASO_IDENTIFICACION)
        }
        return
      }
    }
    ir(Math.min(paso + 1, PASO_REVISION))
  })

  const guardarYSalir = handleSubmit(async (v) => {
    const guardado = await guardar(v).catch(() => null)
    if (guardado) navegar(`/projects/${guardado.id}/overview`)
  })

  const enviar = () => {
    if (!proyecto) return
    enviarARevision.mutate({ registro: proyecto, transicion: 'submit_for_review' }, { onSuccess: () => navegar(`/projects/${proyecto.id}/overview`) })
  }

  // el mensaje de un error del servidor (setError) o, el de Zod, en el idioma del portal
  const errorDe = (campo: 'code' | 'name') => {
    const error = formState.errors[campo]
    return error ? (error.type === 'manual' ? error.message : t('proyectos.asistente.obligatorio')) : undefined
  }
  const errorDeEscritura = crear.error ?? actualizar.error

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[220px_1fr]">
      <div className="space-y-2">
        <h1 className="text-sg-h2 font-semibold">{proyecto ? t('proyectos.asistente.completar') : t('proyectos.asistente.titulo')}</h1>
        <Pasos pasos={pasos} actual={paso} visitados={visitados} alIr={ir} />
      </div>
      <form onSubmit={(e) => void avanzar(e)} className="space-y-4" aria-label={pasos[paso]}>
        <h2 className="text-sg-h3 font-semibold">{pasos[paso]}</h2>
        {paso === 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Campo etiqueta={definicion.data?.fields.find((f) => f.name === 'code')?.label ?? 'code'} error={errorDe('code')}>
              {(p) => <Input {...p} {...register('code')} />}
            </Campo>
            <Campo etiqueta={definicion.data?.fields.find((f) => f.name === 'name')?.label ?? 'name'} error={errorDe('name')}>
              {(p) => <Input {...p} {...register('name')} />}
            </Campo>
            {(['project_type', 'stage', 'exploration_phase'] as const).map((c) => (
              <Campo key={c} etiqueta={definicion.data?.fields.find((f) => f.name === c)?.label ?? c}>
                {(p) => <SelectNativo {...p} opciones={opciones(c)} {...register(c)} />}
              </Campo>
            ))}
            <Campo etiqueta={definicion.data?.fields.find((f) => f.name === 'start_date')?.label ?? 'start_date'}>
              {(p) => <Input {...p} type="date" {...register('start_date')} />}
            </Campo>
            <div className="md:col-span-2">
              <Campo etiqueta={definicion.data?.fields.find((f) => f.name === 'description')?.label ?? 'description'}>
                {(p) => <Textarea {...p} {...register('description')} />}
              </Campo>
            </div>
          </div>
        ) : null}
        {paso === 1 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Campo etiqueta={t('proyectos.asistente.crs')} ayuda={t('proyectos.asistente.crsAyuda')}>
                {(p) => <SelectNativo {...p} opciones={opciones('working_crs')} {...register('working_crs')} />}
              </Campo>
            </div>
            <Campo etiqueta={t('proyectos.asistente.latitud')} error={formState.errors.latitud ? t('proyectos.asistente.coordenadaInvalida') : undefined}>
              {(p) => <Input {...p} inputMode="decimal" {...register('latitud')} />}
            </Campo>
            <Campo etiqueta={t('proyectos.asistente.longitud')} error={formState.errors.longitud ? t('proyectos.asistente.coordenadaInvalida') : undefined}>
              {(p) => <Input {...p} inputMode="decimal" {...register('longitud')} />}
            </Campo>
          </div>
        ) : null}
        {paso === 2 && proyecto ? <PartesDelProyecto proyecto={proyecto.id} /> : null}
        {paso === 3 && proyecto ? <CampanaDelProyecto proyecto={proyecto.id} /> : null}
        {paso === 4 && proyecto ? <EquipoDelProyecto proyecto={proyecto.id} /> : null}
        {paso === PASO_PARAMETROS ? (
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
                      onChange={(e) => setValue(`parametros.${par.campo}`, e.target.checked)}
                    />
                  ) : (
                    <Input
                      id={`par-${par.campo}`}
                      type="number"
                      className="w-24"
                      value={String(valor)}
                      onChange={(e) => setValue(`parametros.${par.campo}`, Number(e.target.value))}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
        {paso === PASO_REVISION && proyecto ? <Revision proyecto={proyecto} /> : null}
        {errorDeEscritura && !(errorDeEscritura instanceof ApiError && errorDeEscritura.status === 409) ? (
          <Alert tone="danger">{mensaje(errorDeEscritura)}</Alert>
        ) : null}
        {enviarARevision.isError ? <Alert tone="danger">{mensaje(enviarARevision.error)}</Alert> : null}
        <p className="text-sg-caption text-sg-text-muted">{t('proyectos.asistente.guardadoAuto')}</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-sg-border pt-3">
          <Button type="button" variant="ghost" onClick={() => void guardarYSalir()}>
            {t('proyectos.asistente.guardarYSalir')}
          </Button>
          {paso > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setPaso(paso - 1)}>
              {t('comun.anterior')}
            </Button>
          ) : null}
          {paso < PASO_REVISION ? (
            <Button type="submit" disabled={crear.isPending || actualizar.isPending}>
              {crear.isPending || actualizar.isPending ? t('comun.guardando') : t('comun.siguiente')}
            </Button>
          ) : (
            <Button type="button" onClick={enviar} disabled={enviarARevision.isPending || !proyecto}>
              {enviarARevision.isPending ? t('proyectos.asistente.enviando') : t('proyectos.asistente.crearYEnviar')}
            </Button>
          )}
        </div>
      </form>
    </div>
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
            <dt className="text-sg-text-muted">{definicion.data?.fields.find((f) => f.name === c)?.label ?? c}</dt>
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
