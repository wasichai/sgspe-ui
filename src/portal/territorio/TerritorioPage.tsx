import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { Layers, List, PanelRightOpen } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AtajosDePeriodo } from '../componentes/AtajosDePeriodo'
import { CampoFecha } from '../componentes/CampoFecha'
import { Drawer } from '../componentes/Drawer'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { useProyecto, useProyectos } from '../contexto/proyectos'
import { useSiguientePaso } from '../contexto/Rastro'
import { hoyEnLima } from '../datos/fechas'
import { rutaParaAbrir } from '../datos/fichas'
import { NS } from '../i18n'
import { useTableroDisponible } from '../tableros/comunes'
import { destinoDe, encuadreDeGeometrias, idDeElemento, useCapas, useCapasDisponibles, type Encuadre } from '../mapa/api'
import { avisoDelMapa } from '../mapa/avisos'
import { CAPAS_DE_GESTION, CAPAS_TERRITORIALES, capa, dibujoDe } from '../mapa/capas'
import { capaDeCalor, SelectorDeCalor, TablaDeCalor } from '../mapa/Calor'
import { Mapa } from '../mapa/Mapa'
import { useWms } from '../mapa/wms'
import { AgregadosDelMapa } from './AgregadosDelMapa'
import { OBJETOS_DE_CALOR, useConcentracion, type ObjetoDeCalor } from './consultas'
import { DialogoDeExportacion } from './DialogoDeExportacion'
import { EstadisticasTerritoriales } from './EstadisticasTerritoriales'
import { capasExportables } from './exportacion'
import { FichaContextual } from './FichaContextual'
import { DESTINOS, importaA } from './importacion'
import { PanelDeCapas } from './PanelDeCapas'
import { RegistrosDeLaZona } from './RegistrosDeLaZona'

// S12 · mapa territorial (screens.md §4, spec F6 §3.7): las capas públicas por WMS del proxy (nombradas por su GetCapabilities) y
// el resto por GeoJSON; los lugares con ficha se siguen pidiendo por GeoJSON, invisibles sobre la tesela, para elegirlos y para la
// lista de lugares visibles, su alternativa de teclado. si GeoServer no responde (503), el WMS se apaga y esas capas vuelven al
// GeoJSON de F2, con un aviso. el grupo Gestión ofrece las capas LYR-17 a LYR-24 que el backend sirve (plan 6.2c; las que
// responden 404 no se ofrecen) con el periodo, y sus agregados por localidad en texto. filtros de proyecto y periodo en la URL,
// leyenda de la paleta compartida y «Capturar PNG». elegir un lugar (?selected=) abre su ficha contextual con KPI-TER-01 y sus
// registros bajo el mapa. "Nueva comunidad" es el flujo 2. en modo tablero (/territory/dashboard, dashboards.md §5.9) suma
// KPI-TER-02 a 04 del proyecto elegido. el mapa primero (DD-11, U-10): el lienzo a todo el ancho, con las capas y su leyenda en
// un panel plegable a la izquierda y los lugares (con la ficha contextual) en otro a la derecha, y en la cabecera una sola
// primaria («Nueva comunidad») con lo demás en «Más acciones»
const FICHA: Record<string, string> = { community: 'communities', locality: 'localities' }
// las capas cuyos lugares tienen ficha (decisión 7 del plan 6.3)
const SELECCIONABLES = new Set(['LYR-02', 'LYR-03', 'LYR-05'])
const DE_GESTION = CAPAS_DE_GESTION.map((c) => c.id)
// la capa que dice si el backend sirve las de gestión: de registros (los compromisos), no un agregado, que sale caro sondear
const SONDA_DE_GESTION = 'LYR-19'
// los paneles plegados, en la URL (?hide=layers,places): atrás o un enlace los dejan como estaban. abiertos, no se escriben
type Panel = 'layers' | 'places'
const PANELES: readonly Panel[] = ['layers', 'places']
// un elemento del menú «Más acciones», como los de CrearRelacionado
const DEL_MENU = 'rounded-sg-sm px-2.5 py-1.5 text-left text-sm hover:bg-sg-surface-hover'

