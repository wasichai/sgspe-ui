import { CaminoDelFlujo } from '../componentes/CaminoDelFlujo'
import { useMigaDelRegistro } from '../componentes/Migas'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo, CONTROL } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, esIlegible, NoDisponible, NoEsDeSusProyectos, ThConExplicacion } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { useMensajeDeError } from '../componentes/errores'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useAsignadoAlProyecto, useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useMisAsignaciones } from '../contexto/proyectos'
import { Rastro } from '../contexto/Rastro'
import { nuevaClave, usePedir } from '../datos/http'
import {
  atributo,
  atributosDeEscritura,
  geometriasDeEscritura,
  puedeEscribir,
  texto,
  useActualizar,
  useDefinicion,
  usePuedeEditar,
  useRegistro,
  useTodosConTope,
  type Registro
} from '../datos/registros'
import { diaPe, fechaPe, NS, numeroPe } from '../i18n'
import type { Elemento } from '../mapa/api'
import { Mapa } from '../mapa/Mapa'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { diaDe } from './fechas'
import { CodigoDeProyecto } from './InteraccionesPage'
import { useUbicacionDelTelefono, type Punto } from './ubicacion'
import { Dia } from '../componentes/Dia'
import { Persona } from '../componentes/Persona'

// S26 · visita de campo (screens.md §6, WF-L): el camino Planificada → En curso → Concluida o Parcial, el mapa con la ruta,
// las interacciones y las observaciones, y "Agregar observación aquí" con la ubicación del teléfono o con coordenadas
// tecleadas (un punto no se dibuja, decisión 14). concluir no cambia las interacciones pendientes: cada una se posterga o
// cancela con su motivo
const CAMINO = ['planned', 'in_progress', 'completed'] as const
// el líder (leader_user_id y leader_user_email) no es un campo del formulario: se elige del equipo del proyecto y se manda con
// los fijos, el identificador y el correo juntos (LiderDeLaVisita)
const CAMPOS_DE_LA_VISITA = [
  'title',
  'objective',
  'itinerary',
  'team_note',
  'planned_start_date',
  'planned_end_date',
  'actual_start_date',
  'actual_end_date'
] as const

export function VisitaDeCampoPage() {
  const { visitId = '' } = useParams()
  return visitId === 'new' ? <NuevaVisita /> : <VisitaExistente id={visitId} />
}

function VisitaExistente({ id }: { id: string }) {
  const visita = useRegistro('field_visit', id)
  if (visita.isPending) return <Cargando />
  // una visita de otro proyecto o de una asignación vencida responde 404, como una que no existe (ADR-0029)
  if (visita.isError && !visita.data)
    return esIlegible(visita.error) ? <NoEsDeSusProyectos /> : <FalloDeLectura error={visita.error} alReintentar={() => void visita.refetch()} />
  return <Visita visita={visita.data as Registro} />
}

function NuevaVisita() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { can, isAdmin } = useAuth()
  const navegar = useNavigate()
  const asignaciones = useMisAsignaciones()
  const asignado = useAsignadoAlProyecto(projectId)
  const [lider, setLider] = useState({ id: '', email: '' })
  // el alta manda el proyecto y, si se eligió o se tecleó, el líder; sin valor no viaja la clave
  const fijos = useMemo(
    () => ({ project: projectId, ...(lider.id ? { leader_user_id: lider.id } : {}), ...(lider.email ? { leader_user_email: lider.email } : {}) }),
    [projectId, lider]
  )
  // sin permiso para crear, o sin asignación vigente (el servidor rechazaría el alta), no hay formulario que llenar en vano
  if (!can('field_visit', 'CREATE')) return <NoDisponible />
  if (!isAdmin) {
    if (asignaciones.isPending) return <Cargando />
    if (asignaciones.isError && !asignaciones.data) return <FalloDeLectura error={asignaciones.error} alReintentar={() => void asignaciones.refetch()} />
    if (!asignado) return <NoDisponible motivo="NOT_ASSIGNED" />
  }
  return (
    <section className="max-w-2xl space-y-3">
      <h1 className="text-sg-h2 font-semibold">{t('relacionamiento.visita.nueva')}</h1>
      <LiderDeLaVisita proyecto={projectId} alElegir={setLider} />
      <FormularioDeRegistro
        objeto="field_visit"
        fijos={fijos}
        campos={CAMPOS_DE_LA_VISITA}
        alGuardar={(v) => navegar(`/projects/${encodeURIComponent(projectId)}/field-visits/${encodeURIComponent(v.id)}`)}
      />
    </section>
  )
}

