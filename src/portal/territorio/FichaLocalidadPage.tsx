import { VerEnElMapa } from '../componentes/VerEnElMapa'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { PestanasDeFicha } from '../componentes/PestanasDeFicha'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { Drawer } from '../componentes/Drawer'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Cargando, Consulta, NoDisponible, Restringido, esProhibido } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import {
  atributo,
  puedeEscribir,
  puedeLeer,
  texto,
  useDefinicion,
  usePuedeEditar,
  useRegistro,
  useRelacionados,
  useTodos,
  type Pagina,
  type Registro
} from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { Dato, TrabajarEnProyecto } from './comunes'
import { EditorDeGeometria } from './EditorDeGeometria'
import { RegistrosDeLaZona } from './RegistrosDeLaZona'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'

// S14 · ficha de localidad y línea base social (screens.md §4): el lugar con datos fechados y su confiabilidad. cada perfil
// es una foto: un dato nuevo es otro perfil. las cifras se comparan con el perfil anterior y una ausente dice "no disponible
// en <fecha>", nunca cero. religión y proceso electoral solo para quien los lee (security.md §7.9). cada consulta auxiliar
// dice si carga, falló o no se puede leer: nunca una lista vacía ni un «sin …» en su lugar
const CIFRAS = ['population_count', 'families_count', 'members_per_family', 'communal_labor_members_count'] as const
const CAMPOS = ['economic_activities', 'crops', 'livestock', 'water_source', 'electricity', 'sanitation', 'phone_coverage', 'migration'] as const

// el estado de una consulta auxiliar cuando todavía no hay datos: carga, no disponible (403) o error con reintento
function SinDatos({ consulta }: { consulta: Pick<UseQueryResult, 'isPending' | 'isError' | 'error' | 'refetch'> }) {
  if (consulta.isPending) return <Cargando />
  if (!consulta.isError) return null
  return <FalloDeLectura error={consulta.error} alReintentar={() => void consulta.refetch()} />
}

// el nombre de un registro al que apunta la localidad (el distrito, la localidad de la que es sector): sin referencia, un
// guion; mientras carga, puntos; si no se pudo leer, restringido o no disponible, nunca un guion
function Referencia({ consulta, tiene, children }: { consulta: UseQueryResult<Registro>; tiene: boolean; children: (r: Registro) => ReactNode }) {
  if (!tiene) return <>—</>
  if (consulta.data) return <>{children(consulta.data)}</>
  if (consulta.isError) return esProhibido(consulta.error) ? <Restringido /> : <NoDisponible />
  return <>…</>
}

export function FichaLocalidadPage() {
  const { id = '' } = useParams()
  const localidad = useRegistro('locality', id)
  return <Consulta consulta={localidad}>{(l) => <Ficha localidad={l} />}</Consulta>
}

