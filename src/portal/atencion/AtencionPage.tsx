import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { useChipDeGrupo } from '../componentes/FiltroDeGrupo'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useSiguientePaso } from '../contexto/Rastro'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { ListaConMapa, ofreceMapa, VISTA_MAPA } from '../mapa/ListaConMapa'
import { TablaPriorizada, type ColumnaPriorizada, type GrupoDeFilas, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, Vacio } from '../componentes/Estados'
import { KpiCard, RejillaDeKpi } from '../componentes/KpiCard'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { ordenEnUrl, PaginacionDelServidor, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { useProyectos } from '../contexto/proyectos'
import { OBJETOS_DE_QCS, rutaDeQcs, useColaDeAtencion, type GrupoDePlazo, type ObjetoDeQcs, type VistaDeLaCola } from '../datos/atencion'
import { useIndicador, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { campoDe, puedeLeer, texto, useDefinicion, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { hoyEnLima } from '../datos/fechas'
import { CicloDeQcs, PlanteaDeQcs, PlazoDeQcs } from './FilaDeQcs'
import { useContextFilters } from '../shell/context'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { Persona } from '../componentes/Persona'
import { ChevronDown } from 'lucide-react'
import { Nivel } from '../componentes/Nivel'

// S35 · lista unificada de QCS (screens.md §8): ¿qué QCS vence primero y quién la tiene? tres objetos con ciclos distintos (WF-E1,
// WF-E2, WF-E3) en una sola cola para atender por plazo, sin mezclar sus estados: cada fila lleva el estado de su workflow y el plazo
// que corre en él (plazoQueCorre), agrupadas por su situación de plazo (deadline_status, que deriva JOB-01: nunca un estado). la cola
// la arma, ordena, pagina y cuenta el servidor (GET /api/sgspe/attention/queue, decisión 5 y D10 de la revisión de UX), leída como
// quien mira: una QCS confidencial que la cuenta no lee no llega (security.md §9.6) y las cifras lo dicen (confidentialHidden). la
// persona que plantea es un campo restringido y no tiene columna: una anónima se dice «anónima»
// «Atención en el mapa» (VISTA_MAPA) es la vista «Lista + mapa» (design-system.md §5.3): la cola de atención junto al mapa, cada QCS
// en su punto o en el de su localidad o comunidad (LYR-20); nunca la de entrada y solo si alguna de la página trae ubicación
const VISTAS = ['atencion', 'quejas', 'consultas', 'solicitudes', 'mias', 'todas', VISTA_MAPA] as const
const DE_LA_VISTA: Record<(typeof VISTAS)[number], VistaDeLaCola> = {
  mapa: 'attention',
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
  return d.length > 120 ? `${d.slice(0, 120).trimEnd()}…` : d
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
  const paso = useSiguientePaso()
  const telefono = useEsTelefono()
  const legibles = OBJETOS_DE_QCS.filter((o) => can(o, 'READ'))
  const proyectos = useProyectos()
  // canal y categoría usan el mismo ENUM en los tres tipos: sus opciones salen del primero que la cuenta lee. severity es solo de
  // las quejas
  const definicion = useDefinicion(legibles[0])
  const conSeveridad = can('grievance', 'READ')
  // quién la plantea: la persona es un campo restringido; se lee según la definición de cada tipo, como la ficha
  const definiciones = {
    grievance: useDefinicion(legibles.includes('grievance') ? 'grievance' : undefined),
    inquiry: useDefinicion(legibles.includes('inquiry') ? 'inquiry' : undefined),
    stakeholder_request: useDefinicion(legibles.includes('stakeholder_request') ? 'stakeholder_request' : undefined)
  }
  const leePersona = (objeto: ObjetoDeQcs) => definiciones[objeto].isSuccess && puedeLeer(definiciones[objeto].data, 'person')
  // la fila abierta (S11), una a la vez: su clave «objeto:id»
  const [abierta, setAbierta] = useState<string | null>(null)
  const claveDe = (f: Fila) => `${f.objeto}:${f.registro.id}`
  const alternar = (f: Fila) => setAbierta((a) => (a === claveDe(f) ? null : claveDe(f)))
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
  const filtrosDeIndicador: FiltrosDeIndicador = proyecto ? { project: [proyecto] } : {}
  const abiertas = useIndicador('KPI-GRV-02', filtrosDeIndicador)
  const vencidas = useIndicador('KPI-GRV-06', filtrosDeIndicador)
  // «Absueltas en 90 días» (S11): KPI-GRV-07 en los últimos 90 días de Lima; la cifra es cuántas de las recibidas en ese lapso
  // tienen respuesta, y el detalle, el porcentaje y su base
  const hoy = hoyEnLima()
  const absueltas = useIndicador('KPI-GRV-07', { ...filtrosDeIndicador, periodStart: haceDias(hoy, 89), periodEnd: hoy })
  const busqueda = lista.filtro('q').trim()
  const canal = lista.filtro('channel')
  const categoria = lista.filtro('category')
  const severidad = conSeveridad ? lista.filtro('severity') : ''
  // ?stakeholder=<id>: las QCS de un grupo de interés, desde las cifras de su ficha (revisión de UX, etapa 6)
  const grupo = lista.filtro('stakeholder')
  const chipDeGrupo = useChipDeGrupo(grupo)
  const vista = (VISTAS as readonly string[]).includes(lista.vista) ? (lista.vista as (typeof VISTAS)[number]) : 'atencion'
  // el orden viaja en la URL (ordenEnUrl, DD-37): volver de una ficha lo conserva, y otro orden vuelve a la primera página
  const [orden, ordenar] = ordenEnUrl(lista, ORDEN_INICIAL, ['codigo', 'plazo'])
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
  // «Lista + mapa»: la vista se ofrece si alguna QCS de la página trae ubicación; en ella, sin ninguna, se dice y queda la tabla
  const enMapa = vista === VISTA_MAPA
  const objetoDeLaFila = new Map(visibles.map((f) => [f.registro.id, f.objeto]))
  const objetoDe = (r: Registro) => objetoDeLaFila.get(r.id) ?? 'grievance'
  const conUbicacion = ofreceMapa(
    objetoDe,
    visibles.map((f) => f.registro)
  )
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
    textos: Pick<Parameters<typeof KpiCard>[0], 'cifra' | 'detalle' | 'tono'>
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
    cifra: (i: Indicador & { value: number }) => (i.numerator != null ? numeroPe(i.numerator) : i.unit === '%' ? `${numeroPe(i.value)} %` : numeroPe(i.value)),
    detalle: (i: Indicador & { value: number }) =>
      i.numerator != null && i.denominator
        ? t('atencion.tarjetas.absueltasDetalle', { porcentaje: numeroPe(i.value), total: numeroPe(i.denominator) })
        : t('atencion.tarjetas.absueltasSinBase')
  }
  const nombreDelProyecto = (id: string) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
  // la tabla compacta de S11 con prioridad de columnas (hallazgo U-06, DD-05): el asunto, que toma el ancho, con su código encima
  // y el canal y la categoría debajo; el tipo; el proyecto en el alcance global; quién la plantea; la severidad con barras (solo
  // de las quejas); el estado y el plazo que corre con sus días. el responsable, opcional (lo dice la fila abierta); al final, el
  // botón que abre la fila con su ciclo de vida
  const columnas: ColumnaPriorizada[] = [
    { id: 'codigo', encabezado: t('atencion.columnas.codigo'), prioridad: 'esencial', titulo: true, ordenable: true },
    { id: 'tipo', encabezado: t('atencion.columnas.tipo'), prioridad: 'esencial', claseDeCelda: 'text-sm' },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('atencion.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    { id: 'plantea', encabezado: t('atencion.columnas.planteaQuien'), prioridad: 'esencial', claseDeCelda: 'min-w-36 text-sm' },
    ...(conSeveridad ? [{ id: 'severidad', encabezado: t('atencion.columnas.severidad'), prioridad: 'esencial' as const }] : []),
    { id: 'estado', encabezado: t('atencion.columnas.estado'), prioridad: 'esencial' },
    { id: 'plazo', encabezado: t('atencion.columnas.plazo'), prioridad: 'esencial', ordenable: true },
    ...(vista === 'mias'
      ? []
      : [{ id: 'responsable', encabezado: t('atencion.columnas.responsable'), prioridad: 'opcional' as const, claseDeCelda: 'text-sm' }]),
    { id: 'ciclo', encabezado: t('atencion.fila.columna'), prioridad: 'esencial', encabezadoOculto: true }
  ]
  const celdaDe = (f: Fila, columna: string): ReactNode => {
    const { objeto, registro } = f
    switch (columna) {
      case 'codigo':
        return (
          <span className="block" title={texto(registro, 'description') || undefined}>
            <EnlaceDeRegistro
              codigo={texto(registro, 'code')}
              titulo={asuntoDe(registro)}
              ruta={rutaDeQcs(texto(registro, 'project'), objeto, registro.id)}
              desde={t('atencion.titulo')}
              codigoEnElEnlace
            />
            {opcion(registro, 'channel') || opcion(registro, 'category') ? (
              <span className="block text-sg-caption text-sg-text-secondary">
                {[opcion(registro, 'channel'), opcion(registro, 'category')].filter(Boolean).join(' · ')}
              </span>
            ) : null}
          </span>
        )
      case 'tipo':
        return t(`comun.qcs.${objeto}`)
      case 'proyecto':
        return nombreDelProyecto(texto(registro, 'project'))
      case 'plantea':
        return <PlanteaDeQcs qcs={registro} leePersona={leePersona(objeto)} />
      case 'severidad':
        return objeto === 'grievance' ? <Nivel valor={texto(registro, 'severity')} nombre={t('atencion.columnas.severidad')} /> : null
      case 'estado':
        return <EstadoChip objeto={objeto} estado={registro.state} />
      case 'plazo':
        return <PlazoDeQcs objeto={objeto} qcs={registro} />
      case 'responsable':
        return <Persona correo={texto(registro, 'owner_user_email')} />
      default: {
        const abiertaEsta = abierta === claveDe(f)
        return (
          <button
            type="button"
            aria-expanded={abiertaEsta}
            aria-controls={abiertaEsta ? idDeFila(f) : undefined}
            aria-label={t(abiertaEsta ? 'atencion.fila.cerrar' : 'atencion.fila.abrir', { codigo: texto(registro, 'code') })}
            onClick={() => alternar(f)}
            className="inline-flex size-8 items-center justify-center rounded-sg-md text-sg-text-secondary hover:bg-sg-surface-hover hover:text-sg-text"
          >
            <ChevronDown aria-hidden className={abiertaEsta ? 'size-5 rotate-180' : 'size-5'} />
          </button>
        )
      }
    }
  }
  // lo que decide si una columna no esencial dice lo mismo en toda la página: el dato guardado, no su rótulo
  const valorPlano = ({ objeto, registro }: Fila, columna: string): string =>
    columna === 'responsable' ? texto(registro, 'owner_user_email').toLowerCase() : `${objeto}:${registro.id}`
  const idDeFila = (f: Fila) => `ciclo-${f.objeto}-${f.registro.id}`
  // los grupos por plazo de S11 sobre la página que dio el servidor (en su orden), con el total de cada grupo que él cuenta
  const grupos: GrupoDeFilas<Fila>[] = GRUPOS.map((g) => ({
    clave: g,
    titulo: t(`atencion.grupos.${g}`),
    filas: visibles.filter((f) => f.grupo === DEL_GRUPO[g]),
    conteo: cola.data?.groups[DEL_GRUPO[g]]
  })).filter((g) => g.filas.length > 0)
  return (
    <ContenedorDePagina elemento="section">
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
        <RejillaDeKpi columnas={4}>
          {tarjeta(t('atencion.tarjetas.abiertas'), abiertas, { detalle: () => t('atencion.tarjetas.abiertasDetalle') })}
          {/* la cifra en danger o warning: el rótulo ya dice que es lo vencido o lo por vencer (design-system.md §5.3) */}
          {tarjeta(t('atencion.tarjetas.vencidas'), vencidas, { detalle: () => t('atencion.tarjetas.vencidasDetalle'), tono: 'danger' })}
          <KpiCard
            titulo={t('atencion.tarjetas.porVencer')}
            tono="warning"
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
        </RejillaDeKpi>
        <NotaDeConfidenciales oculta={conConfidencialesOcultas} />
      </section>
      {/* la barra de filtros (P-02; hallazgos U-18 y U-22): las vistas en una sola fila con su conteo, la búsqueda, los tres filtros
          frecuentes y un chip por filtro con «Limpiar». ?view= y los parámetros de filtro siguen siendo los mismos */}
      <BarraDeFiltros
        vista={
          <SelectorDeVista
            etiqueta={t('comun.vistas')}
            vistas={VISTAS.filter((v) => v !== VISTA_MAPA || conUbicacion || enMapa).map((v) => ({
              id: v,
              etiqueta: t(`atencion.vistas.${v}`),
              n: v === VISTA_MAPA ? undefined : conteoDe(v)
            }))}
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
          {enMapa && !conUbicacion ? <Alert tone="notice">{t('mapa.listaConMapa.sinUbicaciones')}</Alert> : null}
          {enMapa && conUbicacion ? (
            <ListaConMapa
              objeto="grievance"
              objetoDe={objetoDe}
              etiqueta={t('atencion.tabla')}
              registros={visibles.map((f) => f.registro)}
              proyecto={proyecto}
              nombreDe={(r) => [texto(r, 'code'), asuntoDe(r)].filter(Boolean).join(' · ')}
              detalleDe={(r) => (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{t(`comun.qcs.${objetoDe(r)}`)}</span>
                  <EstadoChip objeto={objetoDe(r)} estado={r.state} />
                  <PlazoDeQcs objeto={objetoDe(r) as ObjetoDeQcs} qcs={r} />
                </span>
              )}
              accionesDe={(r) => (
                <EnlaceDeRegistro
                  codigo={texto(r, 'code')}
                  titulo={asuntoDe(r)}
                  ruta={rutaDeQcs(texto(r, 'project'), objetoDe(r) as ObjetoDeQcs, r.id)}
                  desde={t('atencion.titulo')}
                  previa={{ objeto: objetoDe(r), id: r.id }}
                  codigoEnElEnlace
                />
              )}
              alAbrir={(r) => {
                const ruta = rutaDeQcs(texto(r, 'project'), objetoDe(r) as ObjetoDeQcs, r.id)
                navegar(ruta, { state: paso(t('atencion.titulo'), ruta) })
              }}
            />
          ) : telefono ? (
            // en el teléfono, una lista de tarjetas por grupo, con su título y el total que cuenta el servidor
            grupos.map((grupo) => (
              <section key={grupo.clave} aria-label={grupo.titulo} className="space-y-2">
                <h2 className="text-sg-h3 font-semibold">
                  {grupo.titulo} <span className="text-sg-text-muted">({numeroPe(grupo.conteo ?? grupo.filas.length)})</span>
                </h2>
                <ListaEnTarjetas
                  etiqueta={t('atencion.tablaDelGrupo', { grupo: grupo.titulo })}
                  tarjetas={grupo.filas.map((f) => ({
                    id: claveDe(f),
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
                    plazo: <PlazoDeQcs objeto={f.objeto} qcs={f.registro} />,
                    proyecto: proyecto ? undefined : nombreDelProyecto(texto(f.registro, 'project'))
                  }))}
                />
              </section>
            ))
          ) : (
            // una sola tabla agrupada por plazo (S11): Vencidas, Por vencer y Al día o sin plazo. Espacio en una fila la abre con su
            // ciclo de vida y Enter abre su ficha
            <TablaPriorizada<Fila>
              etiqueta={t('atencion.tabla')}
              idDeTabla="atencion"
              columnas={columnas}
              grupos={grupos}
              clave={claveDe}
              celda={celdaDe}
              valorPlano={valorPlano}
              ocultarUniformes
              orden={orden}
              alOrdenar={ordenar}
              total={cola.data?.totalElements}
              alAbrir={(f) => {
                const ruta = rutaDeQcs(texto(f.registro, 'project'), f.objeto, f.registro.id)
                navegar(ruta, { state: paso(t('atencion.titulo'), ruta) })
              }}
              alPrevisualizar={alternar}
              detalleDe={(f) =>
                abierta === claveDe(f)
                  ? { id: idDeFila(f), contenido: <CicloDeQcs objeto={f.objeto} qcs={f.registro} alAplicar={() => void cola.refetch()} /> }
                  : null
              }
              notaAlPie={t('atencion.notaDePlazos')}
            />
          )}
          <PaginacionDelServidor datos={cola.data} alPagina={(p) => lista.cambiar({ page: String(p) })} />
        </>
      )}
    </ContenedorDePagina>
  )
}

// el primer día de los últimos n + 1 días que terminan hoy (AAAA-MM-DD, de calendario)
const haceDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)
