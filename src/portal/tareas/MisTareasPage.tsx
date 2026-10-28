import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { cn } from '@wasichai/ui'
import { ChipsDeFiltro } from '../componentes/Lista'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { useLeeTodosLosProyectos, useProyectos } from '../contexto/proyectos'
import { useAuth } from '@wasichai/core'
import { Button, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { PaginacionDelServidor, useParametrosDeLista, VistasGuardadas } from '../componentes/Lista'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { hoyEnLima } from '../datos/fechas'
import {
  atributo,
  estados,
  texto,
  useConteo,
  useConteos,
  useRegistro,
  useRegistros,
  useTodosConTope,
  type Pagina,
  type Parametros,
  type Registro
} from '../datos/registros'
import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { OrigenDeTarea, TareaDrawer } from './TareaDrawer'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { CuandoVence, FechaDePlazo } from '../componentes/CuandoVence'
import { sinFiltroDeAsignados, soloAsignados } from './paraTomar'

// S47 · mis tareas (screens.md §11, WF-N): ¿qué tengo que hacer hoy y qué se me venció? en /tasks, las asignadas a quien mira
// (assignee_user_id, indexado); en /projects/:projectId/tasks, las del proyecto. la lista va en grupos (D10 de la revisión de UX):
// «Mis tareas», las abiertas asignadas a quien mira, y «Para tomar», las de escalamiento de JOB-01 que llegan sin asignar
// (empty=assignee_user_id): sin proyecto elegido, una sola lectura que el servidor acota a sus proyectos (ADR-0029); quien lee
// todos los proyectos la pide con assigned=true, para recibir la de sus proyectos asignados y no la de todo el tenant (B-04,
// paraTomar.ts), y con un servidor que no lo conoce la ve solo dentro de un proyecto. cada grupo es una consulta del servidor por
// estado, con su página y su total; el tablero pide
// cada columna y el calendario el rango del mes (range_field=due_date). una tarea se abre en su drawer (?task=id) con sus
// transiciones. una tarea vencida sigue en su estado: la situación es deadline_status (RN-WFL-001)
const ABIERTAS = ['open', 'in_progress', 'blocked']
const COLUMNAS = ['open', 'in_progress', 'blocked', 'done'] as const
const VISTAS = ['lista', 'tablero', 'calendario']
const POR_PAGINA = 25

export function MisTareasPage() {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const lista = useParametrosDeLista('lista')
  // una vista que ya no existe (?view=paraTomar, hoy un grupo de la lista) es la lista
  const vista = VISTAS.includes(lista.vista) ? lista.vista : 'lista'
  // las mías: del proyecto o de todos los proyectos que se leen
  const mias: Parametros = { ...(proyecto ? { project: proyecto } : {}), assignee_user_id: user?.id }
  const abiertasMias: Parametros = { ...mias, state: estados(ABIERTAS) }
  // las cifras de arriba son filtros (revisión de UX, etapa 3): «Vencidas» y «Por vencer» filtran la lista por su situación de
  // plazo, en la URL (?situacion=), y «Abiertas» los quita
  const situacion = lista.filtro('situacion')
  const filtrar = (valor: string | null) => lista.cambiar({ situacion: valor, view: null })
  const enLaLista = useRegistros(
    'task',
    { ...abiertasMias, deadline_status: situacion, sort: 'due_date', dir: 'asc', page: lista.pagina, size: POR_PAGINA },
    Boolean(user) && vista === 'lista'
  )
  const paginaParaTomar = Number(lista.filtro('pt')) || 0
  const leeTodos = useLeeTodosLosProyectos()
  const paraTomar = useRegistros(
    'task',
    {
      ...(proyecto ? { project: proyecto } : soloAsignados(leeTodos)),
      empty: 'assignee_user_id',
      state: estados(ABIERTAS),
      sort: 'due_date',
      dir: 'asc',
      page: paginaParaTomar,
      size: POR_PAGINA
    },
    vista === 'lista'
  )
  const conParaTomar = Boolean(proyecto) || !leeTodos || !sinFiltroDeAsignados(paraTomar.error)
  const cifras = useConteos(
    'task',
    { vencidas: { ...abiertasMias, deadline_status: 'VENCIDO' }, porVencer: { ...abiertasMias, deadline_status: 'POR VENCER' }, abiertas: abiertasMias },
    Boolean(user)
  )
  const abierta = useRegistro('task', lista.filtro('task') || undefined)
  // abrir o cerrar una tarea no cambia de página ni de vista
  const pagina = lista.pagina ? String(lista.pagina) : null
  const abrir = (tarea: Registro) => lista.cambiar({ task: tarea.id, page: pagina })
  const chips = situacion ? [{ clave: 'situacion', etiqueta: t(`tareas.contadores.${situacion === 'VENCIDO' ? 'vencidas' : 'porVencer'}`) }] : []
  // el tablero y el calendario aplican la situación elegida, como la lista: su chip no puede quedar a la vista sin filtrar
  const conSituacion: Parametros = situacion ? { ...mias, deadline_status: situacion } : mias
  const verLista = () => lista.cambiar({ view: null })
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        titulo={proyecto ? t('tareas.delProyecto') : t('tareas.titulo')}
        conteo={cifras.abiertas !== null ? t('tareas.conteo', { count: cifras.abiertas }) : undefined}
      />
      {cifras.abiertas === null ? null : (
        <div role="group" aria-label={t('tareas.titulo')} className="grid grid-cols-3 gap-3 sm:max-w-md">
          {(
            [
              ['vencidas', cifras.vencidas, 'VENCIDO'],
              ['porVencer', cifras.porVencer, 'POR VENCER'],
              ['abiertas', cifras.abiertas, null]
            ] as const
          ).map(([clave, n, valor]) => {
            // la cifra elegida queda marcada en toda vista: el tablero y el calendario también la aplican (tercera pasada de UX)
            const activo = valor ? situacion === valor : !situacion
            return (
              <button
                key={clave}
                type="button"
                aria-pressed={activo}
                onClick={() => filtrar(valor && situacion !== valor ? valor : null)}
                className={cn('rounded-sg-lg border bg-sg-surface p-3 text-left hover:bg-sg-surface-hover', activo ? 'border-sg-primary' : 'border-sg-border')}
              >
                <span className="block text-sg-overline font-semibold uppercase text-sg-text-muted">{t(`tareas.contadores.${clave}`)}</span>{' '}
                <span className="block text-sg-h2 font-semibold tabular-nums">{n === null ? '—' : numeroPe(n)}</span>
              </button>
            )
          })}
        </div>
      )}
      <ChipsDeFiltro chips={chips} alQuitar={() => filtrar(null)} alLimpiar={() => filtrar(null)} />
      <VistasGuardadas
        vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`tareas.vistas.${v}`) }))}
        actual={vista}
        alCambiar={(vista) => lista.cambiar({ view: vista })}
      />
      {vista === 'tablero' ? (
        <Tablero consulta={conSituacion} alAbrir={abrir} alVerLista={verLista} />
      ) : vista === 'calendario' ? (
        <Calendario
          consulta={conSituacion}
          alVerLista={verLista}
          mes={lista.filtro('month') || hoyEnLima().slice(0, 7)}
          alCambiarMes={(mes) => lista.cambiar({ month: mes })}
          alAbrir={abrir}
        />
      ) : (
        <>
          <GrupoDeTareas titulo={t('tareas.grupos.mias')} lectura={enLaLista} alPagina={(p) => lista.cambiar({ page: String(p) })}>
            {(tareas) => <TablaDeTareas tareas={tareas} vacio={t('tareas.vacia')} alAbrir={abrir} conProyecto={!proyecto} />}
          </GrupoDeTareas>
          {conParaTomar ? (
            <GrupoDeTareas titulo={t('tareas.grupos.paraTomar')} lectura={paraTomar} alPagina={(p) => lista.cambiar({ pt: String(p), page: pagina })}>
              {(tareas) => (
                <>
                  <p className="text-sm text-sg-text-secondary">{t('tareas.paraTomarAyuda')}</p>
                  <TablaDeTareas
                    tareas={tareas}
                    vacio={proyecto ? t('tareas.vaciaParaTomar') : t('tareas.vaciaParaTomarEnSusProyectos')}
                    alAbrir={abrir}
                    etiqueta={t('tareas.grupos.paraTomar')}
                    conProyecto={!proyecto}
                  />
                </>
              )}
            </GrupoDeTareas>
          ) : (
            <p className="text-sm text-sg-text-muted">{t('tareas.paraTomarGlobal')}</p>
          )}
        </>
      )}
      {abierta.data ? <TareaDrawer tarea={abierta.data} alCerrar={() => lista.cambiar({ task: null, page: pagina })} /> : null}
    </section>
  )
}

