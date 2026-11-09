import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { ListaEnTarjetas, useCoincide, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { ChevronRight, Map as MapaIcono, Plus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { comparable } from '../componentes/FiltroDeGrupo'
import { ordenarEnCliente } from '../componentes/ordenEnCliente'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { TablaPriorizada, type ColumnaPriorizada, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, NoDisponible, Vacio } from '../componentes/Estados'
import { ordenEnUrl, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { ROL_DE_JEFATURA } from '../config'
import { useLeeTodosLosProyectos, useMisAsignaciones } from '../contexto/proyectos'
import { atributo, texto, useDefinicion, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { Persona } from '../componentes/Persona'
import { KpiCard } from '../componentes/KpiCard'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { DESDE_XL, useAcopleDeVistaPrevia, usePeek, useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { montoPe } from '../componentes/Monto'
import { hoyEnLima } from '../datos/fechas'
import { diaPe, numeroPe } from '../i18n'
import { useCifrasDelPortafolio } from './cifrasDelPortafolio'
import { useIndicadoresDelProyecto } from './TableroDelProyecto'

// S06 · lista de proyectos (screens.md §3): vistas "Mis proyectos", "Activos", "En revisión" y "Todos"; filtros por tipo,
// etapa y fase en la URL; la jefatura son las asignaciones activas con el rol de jefatura (ASM-080) y la campaña en curso,
// la que está EN EJECUCION. los proyectos de un tenant son pocos: se leen todos y se filtran aquí. desde la tercera pasada de UX
// (3.8), con el patrón común de las listas: las vistas en el selector, la búsqueda por código o nombre y los filtros en la barra,
// y la tabla priorizada con el orden en la URL. con Civic Modern es el portafolio de S04 (design-system.md §6.7): el antetítulo
// «Portafolio», las cifras de atención de cada proyecto (compromisos vencidos, QCS vencidas, riesgos altos) con sus encabezados
// en dos líneas, en danger cuando pasan de cero y atenuadas en cero, «—» con su nota al pie si la cuenta no las lee, y la vista
// previa del proyecto elegido (?peek=project:id) bajo la tabla desde xl, con «Ver en el mapa» y «Abrir Proyecto 360»; por debajo
// de xl, la vista previa es el cajón del shell. en el teléfono, tarjetas
const VISTAS = ['mine', 'active', 'in_review', 'all'] as const
const CAMPO_DE_ORDEN: Record<string, string> = { codigo: 'code', nombre: 'name' }
const ORDEN_INICIAL: OrdenDeTabla = { columna: 'nombre', dir: 'asc' }
const FILTROS = [
  ['project_type', 'tipo'],
  ['stage', 'etapa'],
  ['exploration_phase', 'fase']
] as const

export function ProyectosPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const telefono = useEsTelefono()
  const leeTodo = useLeeTodosLosProyectos()
  // quien lee todos los proyectos abre en «Todos»: sus asignaciones pueden no existir, y el
  // selector de la cabecera ya le dice «Todos los proyectos»
  const lista = useParametrosDeLista(leeTodo ? 'all' : 'mine')
  const proyectos = useTodos('project', { sort: 'name', dir: 'asc' })
  const definicion = useDefinicion('project')
  const asignaciones = useMisAsignaciones()
  const jefaturas = useTodos('project_assignment', { role_name: ROL_DE_JEFATURA, active: true })
  const campanas = useTodos('exploration_campaign', { campaign_status: 'EN EJECUCION' })

  // «Mis proyectos» sale de las asignaciones propias: sin ellas no hay lista que mostrar, ni siquiera vacía
  const mios = new Set((asignaciones.data ?? []).map((a) => String(atributo(a, 'project'))))
  const porProyecto = (registros: Registro[] | undefined, campo: string) => {
    const mapa = new Map<string, Set<string>>()
    for (const r of registros ?? []) {
      const valor = texto(r, campo)
      if (!valor) continue
      const proyecto = String(atributo(r, 'project'))
      mapa.set(proyecto, (mapa.get(proyecto) ?? new Set<string>()).add(valor))
    }
    return mapa
  }
  const jefes = porProyecto(jefaturas.data, 'member_user_email')
  const enCurso = porProyecto(campanas.data, 'name')
  // la jefatura y la campaña son de otras consultas: mientras cargan no se afirma nada, y si fallan o dan 403 se dice. solo
  // sin datos: un refetch fallido (volver a la pestaña) no reemplaza lo ya cargado por «No disponible»
  const celda = (
    consulta: { isPending: boolean; isError: boolean; data: unknown },
    valores: Set<string> | undefined,
    vacio: ReactNode,
    mostrar: (valores: Set<string>) => ReactNode = (v) => [...v].join(', ')
  ) =>
    consulta.isError && !consulta.data ? (
      <NoDisponible />
    ) : consulta.isPending ? (
      <span className="text-sg-text-muted">…</span>
    ) : valores ? (
      mostrar(valores)
    ) : (
      vacio
    )
  const desdeXl = useCoincide(DESDE_XL)
  const peek = usePeek()
  const rutaDePrevia = useRutaDeVistaPrevia()
  const lasMias = lista.vista === 'mine'
  const cargando = proyectos.isPending || (lasMias && asignaciones.isPending)
  // el error de carga reemplaza la lista solo si no hay lista: un refetch fallido deja la ya cargada
  const fallo = proyectos.isError && !proyectos.data ? proyectos : lasMias && asignaciones.isError && !asignaciones.data ? asignaciones : null
  // sin asignaciones vigentes ni la acción de leer todos, el servidor no devuelve ningún proyecto (alcance por proyecto, spec 4.4
  // §3.12): se dice que no tiene proyectos asignados, no «un proyecto nace con Nuevo proyecto» a quien no puede crearlo
  const sinProyectos = proyectos.isSuccess && proyectos.data.length === 0 && !leeTodo && !can('project', 'CREATE')

  const buscado = comparable(lista.filtro('q').trim())
  const enLaVista = (vista: string, p: Registro) => {
    if (vista === 'mine' && !mios.has(p.id)) return false
    if ((vista === 'active' || vista === 'in_review') && p.state !== vista) return false
    if (buscado && !comparable(`${texto(p, 'code')} ${texto(p, 'name')}`).includes(buscado)) return false
    return FILTROS.every(([campo]) => !lista.filtro(campo) || atributo(p, campo) === lista.filtro(campo))
  }
  const [orden, ordenar] = ordenEnUrl(lista, ORDEN_INICIAL, ['codigo', 'nombre'])
  const filtrados = ordenarEnCliente(
    (proyectos.data ?? []).filter((p) => enLaVista(lista.vista, p)),
    orden,
    (p, columna) => texto(p, CAMPO_DE_ORDEN[columna])
  )
  const cifras = useCifrasDelPortafolio(filtrados.map((p) => p.id))
  // desde xl la vista previa de un proyecto de la tabla va debajo de ella (S04), no en el cajón del shell
  useAcopleDeVistaPrevia(telefono ? null : filtrados.map((p) => `project:${p.id}`))
  const elegido = peek?.objeto === 'project' ? filtrados.find((p) => p.id === peek.id) : undefined
  // cada vista dice cuántos tiene con los filtros puestos (revisión de UX, etapa 3)
  const conteoDe = (vista: string) => (proyectos.data ?? []).filter((p) => enLaVista(vista, p)).length
  const chips = [
    ...FILTROS.filter(([campo]) => lista.filtro(campo)).map(([campo, clave]) => ({
      clave: campo as string,
      etiqueta: `${t(`proyectos.filtros.${clave}`)}: ${rotuloDeOpcion(lista.filtro(campo))}`
    })),
    ...(buscado ? [{ clave: 'q', etiqueta: t('comun.contiene', { texto: lista.filtro('q').trim() }) }] : [])
  ]
  const sinFiltros = Object.fromEntries([...FILTROS.map(([c]) => [c, null]), ['q', null]])
  const ruta = (p: Registro) => `/projects/${encodeURIComponent(p.id)}/overview`
  const columnas: ColumnaPriorizada[] = [
    { id: 'codigo', encabezado: t('proyectos.columnas.codigo'), prioridad: 'esencial', claseDeCelda: 'font-sg-mono text-sg-caption', ordenable: true },
    { id: 'nombre', encabezado: t('proyectos.columnas.nombre'), prioridad: 'esencial', titulo: true, ordenable: true },
    { id: 'tipo', encabezado: t('proyectos.columnas.tipo'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'etapa', encabezado: t('proyectos.columnas.etapa'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'estado', encabezado: t('proyectos.columnas.estado'), prioridad: 'esencial' },
    { id: 'jefatura', encabezado: t('proyectos.columnas.jefatura'), prioridad: 'esencial', claseDeCelda: 'text-sm' },
    { id: 'campana', encabezado: t('proyectos.columnas.campana'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'vencidos', encabezado: t('proyectos.columnas.vencidos'), prioridad: 'esencial', numerica: true, enDosLineas: true },
    { id: 'qcs', encabezado: t('proyectos.columnas.qcs'), prioridad: 'esencial', numerica: true, enDosLineas: true },
    { id: 'riesgos', encabezado: t('proyectos.columnas.riesgos'), prioridad: 'esencial', numerica: true, enDosLineas: true }
  ]
  const celdaDeTabla = (p: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'codigo':
        return texto(p, 'code')
      case 'nombre':
        return (
          <EnlaceDeRegistro
            codigoAparte
            codigo={texto(p, 'code')}
            titulo={texto(p, 'name')}
            ruta={ruta(p)}
            desde={t('proyectos.titulo')}
            previa={{ objeto: 'project', id: p.id }}
          />
        )
      case 'tipo':
        return opcion(p, 'project_type')
      case 'etapa':
        return opcion(p, 'stage')
      case 'estado':
        return <EstadoChip objeto="project" estado={p.state} />
      case 'jefatura':
        // sin jefatura, un aviso que se lee (S04): en cursiva y text-secondary, no un color de alerta
        return celda(jefaturas, jefes.get(p.id), <span className="text-sg-text-secondary italic">{t('proyectos.sinJefatura')}</span>, (correos) =>
          [...correos].map((c, i) => (
            <span key={c}>
              {i ? ', ' : ''}
              <Persona correo={c} />
            </span>
          ))
        )
      case 'vencidos':
        return <CifraDeAtencion valor={cifras[p.id]?.compromisos} />
      case 'qcs':
        return <CifraDeAtencion valor={cifras[p.id]?.qcs} />
      case 'riesgos':
        return <CifraDeAtencion valor={cifras[p.id]?.riesgos} />
      default:
        return celda(campanas, enCurso.get(p.id), '—')
    }
  }
  const conConfidenciales = filtrados.some((p) => cifras[p.id]?.confidenciales)
  const opciones = (campo: string) => definicion.data?.fields.find((f) => f.name === campo)?.enumOptions ?? []

  return (
    <ContenedorDePagina>
      <EncabezadoDePagina
        antetitulo={t('proyectos.antetitulo')}
        antetituloEnSans
        titulo={t('proyectos.titulo')}
        conteo={
          cargando || fallo || sinProyectos ? undefined : (
            <>
              <span>{t('proyectos.conteo', { count: filtrados.length })}</span>
              {' · '}
              <span>{t('proyectos.cifrasDeHoy', { fecha: diaPe(hoyEnLima()) })}</span>
            </>
          )
        }
        primaria={
          can('project', 'CREATE') ? (
            <Button asChild>
              <Link to="/projects/new">
                <Plus aria-hidden className="size-4" />
                {t('proyectos.nuevo')}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <BarraDeFiltros
        vista={
          <SelectorDeVista
            etiqueta={t('comun.vistas')}
            vistas={VISTAS.map((id) => ({ id, etiqueta: t(`proyectos.vistas.${id}`), n: cargando || fallo ? null : conteoDe(id) }))}
            actual={lista.vista}
            alElegir={(id) => lista.cambiar({ view: id })}
          />
        }
        busqueda={{ etiqueta: t('proyectos.buscar'), valor: lista.filtro('q'), alCambiar: (q) => lista.cambiar({ q }) }}
        frecuentes={FILTROS.filter(([campo]) => opciones(campo).length > 0).map(([campo, clave]) => (
          <FiltroDeLista
            key={campo}
            etiqueta={t(`proyectos.filtros.${clave}`)}
            opciones={opciones(campo)}
            value={lista.filtro(campo)}
            onChange={(e) => lista.cambiar({ [campo]: e.target.value })}
          />
        ))}
        aplicados={chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
        alLimpiar={() => lista.cambiar(sinFiltros)}
      />
      {cargando ? (
        <Cargando />
      ) : fallo ? (
        <ErrorDeCarga error={fallo.error} alReintentar={() => void fallo.refetch()} />
      ) : sinProyectos ? (
        <Vacio titulo={t('contexto.sinProyectos')} />
      ) : filtrados.length === 0 ? (
        <VacioDeLista conFiltros={chips.length > 0 || lista.vista !== 'all'} alLimpiar={() => lista.cambiar({ view: 'all', ...sinFiltros })}>
          {/* «Nuevo proyecto» solo se le sugiere a quien puede crearlo, no a quien solo lee todos */}
          {can('project', 'CREATE') ? t('proyectos.vacio') : null}
        </VacioDeLista>
      ) : telefono ? (
        // en el teléfono, tarjetas (revisión de UX, etapa 8)
        <ListaEnTarjetas
          etiqueta={t('proyectos.titulo')}
          total={filtrados.length}
          tarjetas={filtrados.map((p) => ({
            id: p.id,
            titulo: <EnlaceDeRegistro codigo={texto(p, 'code')} titulo={texto(p, 'name')} ruta={ruta(p)} desde={t('proyectos.titulo')} />,
            estado: <EstadoChip objeto="project" estado={p.state} />,
            detalle: [opcion(p, 'project_type'), opcion(p, 'stage')].filter(Boolean).join(' · ') || undefined
          }))}
        />
      ) : (
        <TablaPriorizada<Registro>
          etiqueta={t('proyectos.titulo')}
          total={filtrados.length}
          columnas={columnas}
          filas={filtrados}
          clave={(p) => p.id}
          celda={celdaDeTabla}
          orden={orden}
          alOrdenar={ordenar}
          alAbrir={(p) => navegar(ruta(p))}
          alPrevisualizar={(p) => navegar(rutaDePrevia('project', p.id))}
          seleccionada={(p) => p.id === elegido?.id}
          notaAlPie={
            <div className="space-y-1">
              <p>{t('proyectos.notaAlPie')}</p>
              <NotaDeConfidenciales oculta={conConfidenciales} />
            </div>
          }
        />
      )}
      {elegido && desdeXl && !telefono && peek ? (
        <VistaPreviaDelProyecto
          key={elegido.id}
          proyecto={elegido}
          jefatura={celda(jefaturas, jefes.get(elegido.id), <span className="text-sg-text-secondary italic">{t('proyectos.sinJefatura')}</span>, (correos) =>
            [...correos].map((c, i) => (
              <span key={c}>
                {i ? ', ' : ''}
                <Persona correo={c} />
              </span>
            ))
          )}
          campana={campanas.data?.find((c) => String(atributo(c, 'project')) === elegido.id)}
          alCerrar={peek.cerrar}
        />
      ) : null}
    </ContenedorDePagina>
  )
}

// una cifra de atención de una fila (S04): en danger y 700 cuando pasa de cero, atenuada en cero; «—» cuando la cuenta no la lee
// o no se pudo leer (la nota al pie lo dice), «…» mientras carga. nunca un cero que no se contó
function CifraDeAtencion({ valor }: { valor: number | null | undefined }) {
  if (valor === undefined) return <span className="text-sg-text-muted">…</span>
  if (valor === null) return <span className="text-sg-text-muted">—</span>
  return <span className={valor > 0 ? 'font-bold text-sg-danger' : 'text-sg-text-muted'}>{numeroPe(valor)}</span>
}

// la vista previa del proyecto elegido bajo la tabla (S04): el panel fuerte con el antetítulo, el nombre con su estado y las dos
// acciones, «Ver en el mapa» (el mapa del proyecto) y «Abrir Proyecto 360»; debajo, en columnas, sus datos (tipo, etapa, fase,
// jefatura y la campaña en curso con su tope) y dos cifras del tablero del proyecto (grupos vigentes e interacciones del mes),
// que se leen solo al elegirlo. «Cerrar» la quita de la URL
function VistaPreviaDelProyecto({
  proyecto,
  jefatura,
  campana,
  alCerrar
}: {
  proyecto: Registro
  jefatura: ReactNode
  campana: Registro | undefined
  alCerrar: () => void
}) {
  const { t } = useTranslation(NS)
  const { de } = useIndicadoresDelProyecto(proyecto.id)
  const base = `/projects/${encodeURIComponent(proyecto.id)}`
  const nombre = texto(proyecto, 'name')
  const reuniones = de('KPI-ENG-02').data
  const meta = reuniones?.available && reuniones.denominator ? reuniones : null
  const tope = campana ? atributo(campana, 'social_support_cap') : null
  const moneda = campana ? texto(campana, 'currency') || 'PEN' : 'PEN'
  const datos: [string, ReactNode][] = [
    [t('proyectos.columnas.tipo'), opcion(proyecto, 'project_type')],
    [t('proyectos.columnas.etapa'), opcion(proyecto, 'stage')],
    [t('proyectos.filtros.fase'), opcion(proyecto, 'exploration_phase')],
    [t('proyectos.columnas.jefatura'), jefatura],
    [
      t('proyectos.columnas.campana'),
      campana
        ? [texto(campana, 'name'), tope !== null && tope !== undefined && tope !== '' ? t('proyectos.previa.tope', { tope: montoPe(tope, moneda) }) : '']
            .filter(Boolean)
            .join(' · ')
        : ''
    ]
  ]
  const lectura = (code: string) => {
    const l = de(code)
    return { indicador: l.data, error: l.isError ? l.error : undefined, cargando: l.isPending }
  }
  return (
    <section aria-label={t('proyectos.previa.titulo', { nombre })} className="mt-5 rounded-sg-md border-2 border-sg-border-strong bg-sg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-sg-border px-5 py-3.5">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sg-overline tracking-wide text-sg-text-muted uppercase">
            {t('contexto.selloProyecto', { codigo: texto(proyecto, 'code') || proyecto.id })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sg-h2 text-sg-text">{nombre}</h2>
            <EstadoChip objeto="project" estado={proyecto.state} />
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link to={`${base}/map`}>
              <MapaIcono aria-hidden className="size-4" />
              {t('proyectos.previa.verMapa')}
            </Link>
          </Button>
          <Button asChild>
            <Link to={`${base}/overview`}>
              {t('proyectos.previa.abrir')}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </Button>
          <button
            type="button"
            onClick={alCerrar}
            aria-label={t('paginas.vistaPrevia.cerrar')}
            title={t('paginas.vistaPrevia.cerrar')}
            className="inline-flex size-8 items-center justify-center rounded-sg-md text-sg-text-secondary hover:bg-sg-surface-hover"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sg-body">
          {datos
            .filter(([, valor]) => valor !== '' && valor !== null && valor !== undefined)
            .map(([rotulo, valor]) => (
              <div key={rotulo} className="contents">
                <dt className="font-semibold text-sg-text-secondary">{rotulo}</dt>
                <dd className="min-w-0 text-sg-text">{valor}</dd>
              </div>
            ))}
        </dl>
        <KpiCard titulo={t('p360.resumen.kpis.gruposVigentes')} {...lectura('KPI-STK-01')} anidada detalle={() => null} />
        <KpiCard
          titulo={t('p360.resumen.kpis.interacciones')}
          {...lectura('KPI-ENG-01')}
          anidada
          detalle={() =>
            meta ? t('p360.resumen.reunionesFrenteAMeta', { n: numeroPe(meta.numerator ?? meta.value ?? 0), meta: numeroPe(meta.denominator as number) }) : null
          }
        />
      </div>
    </section>
  )
}
