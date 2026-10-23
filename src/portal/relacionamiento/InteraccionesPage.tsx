import { EnlaceConRastro } from '../contexto/Rastro'
import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { BotonCrear } from '../componentes/BotonCrear'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, cn } from '@wasichai/ui'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, NoDisponible, esProhibido } from '../componentes/Estados'
import { VacioDeLista } from '../componentes/Lista'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { TablaPriorizada, type ColumnaPriorizada } from '../componentes/TablaPriorizada'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { filtroDeTerritorio } from '../contexto/rutas'
import { hoyEnLima } from '../datos/fechas'
import { usePedir } from '../datos/http'
import { useIndicador } from '../datos/indicadores'
import { atributo, leerTodos, texto, useConteo, useRegistro, useRegistros, useTodosConTope, type Parametros, type Registro } from '../datos/registros'
import { PaginacionDelServidor } from '../componentes/Lista'
import { diaPe, mesPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useTableroDisponible } from '../tableros/comunes'
import { diaDe, diaSiguiente, esDia, esFormal, esMes, mesActual, semanaDe, semanasDelMes, sumarMeses } from './fechas'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { ListaPlegable } from '../componentes/ListaPlegable'

// S21 y S22 · calendario y lista de interacciones (screens.md §6, flujo 4): el mes frente a la meta (KPI-ENG-02), las
// festividades de la línea base como contexto y "Te toca". la misma consulta se ve como mes, semana o lista; el alcance es
// el del contexto (ASM-076). la API genérica no filtra por rango (decisión 5): se leen las del alcance y se ubican por día
// en Lima. una consulta que carga o falla nunca se dibuja como un calendario o una lista vacíos
type Vista = 'mes' | 'semana' | 'lista'
const VISTAS: readonly Vista[] = ['mes', 'semana', 'lista']
const CINCO_MINUTOS = 300_000
const POR_PAGINA = 25