// un grupo de la lista con su título, su total, su página del servidor y su paginación; mientras carga o si falla no se dibuja
// como vacío
function GrupoDeTareas({
  titulo,
  lectura,
  alPagina,
  children
}: {
  titulo: string
  lectura: UseQueryResult<Pagina>
  alPagina: (pagina: number) => void
  children: (tareas: Registro[]) => ReactNode
}) {
  return (
    <section aria-label={titulo} className="space-y-2">
      <h2 className="text-sg-h3 font-semibold">
        {titulo}
        {lectura.data?.totalElements != null ? <span className="text-sg-text-muted">{` (${numeroPe(lectura.data.totalElements)})`}</span> : null}
      </h2>
      {lectura.isPending ? (
        <Cargando />
      ) : lectura.isError && !lectura.data ? (
        <FalloDeLectura error={lectura.error} alReintentar={() => void lectura.refetch()} />
      ) : (
        <>
          {children(lectura.data.content)}
          <PaginacionDelServidor datos={lectura.data} alPagina={alPagina} />
        </>
      )}
    </section>
  )
}

function TablaDeTareas({
  tareas,
  vacio,
  alAbrir,
  conProyecto = false,
  etiqueta
}: {
  tareas: Registro[]
  vacio: string
  alAbrir: (tarea: Registro) => void
  conProyecto?: boolean
  etiqueta?: string
}) {
  const { t } = useTranslation(NS)
  const proyectos = useProyectos()
  const telefono = useEsTelefono()
  if (tareas.length === 0) return <Vacio titulo={vacio} />
  if (telefono)
    return (
      <ListaEnTarjetas
        etiqueta={etiqueta ?? t('tareas.titulo')}
        tarjetas={tareas.map((x) => ({
          id: x.id,
          titulo: (
            <button
              type="button"
              className="text-left text-sg-primary-text underline"
              aria-label={t('tareas.abrir', { tarea: texto(x, 'title') })}
              onClick={() => alAbrir(x)}
            >
              {texto(x, 'title')}
            </button>
          ),
          estado: <EstadoChip objeto="task" estado={x.state} />,
          plazo: (
            <>
              <SituacionDePlazo valor={atributo(x, 'deadline_status')} />
              <FechaDePlazo dia={texto(x, 'due_date')} situacion={atributo(x, 'deadline_status')} />
            </>
          ),
          proyecto: conProyecto ? <ProyectoEnLista proyecto={proyectos.data?.find((p) => p.id === texto(x, 'project'))} /> : undefined,
          detalle: <OrigenDeTarea tarea={x} />
        }))}
      />
    )
  return (
    <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
      <Table aria-label={etiqueta ?? t('tareas.titulo')}>
        <thead>
          <tr>
            {(['tarea', ...(conProyecto ? (['proyecto'] as const) : []), 'origen', 'prioridad', 'vence', 'estado'] as const).map((c) => (
              <Th key={c} scope="col">
                {t(`tareas.columnas.${c}`)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tareas.map((x) => {
            return (
              <tr key={x.id}>
                <Td className="text-sm">
                  <button
                    type="button"
                    className="text-left text-sg-primary-text underline"
                    aria-label={t('tareas.abrir', { tarea: texto(x, 'title') })}
                    onClick={() => alAbrir(x)}
                  >
                    {texto(x, 'title')}
                  </button>
                </Td>
                {conProyecto ? (
                  <Td className="text-sm">
                    <ProyectoEnLista proyecto={proyectos.data?.find((p) => p.id === texto(x, 'project'))} />
                  </Td>
                ) : null}
                <Td className="text-sm">
                  <OrigenDeTarea tarea={x} />
                </Td>
                <Td className="text-sm">{opcion(x, 'priority') || '—'}</Td>
                <Td className="space-x-2 text-sm">
                  <span>
                    <Dia valor={texto(x, 'due_date')} />
                  </span>
                  <SituacionDePlazo valor={atributo(x, 'deadline_status')} />
                  {texto(x, 'due_date') && atributo(x, 'deadline_status') ? (
                    <CuandoVence dia={texto(x, 'due_date')} className="block text-sg-caption text-sg-text-muted" />
                  ) : null}
                </Td>
                <Td>
                  <EstadoChip objeto="task" estado={x.state} />
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}

// el tablero por estado: una columna por estado de WF-N (las canceladas no se muestran), cada una con su consulta y su total; cada
// tarjeta abre la tarea, donde están las transiciones con el teclado y con motivo, en lugar de arrastrar (screens.md S47)
function Tablero({ consulta, alAbrir, alVerLista }: { consulta: Parametros; alAbrir: (tarea: Registro) => void; alVerLista: () => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {COLUMNAS.map((estado) => (
        <ColumnaDelTablero key={estado} consulta={consulta} estado={estado} alAbrir={alAbrir} alVerLista={alVerLista} />
      ))}
    </div>
  )
}

const POR_COLUMNA = 50

function ColumnaDelTablero({
  consulta,
  estado,
  alAbrir,
  alVerLista
}: {
  consulta: Parametros
  estado: string
  alAbrir: (tarea: Registro) => void
  alVerLista: () => void
}) {
  const { t } = useTranslation(NS)
  const lectura = useRegistros('task', { ...consulta, state: estado, sort: 'due_date', dir: 'asc', size: POR_COLUMNA })
  const tareas = lectura.data?.content ?? []
  const total = lectura.data?.totalElements ?? null
  return (
    <section aria-label={t(`tareas.columnasDelTablero.${estado}`)} className="space-y-2 rounded-sg-lg bg-sg-surface-sunken p-2">
      <h2 className="text-sm font-semibold">
        {t(`tareas.columnasDelTablero.${estado}`)} · {total === null ? '—' : numeroPe(total)}
      </h2>
      {lectura.isPending ? (
        <Cargando compacto />
      ) : lectura.isError && !lectura.data ? (
        <FalloDeLectura error={lectura.error} alReintentar={() => void lectura.refetch()} />
      ) : (
        <ul className="space-y-2">
          {tareas.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => alAbrir(x)}
                className="w-full space-y-1 rounded-sg-md border border-sg-border bg-sg-surface p-2 text-left text-sm"
              >
                <span className="block font-medium">{texto(x, 'title')}</span>
                <span className="flex flex-wrap items-center gap-1 text-sg-caption text-sg-text-muted">
                  <Dia valor={texto(x, 'due_date')} />
                  <SituacionDePlazo valor={atributo(x, 'deadline_status')} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* las que no caben en la columna se ven en la lista (tercera pasada de UX: «Y N más.» no llevaba a ninguna parte) */}
      {total !== null && total > tareas.length ? (
        <button type="button" onClick={alVerLista} className="text-sg-caption font-medium text-sg-primary-text hover:underline focus-visible:underline">
          {t('tareas.verRestoEnLaLista', { n: numeroPe(total - tareas.length) })}
        </button>
      ) : null}
    </section>
  )
}

const sumarMes = (mes: string, n: number): string => {
  const [a, m] = mes.split('-').map(Number)
  const fecha = new Date(Date.UTC(a, m - 1 + n, 1))
  return fecha.toISOString().slice(0, 7)
}

// el calendario del mes por fecha de vencimiento (días de calendario, sin huso): una cuadrícula de lunes a domingo
function Calendario({
  consulta,
  mes,
  alCambiarMes,
  alAbrir,
  alVerLista
}: {
  consulta: Parametros
  mes: string
  alCambiarMes: (mes: string) => void
  alAbrir: (tarea: Registro) => void
  alVerLista: () => void
}) {
  const { t, i18n } = useTranslation(NS)
  const valido = /^\d{4}-\d{2}$/.test(mes) ? mes : hoyEnLima().slice(0, 7)
  const [a, m] = valido.split('-').map(Number)
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const primero = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7
  const celdas = [...Array.from({ length: primero }, () => null), ...Array.from({ length: dias }, (_, i) => i + 1)]
  // las del mes, por su rango de vencimiento, y cuántas no tienen fecha (D10 de la revisión de UX)
  const delMes = useTodosConTope('task', { ...consulta, range_field: 'due_date', range_from: `${valido}-01`, range_to: `${sumarMes(valido, 1)}-01` })
  const tareas = delMes.data ?? []
  const delDia = (dia: number) => tareas.filter((x) => texto(x, 'due_date') === `${valido}-${String(dia).padStart(2, '0')}`)
  const sinFecha = useConteo('task', { ...consulta, empty: 'due_date' }) ?? 0
  const nombreDelMes = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en' : 'es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(a, m - 1, 1))
  )
  const semana = t('tareas.diasDeLaSemana', { returnObjects: true }) as string[]
  return (
    <section aria-label={nombreDelMes} className="space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => alCambiarMes(sumarMes(valido, -1))}>
          {t('tareas.mesAnterior')}
        </Button>
        <h2 className="text-sg-h3 font-semibold capitalize">{nombreDelMes}</h2>
        <Button size="sm" variant="secondary" onClick={() => alCambiarMes(sumarMes(valido, 1))}>
          {t('tareas.mesSiguiente')}
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-sm">
        {semana.map((d) => (
          <div key={d} className="text-center text-sg-caption font-semibold text-sg-text-muted">
            {d}
          </div>
        ))}
        {celdas.map((dia, i) =>
          dia === null ? (
            <div key={`vacio-${i}`} />
          ) : (
            <div key={dia} className="min-h-16 rounded-sg-sm border border-sg-border-subtle p-1">
              <span className="text-sg-caption text-sg-text-muted">{dia}</span>
              <ul>
                {delDia(dia).map((x) => (
                  <li key={x.id}>
                    <button type="button" className="text-left text-sg-caption text-sg-primary-text underline" onClick={() => alAbrir(x)}>
                      {texto(x, 'title')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>
      {sinFecha > 0 ? <p className="text-sm text-sg-text-muted">{t('tareas.sinFecha', { n: sinFecha })}</p> : null}
      {/* la lectura del mes tiene tope: si lo alcanza, el calendario no las muestra todas y lo dice (tercera pasada de UX) */}
      {delMes.truncado ? (
        <p className="text-sm text-sg-warning">
          {t('tareas.calendarioCortado')}{' '}
          <button type="button" onClick={alVerLista} className="font-medium text-sg-primary-text hover:underline focus-visible:underline">
            {t('tareas.irALaLista')}
          </button>
        </p>
      ) : null}
    </section>
  )
}
