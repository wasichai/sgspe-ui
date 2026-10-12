import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CONTROL } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { useProyectos } from '../contexto/proyectos'
import { useSiguientePaso } from '../contexto/Rastro'
import { hoyEnLima } from '../datos/fechas'
import { rutaParaAbrir } from '../datos/fichas'
import { texto } from '../datos/registros'
import { NS } from '../i18n'
import { destinoDe, idDeElemento, useCapas, useCapasDisponibles, type Encuadre } from '../mapa/api'
import { avisoDelMapa } from '../mapa/avisos'
import { CAPAS_DE_GESTION, CAPAS_TERRITORIALES, capa, dibujoDe } from '../mapa/capas'
import { capaDeCalor, SelectorDeCalor, TablaDeCalor } from '../mapa/Calor'
import { ControlDeCapas } from '../mapa/ControlDeCapas'
import { Leyenda } from '../mapa/Leyenda'
import { Mapa } from '../mapa/Mapa'
import { useWms } from '../mapa/wms'
import { AgregadosDelMapa } from './AgregadosDelMapa'
import { OBJETOS_DE_CALOR, useConcentracion, type ObjetoDeCalor } from './consultas'
import { DialogoDeExportacion } from './DialogoDeExportacion'
import { EstadisticasTerritoriales } from './EstadisticasTerritoriales'
import { capasExportables } from './exportacion'
import { FichaContextual } from './FichaContextual'
import { DESTINOS, importaA } from './importacion'
import { RegistrosDeLaZona } from './RegistrosDeLaZona'

// S12 · mapa territorial (screens.md §4, spec F6 §3.7): las capas públicas por WMS del proxy (nombradas por su GetCapabilities) y
// el resto por GeoJSON; los lugares con ficha se siguen pidiendo por GeoJSON, invisibles sobre la tesela, para elegirlos y para la
// lista de lugares visibles, su alternativa de teclado. si GeoServer no responde (503), el WMS se apaga y esas capas vuelven al
// GeoJSON de F2, con un aviso. el grupo Gestión ofrece las capas LYR-17 a LYR-24 que el backend sirve (plan 6.2c; las que
// responden 404 no se ofrecen) con el periodo, y sus agregados por localidad en texto. filtros de proyecto y periodo en la URL,
// leyenda de la paleta compartida y «Capturar PNG». elegir un lugar (?selected=) abre su ficha contextual con KPI-TER-01 y sus
// registros bajo el mapa. "Nueva comunidad" es el flujo 2. en modo tablero (/territory/dashboard, dashboards.md §5.9) suma
// KPI-TER-02 a 04 del proyecto elegido
const FICHA: Record<string, string> = { community: 'communities', locality: 'localities' }
// las capas cuyos lugares tienen ficha (decisión 7 del plan 6.3)
const SELECCIONABLES = new Set(['LYR-02', 'LYR-03', 'LYR-05'])
const DE_GESTION = CAPAS_DE_GESTION.map((c) => c.id)
// la capa que dice si el backend sirve las de gestión: de registros (los compromisos), no un agregado, que sale caro sondear
const SONDA_DE_GESTION = 'LYR-19'

export function TerritorioPage({ modo = 'mapa' }: { modo?: 'mapa' | 'tablero' } = {}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
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
  const elegir = (objeto: string, id: string | null) => {
    const siguiente = new URLSearchParams(busqueda)
    if (id && FICHA[objeto]) siguiente.set('selected', `${objeto}:${id}`)
    else siguiente.delete('selected')
    fijar(siguiente, { replace: true })
  }
  const [encendidas, setEncendidas] = useState(() => new Set<string>(['LYR-02', 'LYR-05']))
  const [encuadre, setEncuadre] = useState<Encuadre | null>(null)
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
    { project: proyecto, bbox: encuadre }
  )
  const estadosDeGestion = useCapas(
    disponibles.filter((id) => encendidas.has(id)),
    { project: proyecto, ...periodo, bbox: encuadre }
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

  return (
    <section className="mx-auto max-w-[1440px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{modo === 'tablero' ? t('tableroTerritorial.titulo') : t('mapa.mapaTerritorial')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={descargar}>
            {t('mapa.capturar')}
          </Button>
          {capasExportables(can).length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setExportando(true)}>
              {t('exportacionGeografica.abrir')}
            </Button>
          ) : null}
          {can('community', 'CREATE') ? (
            <Button size="sm" onClick={() => setCreando(true)}>
              {t('mapa.nuevaComunidad')}
            </Button>
          ) : null}
          {DESTINOS.some((d) => importaA(can, d)) ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/territory/imports/new${sufijo}`}>{t('mapa.importar')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
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
      <div className="grid gap-3 lg:grid-cols-[260px_1fr_300px]">
        <div className="space-y-3">
          <ControlDeCapas
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
          <Leyenda ids={ids.filter((id) => encendidas.has(id))} />
        </div>
        <div className="space-y-1">
          <Mapa
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
            alCapturar={(f) => (capturar.current = f)}
          />
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
        </div>
        <div className="space-y-3">
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
          <nav aria-label={t('mapa.lugares')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
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
            <ul className="max-h-[420px] space-y-1 overflow-y-auto">
              {[...lugares.values()].map((l) => (
                <li key={`${l.objeto}-${l.id}`}>
                  <Link to={rutaDe(l.objeto, l.id)!} state={paso(t('mapa.mapaTerritorial'))} className="text-sg-primary-text underline">
                    {l.nombre || t('territorio.sinNombre')}
                  </Link>
                  {/* la alternativa de teclado del clic en el mapa: abre la ficha contextual */}
                  <button
                    type="button"
                    className="ml-2 text-sg-caption text-sg-text-secondary underline"
                    aria-label={t('fichaTerritorial.verResumen', { nombre: l.nombre || t('territorio.sinNombre') })}
                    onClick={() => elegir(l.objeto, l.id)}
                  >
                    {t('fichaTerritorial.verResumenCorto')}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <AgregadosDelMapa estados={estadosDeGestion} />
        </div>
      </div>
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
    </section>
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

// el proyecto y el periodo del mapa, en la URL (screens.md S12, «MapFilters»): el proyecto acota las capas de proyecto y marca
// las concesiones del proyecto; el periodo lo leen las capas de gestión, el calor, la ficha y los registros de la zona (las de
// referencia no tienen fecha: enmienda 5.2 del plan 6.3). un periodo que el servidor rechazaría (OUT_OF_RANGE) se dice aquí y
// no llega a la URL (enmienda 5.3)
export function FiltrosDelMapa() {
  const { t } = useTranslation(NS)
  const [busqueda, fijar] = useSearchParams()
  const proyectos = useProyectos()
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
        <label className="space-y-1">
          <span className="block text-sg-label">{t('sig.proyecto')}</span>
          <select className={CONTROL} value={busqueda.get('project') ?? ''} onChange={(e) => escribir({ project: e.target.value })}>
            <option value="">{t('sig.todosLosLugares')}</option>
            {(proyectos.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {texto(p, 'code')} · {texto(p, 'name')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sg-label">{t('sig.desde')}</span>
          <input
            type="date"
            className={CONTROL}
            value={fecha('periodStart')}
            aria-invalid={borrador ? true : undefined}
            onChange={(e) => cambiarPeriodo('periodStart', e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sg-label">{t('sig.hasta')}</span>
          <input
            type="date"
            className={CONTROL}
            value={fecha('periodEnd')}
            aria-invalid={borrador ? true : undefined}
            onChange={(e) => cambiarPeriodo('periodEnd', e.target.value)}
          />
        </label>
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
