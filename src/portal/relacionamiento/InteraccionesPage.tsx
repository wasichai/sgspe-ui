import { useQueries, useQuery } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Th, cn } from '@wasichai/ui'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, NoDisponible, ThConExplicacion } from '../componentes/Estados'
import { VacioDeLista } from '../componentes/Lista'
import { useAsignadoAlProyecto } from '../contexto/ProyectoLayout'
import { filtroDeTerritorio } from '../contexto/rutas'
import { hoyEnLima } from '../datos/fechas'
import { usePedir } from '../datos/http'
import { useIndicador } from '../datos/indicadores'
import { atributo, leerTodos, texto, useRegistro, useTodosConTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useTableroDisponible } from '../tableros/comunes'
import { diaDe, esDia, esFormal, esMes, mesActual, semanaDe, semanasDelMes, sumarMeses } from './fechas'

// S21 y S22 · calendario y lista de interacciones (screens.md §6, flujo 4): el mes frente a la meta (KPI-ENG-02), las
// festividades de la línea base como contexto y "Te toca". la misma consulta se ve como mes, semana o lista; el alcance es
// el del contexto (ASM-076). la API genérica no filtra por rango (decisión 5): se leen las del alcance y se ubican por día
// en Lima. una consulta que carga o falla nunca se dibuja como un calendario o una lista vacíos
type Vista = 'mes' | 'semana' | 'lista'
const VISTAS: readonly Vista[] = ['mes', 'semana', 'lista']
const CINCO_MINUTOS = 300_000
const sinPermiso = (error: unknown): boolean => error instanceof ApiError && error.status === 403