export function InteraccionesPage({ vista: porDefecto }: { vista?: Vista }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { pathname } = useLocation()
  const { scope, territory } = useContextFilters()
  const [busqueda, fijar] = useSearchParams()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribeEnElProyecto = useEscribeEnProyecto(proyecto)
  const conTablero = useTableroDisponible('engagement')
  const pedida = busqueda.get('view')
  const vista = VISTAS.find((v) => v === pedida) ?? porDefecto ?? (pathname.endsWith('/calendar') ? 'mes' : 'lista')
  const mesPedido = busqueda.get('month')
  const diaPedido = busqueda.get('day')
  const mes = esMes(mesPedido) ? mesPedido : mesActual()
  const territorio = filtroDeTerritorio(territory, { locality: 'locality', community: 'community' })
  // cada vista pide lo suyo al servidor (D10 de la revisión de UX): la lista, su página; el calendario, los días que dibuja por el
  // rango de su fecha (la realizada o, si no, la programada: range_field=held_at,scheduled_at); y el panel, lo pendiente por estado
  const alcance: Parametros = { project: proyecto, ...(territorio ?? {}) }
  const paginaDeLista = Number(busqueda.get('page') ?? '0') || 0
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
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
  const desde = semanas[0][0]
  const hasta = diaSiguiente(semanas[semanas.length - 1][6])
  const enLista = vista === 'lista'
  const pagina = useRegistros('engagement', { ...alcance, sort: 'scheduled_at', dir: 'desc', page: paginaDeLista, size: POR_PAGINA }, enLista)
  // el servidor lee un día como su comienzo en Lima: el rango [primer día, día siguiente al último) cubre justo los días de la grilla
  const delCalendario = useTodosConTope(
    'engagement',
    { ...alcance, range_field: 'held_at,scheduled_at', range_from: desde, range_to: hasta, sort: 'scheduled_at', dir: 'asc' },
    !enLista
  )
  const total = useConteo('engagement', alcance)
  const sinFecha = useConteo('engagement', { ...alcance, empty: 'held_at,scheduled_at' }, !enLista) ?? 0
  const interacciones = enLista ? { ...pagina, data: pagina.data?.content, truncado: false } : delCalendario
  const enPantalla = (delCalendario.data ?? []).filter((i) => visibles.has(diaDe(i) ?? ''))
  const mesesVisibles = [...new Set(semanas.flat().map((d) => Number(d.slice(5, 7))))]

  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        vistas={<VistasDelModulo modulo="engagements" actual="lista" conTablero={conTablero} />}
        titulo={t('relacionamiento.titulo')}
        conteo={total !== null ? t('relacionamiento.conteo', { count: total }) : undefined}
        primaria={<BotonCrear objeto="engagement" etiqueta={t('relacionamiento.registrar')} resto="engagements/new" />}
        secundarias={
          <>
            {can('field_visit', 'READ') ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={`${base}/field-visits`}>{t('relacionamiento.visitas')}</Link>
              </Button>
            ) : null}
            {proyecto && escribeEnElProyecto && can('field_visit', 'CREATE') ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={`${base}/field-visits/new`}>{t('relacionamiento.nuevaVisita')}</Link>
              </Button>
            ) : null}
          </>
        }
      />
      {territorio === null ? <Alert tone="notice">{t('contexto.noAplica')}</Alert> : null}
      {/* la barra de filtros (hallazgo U-18, DD-03): Mes, Semana y Lista en el selector de vista de toda lista, con el paso de
          mes o de semana al lado. ?view=, ?month= y ?day= son los mismos; la lista no tiene filtros propios (el territorio es el
          chip de la barra de contexto) */}
      <BarraDeFiltros
        vista={
          <div className="flex flex-wrap items-center gap-3">
            <SelectorDeVista
              etiqueta={t('relacionamiento.vista')}
              vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`relacionamiento.vistas.${v}`) }))}
              actual={vista}
              alElegir={(v) => cambiar({ view: v })}
            />
            {vista === 'mes' ? (
              <div className="flex items-center gap-2 text-sm">
                <button type="button" aria-label={t('relacionamiento.mesAnterior')} onClick={() => cambiar({ month: sumarMeses(mes, -1) })} className="px-2">
                  ‹
                </button>
                <span className="min-w-32 text-center font-medium">{mesPe(mes)}</span>
                <button type="button" aria-label={t('relacionamiento.mesSiguiente')} onClick={() => cambiar({ month: sumarMeses(mes, 1) })} className="px-2">
                  ›
                </button>
              </div>
            ) : vista === 'semana' ? (
              <div className="flex items-center gap-2 text-sm">
                <button type="button" aria-label={t('relacionamiento.semanaAnterior')} onClick={() => cambiar(moverSemana(dia, -7))} className="px-2">
                  ‹
                </button>
                <span className="min-w-32 text-center font-medium">{diaPe(semanas[0][0])}</span>
                <button type="button" aria-label={t('relacionamiento.semanaSiguiente')} onClick={() => cambiar(moverSemana(dia, 7))} className="px-2">
                  ›
                </button>
              </div>
            ) : null}
          </div>
        }
        aplicados={[]}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          {interacciones.truncado ? <Alert tone="warning">{t('relacionamiento.truncado', { n: numeroPe(interacciones.data?.length ?? 0) })}</Alert> : null}
          {vista !== 'lista' && sinFecha > 0 ? <Alert tone="notice">{t('relacionamiento.sinFecha', { n: numeroPe(sinFecha) })}</Alert> : null}
          {interacciones.isPending ? (
            <Cargando />
          ) : interacciones.isError && !interacciones.data ? (
            esProhibido(interacciones.error) ? (
              <NoDisponible />
            ) : (
              <ErrorDeCarga error={interacciones.error} alReintentar={() => void interacciones.refetch()} />
            )
          ) : vista === 'lista' ? (
            <>
              <Lista interacciones={interacciones.data ?? []} global={!proyecto} />
              <PaginacionDelServidor
                datos={pagina.data}
                alPagina={(p) => {
                  const siguiente = new URLSearchParams(busqueda)
                  siguiente.set('page', String(p))
                  fijar(siguiente, { replace: true })
                }}
              />
            </>
          ) : (
            <Calendario mes={mesVisible} meses={mesesVisibles} interacciones={enPantalla} semanas={semanas} proyecto={proyecto} />
          )}
        </div>
        <PanelLateral proyecto={proyecto} mes={mesVisible} alcance={alcance} />
      </div>
    </section>
  )
}

