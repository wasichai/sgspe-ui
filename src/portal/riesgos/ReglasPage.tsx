import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useErroresDeCampo } from '../componentes/errores'
import { Cargando, Vacio } from '../componentes/Estados'
import { ConDefiniciones, FalloDeLectura } from '../componentes/LecturaConEstados'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { usePedir } from '../datos/http'
import { atributo, campoDe, texto, useActualizar, useCrear, useDefinicion, useTodosConTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'

// S60 · reglas de alerta (screens.md §9; workflows.md, «Tipos de regla de JOB-04»; ASM-097): las reglas del proyecto
// (/projects/:projectId/risks/rules) o las de la organización (/risks/rules, sin proyecto). un formulario propio, no el de la
// metadata, para explicar al elegir el tipo qué cuenta, qué significa el umbral y qué ventana usa, y validar antes de mandar lo que
// el servidor rechaza con 400 OUT_OF_RANGE: umbral entero desde 1 (de 1 a 25 en NIVEL DE RIESGO) y ventana de 1 a 365 (vacía vale 7
// y es también el silencio tras una alerta). sin CAMBIO DE POSTURA en el MVP. una regla con alertas no se borra (409 HAS_DEPENDENTS):
// se desactiva. escriben solo quienes tienen CREATE, UPDATE o DELETE sobre early_warning_rule, y en un proyecto, con asignación vigente
const OBJETO = 'early_warning_rule'
// CAMBIO DE POSTURA queda fuera del MVP (ASM-097): aunque un catálogo viejo lo traiga, no se ofrece
const FUERA_DEL_MVP = ['CAMBIO DE POSTURA']
const SIN_VENTANA = ['COMPROMISOS VENCIDOS', 'NIVEL DE RIESGO']
const PUNTAJE = 'NIVEL DE RIESGO'

export function ReglasPage() {
  const definicion = useDefinicion(OBJETO)
  return <ConDefiniciones definiciones={[definicion]}>{() => <Reglas />}</ConDefiniciones>
}

function Reglas() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { projectId } = useParams()
  const escribeEnProyecto = useEscribeEnProyecto(projectId)
  const escribe = projectId ? escribeEnProyecto : true
  // la API filtra por igualdad: las de la organización son las que no tienen proyecto, y se separan aquí
  const lectura = useTodosConTope(OBJETO, projectId ? { project: projectId } : {})
  const reglas = (lectura.data ?? []).filter((r) => (projectId ? true : !atributo(r, 'project')))
  // la regla abierta se toma de la lista: tras «Recargar» (un 412) el formulario recibe la versión nueva
  const [abierta, setAbierta] = useState<string | null>(null)
  const editada = abierta && abierta !== 'nueva' ? reglas.find((r) => r.id === abierta) : undefined
  const crea = escribe && can(OBJETO, 'CREATE')
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{projectId ? t('reglasDeAlerta.titulo') : t('reglasDeAlerta.tituloDeLaOrganizacion')}</h1>
        {crea ? <Button onClick={() => setAbierta('nueva')}>{t('reglasDeAlerta.nueva')}</Button> : null}
      </div>
      <p className="text-sm text-sg-text-secondary">{t('reglasDeAlerta.ayuda')}</p>
      {lectura.truncado ? <Alert tone="warning">{t('reglasDeAlerta.truncado', { n: numeroPe(lectura.data?.length ?? 0) })}</Alert> : null}
      {lectura.isPending ? (
        <Cargando />
      ) : lectura.isError && !lectura.data ? (
        <FalloDeLectura error={lectura.error} alReintentar={() => void lectura.refetch()} />
      ) : reglas.length === 0 ? (
        <Vacio titulo={t('reglasDeAlerta.vacio')} />
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={t('reglasDeAlerta.tabla')}>
            <thead>
              <tr>
                {(['nombre', 'tipo', 'umbral', 'ventana', 'severidad', 'alcance', 'estado', 'acciones'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`reglasDeAlerta.columnas.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reglas.map((r) => (
                <FilaDeRegla key={r.id} regla={r} escribe={escribe} alEditar={() => setAbierta(r.id)} />
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <Drawer
        titulo={abierta === 'nueva' ? t('reglasDeAlerta.nueva') : t('reglasDeAlerta.editarTitulo')}
        abierto={abierta === 'nueva' || editada !== undefined}
        alCerrar={() => setAbierta(null)}
      >
        {abierta === 'nueva' || editada ? (
          <FormularioDeRegla key={abierta ?? ''} regla={editada} proyecto={projectId} alTerminar={() => setAbierta(null)} />
        ) : null}
      </Drawer>
    </section>
  )
}

function FilaDeRegla({ regla, escribe, alEditar }: { regla: Registro; escribe: boolean; alEditar: () => void }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const actualizar = useActualizar(OBJETO)
  const releer = useReleer()
  const activa = atributo(regla, 'enabled') === true
  const edita = escribe && can(OBJETO, 'UPDATE')
  return (
    <>
      <tr>
        <Td className="text-sm font-medium">{texto(regla, 'name')}</Td>
        <Td className="text-sm">{texto(regla, 'rule_kind')}</Td>
        <Td className="text-sm tabular-nums">{texto(regla, 'threshold') || '—'}</Td>
        <Td className="text-sm tabular-nums">{texto(regla, 'window_days') || '7'}</Td>
        <Td className="text-sm">{texto(regla, 'severity') || '—'}</Td>
        <Td className="text-sm">{atributo(regla, 'project') ? t('reglasDeAlerta.alcances.proyecto') : t('reglasDeAlerta.alcances.organizacion')}</Td>
        <Td className="text-sm">{activa ? t('reglasDeAlerta.estados.activa') : t('reglasDeAlerta.estados.desactivada')}</Td>
        <Td className="space-x-2 whitespace-nowrap text-sm">
          {edita ? (
            <>
              <Button size="sm" variant="secondary" aria-label={`${t('reglasDeAlerta.editar')} ${texto(regla, 'name')}`} onClick={alEditar}>
                {t('reglasDeAlerta.editar')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`${activa ? t('reglasDeAlerta.desactivar') : t('reglasDeAlerta.activar')} ${texto(regla, 'name')}`}
                disabled={actualizar.isPending}
                onClick={() => actualizar.mutate({ registro: regla, cambios: { enabled: !activa } })}
              >
                {activa ? t('reglasDeAlerta.desactivar') : t('reglasDeAlerta.activar')}
              </Button>
            </>
          ) : null}
          {escribe && can(OBJETO, 'DELETE') ? <Borrar regla={regla} /> : null}
        </Td>
      </tr>
      {actualizar.isError ? (
        <tr>
          <Td colSpan={8}>
            <AvisoDeConflicto error={actualizar.error} releer={() => releer(['records', OBJETO])} alRecargar={() => actualizar.reset()} />
          </Td>
        </tr>
      ) : null}
    </>
  )
}

// borrar con la versión leída (If-Match). una regla con alertas responde 409 HAS_DEPENDENTS: se dice que se desactive
function Borrar({ regla }: { regla: Registro }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const cliente = useQueryClient()
  const releer = useReleer()
  const [confirmando, setConfirmando] = useState(false)
  const borrar = useMutation({
    mutationFn: () => pedir(`/objects/${OBJETO}/records/${encodeURIComponent(regla.id)}`, { metodo: 'DELETE', version: regla.updatedAt }),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: ['records', OBJETO] })
  })
  if (!confirmando)
    return (
      <Button size="sm" variant="secondary" aria-label={`${t('reglasDeAlerta.borrar')} ${texto(regla, 'name')}`} onClick={() => setConfirmando(true)}>
        {t('reglasDeAlerta.borrar')}
      </Button>
    )
  return (
    <div className="mt-2 inline-flex flex-wrap items-center gap-2 whitespace-normal">
      <span>{t('reglasDeAlerta.borrarConfirmar', { nombre: texto(regla, 'name') })}</span>
      <Button size="sm" onClick={() => borrar.mutate()} disabled={borrar.isPending} aria-busy={borrar.isPending}>
        {borrar.isPending ? t('reglasDeAlerta.borrando') : t('reglasDeAlerta.borrar')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setConfirmando(false)
          borrar.reset()
        }}
      >
        {t('comun.cancelar')}
      </Button>
      {borrar.isError ? (
        <AvisoDeConflicto
          error={borrar.error}
          propios={{ HAS_DEPENDENTS: t('reglasDeAlerta.tieneAlertas') }}
          releer={() => releer(['records', OBJETO])}
          alRecargar={() => borrar.reset()}
        />
      ) : null}
    </div>
  )
}

interface Valores {
  name: string
  rule_kind: string
  threshold: string
  window_days: string
  severity: string
  enabled: boolean
  description: string
}

const entero = (valor: string): number | null => (/^\d+$/.test(valor.trim()) ? Number(valor.trim()) : null)

// lo que el formulario rechaza antes de mandar: el mismo rango que el servidor (WarningWriteGuard)
export function erroresDeRegla(v: Valores): Partial<Record<keyof Valores, 'nombre' | 'tipo' | 'umbral' | 'umbralPuntaje' | 'ventana'>> {
  const errores: Partial<Record<keyof Valores, 'nombre' | 'tipo' | 'umbral' | 'umbralPuntaje' | 'ventana'>> = {}
  if (!v.name.trim()) errores.name = 'nombre'
  if (!v.rule_kind) errores.rule_kind = 'tipo'
  const umbral = entero(v.threshold)
  if (v.rule_kind === PUNTAJE) {
    if (umbral === null || umbral < 1 || umbral > 25) errores.threshold = 'umbralPuntaje'
  } else if (umbral === null || umbral < 1) errores.threshold = 'umbral'
  if (v.window_days.trim() !== '') {
    const ventana = entero(v.window_days)
    if (ventana === null || ventana < 1 || ventana > 365) errores.window_days = 'ventana'
  }
  return errores
}

function FormularioDeRegla({ regla, proyecto, alTerminar }: { regla?: Registro; proyecto?: string; alTerminar: () => void }) {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion(OBJETO)
  const crear = useCrear(OBJETO)
  const actualizar = useActualizar(OBJETO)
  const releer = useReleer()
  const erroresDelServidor = useErroresDeCampo()
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const [valores, setValores] = useState<Valores>(() => ({
    name: texto(regla, 'name'),
    rule_kind: texto(regla, 'rule_kind'),
    threshold: texto(regla, 'threshold'),
    window_days: texto(regla, 'window_days'),
    severity: texto(regla, 'severity'),
    enabled: regla ? atributo(regla, 'enabled') === true : true,
    description: texto(regla, 'description')
  }))
  const [intentado, setIntentado] = useState(false)
  const errores = erroresDeRegla(valores)
  const error = crear.error ?? actualizar.error
  // un error del servidor se dice junto a su campo (attributes.threshold o threshold)
  const delServidor = Object.fromEntries(Object.entries(erroresDelServidor(error)).map(([campo, x]) => [campo.replace(/^attributes\./, ''), x]))
  const conCampo = Object.keys(delServidor).some((c) => c in valores)
  const errorDe = (campo: keyof Valores) => (intentado && errores[campo] ? t(`reglasDeAlerta.errores.${errores[campo]}`) : delServidor[campo])
  const cambiar = <K extends keyof Valores>(campo: K, valor: Valores[K]) => {
    setValores((v) => ({ ...v, [campo]: valor }))
    if (crear.isError) crear.reset()
    if (actualizar.isError) actualizar.reset()
  }
  const sinVentana = SIN_VENTANA.includes(valores.rule_kind)
  const guardar = () => {
    setIntentado(true)
    if (Object.keys(errores).length > 0) return
    const atributos: Record<string, unknown> = {
      name: valores.name.trim(),
      rule_kind: valores.rule_kind,
      threshold: entero(valores.threshold),
      window_days: valores.window_days.trim() === '' ? null : entero(valores.window_days),
      severity: valores.severity || null,
      enabled: valores.enabled,
      description: valores.description.trim() || null
    }
    if (regla) actualizar.mutate({ registro: regla, cambios: atributos }, { onSuccess: alTerminar })
    else crear.mutate({ atributos: { ...atributos, ...(proyecto ? { project: proyecto } : {}) } }, { onSuccess: alTerminar })
  }
  const enCurso = crear.isPending || actualizar.isPending
  return (
    <div className="space-y-3">
      <Campo etiqueta={t('reglasDeAlerta.campos.nombre')} error={errorDe('name')}>
        {(p) => <Input {...p} value={valores.name} maxLength={200} onChange={(e) => cambiar('name', e.target.value)} />}
      </Campo>
      <Campo etiqueta={t('reglasDeAlerta.campos.tipo')} error={errorDe('rule_kind')}>
        {(p) => (
          <SelectNativo
            {...p}
            value={valores.rule_kind}
            onChange={(e) => cambiar('rule_kind', e.target.value)}
            opciones={opciones('rule_kind').filter((o) => !FUERA_DEL_MVP.includes(o))}
          />
        )}
      </Campo>
      {valores.rule_kind ? (
        <p role="note" className="rounded-sg-md bg-sg-surface-sunken p-3 text-sm">
          {t(`reglasDeAlerta.tipos.${valores.rule_kind}`, { defaultValue: '' })}
        </p>
      ) : null}
      <Campo
        etiqueta={valores.rule_kind === PUNTAJE ? t('reglasDeAlerta.campos.umbralPuntaje') : t('reglasDeAlerta.campos.umbral')}
        error={errorDe('threshold')}
      >
        {(p) => <Input {...p} inputMode="numeric" value={valores.threshold} onChange={(e) => cambiar('threshold', e.target.value)} />}
      </Campo>
      <Campo
        etiqueta={sinVentana ? t('reglasDeAlerta.campos.silencio') : t('reglasDeAlerta.campos.ventana')}
        ayuda={t('reglasDeAlerta.campos.ventanaAyuda')}
        error={errorDe('window_days')}
      >
        {(p) => <Input {...p} inputMode="numeric" value={valores.window_days} onChange={(e) => cambiar('window_days', e.target.value)} />}
      </Campo>
      <Campo etiqueta={t('reglasDeAlerta.campos.severidad')}>
        {(p) => <SelectNativo {...p} value={valores.severity} onChange={(e) => cambiar('severity', e.target.value)} opciones={opciones('severity')} />}
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={valores.enabled} onChange={(e) => cambiar('enabled', e.target.checked)} />
        {t('reglasDeAlerta.campos.activa')}
      </label>
      <Campo etiqueta={t('reglasDeAlerta.campos.descripcion')}>
        {(p) => <Textarea {...p} value={valores.description} maxLength={2000} onChange={(e) => cambiar('description', e.target.value)} />}
      </Campo>
      {error && !conCampo ? (
        <AvisoDeConflicto
          error={error}
          releer={() => releer(['records', OBJETO])}
          alRecargar={() => {
            crear.reset()
            actualizar.reset()
          }}
        />
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={alTerminar}>
          {t('comun.cancelar')}
        </Button>
        <Button onClick={guardar} disabled={enCurso} aria-busy={enCurso}>
          {enCurso ? t('reglasDeAlerta.guardando') : t('reglasDeAlerta.guardar')}
        </Button>
      </div>
    </div>
  )
}