export function InteraccionesPage({ vista: porDefecto }: { vista?: Vista }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { pathname } = useLocation()
  const { scope, territory } = useContextFilters()
  const [busqueda, fijar] = useSearchParams()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const asignado = useAsignadoAlProyecto(proyecto)
  const conTablero = useTableroDisponible('engagement')
  const pedida = busqueda.get('view')
  const vista = VISTAS.find((v) => v === pedida) ?? porDefecto ?? (pathname.endsWith('/calendar') ? 'mes' : 'lista')
  const mesPedido = busqueda.get('month')
  const diaPedido = busqueda.get('day')
  const mes = esMes(mesPedido) ? mesPedido : mesActual()
  const territorio = filtroDeTerritorio(territory, { locality: 'locality', community: 'community' })
  // descendente por fecha programada: si el tope de lectura corta la lista, lo que queda fuera son, en general, las más antiguas.
  // una interacción solo con held_at (sin scheduled_at) queda donde el servidor ordene los nulos, así que no se promete más
  const interacciones = useTodosConTope('engagement', { project: proyecto, ...(territorio ?? {}), sort: 'scheduled_at', dir: 'desc' })
  const base = proyecto ? `/projects/${proyecto}` : ''
  const cambiar = (cambios: Record<string, string>) => {
    const siguiente = new URLSearchParams(busqueda)
    for (const [k, v] of Object.entries(cambios)) siguiente.set(k, v)
    fijar(siguiente, { replace: true })
  }
  // la semana se ancla en el día pedido; sin él, hoy si cae en el mes, y si no el primero
  const hoy = hoyEnLima()
  const dia = esDia(diaPedido) ? diaPedido : hoy.startsWith(mes) ? hoy : `${mes}-01`
  const mesVisible = vista === 'semana' ? dia.slice(0, 7) : mes
  const semanas = vista === 'mes' ? semanasDelMes(mes) : [semanaDe(dia)]
  // se dibuja cada interacción en el día de Lima de la celda que ocupa, también los días de otros meses que la grilla muestra
  const visibles = new Set(semanas.flat())
  const enPantalla = (interacciones.data ?? []).filter((i) => visibles.has(diaDe(i) ?? ''))
  const sinFecha = (interacciones.data ?? []).filter((i) => diaDe(i) === null).length
  const mesesVisibles = [...new Set(semanas.flat().map((d) => Number(d.slice(5, 7))))]

  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-sg-h1 font-semibold">{t('relacionamiento.titulo')}</h1>
        <div className="flex flex-wrap gap-2">
          {conTablero ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`${base}/engagements/dashboard`}>{t('relacionamiento.tablero')}</Link>
            </Button>
          ) : null}
          {can('field_visit', 'READ') ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`${base}/field-visits`}>{t('relacionamiento.visitas')}</Link>
            </Button>
          ) : null}
          {proyecto && asignado && can('field_visit', 'CREATE') ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`${base}/field-visits/new`}>{t('relacionamiento.nuevaVisita')}</Link>
            </Button>
          ) : null}
          {proyecto && asignado && can('engagement', 'CREATE') ? (
            <Button asChild size="sm">
              <Link to={`${base}/engagements/new`}>{t('relacionamiento.registrar')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {territorio === null ? <Alert tone="notice">{t('contexto.noAplica')}</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t('relacionamiento.vista')} className="inline-flex rounded-sg-md border border-sg-border-strong">
          {VISTAS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => cambiar({ view: v })}
              className={cn('px-3 py-1 text-sm', vista === v ? 'bg-sg-primary-soft font-medium' : '')}
            >
              {t(`relacionamiento.vistas.${v}`)}
            </button>
          ))}
        </div>
        {vista === 'mes' ? (
          <div className="flex items-center gap-2 text-sm">
            <button type="button" aria-label={t('relacionamiento.mesAnterior')} onClick={() => cambiar({ month: sumarMeses(mes, -1) })} className="px-2">
              ‹
            </button>
            <span className="font-medium tabular-nums">{mes}</span>
            <button type="button" aria-label={t('relacionamiento.mesSiguiente')} onClick={() => cambiar({ month: sumarMeses(mes, 1) })} className="px-2">
              ›
            </button>
          </div>
        ) : vista === 'semana' ? (
          <div className="flex items-center gap-2 text-sm">
            <button type="button" aria-label={t('relacionamiento.semanaAnterior')} onClick={() => cambiar(moverSemana(dia, -7))} className="px-2">
              ‹
            </button>
            <span className="font-medium tabular-nums">{semanas[0][0]}</span>
            <button type="button" aria-label={t('relacionamiento.semanaSiguiente')} onClick={() => cambiar(moverSemana(dia, 7))} className="px-2">
              ›
            </button>
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {interacciones.truncado ? <Alert tone="warning">{t('relacionamiento.truncado', { n: numeroPe(interacciones.data?.length ?? 0) })}</Alert> : null}
          {vista !== 'lista' && sinFecha > 0 ? <Alert tone="notice">{t('relacionamiento.sinFecha', { n: numeroPe(sinFecha) })}</Alert> : null}
          {interacciones.isPending ? (
            <Cargando />
          ) : interacciones.isError && !interacciones.data ? (
            sinPermiso(interacciones.error) ? (
              <NoDisponible />
            ) : (
              <ErrorDeCarga error={interacciones.error} alReintentar={() => void interacciones.refetch()} />
            )
          ) : vista === 'lista' ? (
            <Lista interacciones={interacciones.data ?? []} global={!proyecto} />
          ) : (
            <Calendario mes={mesVisible} meses={mesesVisibles} interacciones={enPantalla} semanas={semanas} proyecto={proyecto} />
          )}
        </div>
        <PanelLateral proyecto={proyecto} mes={mesVisible} interacciones={interacciones} />
      </div>
    </section>
  )
}