function Ficha({ localidad }: { localidad: Registro }) {
  const { t } = useTranslation(NS)
  const puedeEditar = usePuedeEditar('locality')
  const idPadre = atributo<string>(localidad, 'parent_locality')
  const idDistrito = atributo<string>(localidad, 'administrative_unit')
  const padre = useRegistro('locality', idPadre)
  const distrito = useRegistro('administrative_unit', idDistrito)
  const [editando, setEditando] = useState(false)
  const { can } = useAuth()
  const definicion = useDefinicion('locality')
  const [busqueda] = useSearchParams()
  // la ubicación y el límite se editan con su revisión previa (spec F6 §3.6): UPDATE sobre la localidad y solo los campos
  // escribibles
  const geometrias = ['location', 'boundary'].filter((c) => puedeEscribir(definicion.data, c))
  const editaGeometria = can('locality', 'UPDATE') && geometrias.length > 0
  const [dibujando, setDibujando] = useState(false)
  return (
    <article className="mx-auto max-w-[1440px] space-y-4">
      {/* el encabezado común (revisión de UX, etapa 5): el tipo como antetítulo, el reconocimiento como chip y los datos de la
          localidad debajo */}
      <EncabezadoDePagina
        antetitulo={opcion(localidad, 'locality_type')}
        titulo={texto(localidad, 'name')}
        chips={<span>{opcion(localidad, 'recognition_status')}</span>}
        primaria={<TrabajarEnProyecto tipo="locality" id={localidad.id} />}
        secundarias={
          <>
            <VerEnElMapa objeto="locality" registro={localidad} />
            {puedeEditar ? (
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                {t('territorio.editar')}
              </Button>
            ) : null}
            {editaGeometria ? (
              <Button size="sm" variant="secondary" onClick={() => setDibujando(true)}>
                {t('edicionDeGeometria.abrir')}
              </Button>
            ) : null}
          </>
        }
      />
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 text-sm text-sg-text-secondary">
        <Dato etiqueta={t('territorio.localidad.codigo')}>{texto(localidad, 'populated_center_code') || '—'}</Dato>
        <Dato etiqueta={t('territorio.localidad.distrito')}>
          <Referencia consulta={distrito} tiene={Boolean(idDistrito)}>
            {(d) => texto(d, 'name') || '—'}
          </Referencia>
        </Dato>
        {idPadre ? (
          <Dato etiqueta={t('territorio.localidad.padre')}>
            <Referencia consulta={padre} tiene>
              {(p) => (
                <Link to={`/territory/localities/${encodeURIComponent(p.id)}`} className="text-sg-primary-text underline">
                  {texto(p, 'name')}
                </Link>
              )}
            </Referencia>
          </Dato>
        ) : null}
      </dl>
      <PestanasDeFicha
        etiqueta={texto(localidad, 'name')}
        pestanas={[
          { id: 'linea-base', etiqueta: t('territorio.pestanas.lineaBase'), render: () => <LineaBase localidad={localidad.id} /> },
          {
            id: 'registros',
            etiqueta: t('territorio.pestanas.registros'),
            render: () => <RegistrosDeLaZona zona="locality" id={localidad.id} />
          }
        ]}
      />
      <Drawer titulo={t('territorio.editar')} abierto={editando} alCerrar={() => setEditando(false)}>
        <FormularioDeRegistro objeto="locality" registro={localidad} alGuardar={() => setEditando(false)} alCancelar={() => setEditando(false)} />
      </Drawer>
      <Drawer titulo={t('edicionDeGeometria.titulo')} abierto={dibujando} alCerrar={() => setDibujando(false)}>
        {dibujando ? (
          <EditorDeGeometria
            objeto="locality"
            registro={localidad}
            campos={geometrias}
            proyecto={busqueda.get('project') ?? undefined}
            alTerminar={() => setDibujando(false)}
          />
        ) : null}
      </Drawer>
    </article>
  )
}

function LineaBase({ localidad }: { localidad: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const perfiles = useTodos('locality_profile', { locality: localidad, sort: 'data_date', dir: 'desc' })
  const definicion = useDefinicion('locality_profile')
  const [elegido, setElegido] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const lista = perfiles.data ?? []
  const indice = Math.max(
    0,
    lista.findIndex((p) => p.id === elegido)
  )
  const perfil = lista[indice]
  const anterior = lista[indice + 1]
  const restringidos = definicion.isSuccess && (!puedeLeer(definicion.data, 'religion') || !puedeLeer(definicion.data, 'electoral_process'))

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {lista.length > 0 ? (
          <label className="flex items-center gap-2 text-sm">
            {t('territorio.localidad.perfil')}
            <select
              className="h-8 rounded-sg-md border border-sg-border-strong bg-sg-surface px-2"
              value={perfil?.id ?? ''}
              onChange={(e) => setElegido(e.target.value)}
            >
              {lista.map((p) => (
                <option key={p.id} value={p.id}>
                  <Dia valor={texto(p, 'data_date')} /> · {opcion(p, 'reliability')}
                </option>
              ))}
            </select>
          </label>
        ) : perfiles.isSuccess ? (
          <p className="text-sm text-sg-text-muted">{t('territorio.localidad.sinPerfiles')}</p>
        ) : null}
        {can('locality_profile', 'CREATE') ? (
          <Button size="sm" onClick={() => setNuevo(true)} title={t('territorio.localidad.nuevoPerfilAyuda')}>
            {t('territorio.localidad.nuevoPerfil')}
          </Button>
        ) : null}
      </div>
      {perfiles.data ? null : <SinDatos consulta={perfiles} />}
      {perfil ? (
        <>
          <p className="text-sm text-sg-text-secondary">
            {t('territorio.localidad.perfilDe', { fecha: texto(perfil, 'data_date'), fuente: texto(perfil, 'data_source') })}{' '}
            <span className="rounded-sg-xs border border-sg-border-strong px-1.5 text-sg-caption">{opcion(perfil, 'reliability')}</span>
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CIFRAS.map((c) => (
              <Cifra key={c} campo={c} perfil={perfil} anterior={anterior} />
            ))}
          </ul>
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
            {CAMPOS.map((c) => (
              <div key={c} className="contents">
                <dt className="text-sg-text-muted">{t(`territorio.localidad.campos.${c}`)}</dt>
                <dd>{texto(perfil, c) || '—'}</dd>
              </div>
            ))}
            <CampoSensible campo="religion" perfil={perfil} definicion={definicion} />
            <CampoSensible campo="electoral_process" perfil={perfil} definicion={definicion} />
          </dl>
          {restringidos ? <Alert tone="notice">{t('territorio.localidad.restringidos')}</Alert> : null}
          {atributo(perfil, 'study') ? <Percepciones estudio={String(atributo(perfil, 'study'))} /> : null}
        </>
      ) : null}
      <Servicios localidad={localidad} />
      <Drawer
        titulo={t('territorio.localidad.nuevoPerfil')}
        descripcion={t('territorio.localidad.nuevoPerfilAyuda')}
        abierto={nuevo}
        alCerrar={() => setNuevo(false)}
      >
        <FormularioDeRegistro objeto="locality_profile" fijos={{ locality: localidad }} alGuardar={() => setNuevo(false)} alCancelar={() => setNuevo(false)} />
      </Drawer>
    </div>
  )
}

