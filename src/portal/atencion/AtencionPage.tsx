import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { useChipDeGrupo } from '../componentes/FiltroDeGrupo'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { useSiguientePaso } from '../contexto/Rastro'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { TablaPriorizada, type ColumnaPriorizada, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, Vacio } from '../componentes/Estados'
import { KpiCard } from '../componentes/KpiCard'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { PaginacionDelServidor, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useProyectos } from '../contexto/proyectos'
import { OBJETOS_DE_QCS, plazoQueCorre, rutaDeQcs, useColaDeAtencion, type GrupoDePlazo, type ObjetoDeQcs, type VistaDeLaCola } from '../datos/atencion'
import { useIndicador, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { atributo, campoDe, texto, useDefinicion, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { Persona } from '../componentes/Persona'

// S35 · lista unificada de QCS (screens.md §8): ¿qué QCS vence primero y quién la tiene? tres objetos con ciclos distintos (WF-E1,
// WF-E2, WF-E3) en una sola cola para atender por plazo, sin mezclar sus estados: cada fila lleva el estado de su workflow y el plazo
// que corre en él (plazoQueCorre), agrupadas por su situación de plazo (deadline_status, que deriva JOB-01: nunca un estado). la cola
// la arma, ordena, pagina y cuenta el servidor (GET /api/sgspe/attention/queue, decisión 5 y D10 de la revisión de UX), leída como
// quien mira: una QCS confidencial que la cuenta no lee no llega (security.md §9.6) y las cifras lo dicen (confidentialHidden). la
// persona que plantea es un campo restringido y no tiene columna: una anónima se dice «anónima»
const VISTAS = ['atencion', 'quejas', 'consultas', 'solicitudes', 'mias', 'todas'] as const
const DE_LA_VISTA: Record<(typeof VISTAS)[number], VistaDeLaCola> = {
  atencion: 'attention',
  quejas: 'grievances',
  consultas: 'inquiries',
  solicitudes: 'requests',
  mias: 'mine',
  todas: 'all'
}
const GRUPOS = ['vencidas', 'porVencer', 'alDia'] as const
const DEL_GRUPO: Record<(typeof GRUPOS)[number], GrupoDePlazo> = { vencidas: 'overdue', porVencer: 'dueSoon', alDia: 'onTime' }
const POR_PAGINA = 25
// las columnas que el servidor ordena (sort y dir de la cola, issue #160 de sgspe): el código y el plazo que corre. el canal, la
// categoría, la severidad y el estado no: su código no dice su orden
const CAMPO_DE_ORDEN: Record<string, string> = { codigo: 'code', plazo: 'due_at' }
// sin orden elegido, el de la cola (por plazo) y la consulta sin sort: un servidor que aún no ordena por columna responde 422 a un
// sort
const ORDEN_INICIAL: OrdenDeTabla | undefined = undefined

// el asunto de una QCS, que no tiene título: el comienzo de su descripción
const asuntoDe = (registro: Registro) => {
  const d = texto(registro, 'description').trim()
  return d.length > 70 ? `${d.slice(0, 70).trimEnd()}…` : d
}

export interface Fila {
  objeto: ObjetoDeQcs
  registro: Registro
}

export function AtencionPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const lista = useParametrosDeLista('atencion')
  // Enter en una fila abre su ficha y Espacio su vista previa (05-especificacion §1.6), como el enlace y el ojo de la fila
  const navegar = useNavigate()
  const previa = useRutaDeVistaPrevia()
  const paso = useSiguientePaso()
  const telefono = useEsTelefono()
  const legibles = OBJETOS_DE_QCS.filter((o) => can(o, 'READ'))
  const proyectos = useProyectos()
  // canal y categoría usan el mismo ENUM en los tres tipos: sus opciones salen del primero que la cuenta lee. severity es solo de
  // las quejas
  const definicion = useDefinicion(legibles[0])
  const conSeveridad = can('grievance', 'READ')
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
  const filtrosDeIndicador: FiltrosDeIndicador = proyecto ? { project: [proyecto] } : {}
  const abiertas = useIndicador('KPI-GRV-02', filtrosDeIndicador)
  const vencidas = useIndicador('KPI-GRV-06', filtrosDeIndicador)
  const absueltas = useIndicador('KPI-GRV-07', filtrosDeIndicador)
  const busqueda = lista.filtro('q').trim()
  const canal = lista.filtro('channel')
  const categoria = lista.filtro('category')
  const severidad = conSeveridad ? lista.filtro('severity') : ''
  // ?stakeholder=<id>: las QCS de un grupo de interés, desde las cifras de su ficha (revisión de UX, etapa 6)
  const grupo = lista.filtro('stakeholder')
  const chipDeGrupo = useChipDeGrupo(grupo)
  const vista = (VISTAS as readonly string[]).includes(lista.vista) ? (lista.vista as (typeof VISTAS)[number]) : 'atencion'
  // el orden es de esta visita: la cola no tiene parámetros de orden en la URL
  const [orden, setOrden] = useState(ORDEN_INICIAL)
  const ordenar = (siguiente: OrdenDeTabla) => {
    setOrden(siguiente)
    // otro orden empieza en la primera página
    lista.cambiar({ page: null })
  }
  const cola = useColaDeAtencion(
    {
      project: proyecto,
      view: DE_LA_VISTA[vista],
      q: busqueda,
      channel: canal,
      category: categoria,
      severity: severidad,
      stakeholder: grupo,
      sort: orden ? CAMPO_DE_ORDEN[orden.columna] : undefined,
      dir: orden?.dir,
      page: lista.pagina,
      size: POR_PAGINA
    },
    legibles.length > 0
  )
  const cargando = cola.isPending
  const fallida = cola.isError && !cola.data ? cola : undefined
  const visibles: (Fila & { grupo: GrupoDePlazo })[] = (cola.data?.content ?? []).map((f) => ({ objeto: f.type, registro: f.record, grupo: f.group }))
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  // la etapa 3 de la revisión de UX: cada vista con su conteo (con los filtros puestos), los filtros como chips con «Limpiar» y el
  // vacío por filtros con cuántos hay sin ellos
  const conteoDe = (v: (typeof VISTAS)[number]) => cola.data?.views[DE_LA_VISTA[v]] ?? null
  const chips = [
    ...(grupo ? [{ clave: 'stakeholder', etiqueta: chipDeGrupo }] : []),
    ...(busqueda ? [{ clave: 'q', etiqueta: t('atencion.filtroBusqueda', { texto: busqueda }) }] : []),
    ...(canal ? [{ clave: 'channel', etiqueta: `${t('atencion.canal')}: ${rotuloDeOpcion(canal)}` }] : []),
    ...(categoria ? [{ clave: 'category', etiqueta: `${t('atencion.categoria')}: ${rotuloDeOpcion(categoria)}` }] : []),
    ...(severidad ? [{ clave: 'severity', etiqueta: `${t('atencion.severidad')}: ${rotuloDeOpcion(severidad)}` }] : [])
  ]
  const limpiar = () => lista.cambiar({ q: null, channel: null, category: null, severity: null, stakeholder: null })
  const conConfidencialesOcultas = [abiertas, vencidas, absueltas].some((i) => i.data?.confidentialHidden === true)
  // si fallan los tres indicadores, un solo aviso con «Reintentar» y las tarjetas en una línea; si falla uno, su tarjeta lo
  // ofrece (D4, revisión de UX, etapa 7). un 403 no es una falla: es «No disponible»
  const indicadores = [abiertas, vencidas, absueltas]
  const fallanTodos = indicadores.every((i) => i.isError && !i.data && !(i.error instanceof ApiError && i.error.status === 403))
  const reintentarTodos = () => indicadores.forEach((i) => void i.refetch())
  // los títulos y lo que cuenta cada cifra son del portal (hallazgo U-24): el rótulo del indicador es del catálogo y no se entiende
  // sin conocer el modelo, y «n / N · %» tampoco
  const tarjeta = (
    titulo: string,
    consulta: { data?: Indicador; error: unknown; isPending: boolean; refetch: () => unknown },
    textos: Pick<Parameters<typeof KpiCard>[0], 'cifra' | 'detalle'>
  ) => (
    <KpiCard
      titulo={titulo}
      indicador={consulta.data}
      cargando={consulta.isPending}
      error={consulta.error}
      alReintentar={fallanTodos ? undefined : () => void consulta.refetch()}
      {...textos}
    />
  )
  const respondidas = {
    cifra: (i: Indicador & { value: number }) => (i.unit === '%' ? `${numeroPe(i.value)} %` : numeroPe(i.value)),
    detalle: (i: Indicador) =>
      i.numerator != null && i.denominator
        ? t('atencion.tarjetas.respondidasDetalle', { n: numeroPe(i.numerator), total: numeroPe(i.denominator) })
        : t('atencion.tarjetas.respondidasSinBase')
  }
  const nombreDelProyecto = (id: string) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
  // la tabla con prioridad de columnas (hallazgo U-06, DD-05): a 1440 px cabe sin desplazar. esenciales la QCS (con su tipo
  // encima), el proyecto, el estado y el plazo; secundarias, desde xl, el canal, la categoría, la severidad y el responsable;
  // opcional, quien la plantea. una columna no esencial que dice lo mismo en todo el grupo sale a una nota encima, y en «Mis
  // QCS» el responsable es siempre quien mira: no se dibuja
  const columnas: ColumnaPriorizada[] = [
    { id: 'codigo', encabezado: t('atencion.columnas.codigo'), prioridad: 'esencial', claseDeCelda: 'min-w-56 text-sm', ordenable: true },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('atencion.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    { id: 'canal', encabezado: t('atencion.columnas.canal'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'categoria', encabezado: t('atencion.columnas.categoria'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    ...(conSeveridad ? [{ id: 'severidad', encabezado: t('atencion.columnas.severidad'), prioridad: 'secundaria' as const, claseDeCelda: 'text-sm' }] : []),
    { id: 'estado', encabezado: t('atencion.columnas.estado'), prioridad: 'esencial' },
    { id: 'plazo', encabezado: t('atencion.columnas.plazo'), prioridad: 'esencial', claseDeCelda: 'text-sm', ordenable: true },
    ...(vista === 'mias'
      ? []
      : [{ id: 'responsable', encabezado: t('atencion.columnas.responsable'), prioridad: 'secundaria' as const, claseDeCelda: 'text-sm' }]),
    { id: 'plantea', encabezado: t('atencion.columnas.planteaQuien'), prioridad: 'opcional', claseDeCelda: 'text-sm' }
  ]
  const celdaDe = (f: Fila, columna: string): ReactNode => {
    const { objeto, registro } = f
    switch (columna) {
      case 'codigo':
        return (
          <span className="block" title={texto(registro, 'description') || undefined}>
            <span className="block text-sg-caption text-sg-text-muted">{t(`comun.qcs.${objeto}`)}</span>
            <EnlaceDeRegistro
              codigo={texto(registro, 'code')}
              titulo={asuntoDe(registro)}
              ruta={rutaDeQcs(texto(registro, 'project'), objeto, registro.id)}
              desde={t('atencion.titulo')}
              previa={{ objeto, id: registro.id }}
              codigoEnElEnlace
            />
          </span>
        )
      case 'proyecto':
        return nombreDelProyecto(texto(registro, 'project'))
      case 'canal':
        return opcion(registro, 'channel') || '—'
      case 'categoria':
        return opcion(registro, 'category') || '—'
      case 'severidad':
        return opcion(registro, 'severity') || '—'
      case 'estado':
        return <EstadoChip objeto={objeto} estado={registro.state} />
      case 'plazo':
        return <PlazoDeQcs fila={f} />
      case 'responsable':
        return <Persona correo={texto(registro, 'owner_user_email')} />
      default:
        return atributo(registro, 'anonymous') === true ? t('atencion.anonima') : t('atencion.identificada')
    }
  }
  // lo que decide si una columna no esencial dice lo mismo en todo el grupo: el dato guardado, no su rótulo
  const valorPlano = ({ objeto, registro }: Fila, columna: string): string => {
    switch (columna) {
      case 'canal':
        return String(atributo(registro, 'channel') ?? '')
      case 'categoria':
        return String(atributo(registro, 'category') ?? '')
      case 'severidad':
        return String(atributo(registro, 'severity') ?? '')
      case 'responsable':
        return texto(registro, 'owner_user_email').toLowerCase()
      case 'plantea':
        return String(atributo(registro, 'anonymous') === true)
      default:
        return `${objeto}:${registro.id}`
    }
  }
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        vistas={<VistasDelModulo modulo="attention" actual="lista" />}
        titulo={t('atencion.titulo')}
        conteo={!cola.data || legibles.length === 0 ? undefined : t('atencion.conteo', { count: cola.data.totalElements })}
        primaria={<BotonCrear objeto={OBJETOS_DE_QCS} etiqueta={t('atencion.registrar')} resto="attention/new" />}
        secundarias={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link to={`${base}/attention/report`}>{t('atencion.reporte')}</Link>
            </Button>
          </>
        }
      />
      <section aria-label={t('atencion.indicadores')} className="space-y-2">
        {fallanTodos ? <ErrorDeCarga error={abiertas.error} alReintentar={reintentarTodos} /> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tarjeta(t('atencion.tarjetas.abiertas'), abiertas, { detalle: () => t('atencion.tarjetas.abiertasDetalle') })}
          {tarjeta(t('atencion.tarjetas.vencidas'), vencidas, { detalle: () => t('atencion.tarjetas.vencidasDetalle') })}
          <KpiCard
            titulo={t('atencion.tarjetas.porVencer')}
            detalle={() => t('atencion.tarjetas.porVencerDetalle')}
            cargando={legibles.length > 0 && cargando}
            indicador={
              legibles.length === 0
                ? // sin ninguna QCS legible no hay cifra: «No disponible», nunca cero
                  { code: 'por-vencer', label: t('atencion.tarjetas.porVencer'), available: false, value: null }
                : cola.data
                  ? { code: 'por-vencer', label: t('atencion.tarjetas.porVencer'), available: true, value: cola.data.openDueSoon }
                  : undefined
            }
            error={fallida?.error}
          />
          {tarjeta(t('atencion.tarjetas.absueltas'), absueltas, respondidas)}
        </div>
        <NotaDeConfidenciales oculta={conConfidencialesOcultas} />
      </section>
      {/* la barra de filtros (P-02; hallazgos U-18 y U-22): las vistas en una sola fila con su conteo, la búsqueda, los tres filtros
          frecuentes y un chip por filtro con «Limpiar». ?view= y los parámetros de filtro siguen siendo los mismos */}
      <BarraDeFiltros
        vista={
          <SelectorDeVista
            etiqueta={t('comun.vistas')}
            vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`atencion.vistas.${v}`), n: conteoDe(v) }))}
            actual={vista}
            alElegir={(v) => lista.cambiar({ view: v })}
            visibles={VISTAS.length}
          />
        }
        busqueda={{ etiqueta: t('atencion.buscar'), valor: lista.filtro('q'), alCambiar: (q) => lista.cambiar({ q }) }}
        frecuentes={
          <>
            <FiltroDeLista
              etiqueta={t('atencion.canal')}
              value={canal}
              onChange={(e) => lista.cambiar({ channel: e.target.value })}
              opciones={opciones('channel')}
            />
            <FiltroDeLista
              etiqueta={t('atencion.categoria')}
              value={categoria}
              onChange={(e) => lista.cambiar({ category: e.target.value })}
              opciones={opciones('category')}
            />
            {conSeveridad ? (
              <FiltroDeLista
                etiqueta={t('atencion.severidad')}
                value={severidad}
                onChange={(e) => lista.cambiar({ severity: e.target.value })}
                opciones={opciones('severity')}
              />
            ) : null}
          </>
        }
        aplicados={chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
        alLimpiar={limpiar}
      />
      {legibles.length === 0 ? (
        <Alert tone="notice">{t('atencion.sinLectura')}</Alert>
      ) : cargando ? (
        <Cargando />
      ) : fallida ? (
        <FalloDeLectura error={fallida.error} alReintentar={() => void cola.refetch()} />
      ) : visibles.length === 0 ? (
        chips.length > 0 ? (
          <VacioDeLista conFiltros alLimpiar={limpiar} sinFiltros={cola.data?.unfiltered} />
        ) : (
          <Vacio titulo={t('atencion.vacio')} />
        )
      ) : (
        <>
          {GRUPOS.map((grupo) => {
            // la página llega ordenada por el servidor (por plazo o por la columna elegida); el total del grupo es el de todas sus
            // páginas
            const delGrupo = visibles.filter((f) => f.grupo === DEL_GRUPO[grupo])
            if (delGrupo.length === 0) return null
            return (
              <section key={grupo} aria-label={t(`atencion.grupos.${grupo}`)} className="space-y-2">
                <h2 className="text-sg-h3 font-semibold">
                  {t(`atencion.grupos.${grupo}`)}{' '}
                  <span className="text-sg-text-muted">({numeroPe(cola.data?.groups[DEL_GRUPO[grupo]] ?? delGrupo.length)})</span>
                </h2>
                {telefono ? (
                  <ListaEnTarjetas
                    etiqueta={t('atencion.tabla', { grupo: t(`atencion.grupos.${grupo}`) })}
                    tarjetas={delGrupo.map((f) => ({
                      id: `${f.objeto}:${f.registro.id}`,
                      titulo: (
                        <>
                          <span className="text-sg-caption text-sg-text-muted">{t(`comun.qcs.${f.objeto}`)} · </span>
                          <EnlaceDeRegistro
                            codigo={texto(f.registro, 'code')}
                            titulo={asuntoDe(f.registro)}
                            ruta={rutaDeQcs(texto(f.registro, 'project'), f.objeto, f.registro.id)}
                            desde={t('atencion.titulo')}
                            previa={{ objeto: f.objeto, id: f.registro.id }}
                            codigoEnElEnlace
                          />
                        </>
                      ),
                      estado: <EstadoChip objeto={f.objeto} estado={f.registro.state} />,
                      plazo: <PlazoDeQcs fila={f} />,
                      proyecto: proyecto ? undefined : nombreDelProyecto(texto(f.registro, 'project'))
                    }))}
                  />
                ) : (
                  <TablaPriorizada<Fila>
                    etiqueta={t('atencion.tabla', { grupo: t(`atencion.grupos.${grupo}`) })}
                    // los grupos de la cola comparten la elección de «Columnas»
                    idDeTabla="atencion"
                    columnas={columnas}
                    filas={delGrupo}
                    clave={(f) => `${f.objeto}:${f.registro.id}`}
                    celda={celdaDe}
                    valorPlano={valorPlano}
                    ocultarUniformes
                    orden={orden}
                    alOrdenar={ordenar}
                    alAbrir={(f) => {
                      const ruta = rutaDeQcs(texto(f.registro, 'project'), f.objeto, f.registro.id)
                      navegar(ruta, { state: paso(t('atencion.titulo'), ruta) })
                    }}
                    alPrevisualizar={(f) => navegar(previa(f.objeto, f.registro.id))}
                  />
                )}
              </section>
            )
          })}
          <PaginacionDelServidor datos={cola.data} alPagina={(p) => lista.cambiar({ page: String(p) })} />
        </>
      )}
    </section>
  )
}

// el plazo que corre en su estado, con su situación; fuera de esos estados, «sin plazo»
function PlazoDeQcs({ fila: { objeto, registro } }: { fila: Fila }) {
  const { t } = useTranslation(NS)
  const plazo = plazoQueCorre(objeto, registro)
  return plazo ? (
    <span className="flex flex-wrap items-center gap-1">
      <SituacionDePlazo valor={atributo(registro, 'deadline_status')} />
      {plazo.fecha ? diaPe(plazo.fecha) : t('atencion.plazoPorCalcular')}
    </span>
  ) : (
    <span className="text-sg-text-muted">{t('atencion.sinPlazo')}</span>
  )
}