// en la lista el motivo de una cancelada se ve siempre; en la celda del calendario no hay sitio y aparece al enfocar el enlace
// (el title no se ve con el teclado) además de leerse como descripción
function Evento({ interaccion, motivoVisible }: { interaccion: Registro; motivoVisible?: boolean }) {
  const { t } = useTranslation(NS)
  const idMotivo = useId()
  const cancelada = interaccion.state === 'cancelled'
  const sinActa = interaccion.state === 'held' && esFormal(interaccion)
  const motivo = cancelada
    ? texto(interaccion, 'cancel_reason')
      ? t('relacionamiento.cancelada', { motivo: texto(interaccion, 'cancel_reason') })
      : t('relacionamiento.canceladaSinMotivo')
    : undefined
  return (
    <span className="group block">
      <Link
        to={`/projects/${texto(interaccion, 'project')}/engagements/${interaccion.id}`}
        title={motivo}
        aria-describedby={motivo ? idMotivo : undefined}
        className={cn('block truncate rounded-sg-sm bg-sg-surface-sunken px-1 text-sg-caption', cancelada && 'line-through')}
      >
        {texto(interaccion, 'title')}
        {sinActa ? <span className="ml-1 text-sg-warning">· {t('relacionamiento.sinActa')}</span> : null}
      </Link>
      {motivo ? (
        <span id={idMotivo} className={cn('block text-sg-caption text-sg-text-muted', !motivoVisible && 'sr-only group-focus-within:not-sr-only')}>
          {motivo}
        </span>
      ) : null}
    </span>
  )
}

