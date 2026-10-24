import { useAuth } from '@wasichai/core'
import { Button, ConfirmDialog, Table, Tabs, Td, Th } from '@wasichai/ui'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Drawer } from '../componentes/Drawer'
import { Consulta } from '../componentes/Estados'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyecto, vigenciaDeAsignacion } from '../contexto/proyectos'
import { hoyEnLima } from '../datos/fechas'
import {
  atributo,
  campoDe,
  puedeEscribir,
  texto,
  useActualizar,
  useDefinicion,
  usePuedeEditar,
  useRelacionados,
  useTodos,
  type Registro
} from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { CampanaDelProyecto, PartesDelProyecto } from './EquipoYPartes'
import { FormularioDeAsignacion } from './FormularioDeAsignacion'
import { useNombresDeRol } from './usuarios'
import { ParametroNumerico } from './ParametroNumerico'
import { TemasPriorizados } from './TemasPriorizados'
import { PARAMETROS_F2, PARAMETROS_F4, PARAMETROS_INVERSION, problemasDeParametros, vigente, type Parametro } from './parametros'
import { opcion } from '../datos/opciones'
import { Persona } from '../componentes/Persona'
import { MasAcciones } from '../componentes/Pagina'
import { useNombreDePersona } from '../datos/personas'

// S11 · equipo y parámetros del proyecto (screens.md §3): asignaciones con su vigencia (una vencida no da escritura,
// RQ-SEC-006), campañas con su tope y lo ejecutado por moneda (ASM-063), partes y concesiones, y los parámetros de F2 con
// la marca "por defecto" o "cambiado" (ASM-019). quien no puede escribir ve todo en solo lectura
export function EquipoYParametrosPage() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { can } = useAuth()
  const escribeEnElProyecto = useEscribeEnProyecto(projectId)
  const escribe = (objeto: string, accion = 'CREATE') => escribeEnElProyecto && can(objeto, accion)
  // el equipo no pide asignación: las escrituras de project_assignment están exentas de ProjectScopeGuard (security.md §9.2,
  // ítem 5), así quien administra proyectos forma equipos de proyectos a los que no está asignado
  const formaEquipo = (accion: string) => can('project_assignment', accion)
  // los parámetros se editan con UPDATE y algún campo escribible: un rol con "u" sobre project los ve en solo lectura
  const puedeEditar = usePuedeEditar('project')
  const editaProyecto = escribeEnElProyecto && puedeEditar
  return (
    <section className="space-y-4">
      <h1 className="text-sg-h2 font-semibold">{t('p360.equipo.titulo')}</h1>
      <Tabs
        label={t('p360.equipo.titulo')}
        tabs={[
          {
            id: 'equipo',
            label: t('p360.equipo.pestanas.equipo'),
            render: () => <Equipo proyecto={projectId} editable={formaEquipo('CREATE')} cambia={formaEquipo('UPDATE')} />
          },
          {
            id: 'campanas',
            label: t('p360.equipo.pestanas.campanas'),
            render: () => <Campanas proyecto={projectId} editable={escribe('exploration_campaign')} />
          },
          {
            id: 'partes',
            label: t('p360.equipo.pestanas.partes'),
            render: () => <PartesYConcesiones proyecto={projectId} editable={escribe('project_party')} />
          },
          {
            id: 'parametros',
            label: t('p360.equipo.pestanas.parametros'),
            render: () => <Parametros proyecto={projectId} editable={editaProyecto} />
          }
        ]}
      />
    </section>
  )
}