// el líder de la visita: se elige del equipo del proyecto (project_assignment, que quien está asignado sí lee) y llena el
// identificador y el correo juntos, sin dejarlos incoherentes. si el equipo no se lee o está vacío, el identificador y el correo
// se tecleaban a mano (decisión 3), como alternativa y no como camino
function LiderDeLaVisita({ proyecto, alElegir }: { proyecto: string; alElegir: (lider: { id: string; email: string }) => void }) {
  const { t } = useTranslation(NS)
  const equipo = useTodosConTope('project_assignment', { project: proyecto, active: true })
  const [elegido, setElegido] = useState('')
  const [manual, setManual] = useState({ id: '', email: '' })
  if (equipo.isPending) return <Cargando compacto />
  // una persona con varias asignaciones se lista una vez
  const miembros = [...new Map((equipo.data ?? []).map((a) => [texto(a, 'member_user_id'), a])).values()].filter((a) => texto(a, 'member_user_id'))
  if (miembros.length === 0) {
    const poner = (siguiente: { id: string; email: string }) => {
      setManual(siguiente)
      alElegir({ id: siguiente.id.trim(), email: siguiente.email.trim() })
    }
    return (
      <fieldset className="space-y-2">
        <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.visita.liderManual')}</p>
        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta={t('relacionamiento.visita.liderId')}>
            {(p) => <Input {...p} value={manual.id} onChange={(e) => poner({ ...manual, id: e.target.value })} />}
          </Campo>
          <Campo etiqueta={t('relacionamiento.visita.liderCorreo')}>
            {(p) => <Input {...p} type="email" value={manual.email} onChange={(e) => poner({ ...manual, email: e.target.value })} />}
          </Campo>
        </div>
      </fieldset>
    )
  }
  return (
    <Campo etiqueta={t('relacionamiento.visita.lider')}>
      {(p) => (
        <select
          {...p}
          className={CONTROL}
          value={elegido}
          onChange={(e) => {
            const miembro = miembros.find((a) => texto(a, 'member_user_id') === e.target.value)
            setElegido(e.target.value)
            alElegir({ id: miembro ? texto(miembro, 'member_user_id') : '', email: miembro ? texto(miembro, 'member_user_email') : '' })
          }}
        >
          <option value="">{t('comun.ninguno')}</option>
          {miembros.map((a) => (
            <option key={texto(a, 'member_user_id')} value={texto(a, 'member_user_id')}>
              {texto(a, 'member_user_email') ? <Persona correo={texto(a, 'member_user_email')} /> : texto(a, 'member_user_id')}
              {texto(a, 'role_name') ? ` (${texto(a, 'role_name')})` : ''}
            </option>
          ))}
        </select>
      )}
    </Campo>
  )
}

// una lista de registros leída con tope: mientras carga o si falla no se dibuja como vacía (un 403 es «no disponible», otro
// error ofrece reintentar), y si el tope la cortó se dice
interface Lectura {
  isPending: boolean
  isError: boolean
  error: unknown
  data: Registro[] | undefined
  truncado: boolean
  refetch: () => unknown
}

function CuerpoDeLista({ lectura, vacio, children }: { lectura: Lectura; vacio: string; children: (lista: Registro[]) => ReactNode }) {
  const { t } = useTranslation(NS)
  if (lectura.isPending) return <Cargando compacto />
  if (lectura.isError && !lectura.data) return <FalloDeLectura error={lectura.error} alReintentar={() => void lectura.refetch()} />
  const lista = lectura.data ?? []
  return (
    <>
      {lectura.truncado ? <Alert tone="warning">{t('relacionamiento.visita.truncado', { n: numeroPe(lista.length) })}</Alert> : null}
      {lista.length === 0 ? <p className="text-sm text-sg-text-muted">{vacio}</p> : children(lista)}
    </>
  )
}