// religión y proceso electoral: la definición para quien llama dice si la cuenta los lee (un campo restringido falta en ella).
// la etiqueta es siempre la del portal (un campo restringido no trae la suya); mientras llega la definición o si no se pudo
// leer, no se afirma ni que están restringidos ni que no hay dato
function CampoSensible({
  campo,
  perfil,
  definicion
}: {
  campo: 'religion' | 'electoral_process'
  perfil: Registro
  definicion: ReturnType<typeof useDefinicion>
}) {
  const { t } = useTranslation(NS)
  let valor: ReactNode
  if (definicion.data) valor = puedeLeer(definicion.data, campo) ? texto(perfil, campo) || '—' : <Restringido />
  else if (definicion.isError) valor = <NoDisponible />
  else valor = '…'
  return (
    <>
      <dt className="text-sg-text-muted">{t(`territorio.localidad.campos.${campo}`)}</dt>
      <dd>{valor}</dd>
    </>
  )
}

function Cifra({ campo, perfil, anterior }: { campo: (typeof CIFRAS)[number]; perfil: Registro; anterior: Registro | undefined }) {
  const { t } = useTranslation(NS)
  const valor = atributo<number>(perfil, campo)
  const previo = anterior ? atributo<number>(anterior, campo) : undefined
  let variacion: string | null = null
  if (anterior && (previo === null || previo === undefined)) variacion = t('territorio.localidad.noDisponibleEn', { fecha: texto(anterior, 'data_date') })
  else if (anterior && typeof valor === 'number' && typeof previo === 'number') {
    const diferencia = valor - previo
    variacion = t('territorio.localidad.variacion', {
      signo: diferencia > 0 ? '+' : diferencia < 0 ? '−' : '±',
      valor: numeroPe(Math.abs(diferencia)),
      fecha: texto(anterior, 'data_date')
    })
  }
  return (
    <li aria-label={t(`territorio.localidad.cifras.${campo}`)} className="rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t(`territorio.localidad.cifras.${campo}`)}</p>
      <p className="text-sg-kpi-sm font-semibold tabular-nums">{valor === null || valor === undefined ? t('comun.noDisponible') : numeroPe(valor)}</p>
      {variacion ? <p className="text-sg-caption text-sg-text-muted">{variacion}</p> : null}
    </li>
  )
}

// una sección de Servicios: sus filas, o por qué no hay (carga, restringido, error); «Aún no hay registros» solo si llegó vacía
function Seccion<T extends Registro>({
  titulo,
  consulta,
  filas,
  rotulo
}: {
  titulo: string
  consulta: UseQueryResult<T[] | Pagina>
  filas: (datos: T[] | Pagina) => Registro[]
  rotulo: (r: Registro) => string
}) {
  const { t } = useTranslation(NS)
  const registros = consulta.data ? filas(consulta.data) : undefined
  return (
    <section aria-label={titulo} className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h3 className="font-medium">{titulo}</h3>
      {registros ? null : <SinDatos consulta={consulta} />}
      <ul>
        {(registros ?? []).map((r) => (
          <li key={r.id}>{rotulo(r)}</li>
        ))}
      </ul>
      {registros && registros.length === 0 ? <p className="text-sg-text-muted">{t('comun.vacio')}</p> : null}
    </section>
  )
}