export function TerritorioPage({ modo = 'mapa' }: { modo?: 'mapa' | 'tablero' } = {}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const conTablero = useTableroDisponible('territory')
  const paso = useSiguientePaso()
  const [busqueda, fijar] = useSearchParams()
  const proyecto = busqueda.get('project') ?? undefined
  const periodo = { periodStart: busqueda.get('periodStart') ?? undefined, periodEnd: busqueda.get('periodEnd') ?? undefined }
  const pedido = busqueda.get('heat')
  const objetoDeCalor = (OBJETOS_DE_CALOR as readonly string[]).includes(pedido ?? '') ? (pedido as ObjetoDeCalor) : null
  const concentracion = useConcentracion(objetoDeCalor, { project: proyecto, ...periodo })
  // la misma capa mientras no cambien los datos: el mapa la vuelve a dibujar cuando cambia su identidad
  const calor = useMemo(() => (objetoDeCalor ? capaDeCalor(concentracion.data) : null), [objetoDeCalor, concentracion.data])
  const elegirCalor = (valor: ObjetoDeCalor | null) => {
    const siguiente = new URLSearchParams(busqueda)
    if (valor) siguiente.set('heat', valor)
    else siguiente.delete('heat')
    fijar(siguiente, { replace: true })
  }
  // el lugar elegido (decisión 11 del plan 6.3): abre la ficha contextual y, bajo el mapa, sus registros; «Abrir la ficha» de la
  // ficha lleva a S13 o S14
  const [objetoElegido, idElegido = null] = busqueda.get('selected')?.split(':') ?? []
  const elegido: { objeto: 'locality' | 'community'; id: string } | null =
    (objetoElegido === 'locality' || objetoElegido === 'community') && idElegido ? { objeto: objetoElegido, id: idElegido } : null
  const plegados = new Set((busqueda.get('hide') ?? '').split(',').filter((p): p is Panel => (PANELES as readonly string[]).includes(p)))
  const conPlegados = (siguiente: URLSearchParams, panel: Panel, plegado: boolean) => {
    const nuevos = PANELES.filter((p) => (p === panel ? plegado : plegados.has(p)))
    if (nuevos.length > 0) siguiente.set('hide', nuevos.join(','))
    else siguiente.delete('hide')
    return siguiente
  }
  const alternar = (panel: Panel) => fijar(conPlegados(new URLSearchParams(busqueda), panel, !plegados.has(panel)), { replace: true })
  // elegir un lugar abre el panel de lugares, donde está su ficha contextual
  const elegir = (objeto: string, id: string | null) => {
    const siguiente = new URLSearchParams(busqueda)
    if (id && FICHA[objeto]) {
      siguiente.set('selected', `${objeto}:${id}`)
      conPlegados(siguiente, 'places', false)
    } else siguiente.delete('selected')
    fijar(siguiente, { replace: true })
  }
  const [encendidas, setEncendidas] = useState(() => new Set<string>(['LYR-02', 'LYR-05']))
  const [encuadre, setEncuadre] = useState<Encuadre | null>(null)
  // el mapa abre sobre el proyecto del filtro (su ubicación y su área de interés); sin filtro, sobre todos los proyectos que la
  // cuenta lee, y sobre el Perú entero solo si ninguno tiene ubicación. recién con esa vista se piden las capas: nunca sin bbox
  // (revisión final del plan 6.3, m1)
  const delFiltro = useProyecto(proyecto)
  const todos = useProyectos()
  const geometrias = delFiltro.data?.geometries
  const esperandoProyecto = proyecto ? delFiltro.isPending : todos.isPending
  const vistaInicial = useMemo(() => {
    if (esperandoProyecto) return 'esperar' as const
    if (proyecto) return encuadreDeGeometrias([geometrias?.location, geometrias?.interest_area])
    return encuadreDeGeometrias((todos.data ?? []).flatMap((p) => [p.geometries?.location, p.geometries?.interest_area]))
  }, [esperandoProyecto, proyecto, geometrias, todos.data])
  const [creando, setCreando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const capturar = useRef<() => string | null>(() => null)
  const { disponibles } = useCapasDisponibles(DE_GESTION, SONDA_DE_GESTION)
  const ids = [...CAPAS_TERRITORIALES, ...disponibles]
  const basicas = CAPAS_TERRITORIALES.filter((id) => encendidas.has(id))
  const servicio = useWms(basicas)
  // por GeoJSON: lo que el WMS no dibuja y, aunque lo dibuje, los lugares con ficha. el periodo solo va a las capas de gestión:
  // las de F2 no tienen fecha
  const estadosBasicos = useCapas(
    basicas.filter((id) => !servicio.porWms.has(id) || SELECCIONABLES.has(id)),
    { project: proyecto, bbox: encuadre, porVista: true }
  )
  const estadosDeGestion = useCapas(
    disponibles.filter((id) => encendidas.has(id)),
    { project: proyecto, ...periodo, bbox: encuadre, porVista: true }
  )
  const estados = [...estadosBasicos, ...estadosDeGestion]
  const sufijo = proyecto ? `?project=${encodeURIComponent(proyecto)}` : ''
  const rutaDe = (objeto: string, id: string) => (FICHA[objeto] ? `/territory/${FICHA[objeto]}/${encodeURIComponent(id)}${sufijo}` : null)
  // los lugares con ficha de las capas de lugares, sin repetir (una localidad puede estar en dos capas); elegir un elemento abre
  // la ficha contextual de su lugar
  const lugares = new Map<string, { id: string; objeto: string; nombre: string }>()
  for (const estado of estadosBasicos)
    for (const f of estado.datos?.features ?? []) {
      const destino = destinoDe(f.properties)
      const id = destino?.id ?? idDeElemento(f)
      const objeto = destino?.objeto ?? capa(estado.id)?.objeto ?? ''
      if (FICHA[objeto] && !lugares.has(`${objeto}:${id}`)) lugares.set(`${objeto}:${id}`, { id, objeto, nombre: String(f.properties.name ?? '') })
    }
  const cargando = estadosBasicos.some((e) => e.cargando)
  const bloqueadas = estadosBasicos.some((e) => e.bloqueada)
  const conError = estadosBasicos.some((e) => !e.bloqueada && e.error)
  // acotado: la consulta sigue la vista del mapa, así que un mapa vacío solo dice que la vista lo está. con capas por WMS, el mapa
  // no está vacío aunque el GeoJSON lo esté
  const aviso = servicio.wms.length > 0 ? null : avisoDelMapa(estados, true)
  // un lugar abre su ficha contextual; un registro de una capa de gestión lleva a su ficha por /r/, que la busca con su proyecto
  const abrir = (objeto: string, id: string) => {
    if (FICHA[objeto]) return elegir(objeto, id)
    const ruta = objeto ? rutaParaAbrir(objeto, id) : null
    if (ruta) navegar(ruta, { state: paso(t('mapa.mapaTerritorial')) })
  }
  const descargar = () => {
    const png = capturar.current()
    if (!png) return
    const enlace = document.createElement('a')
    enlace.href = png
    enlace.download = 'mapa-territorial.png'
    enlace.click()
  }

  const capasAbiertas = !plegados.has('layers')
  const lugaresAbiertos = !plegados.has('places')
  const idDeCapas = 'panel-de-capas'
  const idDeLugares = 'panel-de-lugares'
  // los paneles flotan sobre el mapa desde md; en el teléfono van debajo, a todo el ancho (02 §7)
  const PANEL = 'rounded-sg-lg border border-sg-border bg-sg-surface-raised p-3 text-sm shadow-sg-md md:absolute md:z-10 md:overflow-y-auto'
  const BOTON_DE_PANEL =
    'inline-flex h-8 items-center gap-1.5 rounded-sg-md border border-sg-border bg-sg-surface px-2.5 text-sm text-sg-text hover:bg-sg-surface-hover aria-expanded:border-sg-primary aria-expanded:text-sg-primary-text'
  const exporta = capasExportables(can).length > 0
  const importa = DESTINOS.some((d) => importaA(can, d))

  return (
    <ContenedorDePagina className="space-y-3">
      {/* una sola primaria («Nueva comunidad»); el cambio de vista entre el mapa y el tablero queda a mano, y lo demás va en
          «Más acciones» (U-10, DD-11) */}
      <EncabezadoDePagina
        titulo={modo === 'tablero' ? t('tableroTerritorial.titulo') : t('mapa.mapaTerritorial')}
        vistas={
          modo === 'tablero' ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/territory${sufijo}`}>{t('tableroTerritorial.irAlMapa')}</Link>
            </Button>
          ) : conTablero ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/territory/dashboard${sufijo}`}>{t('tableroTerritorial.irAlTablero')}</Link>
            </Button>
          ) : undefined
        }
        mas={
          <>
            <Link to="/territory/quality" className={DEL_MENU}>
              {t('calidad.titulo')}
            </Link>
            <button type="button" className={DEL_MENU} onClick={descargar}>
              {t('mapa.capturar')}
            </button>
            {exporta ? (
              <button type="button" className={DEL_MENU} onClick={() => setExportando(true)}>
                {t('exportacionGeografica.abrir')}
              </button>
            ) : null}
            {importa ? (
              <Link to={`/territory/imports/new${sufijo}`} className={DEL_MENU}>
                {t('mapa.importar')}
              </Link>
            ) : null}
          </>
        }
        primaria={
          can('community', 'CREATE') ? (
            <Button size="sm" onClick={() => setCreando(true)}>
              {t('mapa.nuevaComunidad')}
            </Button>
          ) : undefined
        }
      />
      <FiltrosDelMapa />
      {servicio.caido ? (
        <Alert tone="warning">
          <span className="flex flex-wrap items-center gap-2">
            {t('sig.wmsCaido')}
            <Button size="sm" variant="secondary" onClick={servicio.reintentar}>
              {t('sig.reintentar')}
            </Button>
          </span>
        </Alert>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={BOTON_DE_PANEL}
          aria-expanded={capasAbiertas}
          aria-controls={capasAbiertas ? idDeCapas : undefined}
          onClick={() => alternar('layers')}
        >
          <Layers aria-hidden className="size-4" />
          {t('mapa.paneles.capas', { n: encendidas.size })}
        </button>
        <button
          type="button"
          className={BOTON_DE_PANEL}
          aria-expanded={lugaresAbiertos}
          aria-controls={lugaresAbiertos ? idDeLugares : undefined}
          onClick={() => alternar('places')}
        >
          <List aria-hidden className="size-4" />
          {t('mapa.paneles.lugares', { n: lugares.size })}
        </button>
      </div>
      {/* el lienzo a todo el ancho útil; las capas (con su leyenda) y los lugares flotan encima, plegables (DD-11, P-06) */}
      <div className="relative space-y-3 md:space-y-0">
        <Mapa
          className="relative h-[70vh] max-h-[760px] min-h-[420px] w-full overflow-hidden rounded-sg-lg border border-sg-border bg-sg-surface-sunken"
          etiqueta={t('mapa.mapaTerritorial')}
          capas={estados
            .filter((e) => e.datos)
            .map((e) => ({
              id: e.id,
              datos: e.datos!,
              color: capa(e.id)!.color,
              ...dibujoDe(e.id),
              seleccionable: Boolean(FICHA[capa(e.id)!.objeto]) || capa(e.id)!.grupo === 'gestion',
              invisible: servicio.porWms.has(e.id)
            }))}
          calor={calor}
          wms={servicio.wms}
          alFallarWms={servicio.alFallar}
          seleccion={elegido?.id ?? null}
          alSeleccionar={(id, capaId, objeto) => abrir(objeto ?? capa(capaId)?.objeto ?? '', id)}
          alMoverVista={setEncuadre}
          vistaInicial={vistaInicial}
          alCapturar={(f) => (capturar.current = f)}
        />
        {capasAbiertas ? (
          <PanelDeCapas
            id={idDeCapas}
            className={`${PANEL} md:top-3 md:left-3 md:max-h-[calc(100%-5.5rem)] md:w-72`}
            ids={ids}
            encendidas={encendidas}
            estados={estados}
            gestion={<SelectorDeCalor valor={objetoDeCalor} alCambiar={elegirCalor} />}
            alCambiar={(id, si) => {
              const siguiente = new Set(encendidas)
              if (si) siguiente.add(id)
              else siguiente.delete(id)
              setEncendidas(siguiente)
            }}
          />
        ) : null}
        {lugaresAbiertos ? (
          // a la izquierda del zoom de MapLibre, que va arriba a la derecha
          <div id={idDeLugares} className={`${PANEL} space-y-3 md:top-3 md:right-12 md:max-h-[calc(100%-3rem)] md:w-80`}>
            {elegido ? (
              <FichaContextual
                key={`${elegido.objeto}:${elegido.id}`}
                objeto={elegido.objeto}
                id={elegido.id}
                proyecto={proyecto}
                periodo={periodo}
                alCerrar={() => elegir('', null)}
              />
            ) : null}
            <nav aria-label={t('mapa.lugares')} className="space-y-2">
              <h2 className="font-medium">{t('mapa.lugares')}</h2>
              <p className="text-sg-caption text-sg-text-muted">{t('mapa.elegirLugar')}</p>
              {/* sin lugares, la lista dice por qué: cargando, una capa que falló (la lista estaría incompleta) o, solo si todo
                  respondió, que no hay lugares en la vista */}
              {lugares.size === 0 && cargando ? (
                <p role="status" className="text-sg-caption text-sg-text-muted">
                  {t('comun.cargando')}
                </p>
              ) : null}
              {conError ? (
                <p role="alert" className="text-sg-caption text-sg-danger">
                  {t('mapa.errorDeCapa')}
                </p>
              ) : null}
              {bloqueadas ? <p className="text-sg-caption text-sg-text-muted">{t('territorio.capasBloqueadas')}</p> : null}
              {lugares.size === 0 && !cargando && !conError && !bloqueadas && (aviso === null || aviso === 'vistaVacia') ? (
                <p className="text-sg-caption text-sg-text-muted">{t('mapa.sinLugares')}</p>
              ) : null}
              <ul className="space-y-1">
                {[...lugares.values()].map((l) => (
                  <li key={`${l.objeto}-${l.id}`}>
                    <Link to={rutaDe(l.objeto, l.id)!} state={paso(t('mapa.mapaTerritorial'))} className="text-sg-primary-text underline">
                      {l.nombre || t('territorio.sinNombre')}
                    </Link>
                    {/* la alternativa de teclado del clic en el mapa: abre la ficha contextual */}
                    {/* un ícono y no «Ver resumen» repetido en cada fila; el nombre accesible y el title dicen de qué lugar */}
                    <button
                      type="button"
                      className="ml-2 inline-flex size-6 items-center justify-center rounded-sg-sm align-middle text-sg-text-secondary hover:bg-sg-surface-hover hover:text-sg-text"
                      aria-label={t('fichaTerritorial.verResumen', { nombre: l.nombre || t('territorio.sinNombre') })}
                      title={t('fichaTerritorial.verResumenCorto')}
                      onClick={() => elegir(l.objeto, l.id)}
                    >
                      <PanelRightOpen aria-hidden className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <AgregadosDelMapa estados={estadosDeGestion} />
          </div>
        ) : null}
      </div>
      {aviso ? (
        <p role="status" className="text-sm text-sg-text-muted">
          {t(`mapa.avisos.${aviso}`)}
        </p>
      ) : null}
      {objetoDeCalor ? <TablaDeCalor objeto={objetoDeCalor} consulta={concentracion} /> : null}
      {/* la clave suma el periodo: con otro periodo la lista vuelve a su primera página */}
      {elegido ? (
        <RegistrosDeLaZona
          key={`${elegido.objeto}:${elegido.id}:${periodo.periodStart ?? ''}:${periodo.periodEnd ?? ''}`}
          zona={elegido.objeto}
          id={elegido.id}
          periodo={periodo}
        />
      ) : null}
      {modo === 'tablero' ? (
        proyecto ? (
          <EstadisticasTerritoriales proyecto={proyecto} periodo={periodo} />
        ) : (
          <Alert tone="notice">{t('tableroTerritorial.eligeProyecto')}</Alert>
        )
      ) : null}
      <DialogoDeExportacion abierto={exportando} alCerrar={() => setExportando(false)} proyecto={proyecto} capaInicial="LYR-05" />
      <Drawer titulo={t('mapa.nuevaComunidad')} abierto={creando} alCerrar={() => setCreando(false)}>
        <FormularioDeRegistro
          objeto="community"
          alGuardar={(c) => navegar(`/territory/communities/${encodeURIComponent(c.id)}${sufijo}`)}
          alCancelar={() => setCreando(false)}
        />
      </Drawer>
    </ContenedorDePagina>
  )
}

// el periodo que el servidor acepta (TerritoryQueries.period): sin fin, hoy en Lima; sin inicio, los 12 meses que terminan en el
// fin; el inicio no pasa del fin y el periodo dura menos de 5 años (el fin, antes del inicio más 5 años). AAAA-MM-DD se compara
// como texto
const MAXIMO_DE_ANOS = 5
const masAnos = (dia: string, anos: number): string => {
  const [a, m, d] = dia.split('-').map(Number)
  // un 29 de febrero cae al 28 en un año que no es bisiesto, como plusYears de java.time
  const ultimo = new Date(Date.UTC(a + anos, m, 0)).getUTCDate()
  return `${String(a + anos).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}
const diaSiguiente = (dia: string): string => new Date(Date.parse(`${dia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

export function problemaDelPeriodo(desde: string, hasta: string, hoy: string = hoyEnLima()): 'periodoAlReves' | 'periodoLargo' | null {
  if (!desde && !hasta) return null
  const fin = hasta || hoy
  const inicio = desde || diaSiguiente(masAnos(fin, -1))
  if (inicio > fin) return 'periodoAlReves'
  return fin < masAnos(inicio, MAXIMO_DE_ANOS) ? null : 'periodoLargo'
}

// el periodo del mapa, en la URL (screens.md S12, «MapFilters»): lo leen las capas de gestión, el calor, la ficha y los registros
// de la zona (las de referencia no tienen fecha: enmienda 5.2 del plan 6.3). un periodo que el servidor rechazaría (OUT_OF_RANGE)
// se dice aquí y no llega a la URL (enmienda 5.3). el proyecto del mapa (?project=, que acota las capas de proyecto y marca sus
// concesiones) lo elige el selector de la barra, que en Territorio es el lente (A24): la pantalla no tiene uno propio
export function FiltrosDelMapa() {
  const { t } = useTranslation(NS)
  const [busqueda, fijar] = useSearchParams()
  // las fechas tecleadas que no forman un periodo válido: se muestran y se dicen, sin escribirlas en la URL. valen mientras el
  // periodo de la URL sea el mismo que cuando se teclearon: si cambia por otro camino (atrás, un enlace), mandan las de la URL
  const enLaUrl = `${busqueda.get('periodStart') ?? ''}|${busqueda.get('periodEnd') ?? ''}`
  const [tecleado, setBorrador] = useState<{
    periodStart: string
    periodEnd: string
    problema: 'periodoAlReves' | 'periodoLargo'
    enLaUrl: string
  } | null>(null)
  const borrador = tecleado?.enLaUrl === enLaUrl ? tecleado : null
  const fecha = (clave: 'periodStart' | 'periodEnd') => (borrador ? borrador[clave] : (busqueda.get(clave) ?? ''))
  const escribir = (valores: Record<string, string>) => {
    const siguiente = new URLSearchParams(busqueda)
    for (const [clave, valor] of Object.entries(valores))
      if (valor) siguiente.set(clave, valor)
      else siguiente.delete(clave)
    fijar(siguiente, { replace: true })
  }
  const cambiarPeriodo = (clave: 'periodStart' | 'periodEnd', valor: string) => {
    const periodo = { periodStart: fecha('periodStart'), periodEnd: fecha('periodEnd'), [clave]: valor }
    const problema = problemaDelPeriodo(periodo.periodStart, periodo.periodEnd)
    if (problema) return setBorrador({ ...periodo, problema, enLaUrl })
    setBorrador(null)
    escribir(periodo)
  }
  return (
    <div role="group" aria-label={t('sig.filtros')} className="space-y-1 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <CampoFecha
          etiqueta={t('sig.desde')}
          valor={fecha('periodStart') || null}
          invalido={Boolean(borrador)}
          alCambiar={(v) => cambiarPeriodo('periodStart', v ?? '')}
        />
        <CampoFecha
          etiqueta={t('sig.hasta')}
          valor={fecha('periodEnd') || null}
          invalido={Boolean(borrador)}
          alCambiar={(v) => cambiarPeriodo('periodEnd', v ?? '')}
        />
        {/* un atajo es siempre un periodo válido (a lo sumo un año): quita lo tecleado que no valía */}
        <AtajosDePeriodo
          desde={fecha('periodStart')}
          hasta={fecha('periodEnd')}
          alElegir={({ desde, hasta }) => {
            setBorrador(null)
            escribir({ periodStart: desde, periodEnd: hasta })
          }}
        />
      </div>
      {borrador ? (
        <p role="alert" className="text-sg-caption text-sg-danger">
          {t(`sig.${borrador.problema}`)}
        </p>
      ) : null}
      <p className="text-sg-caption text-sg-text-muted">{t('sig.ayudaDelPeriodo')}</p>
    </div>
  )
}