// en la lista el motivo de una cancelada se ve siempre; en la celda del calendario no hay sitio y aparece al enfocar el enlace
// (el title no se ve con el teclado) además de leerse como descripción
// en el calendario, un chip que se trunca en su celda; en la lista (enLista), un enlace como el de toda lista, con el motivo de
// una cancelada a la vista
function Evento({ interaccion, enLista }: { interaccion: Registro; enLista?: boolean }) {
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
      <EnlaceConRastro
        to={`/projects/${encodeURIComponent(texto(interaccion, 'project'))}/engagements/${encodeURIComponent(interaccion.id)}`}
        // en la lista, el título va en una línea (P-02) y dice el texto completo al pasar; el motivo ya está a la vista debajo
        title={enLista ? texto(interaccion, 'title') : motivo}
        aria-describedby={motivo ? idMotivo : undefined}
        className={cn(
          enLista ? 'block truncate text-sm text-sg-primary-text underline' : 'block truncate rounded-sg-sm bg-sg-surface-sunken px-1 text-sg-caption',
          cancelada && 'line-through'
        )}
      >
        {texto(interaccion, 'title')}
        {sinActa ? <span className="ml-1 text-sg-warning">· {t('relacionamiento.sinActa')}</span> : null}
      </EnlaceConRastro>
      {motivo ? (
        <span id={idMotivo} className={cn('block text-sg-caption text-sg-text-muted', !enLista && 'sr-only group-focus-within:not-sr-only')}>
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
  const telefono = useEsTelefono()
  if (interacciones.length === 0)
    return (
      <VacioDeLista conFiltros={false} alLimpiar={() => undefined}>
        {t('relacionamiento.vacio')}
      </VacioDeLista>
    )
  // por su día de Lima, la más reciente primero; las que no tienen fecha, al final
  const ordenadas = [...interacciones].sort((a, b) => (diaDe(b) ?? '').localeCompare(diaDe(a) ?? ''))
  // en el teléfono, tarjetas con el título, el estado, el día y el proyecto (revisión de UX, etapa 8)
  if (telefono)
    return (
      <ListaEnTarjetas
        etiqueta={t('relacionamiento.titulo')}
        tarjetas={ordenadas.map((i) => ({
          id: i.id,
          titulo: <Evento interaccion={i} enLista />,
          estado: <EstadoChip objeto="engagement" estado={i.state} />,
          plazo: <Dia valor={diaDe(i)} />,
          proyecto: global ? <CodigoDeProyecto id={texto(i, 'project')} describedPor={idDeProyecto} /> : undefined,
          detalle: [opcion(i, 'engagement_type'), texto(i, 'place')].filter(Boolean).join(' · ') || undefined
        }))}
      />
    )
  // la tabla de escritorio con prioridad de columnas (hallazgo U-06, DD-05): a 1440 px, junto al panel, cabe sin desplazar.
  // esenciales la interacción, el proyecto (en lo global), el estado y la fecha; secundaria, desde xl, el tipo; el lugar y los
  // asistentes son opcionales: desde 1536 px, hasta que los elija «Columnas». una no esencial que dice lo mismo en toda la
  // página sale a la nota. el título toma el ancho que queda (w-full con max-w-0) y se corta en una línea. no se sabe de
  // antemano qué proyectos no se podrán leer: la explicación única va en el encabezado, solo para los lectores de pantalla
  const columnas: ColumnaPriorizada[] = [
    { id: 'titulo', encabezado: t('relacionamiento.columnas.titulo'), prioridad: 'esencial', claseDeCelda: 'w-full max-w-0' },
    ...(global
      ? [
          {
            id: 'proyecto',
            encabezado: t('relacionamiento.columnas.proyecto'),
            prioridad: 'esencial' as const,
            claseDeCelda: 'font-sg-mono text-sg-caption',
            explicacion: { id: idDeProyecto, tipo: 'noDisponible' as const, soloLectores: true }
          }
        ]
      : []),
    { id: 'tipo', encabezado: t('relacionamiento.columnas.tipo'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'estado', encabezado: t('relacionamiento.columnas.estado'), prioridad: 'esencial' },
    { id: 'fecha', encabezado: t('relacionamiento.columnas.fecha'), prioridad: 'esencial', claseDeCelda: 'text-sm whitespace-nowrap' },
    { id: 'lugar', encabezado: t('relacionamiento.columnas.lugar'), prioridad: 'opcional', claseDeCelda: 'text-sm' },
    { id: 'asistentes', encabezado: t('relacionamiento.columnas.asistentes'), prioridad: 'opcional', numerica: true, claseDeCelda: 'text-sm' }
  ]
  const asistentes = (i: Registro) => {
    const n = atributo(i, 'attendees_total_count')
    return n === null || n === undefined ? '—' : numeroPe(Number(n))
  }
  const celda = (i: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'titulo':
        return <Evento interaccion={i} enLista />
      case 'proyecto':
        return <CodigoDeProyecto id={texto(i, 'project')} describedPor={idDeProyecto} />
      case 'tipo':
        return opcion(i, 'engagement_type')
      case 'estado':
        return <EstadoChip objeto="engagement" estado={i.state} />
      case 'fecha':
        return <Dia valor={diaDe(i)} />
      case 'lugar':
        return texto(i, 'place') || '—'
      default:
        return asistentes(i)
    }
  }
  // lo que decide si una secundaria dice lo mismo en toda la página: el dato guardado, no su rótulo
  const valorPlano = (i: Registro, columna: string): string =>
    columna === 'tipo' ? texto(i, 'engagement_type') : columna === 'lugar' ? texto(i, 'place') : columna === 'asistentes' ? asistentes(i) : i.id
  return (
    <TablaPriorizada<Registro>
      etiqueta={t('relacionamiento.titulo')}
      idDeTabla="interacciones"
      columnas={columnas}
      filas={ordenadas}
      clave={(i) => i.id}
      celda={celda}
      valorPlano={valorPlano}
      ocultarUniformes
    />
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
    return esProhibido(proyecto.error) ? <NoDisponible describedPor={describedPor} /> : <span>{t('comun.errorDeCarga')}</span>
  // «código · nombre», enlazado al resumen del proyecto (revisión de UX, etapa 3)
  return <ProyectoEnLista proyecto={proyecto.data} />
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

function PanelLateral({ proyecto, mes, alcance }: { proyecto?: string; mes: string; alcance: Parametros }) {
  const { t } = useTranslation(NS)
  const eng02 = useIndicador('KPI-ENG-02', { ...(proyecto ? { project: [proyecto] } : {}), periodStart: `${mes}-01`, periodEnd: `${sumarMeses(mes, 1)}-01` })
  const festividades = useFestividades(proyecto, [Number(mes.slice(5, 7))])
  const delMes = eng02.data?.series?.find((s) => s.period === mes)
  // lo pendiente, por estado: las actas por redactar (realizadas y formales) y las postergadas
  const interacciones = useTodosConTope('engagement', { ...alcance, state: 'held,postponed', sort: 'scheduled_at', dir: 'desc' })
  const pendientes = (interacciones.data ?? []).filter((i) => (i.state === 'held' && esFormal(i)) || i.state === 'postponed')
  return (
    <aside className="space-y-3 text-sm">
      <section aria-label={t('relacionamiento.meta')} className="rounded-sg-lg border border-sg-border bg-sg-surface p-3">
        <h2 className="font-medium">{t('relacionamiento.meta')}</h2>
        {eng02.isPending ? (
          <Cargando compacto />
        ) : eng02.isError && !eng02.data ? (
          esProhibido(eng02.error) ? (
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
          esProhibido(interacciones.error) ? (
            <NoDisponible />
          ) : (
            <p className="text-sg-text-muted">{t('comun.errorDeCarga')}</p>
          )
        ) : (
          // las actas por redactar y las postergadas, cada grupo con su conteo y cinco a la vista
          <div className="mt-2 space-y-3">
            {(['held', 'postponed'] as const).map((estado) => {
              const delEstado = pendientes.filter((i) => i.state === estado)
              return (
                <ListaPlegable
                  key={estado}
                  titulo={t(estado === 'held' ? 'relacionamiento.grupoActas' : 'relacionamiento.grupoPostergadas', { count: delEstado.length })}
                  elementos={delEstado.map((i) => ({
                    clave: i.id,
                    contenido: (
                      <EnlaceConRastro
                        to={`/projects/${encodeURIComponent(texto(i, 'project'))}/engagements/${encodeURIComponent(i.id)}${i.state === 'held' ? '/minutes' : ''}`}
                        className="text-sg-primary-text underline"
                      >
                        {texto(i, 'title')}
                      </EnlaceConRastro>
                    )
                  }))}
                />
              )
            })}
            {pendientes.length === 0 ? <p className="text-sm text-sg-text-muted">{t('relacionamiento.nadaPendiente')}</p> : null}
          </div>
        )}
      </section>
      <section aria-label={t('relacionamiento.festividades')} className="rounded-sg-lg border border-sg-border bg-sg-surface p-3">
        <h2 className="font-medium">{t('relacionamiento.festividades')}</h2>
        {festividades.pendiente ? (
          <Cargando compacto />
        ) : festividades.error ? (
          esProhibido(festividades.error) ? (
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