const elementos = (registros: Registro[], geometria: string): Elemento[] =>
  registros.flatMap((r) => {
    const forma = r.geometries?.[geometria]
    return forma ? [{ type: 'Feature' as const, geometry: forma, properties: { __id: r.id, name: texto(r, 'title') || texto(r, 'observation') } }] : []
  })

const coleccion = (features: Elemento[]) => ({ type: 'FeatureCollection' as const, features })

function Visita({ visita }: { visita: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = String(atributo(visita, 'project'))
  const escribe = useEscribeEnProyecto(proyecto)
  const puedeEditar = usePuedeEditar('field_visit')
  // «Editar el resultado» guarda outcome_summary: sin poder escribirlo, el PUT "tendría éxito" sin guardar el texto
  const definicion = useDefinicion('field_visit')
  const puedeEscribirResultado = puedeEditar && puedeEscribir(definicion.data, 'outcome_summary')
  const interacciones = useTodosConTope('engagement', { field_visit: visita.id })
  const observaciones = useTodosConTope('field_observation', { field_visit: visita.id, sort: 'observed_at', dir: 'asc' })
  const [observando, setObservando] = useState(false)
  const [resumiendo, setResumiendo] = useState(false)
  const capas = [
    { id: 'ruta', color: '--sg-primary', seleccionable: false, datos: coleccion(elementos([visita], 'route')) },
    { id: 'interacciones', color: '--sg-data-1', seleccionable: false, datos: coleccion(elementos(interacciones.data ?? [], 'location')) },
    { id: 'observaciones', color: '--sg-data-2', seleccionable: false, datos: coleccion(elementos(observaciones.data ?? [], 'location')) }
  ]
  const enCurso = visita.state === 'in_progress'

  // la anatomía de design-system.md §6.1 (revisión de UX, etapa 4): migas con el título, encabezado, camino del flujo (el común, en
  // lugar de los pasos propios) y panel de decisión con quien lidera la visita y su fin previsto
  useMigaDelRegistro(texto(visita, 'title'))
  const siguiente = useSiguienteAccion('field_visit', visita)
  return (
    <article className="space-y-4">
      <Rastro />
      <EncabezadoDePagina
        antetitulo={t('relacionamiento.visita.tipo')}
        titulo={texto(visita, 'title')}
        chips={
          <>
            <EstadoChip objeto="field_visit" estado={visita.state} />
            <span className="text-sg-text-secondary">
              {t('relacionamiento.visita.periodo', {
                desde: diaPe(texto(visita, 'actual_start_date') || texto(visita, 'planned_start_date')) || '…',
                hasta: diaPe(texto(visita, 'actual_end_date') || texto(visita, 'planned_end_date')) || '…'
              })}
            </span>
          </>
        }
        primaria={
          <div className="flex flex-wrap gap-2">
            {escribe && enCurso && can('field_observation', 'CREATE') ? (
              <Button size="sm" onClick={() => setObservando(true)}>
                {t('relacionamiento.visita.agregarObservacion')}
              </Button>
            ) : null}
            <BotonesDeTransicion
              objeto="field_visit"
              registro={visita}
              proyecto={proyecto}
              sinPrimaria={escribe && enCurso && can('field_observation', 'CREATE')}
            />
          </div>
        }
        secundarias={
          escribe && can('engagement', 'CREATE') && (enCurso || visita.state === 'planned') ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/projects/${encodeURIComponent(proyecto)}/engagements/new?field_visit=${encodeURIComponent(visita.id)}`}>
                {t('relacionamiento.visita.registrarInteraccion')}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <CaminoDelFlujo objeto="field_visit" estado={visita.state} camino={[...CAMINO]} />
      <PanelDeDecision
        objeto="field_visit"
        estado={visita.state}
        desde={texto(visita, 'state_changed_at') || null}
        por={texto(visita, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={texto(visita, 'leader_user_email') || null}
        vencimiento={texto(visita, 'planned_end_date') || null}
      />
      {enCurso ? <Alert tone="notice">{t('relacionamiento.visita.concluirAviso')}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Mapa
            etiqueta={t('relacionamiento.visita.mapa')}
            capas={capas}
            className="relative h-72 w-full overflow-hidden rounded-sg-lg border border-sg-border"
          />
          <section aria-label={t('relacionamiento.visita.interacciones')} className="space-y-2">
            <CuerpoDeLista lectura={interacciones} vacio={t('relacionamiento.visita.sinInteracciones')}>
              {(lista) => (
                <Table aria-label={t('relacionamiento.visita.interacciones')}>
                  <thead>
                    <tr>
                      <Th scope="col">{t('relacionamiento.columnas.titulo')}</Th>
                      <Th scope="col">{t('relacionamiento.columnas.estado')}</Th>
                      <Th scope="col">{t('relacionamiento.columnas.fecha')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((i) => (
                      <tr key={i.id}>
                        <Td>
                          <Link
                            to={`/projects/${encodeURIComponent(proyecto)}/engagements/${encodeURIComponent(i.id)}`}
                            className="text-sg-primary-text underline"
                          >
                            {texto(i, 'title')}
                          </Link>
                        </Td>
                        <Td>
                          <EstadoChip objeto="engagement" estado={i.state} />
                        </Td>
                        <Td className="text-sm">
                          <Dia valor={diaDe(i)} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CuerpoDeLista>
          </section>
          <section aria-label={t('relacionamiento.visita.observaciones')} className="space-y-1 text-sm">
            <h2 className="font-medium">{t('relacionamiento.visita.observaciones')}</h2>
            <CuerpoDeLista lectura={observaciones} vacio={t('relacionamiento.visita.sinObservaciones')}>
              {(lista) => (
                <ol className="space-y-1">
                  {lista.map((o) => {
                    const momento = new Date(String(atributo(o, 'observed_at') ?? ''))
                    return (
                      <li key={o.id}>
                        {Number.isNaN(momento.getTime()) ? null : <span className="text-sg-text-muted">{fechaPe(momento)} · </span>}
                        {texto(o, 'observation')}
                      </li>
                    )
                  })}
                </ol>
              )}
            </CuerpoDeLista>
          </section>
        </div>
        <aside className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
          <h2 className="font-medium">{t('relacionamiento.visita.objetivo')}</h2>
          <p>{texto(visita, 'objective') || '—'}</p>
          <h2 className="font-medium">{t('relacionamiento.visita.itinerario')}</h2>
          <p className="whitespace-pre-wrap">{texto(visita, 'itinerary') || '—'}</p>
          <h2 className="font-medium">{t('relacionamiento.visita.equipo')}</h2>
          <p>{[texto(visita, 'leader_user_email'), texto(visita, 'team_note')].filter(Boolean).join(' · ') || '—'}</p>
          <h2 className="font-medium">{t('relacionamiento.visita.resultado')}</h2>
          <p className="whitespace-pre-wrap">{texto(visita, 'outcome_summary') || '—'}</p>
          {escribe && enCurso && puedeEscribirResultado ? (
            <Button size="sm" variant="secondary" onClick={() => setResumiendo(true)}>
              {t('relacionamiento.visita.editarResultado')}
            </Button>
          ) : null}
        </aside>
      </div>
      <Drawer titulo={t('relacionamiento.visita.agregarObservacion')} abierto={observando} alCerrar={() => setObservando(false)}>
        <NuevaObservacion visita={visita.id} alGuardar={() => setObservando(false)} />
      </Drawer>
      <Drawer titulo={t('relacionamiento.visita.resultado')} abierto={resumiendo} alCerrar={() => setResumiendo(false)}>
        <ResultadoDeLaVisita visita={visita} alGuardar={() => setResumiendo(false)} alCancelar={() => setResumiendo(false)} />
      </Drawer>
    </article>
  )
}

// el resumen del resultado: se guarda con la versión leída (If-Match) y un 412 dice que otra persona cambió la visita,
// ofrece recargar y conserva lo escrito
function ResultadoDeLaVisita({ visita, alGuardar, alCancelar }: { visita: Registro; alGuardar: () => void; alCancelar: () => void }) {
  const { t } = useTranslation(NS)
  const releer = useReleer()
  const actualizar = useActualizar('field_visit')
  const [resumen, setResumen] = useState(texto(visita, 'outcome_summary'))
  return (
    <div className="space-y-3">
      <Campo etiqueta={t('relacionamiento.visita.resultado')}>{(p) => <Textarea {...p} value={resumen} onChange={(e) => setResumen(e.target.value)} />}</Campo>
      {actualizar.isError ? (
        // la visita se relee con su versión nueva; lo escrito queda en el cuadro
        <AvisoDeConflicto error={actualizar.error} releer={() => releer(['record', 'field_visit', visita.id])} alRecargar={() => actualizar.reset()} />
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={alCancelar}>
          {t('comun.cancelar')}
        </Button>
        <Button
          disabled={actualizar.isPending}
          aria-busy={actualizar.isPending}
          onClick={() => actualizar.mutate({ registro: visita, cambios: { outcome_summary: resumen } }, { onSuccess: alGuardar })}
        >
          {t('comun.guardar')}
        </Button>
      </div>
    </div>
  )
}

// el punto de las coordenadas tecleadas: ambas o ninguna, en grados decimales (la coma decimal se acepta). null es «sin
// punto»; undefined, un valor que no es una coordenada
function puntoDe(longitud: string, latitud: string): Punto | null | undefined {
  const x = longitud.trim().replace(',', '.')
  const y = latitud.trim().replace(',', '.')
  if (!x && !y) return null
  const lon = x ? Number(x) : NaN
  const lat = y ? Number(y) : NaN
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? [lon, lat] : undefined
}

// una observación geolocalizada: el texto, el momento y, si la persona lo da, el punto con la ubicación del teléfono o con
// coordenadas (RF-FLD-001). se escribe con la forma de la definición de quien llama (decisión 18); la clave de idempotencia y
// el momento son de la acción: un reintento sin cambios los repite, y una acción nueva (tras guardar o al cambiar lo escrito)
// estrena otros
function NuevaObservacion({ visita, alGuardar }: { visita: string; alGuardar: () => void }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const cliente = useQueryClient()
  const mensaje = useMensajeDeError()
  const definicion = useDefinicion('field_observation')
  const accion = useRef<{ clave: string; momento: string } | null>(null)
  const [observacion, setObservacion] = useState('')
  const [longitud, setLongitud] = useState('')
  const [latitud, setLatitud] = useState('')
  // la lectura de la ubicación en curso: un resultado tardío no pisa las coordenadas que la persona escribió después
  const telefono = useUbicacionDelTelefono()
  const [faltas, setFaltas] = useState<{ observacion?: string; punto?: string }>({})
  const crear = useMutation({
    mutationFn: (punto: Punto | null) => {
      const def = definicion.data
      if (!def) throw new Error('definición sin leer')
      accion.current ??= { clave: nuevaClave(), momento: new Date().toISOString() }
      const geometrias = geometriasDeEscritura(def, punto ? { location: { type: 'Point', coordinates: punto } } : undefined)
      return pedir<Registro>('/objects/field_observation/records', {
        json: {
          attributes: atributosDeEscritura('field_observation', def, {
            field_visit: visita,
            observation: observacion.trim(),
            observed_at: accion.current.momento
          }),
          ...(geometrias ? { geometries: geometrias } : {})
        },
        clave: accion.current.clave
      })
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['records', 'field_observation'] })
      accion.current = null
      setObservacion('')
      setLongitud('')
      setLatitud('')
      alGuardar()
    }
  })
  if (definicion.isPending) return <Cargando />
  if (definicion.isError || !definicion.data) return <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} />
  const conPunto = puedeEscribir(definicion.data, 'location')
  // lo escrito cambió: lo que se reintente ya no es la misma acción, y el aviso de validación y el error del guardado anterior ya
  // no hablan de lo que se ve
  const editar = (poner: () => void) => {
    accion.current = null
    setFaltas({})
    if (crear.isError) crear.reset()
    poner()
  }
  // teclear una coordenada deja sin efecto la lectura de ubicación que todavía no respondió
  const escribirCoordenada = (poner: () => void) => {
    telefono.descartar()
    editar(poner)
  }

  const leerUbicacion = () =>
    telefono.leer(([lon, lat]) =>
      editar(() => {
        setLongitud(String(Number(lon.toFixed(6))))
        setLatitud(String(Number(lat.toFixed(6))))
      })
    )

  const guardar = () => {
    const punto = conPunto ? puntoDe(longitud, latitud) : null
    const siguientes = {
      ...(observacion.trim() ? {} : { observacion: t('relacionamiento.visita.faltaObservacion') }),
      ...(punto === undefined ? { punto: t('relacionamiento.visita.coordenadaInvalida') } : {})
    }
    setFaltas(siguientes)
    if (Object.keys(siguientes).length > 0) return
    crear.mutate(punto ?? null)
  }

  return (
    <div className="space-y-3">
      <Campo etiqueta={t('relacionamiento.visita.observaciones')} error={faltas.observacion}>
        {(p) => <Textarea {...p} value={observacion} onChange={(e) => editar(() => setObservacion(e.target.value))} />}
      </Campo>
      {conPunto ? (
        <fieldset className="space-y-2">
          <Button type="button" variant="secondary" className="h-11 w-full" disabled={telefono.ubicando} aria-busy={telefono.ubicando} onClick={leerUbicacion}>
            {t('relacionamiento.registro.usarUbicacion')}
          </Button>
          {telefono.ubicando ? (
            <p role="status" className="text-sg-caption text-sg-text-muted">
              {t('relacionamiento.visita.obteniendoUbicacion')}
            </p>
          ) : null}
          {telefono.sinUbicacion ? <p className="text-sg-caption text-sg-warning">{t('relacionamiento.registro.sinUbicacion')}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta={t('relacionamiento.visita.longitud')}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  aria-invalid={faltas.punto ? true : undefined}
                  value={longitud}
                  onChange={(e) => escribirCoordenada(() => setLongitud(e.target.value))}
                />
              )}
            </Campo>
            <Campo etiqueta={t('relacionamiento.visita.latitud')}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  aria-invalid={faltas.punto ? true : undefined}
                  value={latitud}
                  onChange={(e) => escribirCoordenada(() => setLatitud(e.target.value))}
                />
              )}
            </Campo>
          </div>
          <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.visita.ayudaCoordenadas')}</p>
          {faltas.punto ? (
            <p role="alert" className="text-sg-caption text-sg-danger">
              {faltas.punto}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      {crear.isError ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
      <Button className="h-11 w-full" disabled={crear.isPending} aria-busy={crear.isPending} onClick={guardar}>
        {t('comun.guardar')}
      </Button>
    </div>
  )
}

// las visitas de campo: con alcance global (/field-visits) las de todos los proyectos legibles, con su proyecto; bajo un proyecto
// (/projects/:projectId/field-visits) solo las de ese proyecto
export function VisitasPage() {
  const { t } = useTranslation(NS)
  const { projectId } = useParams()
  const idDeProyecto = useId()
  const visitas = useTodosConTope('field_visit', { ...(projectId ? { project: projectId } : {}), sort: 'planned_start_date', dir: 'desc' })
  return (
    <section className="mx-auto max-w-[1440px] space-y-3">
      <h1 className="text-sg-h1 font-semibold">{t('relacionamiento.visitas')}</h1>
      <CuerpoDeLista lectura={visitas} vacio={t('relacionamiento.visita.sinVisitas')}>
        {(lista) => (
          <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
            <Table aria-label={t('relacionamiento.visitas')}>
              <thead>
                <tr>
                  <Th scope="col">{t('relacionamiento.visita.columnas.titulo')}</Th>
                  {projectId ? null : (
                    <ThConExplicacion explicacion={idDeProyecto} tipo="noDisponible" soloLectores>
                      {t('relacionamiento.columnas.proyecto')}
                    </ThConExplicacion>
                  )}
                  <Th scope="col">{t('relacionamiento.columnas.estado')}</Th>
                  <Th scope="col">{t('relacionamiento.visita.columnas.inicio')}</Th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id}>
                    <Td>
                      <Link
                        to={`/projects/${encodeURIComponent(String(atributo(v, 'project')))}/field-visits/${encodeURIComponent(v.id)}`}
                        className="text-sg-primary-text underline"
                      >
                        {texto(v, 'title')}
                      </Link>
                    </Td>
                    {projectId ? null : (
                      <Td className="font-sg-mono text-sg-caption">
                        <CodigoDeProyecto id={texto(v, 'project')} describedPor={idDeProyecto} />
                      </Td>
                    )}
                    <Td>
                      <EstadoChip objeto="field_visit" estado={v.state} />
                    </Td>
                    <Td className="text-sm">
                      <Dia valor={texto(v, 'actual_start_date') || texto(v, 'planned_start_date')} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </CuerpoDeLista>
    </section>
  )
}
