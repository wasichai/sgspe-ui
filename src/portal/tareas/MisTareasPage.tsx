import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { cn } from '@wasichai/ui'
import { ChipsDeFiltro } from '../componentes/Lista'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { useProyectos } from '../contexto/proyectos'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useParametrosDeLista, VistasGuardadas } from '../componentes/Lista'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { hoyEnLima } from '../datos/fechas'
import { atributo, texto, useTodosConTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { OrigenDeTarea, TareaDrawer } from './TareaDrawer'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'

// S47 · mis tareas (screens.md §11, WF-N): ¿qué tengo que hacer hoy y qué se me venció? en /tasks, las asignadas a quien mira
// (assignee_user_id, indexado); en /projects/:projectId/tasks, las del proyecto, con «Para tomar»: las de escalamiento de
// JOB-01, que llegan sin asignar. la API genérica no filtra por estado ni por «sin asignar»: se lee con tope y se arma aquí.
// lista, tablero por estado y calendario del mes por vencimiento; una tarea se abre en su drawer (?task=id) con sus
// transiciones. una tarea vencida sigue en su estado: la situación es deadline_status (RN-WFL-001)
const ABIERTAS = ['open', 'in_progress', 'blocked']
const COLUMNAS = ['open', 'in_progress', 'blocked', 'done'] as const

export function MisTareasPage() {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const lista = useParametrosDeLista('lista')
  const vistas = ['lista', 'tablero', 'calendario', ...(proyecto ? ['paraTomar'] : [])]
  // una vista que aquí no existe (?view=paraTomar fuera de un proyecto) es la lista: «Para tomar» filtraría solo las propias
  const vista = vistas.includes(lista.vista) ? lista.vista : 'lista'
  const tareas = useTodosConTope(
    'task',
    proyecto ? { project: proyecto, sort: 'due_date', dir: 'asc' } : { assignee_user_id: user?.id, sort: 'due_date', dir: 'asc' },
    Boolean(user)
  )
  const todas = tareas.data ?? []
  const mias = todas.filter((x) => atributo(x, 'assignee_user_id') === user?.id)
  const paraTomar = todas.filter((x) => !atributo(x, 'assignee_user_id') && ABIERTAS.includes(x.state ?? ''))
  const abiertas = mias.filter((x) => ABIERTAS.includes(x.state ?? ''))
  const abierta = todas.find((x) => x.id === lista.filtro('task'))
  // abrir o cerrar una tarea no cambia de página ni de vista
  const pagina = lista.pagina ? String(lista.pagina) : null
  const abrir = (tarea: Registro) => lista.cambiar({ task: tarea.id, page: pagina })
  const contar = (situacion: string) => abiertas.filter((x) => atributo(x, 'deadline_status') === situacion).length
  // las cifras de arriba son filtros (revisión de UX, etapa 3): «Vencidas» y «Por vencer» filtran la lista por su situación de
  // plazo, en la URL (?situacion=), y «Abiertas» los quita
  const situacion = lista.filtro('situacion')
  const filtrar = (valor: string | null) => lista.cambiar({ situacion: valor, view: null })
  const enLaLista = situacion ? abiertas.filter((x) => atributo(x, 'deadline_status') === situacion) : abiertas
  const chips = situacion ? [{ clave: 'situacion', etiqueta: t(`tareas.contadores.${situacion === 'VENCIDO' ? 'vencidas' : 'porVencer'}`) }] : []
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        titulo={proyecto ? t('tareas.delProyecto') : t('tareas.titulo')}
        conteo={tareas.data ? t('tareas.conteo', { count: abiertas.length }) : undefined}
      />
      {tareas.isPending ? null : tareas.isError && !tareas.data ? null : (
        <div role="group" aria-label={t('tareas.titulo')} className="grid grid-cols-3 gap-3 sm:max-w-md">
          {(
            [
              ['vencidas', contar('VENCIDO'), 'VENCIDO'],
              ['porVencer', contar('POR VENCER'), 'POR VENCER'],
              ['abiertas', abiertas.length, null]
            ] as const
          ).map(([clave, n, valor]) => {
            const activo = vista === 'lista' && (valor ? situacion === valor : !situacion)
            return (
              <button
                key={clave}
                type="button"
                aria-pressed={activo}
                onClick={() => filtrar(valor && situacion !== valor ? valor : null)}
                className={cn('rounded-sg-lg border bg-sg-surface p-3 text-left hover:bg-sg-surface-hover', activo ? 'border-sg-primary' : 'border-sg-border')}
              >
                <span className="block text-sg-overline font-semibold uppercase text-sg-text-muted">{t(`tareas.contadores.${clave}`)}</span>{' '}
                <span className="block text-sg-h2 font-semibold tabular-nums">{numeroPe(n)}</span>
              </button>
            )
          })}
        </div>
      )}
      <ChipsDeFiltro chips={chips} alQuitar={() => filtrar(null)} alLimpiar={() => filtrar(null)} />
      <VistasGuardadas
        vistas={vistas.map((v) => ({ id: v, etiqueta: t(`tareas.vistas.${v}`) }))}
        actual={vista}
        alCambiar={(vista) => lista.cambiar({ view: vista })}
      />
      {tareas.truncado ? <Alert tone="warning">{t('tareas.truncado', { n: numeroPe(tareas.data?.length ?? 0) })}</Alert> : null}
      {tareas.isPending ? (
        <Cargando />
      ) : tareas.isError && !tareas.data ? (
        <FalloDeLectura error={tareas.error} alReintentar={() => void tareas.refetch()} />
      ) : vista === 'tablero' ? (
        <Tablero tareas={mias} alAbrir={abrir} />
      ) : vista === 'calendario' ? (
        <Calendario
          tareas={mias}
          mes={lista.filtro('month') || hoyEnLima().slice(0, 7)}
          alCambiarMes={(mes) => lista.cambiar({ month: mes })}
          alAbrir={abrir}
        />
      ) : vista === 'paraTomar' ? (
        <>
          <p className="text-sm text-sg-text-secondary">{t('tareas.paraTomarAyuda')}</p>
          <TablaDeTareas tareas={paraTomar} vacio={t('tareas.vaciaParaTomar')} alAbrir={abrir} />
        </>
      ) : (
        <TablaDeTareas tareas={enLaLista} vacio={t('tareas.vacia')} alAbrir={abrir} conProyecto={!proyecto} />
      )}
      {!proyecto ? <p className="text-sm text-sg-text-muted">{t('tareas.paraTomarGlobal')}</p> : null}
      {abierta ? <TareaDrawer tarea={abierta} alCerrar={() => lista.cambiar({ task: null, page: pagina })} /> : null}
    </section>
  )
}