const deLista = (datos: Registro[] | Pagina) => (Array.isArray(datos) ? datos : datos.content)

function Servicios({ localidad }: { localidad: string }) {
  const { t, i18n } = useTranslation(NS)
  const escuelas = useTodos('school', { locality: localidad })
  const salud = useTodos('health_facility', { locality: localidad })
  const vias = useTodos('road_access', { locality: localidad })
  const festividades = useTodos('festivity', { locality: localidad, sort: 'month', dir: 'asc' })
  const programas = useRelacionados('locality', localidad, 'state_program_locality')
  const conflictos = useRelacionados('locality', localidad, 'local_conflict_locality')
  const nombreDeMes = (m: number) => new Intl.DateTimeFormat(i18n.language, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, m - 1, 1)))
  const mesDe = (f: Registro) => Number(atributo(f, 'month'))
  // por mes; una festividad sin mes válido sale al final, sin nombre de mes, no se pierde
  const ordenadas = [...(festividades.data ?? [])].sort(
    (a, b) => (mesDe(a) >= 1 && mesDe(a) <= 12 ? mesDe(a) : 13) - (mesDe(b) >= 1 && mesDe(b) <= 12 ? mesDe(b) : 13)
  )
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Seccion
        titulo={t('territorio.localidad.escuelas')}
        consulta={escuelas}
        filas={deLista}
        rotulo={(r) => `${texto(r, 'name')} · ${texto(r, 'education_level')}`}
      />
      <Seccion titulo={t('territorio.localidad.salud')} consulta={salud} filas={deLista} rotulo={(r) => `${texto(r, 'name')} · ${texto(r, 'facility_type')}`} />
      <Seccion
        titulo={t('territorio.localidad.vias')}
        consulta={vias}
        filas={deLista}
        rotulo={(r) => [texto(r, 'road_type'), texto(r, 'road_condition'), texto(r, 'travel_time')].filter(Boolean).join(' · ')}
      />
      <section aria-label={t('territorio.localidad.festividades')} className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
        <h3 className="font-medium">{t('territorio.localidad.festividades')}</h3>
        {festividades.data ? null : <SinDatos consulta={festividades} />}
        <ol>
          {ordenadas.map((f) => (
            <li key={f.id}>
              {mesDe(f) >= 1 && mesDe(f) <= 12 ? <span className="capitalize">{nombreDeMes(mesDe(f))}: </span> : null}
              {texto(f, 'name')} {texto(f, 'date_text') ? `(${texto(f, 'date_text')})` : ''}
            </li>
          ))}
        </ol>
        {festividades.data?.length === 0 ? <p className="text-sg-text-muted">{t('comun.vacio')}</p> : null}
      </section>
      <Seccion titulo={t('territorio.localidad.programas')} consulta={programas} filas={deLista} rotulo={(r) => texto(r, 'name')} />
      <Seccion
        titulo={t('territorio.localidad.conflictos')}
        consulta={conflictos}
        filas={deLista}
        rotulo={(r) => `${texto(r, 'title')} · ${opcion(r, 'conflict_type')} · ${opcion(r, 'conflict_status')}`}
      />
    </div>
  )
}

function Percepciones({ estudio }: { estudio: string }) {
  const { t } = useTranslation(NS)
  const percepciones = useTodos('perception', { study: estudio })
  return (
    <section aria-label={t('territorio.localidad.percepciones')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h3 className="font-medium">{t('territorio.localidad.percepciones')}</h3>
      {percepciones.data ? null : <SinDatos consulta={percepciones} />}
      <ul className="space-y-2">
        {(percepciones.data ?? []).map((p) => (
          <li key={p.id}>
            <p>
              {opcion(p, 'subject')} · {opcion(p, 'polarity')}: {texto(p, 'statement')}
            </p>
            {texto(p, 'quote') ? (
              <blockquote className="border-l-2 border-sg-border pl-2 italic text-sg-text-secondary">
                «{texto(p, 'quote')}» {texto(p, 'attributed_role') ? t('territorio.localidad.atribuida', { cargo: texto(p, 'attributed_role') }) : ''}
              </blockquote>
            ) : null}
          </li>
        ))}
      </ul>
      {percepciones.data?.length === 0 ? <p className="text-sg-text-muted">{t('comun.vacio')}</p> : null}
    </section>
  )
}