function Calendario({
  mes,
  meses,
  semanas,
  interacciones,
  proyecto
}: {
  mes: string
  meses: number[]
  semanas: string[][]
  interacciones: Registro[]
  proyecto?: string
}) {
  const { t } = useTranslation(NS)
  const festividades = useFestividades(proyecto, meses)
  const dias = t('relacionamiento.dias', { returnObjects: true }) as string[]
  const delDia = (dia: string) => interacciones.filter((i) => diaDe(i) === dia)
  // la franja de contexto: las festividades del mes de cada día, también en una semana que cruza de mes
  const festivas = (dia: string) =>
    festividades.lista.filter(
      (f) =>
        Number(atributo(f, 'month')) === Number(dia.slice(5, 7)) &&
        Number(atributo(f, 'start_day') ?? 0) <= Number(dia.slice(8)) &&
        Number(atributo(f, 'end_day') ?? atributo(f, 'start_day') ?? 0) >= Number(dia.slice(8))
    )
  return (
    <div className="space-y-2">
      {festividades.pendiente ? (
        <Cargando compacto etiqueta={t('relacionamiento.festividadesCargando')} />
      ) : festividades.error ? (
        <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.festividadesFallo')}</p>
      ) : null}
      <table aria-label={t('relacionamiento.calendario')} className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            {dias.map((d) => (
              <th key={d} scope="col" className="border-b border-sg-border py-1 text-sg-caption text-sg-text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana) => (
            <tr key={semana[0]}>
              {semana.map((dia) => (
                <td
                  key={dia}
                  aria-label={dia}
                  className={cn('h-24 border border-sg-border-subtle p-1 align-top', !dia.startsWith(mes) && 'bg-sg-surface-sunken text-sg-text-muted')}
                >
                  <span className="text-sg-caption tabular-nums">{Number(dia.slice(8))}</span>
                  {festivas(dia).map((f) => (
                    <span key={f.id} className="block truncate rounded-sg-xs bg-sg-territory-soft px-1 text-sg-caption text-sg-territory">
                      {texto(f, 'name')}
                    </span>
                  ))}
                  <ul className="space-y-0.5">
                    {delDia(dia).map((i) => (
                      <li key={i.id}>
                        <Evento interaccion={i} />
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Lista({ interacciones, global }: { interacciones: Registro[]; global: boolean }) {
  const { t } = useTranslation(NS)
  const idDeProyecto = useId()
  if (interacciones.length === 0)
    return (
      <VacioDeLista conFiltros={false} alLimpiar={() => undefined}>
        {t('relacionamiento.vacio')}
      </VacioDeLista>
    )
  // por su día de Lima, la más reciente primero; las que no tienen fecha, al final
  const ordenadas = [...interacciones].sort((a, b) => (diaDe(b) ?? '').localeCompare(diaDe(a) ?? ''))
  return (
    <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
      <Table aria-label={t('relacionamiento.titulo')}>
        <thead>
          <tr>
            {(['titulo', ...(global ? ['proyecto'] : []), 'tipo', 'estado', 'fecha', 'lugar', 'asistentes'] as const).map((c) =>
              c === 'proyecto' ? (
                // no se sabe de antemano qué proyectos no se podrán leer: la explicación única va en el encabezado, solo
                // para los lectores de pantalla, y cada celda sin acceso la referencia
                <ThConExplicacion key={c} explicacion={idDeProyecto} tipo="noDisponible" soloLectores>
                  {t(`relacionamiento.columnas.${c}`)}
                </ThConExplicacion>
              ) : (
                <Th key={c} scope="col">
                  {t(`relacionamiento.columnas.${c}`)}
                </Th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((i) => (
            <tr key={i.id}>
              <Td>
                <Evento interaccion={i} motivoVisible />
              </Td>
              {global ? (
                <Td className="font-sg-mono text-sg-caption">
                  <CodigoDeProyecto id={texto(i, 'project')} describedPor={idDeProyecto} />
                </Td>
              ) : null}
              <Td className="text-sm">{texto(i, 'engagement_type')}</Td>
              <Td>
                <EstadoChip objeto="engagement" estado={i.state} />
              </Td>
              <Td className="text-sm tabular-nums">{diaDe(i) ?? '—'}</Td>
              <Td className="text-sm">{texto(i, 'place') || '—'}</Td>
              <Td className="text-sm tabular-nums">
                {atributo(i, 'attendees_total_count') === null || atributo(i, 'attendees_total_count') === undefined
                  ? '—'
                  : numeroPe(Number(atributo(i, 'attendees_total_count')))}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

// la semana siguiente o anterior: mueve el día y el mes que lo contiene
function moverSemana(dia: string, dias: number): Record<string, string> {
  const siguiente = new Date(Date.parse(`${dia}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10)
  return { day: siguiente, month: siguiente.slice(0, 7) }
}

// el código del proyecto: mientras llega o si no se puede leer no se dibuja un código vacío. en una tabla, describedPor es el id
// de la explicación única del encabezado (ThConExplicacion): la celda sin acceso no lleva botón de ayuda
export function CodigoDeProyecto({ id, describedPor }: { id: string; describedPor?: string }) {
  const { t } = useTranslation(NS)
  const proyecto = useRegistro('project', id)
  if (proyecto.isPending) return <Cargando compacto etiqueta="…" />
  if (proyecto.isError && !proyecto.data)
    return sinPermiso(proyecto.error) ? <NoDisponible describedPor={describedPor} /> : <span>{t('comun.errorDeCarga')}</span>
  return <>{texto(proyecto.data, 'code') || '—'}</>
}

// las festividades de un mes: con proyecto, las de las localidades de sus áreas de influencia aprobadas; sin él, todas. dice
// si todavía carga o si falló, para que el panel no la dibuje como "sin festividades"
interface Festividades {
  lista: Registro[]
  pendiente: boolean
  error: unknown
  reintentar: () => void
}

function useFestividades(proyecto: string | undefined, meses: number[]): Festividades {
  const pedir = usePedir()
  // una consulta por mes, con la misma clave en la grilla y en el panel: el mes visible se lee una sola vez
  const porMes = useQueries({
    queries: meses.map((month) => ({
      queryKey: ['records', 'festivity', 'mes', month],
      queryFn: () => leerTodos(pedir, 'festivity', { month }),
      // la línea base de festividades casi no cambia: sin esto, montar la grilla tras el panel la volvería a pedir
      staleTime: CINCO_MINUTOS
    }))
  })
  const localidades = useQuery({
    queryKey: ['records', 'area_of_influence_member', 'localidades-aprobadas', proyecto],
    queryFn: async () => {
      const areas = (await leerTodos(pedir, 'area_of_influence', { project: proyecto })).filter((a) => a.state === 'approved')
      const miembros = (await Promise.all(areas.map((a) => leerTodos(pedir, 'area_of_influence_member', { area_of_influence: a.id })))).flat()
      return new Set(miembros.map((m) => String(atributo(m, 'locality') ?? '')).filter(Boolean))
    },
    enabled: Boolean(proyecto)
  })
  const fallida = [...porMes, localidades].find((q) => q.isError && !q.data)
  // un mes repetido no duplica la festividad
  const todas = [...new Map(porMes.flatMap((q) => q.data ?? []).map((f) => [f.id, f])).values()]
  return {
    lista: todas.filter((f) => !proyecto || localidades.data?.has(String(atributo(f, 'locality')))),
    pendiente: porMes.some((q) => q.isPending) || (Boolean(proyecto) && localidades.isPending),
    error: fallida?.error,
    reintentar: () => void (fallida ?? porMes[0]).refetch()
  }
}

function PanelLateral({ proyecto, mes, interacciones }: { proyecto?: string; mes: string; interacciones: ReturnType<typeof useTodosConTope> }) {
  const { t } = useTranslation(NS)
  const eng02 = useIndicador('KPI-ENG-02', { ...(proyecto ? { project: [proyecto] } : {}), periodStart: `${mes}-01`, periodEnd: `${sumarMeses(mes, 1)}-01` })
  const festividades = useFestividades(proyecto, [Number(mes.slice(5, 7))])
  const delMes = eng02.data?.series?.find((s) => s.period === mes)
  const pendientes = (interacciones.data ?? []).filter((i) => (i.state === 'held' && esFormal(i)) || i.state === 'postponed')
  return (
    <aside className="space-y-3 text-sm">
      <section aria-label={t('relacionamiento.meta')} className="rounded-sg-lg border border-sg-border bg-sg-surface p-3">
        <h2 className="font-medium">{t('relacionamiento.meta')}</h2>
        {eng02.isPending ? (
          <Cargando compacto />
        ) : eng02.isError && !eng02.data ? (
          sinPermiso(eng02.error) ? (
            <NoDisponible />
          ) : (
            <ErrorDeCarga error={eng02.error} alReintentar={() => void eng02.refetch()} />
          )
        ) : !eng02.data?.available ? (
          <NoDisponible motivo={eng02.data?.unavailableReason} />
        ) : delMes ? (
          <p className="text-sg-kpi-sm font-semibold">
            {delMes.value === null || delMes.value === undefined
              ? '—'
              : t('relacionamiento.metaValor', { valor: numeroPe(delMes.value), meta: delMes.target == null ? '—' : numeroPe(delMes.target) })}
          </p>
        ) : (
          <p className="text-sg-text-muted">—</p>
        )}
      </section>
      <section aria-label={t('relacionamiento.teToca')} className="rounded-sg-lg border border-sg-border bg-sg-surface p-3">
        <h2 className="font-medium">{t('relacionamiento.teToca')}</h2>
        {interacciones.isPending ? (
          <Cargando compacto />
        ) : interacciones.isError && !interacciones.data ? (
          sinPermiso(interacciones.error) ? (
            <NoDisponible />
          ) : (
            <p className="text-sg-text-muted">{t('comun.errorDeCarga')}</p>
          )
        ) : (
          <ul>
            {pendientes.map((i) => (
              <li key={i.id}>
                <Link
                  to={`/projects/${texto(i, 'project')}/engagements/${i.id}${i.state === 'held' ? '/minutes' : ''}`}
                  className="text-sg-primary-text underline"
                >
                  {i.state === 'held'
                    ? t('relacionamiento.actaPorRedactar', { titulo: texto(i, 'title') })
                    : t('relacionamiento.postergada', { titulo: texto(i, 'title') })}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label={t('relacionamiento.festividades')} className="rounded-sg-lg border border-sg-border bg-sg-surface p-3">
        <h2 className="font-medium">{t('relacionamiento.festividades')}</h2>
        {festividades.pendiente ? (
          <Cargando compacto />
        ) : festividades.error ? (
          sinPermiso(festividades.error) ? (
            <NoDisponible />
          ) : (
            <ErrorDeCarga error={festividades.error} alReintentar={festividades.reintentar} />
          )
        ) : (
          <ul>
            {festividades.lista.map((f) => (
              <li key={f.id}>
                {texto(f, 'name')} {texto(f, 'date_text') ? `· ${texto(f, 'date_text')}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