function Equipo({ proyecto, editable, cambia }: { proyecto: string; editable: boolean; cambia: boolean }) {
  const { t } = useTranslation(NS)
  const asignaciones = useTodos('project_assignment', { project: proyecto })
  // el rol con su etiqueta si la cuenta lee los roles (GET /api/roles); si no, su nombre
  const roles = useNombresDeRol()
  const rolDicho = (nombre: string) => roles.data?.find((r) => r.name === nombre)?.label ?? nombre
  const actualizar = useActualizar('project_assignment')
  const releer = useReleer()
  const [abierto, setAbierto] = useState(false)
  // la asignación que se está por terminar (pide confirmación) y la última que se intentó terminar (dice cuál falló)
  const [confirmando, setConfirmando] = useState<Registro | null>(null)
  const [intentada, setIntentada] = useState('')
  const hoy = hoyEnLima()
  // terminar una asignación cierra su vigencia hoy (en Lima), nunca antes de su inicio: una programada termina el día que empezaría
  const terminar = (a: Registro) => {
    const inicio = texto(a, 'start_date')
    setConfirmando(null)
    setIntentada(texto(a, 'member_user_email'))
    actualizar.mutate({ registro: a, cambios: { active: false, end_date: inicio > hoy ? inicio : hoy } })
  }
  return (
    <div className="space-y-3 pt-3">
      {editable ? <Button onClick={() => setAbierto(true)}>{t('p360.asignacion.titulo')}</Button> : null}
      <Consulta consulta={asignaciones}>
        {(lista) => (
          <Table aria-label={t('p360.equipo.pestanas.equipo')}>
            <thead>
              <tr>
                {(['correo', 'rol', 'periodo', 'estado'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`p360.equipo.columnas.${c}`)}
                  </Th>
                ))}
                {cambia ? <Th scope="col" /> : null}
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => {
                const vigencia = vigenciaDeAsignacion(a, hoy)
                const correo = texto(a, 'member_user_email')
                return (
                  <tr key={a.id}>
                    <Td>
                      <Persona correo={correo} />
                    </Td>
                    <Td className={roles.data?.some((r) => r.name === texto(a, 'role_name')) ? 'text-sm' : 'font-sg-mono text-sg-caption'}>
                      {rolDicho(texto(a, 'role_name'))}
                    </Td>
                    <Td className="text-sm">
                      {texto(a, 'start_date') || texto(a, 'end_date')
                        ? `${diaPe(texto(a, 'start_date')) || t('p360.equipo.desdeSiempre')} – ${diaPe(texto(a, 'end_date')) || t('p360.equipo.sinFin')}`
                        : t('p360.equipo.sinFechas')}
                    </Td>
                    <Td className="text-sm">
                      {vigencia === 'vigente' ? (
                        t('p360.equipo.activa')
                      ) : vigencia === 'terminada' ? (
                        t('p360.equipo.inactiva')
                      ) : (
                        <span className="text-sg-warning">{t(vigencia === 'programada' ? 'p360.asignacion.programada' : 'p360.asignacion.vencida')}</span>
                      )}
                    </Td>
                    {cambia ? (
                      <Td>
                        {vigencia === 'vigente' || vigencia === 'programada' ? <MenuDeAsignacion correo={correo} alTerminar={() => setConfirmando(a)} /> : null}
                      </Td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Consulta>
      {confirmando ? (
        <ConfirmarTerminar
          asignacion={confirmando}
          programada={vigenciaDeAsignacion(confirmando, hoy) === 'programada'}
          hoy={hoy}
          alConfirmar={() => terminar(confirmando)}
          alCancelar={() => setConfirmando(null)}
        />
      ) : null}
      {actualizar.isError ? (
        <AvisoDeConflicto
          error={actualizar.error}
          prefijo={`${intentada}: `}
          releer={() => releer(['records', 'project_assignment'])}
          alRecargar={() => actualizar.reset()}
        />
      ) : null}
      <Drawer titulo={t('p360.asignacion.titulo')} abierto={abierto} alCerrar={() => setAbierto(false)}>
        <FormularioDeAsignacion proyecto={proyecto} alGuardar={() => setAbierto(false)} />
      </Drawer>
    </div>
  )
}

// U-16, P-08: terminar una asignación no es un botón rojo en cada fila, sino una opción del menú «…» de la fila, en color de
// peligro; el menú dice de quién son las acciones (el nombre visible o, sin él, el correo)
function MenuDeAsignacion({ correo, alTerminar }: { correo: string; alTerminar: () => void }) {
  const { t } = useTranslation(NS)
  const persona = useNombreDePersona(correo) ?? correo
  return (
    <MasAcciones nombre={t('p360.asignacion.acciones', { persona })}>
      <button
        type="button"
        onClick={alTerminar}
        className="whitespace-nowrap rounded-sg-sm px-2 py-1.5 text-left text-sm text-sg-danger hover:bg-sg-surface-hover"
      >
        {t('p360.asignacion.terminar')}
      </button>
    </MasAcciones>
  )
}

// la confirmación nombra a la persona y el efecto en lenguaje llano: una vigente termina hoy; una programada no llega a empezar
function ConfirmarTerminar({
  asignacion,
  programada,
  hoy,
  alConfirmar,
  alCancelar
}: {
  asignacion: Registro
  programada: boolean
  hoy: string
  alConfirmar: () => void
  alCancelar: () => void
}) {
  const { t } = useTranslation(NS)
  const correo = texto(asignacion, 'member_user_email')
  const persona = useNombreDePersona(correo) ?? correo
  return (
    <ConfirmDialog
      title={t('p360.asignacion.tituloTerminar', { persona })}
      description={
        programada
          ? t('p360.asignacion.efectoProgramada', { persona, fecha: diaPe(texto(asignacion, 'start_date')) })
          : t('p360.asignacion.efectoVigente', { persona, fecha: diaPe(hoy) })
      }
      cancelLabel={t('comun.cancelar')}
      confirmLabel={t('p360.asignacion.terminarSi')}
      variant="danger"
      onConfirm={alConfirmar}
      onCancel={alCancelar}
    />
  )
}

function Campanas({ proyecto, editable }: { proyecto: string; editable: boolean }) {
  const { t } = useTranslation(NS)
  const campanas = useTodos('exploration_campaign', { project: proyecto })
  const definicion = useDefinicion('exploration_campaign')
  // los valores ENUM se guardan en español MAYÚSCULAS (ASM-025) y la metadata no trae etiquetas por valor: cada uno sale con la
  // etiqueta de su campo, y sin ella (mientras llega la metadata) solo el valor
  const conEtiqueta = (c: Registro, campo: string) => {
    const valor = opcion(c, campo)
    const etiqueta = campoDe(definicion.data, campo)?.label
    return valor && etiqueta ? `${etiqueta}: ${valor}` : valor
  }
  return (
    <div className="space-y-3 pt-3">
      <Consulta consulta={campanas}>
        {(lista) => (
          <ul className="grid gap-3 md:grid-cols-2">
            {lista.map((c) => {
              const tope = atributo<number>(c, 'social_support_cap')
              const ejecutado = atributo<number>(c, 'executed_social_amount') ?? 0
              const otras = atributo<number>(c, 'other_currency_items_count') ?? 0
              return (
                <li key={c.id} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
                  <p className="font-medium">{texto(c, 'name')}</p>
                  <p className="text-sg-caption text-sg-text-muted">
                    {[conEtiqueta(c, 'campaign_status'), conEtiqueta(c, 'activity_type')].filter(Boolean).join(' · ')}
                  </p>
                  {tope ? (
                    <div
                      role="progressbar"
                      aria-label={texto(c, 'name')}
                      aria-valuemin={0}
                      aria-valuemax={tope}
                      aria-valuenow={ejecutado}
                      aria-valuetext={t('p360.equipo.ejecutado', { ejecutado: numeroPe(ejecutado), tope: numeroPe(tope), moneda: texto(c, 'currency') })}
                      className="h-2 rounded-full bg-sg-surface-sunken"
                    >
                      <div className="h-2 rounded-full bg-sg-primary" style={{ width: `${Math.min(100, (ejecutado / tope) * 100)}%` }} />
                    </div>
                  ) : null}
                  <p className="text-sm">
                    {tope
                      ? t('p360.equipo.ejecutado', { ejecutado: numeroPe(ejecutado), tope: numeroPe(tope), moneda: texto(c, 'currency') })
                      : t('p360.equipo.sinTope')}
                  </p>
                  {otras > 0 ? <p className="text-sg-caption text-sg-warning">{t('p360.equipo.otraMoneda', { n: otras })}</p> : null}
                </li>
              )
            })}
          </ul>
        )}
      </Consulta>
      {editable ? <CampanaDelProyecto proyecto={proyecto} /> : null}
    </div>
  )
}

function PartesYConcesiones({ proyecto, editable }: { proyecto: string; editable: boolean }) {
  const { t } = useTranslation(NS)
  const concesiones = useRelacionados('project', proyecto, 'project_concession')
  return (
    <div className="space-y-4 pt-3">
      <PartesDelProyecto proyecto={proyecto} editable={editable} />
      <section aria-label={t('p360.equipo.concesiones')} className="space-y-2">
        <h3 className="font-medium">{t('p360.equipo.concesiones')}</h3>
        <Consulta consulta={concesiones}>
          {(pagina) => (
            <ul className="text-sm">
              {pagina.content.map((c) => (
                <li key={c.id}>
                  <span className="font-sg-mono text-sg-caption">{texto(c, 'code')}</span> {texto(c, 'name')}
                </li>
              ))}
            </ul>
          )}
        </Consulta>
      </section>
    </div>
  )
}

// los parámetros y, desde F5, los temas priorizados para aportes (project_priority_topic): los vincula quien edita el proyecto con
// UPDATE sobre topic (security.md §5.6)
function Parametros({ proyecto, editable }: { proyecto: string; editable: boolean }) {
  const { can } = useAuth()
  const consulta = useProyecto(proyecto)
  return (
    <Consulta consulta={consulta}>
      {(p) => (
        <div className="space-y-4">
          <FormularioDeParametros proyecto={p} editable={editable} />
          <TemasPriorizados proyecto={p.id} editable={editable && can('topic', 'UPDATE')} />
        </div>
      )}
    </Consulta>
  )
}

// el formulario guarda solo lo que la persona cambió, sobre lo leído: lo demás se muestra con el registro vigente, así que un
// refetch en segundo plano actualiza lo que no se tocó y nunca borra lo tecleado. el formulario se limpia tras un guardado
// propio; «Recargar» tras un 412 relee el registro y conserva lo escrito (se manda sobre la versión nueva)
function FormularioDeParametros({ proyecto, editable }: { proyecto: Registro; editable: boolean }) {
  const { t } = useTranslation(NS)
  const actualizar = useActualizar('project')
  const definicion = useDefinicion('project')
  const releer = useReleer()
  const [tecleados, setTecleados] = useState<Record<string, number | boolean>>({})
  const [intento, setIntento] = useState(false)
  // el texto de cada campo numérico: si un refetch cambia el registro y el campo se vuelve a pintar, no pierde lo tecleado
  const textos = useRef<Record<string, string>>({})
  // los de F4 y F5 solo si el modelo del tenant ya los tiene (un tenant de F3 no los ve)
  const parametros = [...PARAMETROS_F2, ...[...PARAMETROS_F4, ...PARAMETROS_INVERSION].filter((p) => campoDe(definicion.data, p.campo) !== undefined)]
  const grupos = [...new Set(parametros.map((p) => p.grupo))]
  const valorDe = (p: Parametro) => (p.campo in tecleados ? tecleados[p.campo] : vigente(proyecto.attributes, p))
  const cambios = Object.fromEntries(
    parametros.filter((p) => p.campo in tecleados && tecleados[p.campo] !== vigente(proyecto.attributes, p)).map((p) => [p.campo, tecleados[p.campo]])
  )
  const hayCambios = Object.keys(cambios).length > 0
  // el rango de los plazos y la cadencia, y el orden de los umbrales, se dicen antes de guardar (el servidor responde 400 OUT_OF_RANGE)
  // (solo lo que cambia, como el servidor: un valor viejo fuera de regla no bloquea otra escritura)
  const problemas = problemasDeParametros(
    (campo) => {
      const p = parametros.find((x) => x.campo === campo)
      return p ? valorDe(p) : undefined
    },
    (campo) => campo in cambios
  )
  const problemaDe = (campo: string) => problemas.find((x) => x.campo === campo)
  const invalido = Object.values(cambios).some((v) => typeof v === 'number' && Number.isNaN(v)) || problemas.length > 0
  // devolver un parámetro a su valor original lo saca de lo tecleado: no se envía ni pisa el cambio de otra persona
  const cambiar = (p: Parametro, valor: number | boolean) => {
    const original = vigente(proyecto.attributes, p)
    setTecleados((v) => {
      const resto = Object.fromEntries(Object.entries(v).filter(([campo]) => campo !== p.campo))
      return Object.is(valor, original) ? resto : { ...resto, [p.campo]: valor }
    })
    if (actualizar.isSuccess || actualizar.isError) actualizar.reset()
  }
  return (
    <form
      className="space-y-4 pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        setIntento(true)
        if (!hayCambios || invalido) return
        actualizar.mutate(
          { registro: proyecto, cambios },
          {
            onSuccess: () => {
              setTecleados({})
              setIntento(false)
              textos.current = {}
            }
          }
        )
      }}
    >
      {grupos.map((grupo) => (
        <fieldset key={grupo} className="space-y-2 rounded-sg-lg border border-sg-border p-4">
          <legend className="px-1 font-medium">{t(`p360.parametros.grupos.${grupo}`)}</legend>
          {grupo === 'quejas' || grupo === 'riesgos' || grupo === 'inversion' ? (
            <p className="text-sg-caption text-sg-text-muted">{t(`p360.parametros.ayudas.${grupo}`)}</p>
          ) : null}
          {parametros
            .filter((p) => p.grupo === grupo)
            .map((p) => {
              const valor = valorDe(p)
              const marca = valor === p.porDefecto ? t('proyectos.asistente.porDefecto') : t('proyectos.asistente.cambiado')
              const id = `param-${p.campo}`
              const bloqueado = !editable || !puedeEscribir(definicion.data, p.campo)
              const problema = problemaDe(p.campo)
              return (
                <div key={p.campo} className="space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <label htmlFor={id} className="text-sm">
                        {t(`p360.parametros.${p.campo}`)} <span className="text-sg-caption text-sg-text-muted">({marca})</span>
                      </label>
                      <p id={`${id}-ayuda`} className="text-sg-caption text-sg-text-muted">
                        {t(`p360.parametros.ayuda.${p.campo}`)}{' '}
                        {t('p360.parametros.porDefecto', {
                          valor: typeof p.porDefecto === 'boolean' ? t(p.porDefecto ? 'p360.parametros.activada' : 'p360.parametros.desactivada') : p.porDefecto
                        })}
                      </p>
                    </div>
                    {p.tipo === 'politica' ? (
                      <input
                        id={id}
                        type="checkbox"
                        aria-describedby={`${id}-ayuda`}
                        disabled={bloqueado}
                        checked={Boolean(valor)}
                        onChange={(e) => cambiar(p, e.target.checked)}
                      />
                    ) : (
                      // el campo se vuelve a pintar cuando el registro cambia su valor (lo no tocado se actualiza, lo tecleado
                      // recupera su texto)
                      <ParametroNumerico
                        key={`${p.campo}:${String(vigente(proyecto.attributes, p))}`}
                        textoInicial={textos.current[p.campo]}
                        alEscribir={(x) => (textos.current[p.campo] = x)}
                        id={id}
                        descritoPor={`${id}-ayuda`}
                        valor={Number(valor)}
                        porDefecto={Number(p.porDefecto)}
                        entero={campoDe(definicion.data, p.campo)?.type === 'INTEGER'}
                        intentoDeGuardar={intento}
                        disabled={bloqueado}
                        alCambiar={(n) => cambiar(p, n)}
                      />
                    )}
                  </div>
                  {problema ? (
                    <p role="alert" className="text-right text-sg-caption text-sg-danger">
                      {problema.motivo === 'orden' ? t('p360.parametros.umbralesEnOrden') : t('p360.parametros.fueraDeRango', p.rango)}
                    </p>
                  ) : null}
                </div>
              )
            })}
        </fieldset>
      ))}
      {actualizar.isError ? (
        <AvisoDeConflicto error={actualizar.error} releer={() => releer(['record', 'project', proyecto.id])} alRecargar={() => actualizar.reset()} />
      ) : null}
      {actualizar.isSuccess && !hayCambios ? (
        <p role="status" className="text-sm text-sg-success">
          {t('p360.equipo.guardados')}
        </p>
      ) : null}
      {editable ? (
        <Button type="submit" disabled={actualizar.isPending || !hayCambios}>
          {actualizar.isPending ? t('comun.guardando') : t('p360.equipo.guardarParametros')}
        </Button>
      ) : null}
    </form>
  )
}