function TablaDeTareas({
  tareas,
  vacio,
  alAbrir,
  conProyecto = false
}: {
  tareas: Registro[]
  vacio: string
  alAbrir: (tarea: Registro) => void
  conProyecto?: boolean
}) {
  const { t } = useTranslation(NS)
  const proyectos = useProyectos()
  const telefono = useEsTelefono()
  if (tareas.length === 0) return <Vacio titulo={vacio} />
  if (telefono)
    return (
      <ListaEnTarjetas
        etiqueta={t('tareas.titulo')}
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
              <Dia valor={texto(x, 'due_date')} />
            </>
          ),
          proyecto: conProyecto ? <ProyectoEnLista proyecto={proyectos.data?.find((p) => p.id === texto(x, 'project'))} /> : undefined,
          detalle: <OrigenDeTarea tarea={x} />
        }))}
      />
    )
  return (
    <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
      <Table aria-label={t('tareas.titulo')}>
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

// el tablero por estado: una columna por estado de WF-N (las canceladas no se muestran); cada tarjeta abre la tarea, donde
// están las transiciones con el teclado y con motivo, en lugar de arrastrar (screens.md S47)
function Tablero({ tareas, alAbrir }: { tareas: Registro[]; alAbrir: (tarea: Registro) => void }) {
  const { t } = useTranslation(NS)
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {COLUMNAS.map((estado) => {
        const deLaColumna = tareas.filter((x) => x.state === estado)
        return (
          <section key={estado} aria-label={t(`tareas.columnasDelTablero.${estado}`)} className="space-y-2 rounded-sg-lg bg-sg-surface-sunken p-2">
            <h2 className="text-sm font-semibold">
              {t(`tareas.columnasDelTablero.${estado}`)} · {numeroPe(deLaColumna.length)}
            </h2>
            <ul className="space-y-2">
              {deLaColumna.map((x) => (
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
          </section>
        )
      })}
    </div>
  )
}

const sumarMes = (mes: string, n: number): string => {
  const [a, m] = mes.split('-').map(Number)
  const fecha = new Date(Date.UTC(a, m - 1 + n, 1))
  return fecha.toISOString().slice(0, 7)
}

// el calendario del mes por fecha de vencimiento (días de calendario, sin huso): una cuadrícula de lunes a domingo
function Calendario({
  tareas,
  mes,
  alCambiarMes,
  alAbrir
}: {
  tareas: Registro[]
  mes: string
  alCambiarMes: (mes: string) => void
  alAbrir: (tarea: Registro) => void
}) {
  const { t, i18n } = useTranslation(NS)
  const valido = /^\d{4}-\d{2}$/.test(mes) ? mes : hoyEnLima().slice(0, 7)
  const [a, m] = valido.split('-').map(Number)
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const primero = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7
  const celdas = [...Array.from({ length: primero }, () => null), ...Array.from({ length: dias }, (_, i) => i + 1)]
  const delDia = (dia: number) => tareas.filter((x) => texto(x, 'due_date') === `${valido}-${String(dia).padStart(2, '0')}`)
  const sinFecha = tareas.filter((x) => !texto(x, 'due_date')).length
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
    </section>
  )
}
