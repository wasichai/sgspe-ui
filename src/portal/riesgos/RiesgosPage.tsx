import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { PaginasDeRiesgos, useBaseDeRiesgos } from './PaginasDeRiesgos'
import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useSiguientePaso } from '../contexto/Rastro'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { ordenEnUrl, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { ListaConMapa, ofreceMapa, VISTA_MAPA } from '../mapa/ListaConMapa'
import { TablaPriorizada, type ColumnaPriorizada, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { ordenarEnCliente, posicionEn, type ValorDeOrden } from '../componentes/ordenEnCliente'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { rutaDeFicha } from '../datos/fichas'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyecto, useProyectos } from '../contexto/proyectos'
import { atributo, texto, useTodosSinTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { NivelDeRiesgo } from './NivelDeRiesgo'
import { NIVELES, nivelDePuntaje, umbralesDe } from './niveles'
import { opcion } from '../datos/opciones'
import { useDiasDelPlazo } from '../componentes/DiasDelPlazo'
import { Dia } from '../componentes/Dia'
import { AlertasActivas, AvisoDeTriaje } from './AlertasDelRegistro'
import { MatrizDeRiesgo } from './MatrizDeRiesgo'
import { Tendencia } from './Tendencia'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { Persona } from '../componentes/Persona'
import { Seccion } from '../componentes/Seccion'
import { CampoDeMotivo, useMotivo } from '../componentes/Motivo'
import { comparable } from '../componentes/FiltroDeGrupo'

// S38 y S39 · registro y matriz de riesgos (screens.md §9): qué riesgos hay, de qué nivel y cuáles piden revisión. la misma página
// con alcance global (columna Proyecto) o de un proyecto (ASM-076). la API genérica no filtra por estado ni por situación, así que,
// como la lista de compromisos, se leen los riesgos del alcance con tope (avisa si recorta) y las vistas y la celda elegida se arman
// aquí. el mapa de calor 5 × 5 cuenta los riesgos por sus valores vigentes (probabilidad e impacto, derivados de la última revisión
// no residual); uno sin revisión no entra al mapa y se cuenta aparte. elegir una celda filtra la tabla. «Identificar riesgo» crea
// el riesgo en identified con motivo (social_risk es requiresReason); ?nuevo=1 lo abre, y ?origin_incident= lo crea desde un
// incidente
// «Vigentes en el mapa» (VISTA_MAPA) es la vista «Lista + mapa» (design-system.md §5.3): los vigentes junto al mapa; nunca la de
// entrada y solo si algún riesgo de la lista trae ubicación
const VISTAS = ['registro', 'revision', 'mios', 'cerrados', VISTA_MAPA] as const
const CAMPOS_DEL_ALTA = [
  'code',
  'title',
  'risk_source',
  'category',
  'impact_type',
  'impact_nature',
  'owner_user_id',
  'owner_user_email',
  'review_every_days',
  'locality',
  'community'
]

const cerrado = (r: Registro) => r.state === 'closed'

const NIVELES_ALTOS = ['ALTO', 'CRITICO']

// el orden por columna (05-especificacion §1.6) es del portal, que ya tiene todos los riesgos del alcance: el riesgo por su código
// (el orden que la lista ya pedía), P × I por su puntaje y el nivel por su orden de negocio (bajo, medio, alto, crítico), nunca por
// su texto. un riesgo sin puntaje o sin nivel va al final en los dos sentidos
const ORDEN_INICIAL: OrdenDeTabla = { columna: 'riesgo', dir: 'asc' }
export function valorDeOrden(r: Registro, columna: string): ValorDeOrden {
  switch (columna) {
    case 'puntaje':
      return celdaDe(r) && texto(r, 'score') ? Number(texto(r, 'score')) : null
    case 'nivel':
      return posicionEn(NIVELES, atributo(r, 'risk_level'))
    default:
      return texto(r, 'code')
  }
}

export function enVista(vista: string, r: Registro, usuario: string | undefined): boolean {
  switch (vista) {
    case 'revision':
      return !cerrado(r) && ['POR REVISAR', 'REVISION VENCIDA'].includes(texto(r, 'review_status'))
    case 'mios':
      return !cerrado(r) && atributo(r, 'owner_user_id') === usuario
    case 'cerrados':
      return cerrado(r)
    default:
      return !cerrado(r)
  }
}

// la celda P-I de un riesgo con valores vigentes; sin ellos, null (sin evaluar)
export function celdaDe(r: Registro): string | null {
  const p = Number(atributo(r, 'probability'))
  const i = Number(atributo(r, 'impact'))
  return Number.isInteger(p) && Number.isInteger(i) && p >= 1 && p <= 5 && i >= 1 && i <= 5 ? `${p}-${i}` : null
}

export function RiesgosPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const lista = useParametrosDeLista('registro')
  const telefono = useEsTelefono()
  // Enter en una fila abre su ficha y Espacio su vista previa (05-especificacion §1.6), como el enlace y el ojo de la fila
  const navegar = useNavigate()
  const paso = useSiguientePaso()
  const [busqueda, fijar] = useSearchParams()
  // todos los riesgos del alcance, sin tope: la matriz de calor cuenta cada celda con el conjunto entero (D10 de la revisión de UX)
  const riesgos = useTodosSinTope('social_risk', { project: proyecto, sort: 'code', dir: 'asc' })
  const registroDelProyecto = useProyecto(proyecto)
  const proyectos = useProyectos()
  const umbrales = umbralesDe(registroDelProyecto.data)
  const celda = lista.filtro('cell')
  // ?level=alto: los de nivel alto o crítico, como «Riesgos altos» (KPI-RSK-01) del resumen y del tablero (revisión de UX, etapa 6)
  const soloAltos = lista.filtro('level') === 'alto'
  const enLaVista = (riesgos.data ?? []).filter((r) => enVista(lista.vista, r, user?.id) && (!soloAltos || NIVELES_ALTOS.includes(texto(r, 'risk_level'))))
  // el orden viaja en la URL (ordenEnUrl, DD-37): volver de una ficha lo conserva
  const [orden, setOrden] = ordenEnUrl(lista, ORDEN_INICIAL, ['riesgo', 'puntaje', 'nivel'])
  // la búsqueda (?q=) por código o título, sin tildes ni mayúsculas (tercera pasada de UX, 3.7); como la celda, filtra la lista y
  // no la matriz
  const buscadoEnUrl = lista.filtro('q').trim()
  const buscado = comparable(buscadoEnUrl)
  const coincide = (r: Registro) => !buscado || comparable(`${texto(r, 'code')} ${texto(r, 'title')}`).includes(buscado)
  const filtrados = ordenarEnCliente(
    enLaVista.filter((r) => (!celda || celdaDe(r) === celda) && coincide(r)),
    orden,
    valorDeOrden
  )
  // «Lista + mapa»: se ofrece si algún riesgo de la lista trae ubicación; en ella, sin ninguno, se dice y queda la tabla
  const enMapa = lista.vista === VISTA_MAPA
  const conUbicacion = ofreceMapa('social_risk', filtrados)
  const enLaVistaSinFiltros = (riesgos.data ?? []).filter((r) => enVista(lista.vista, r, user?.id)).length
  const sinEvaluar = enLaVista.filter((r) => celdaDe(r) === null).length
  // la matriz cuenta los riesgos de la vista por su celda P-I (los sin revisión no entran)
  const conteoDeCeldas = new Map<string, number>()
  for (const r of enLaVista) {
    const c = celdaDe(r)
    if (c) conteoDeCeldas.set(c, (conteoDeCeldas.get(c) ?? 0) + 1)
  }
  const crea = proyecto !== undefined && escribe && can('social_risk', 'CREATE')
  const nuevo = busqueda.get('nuevo') === '1'
  const incidente = busqueda.get('origin_incident')
  const abrirAlta = (abrir: boolean) => {
    const siguiente = new URLSearchParams(busqueda)
    if (abrir) siguiente.set('nuevo', '1')
    else {
      siguiente.delete('nuevo')
      siguiente.delete('origin_incident')
    }
    fijar(siguiente, { replace: true })
  }
  const nombreDelProyecto = (id: string) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
  const [p, i] = celda.split('-')
  const chips = [
    ...(soloAltos ? [{ clave: 'level', etiqueta: t('riesgos.filtroAltos') }] : []),
    ...(celda ? [{ clave: 'cell', etiqueta: t('riesgos.filtroCelda', { p, i }) }] : []),
    ...(buscadoEnUrl ? [{ clave: 'q', etiqueta: t('comun.contiene', { texto: buscadoEnUrl }) }] : [])
  ]
  // la tabla de S10 a todo el ancho, con prioridad de columnas (hallazgo U-06, DD-05): el riesgo con su código y su categoría
  // debajo, P × I numérico, el nivel con barras y la tendencia apilados, el estado y la revisión como situación con sus días. el
  // proyecto en el alcance global; el responsable, secundaria desde xl (en «Mis riesgos» es quien mira: no se dibuja). una columna
  // no esencial que dice lo mismo en todas las filas sale a una nota encima
  const columnas: ColumnaPriorizada[] = [
    { id: 'riesgo', encabezado: t('riesgos.columnas.riesgo'), prioridad: 'esencial', titulo: true, ordenable: true },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('riesgos.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    { id: 'puntaje', encabezado: t('riesgos.columnas.puntaje'), prioridad: 'esencial', numerica: true, ordenable: true },
    { id: 'nivel', encabezado: t('riesgos.columnas.nivel'), prioridad: 'esencial', ordenable: true },
    { id: 'estado', encabezado: t('riesgos.columnas.estado'), prioridad: 'esencial' },
    { id: 'revision', encabezado: t('riesgos.columnas.revision'), prioridad: 'esencial' },
    ...(lista.vista === 'mios'
      ? []
      : [{ id: 'responsable', encabezado: t('riesgos.columnas.responsable'), prioridad: 'secundaria' as const, claseDeCelda: 'text-sm' }])
  ]
  const enlaceDe = (r: Registro) => (
    <EnlaceDeRegistro
      codigo={texto(r, 'code')}
      titulo={texto(r, 'title')}
      ruta={rutaDeFicha('social_risk', r)}
      desde={t('riesgos.titulo')}
      previa={{ objeto: 'social_risk', id: r.id }}
    />
  )
  const celdaDeTabla = (r: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'riesgo':
        return (
          <>
            {enlaceDe(r)}
            {opcion(r, 'category') ? <span className="block text-sg-caption text-sg-text-secondary">{opcion(r, 'category')}</span> : null}
          </>
        )
      case 'proyecto':
        return nombreDelProyecto(texto(r, 'project'))
      case 'puntaje':
        // sin valores vigentes, vacío: la columna numérica dibuja «—», con su nota al pie
        return celdaDe(r) && texto(r, 'score') ? <PuntajeDelRiesgo riesgo={r} /> : null
      case 'nivel':
        return <NivelYTendencia riesgo={r} />
      case 'estado':
        return <EstadoChip objeto="social_risk" estado={r.state} />
      case 'revision':
        return <RevisionDelRiesgo riesgo={r} />
      default:
        return <Persona correo={texto(r, 'owner_user_email')} />
    }
  }
  const valorPlano = (r: Registro, columna: string): string => (columna === 'responsable' ? texto(r, 'owner_user_email').toLowerCase() : r.id)
  // «5 riesgos · 1 crítico · 2 alertas activas» (S10): lo que muestra la vista, cuántos de ellos son críticos y, en un proyecto,
  // cuántas alertas siguen activas
  const criticos = filtrados.filter((r) => texto(r, 'risk_level') === 'CRITICO').length
  const conAlertas = proyecto !== undefined && can('early_warning', 'READ')
  const base = useBaseDeRiesgos()
  return (
    <ContenedorDePagina elemento="section">
      {/* la sección aterriza en el registro y la matriz (decisión 7 de la revisión de UX); las demás páginas de Riesgos y su tablero
          van en las pestañas de debajo, y las reglas de alerta son una acción (S10) */}
      <EncabezadoDePagina
        titulo={conAlertas ? t('riesgos.tituloConAlertas') : t('riesgos.titulo')}
        conteo={
          riesgos.data
            ? [t('riesgos.conteo', { count: filtrados.length }), ...(criticos > 0 ? [t('riesgos.criticos', { count: criticos })] : [])].join(' · ')
            : undefined
        }
        secundarias={
          can('early_warning_rule', 'READ') ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`${base}/risks/rules`}>{t('riesgos.verReglas')}</Link>
            </Button>
          ) : undefined
        }
        primaria={
          proyecto ? (
            crea ? (
              <Button size="sm" onClick={() => abrirAlta(true)}>
                {t('riesgos.identificar')}
              </Button>
            ) : undefined
          ) : (
            <BotonCrear objeto="social_risk" etiqueta={t('riesgos.identificar')} resto="risks?nuevo=1" />
          )
        }
      />
      <PaginasDeRiesgos actual="registro" />
      {conAlertas ? <AvisoDeTriaje proyecto={proyecto} /> : null}
      {/* la barra de filtros (P-02; hallazgos U-18 y U-22): las vistas del registro, el único selector de vista de la página, en
          una sola fila con su conteo, y el nivel y la celda de la matriz como chips con «Limpiar». ?view=, ?level= y ?cell= siguen
          siendo los mismos */}
      <BarraDeFiltros
        vista={
          <SelectorDeVista
            etiqueta={t('comun.vistas')}
            vistas={VISTAS.filter((v) => v !== VISTA_MAPA || conUbicacion || enMapa).map((v) => ({
              id: v,
              etiqueta: t(`riesgos.vistas.${v}`),
              n: v === VISTA_MAPA ? undefined : riesgos.data ? riesgos.data.filter((r) => enVista(v, r, user?.id)).length : null
            }))}
            actual={lista.vista}
            alElegir={(vista) => lista.cambiar({ view: vista, cell: null })}
          />
        }
        busqueda={{ etiqueta: t('riesgos.buscar'), valor: lista.filtro('q'), alCambiar: (q) => lista.cambiar({ q }) }}
        aplicados={chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
        alLimpiar={() => lista.cambiar({ level: null, cell: null, q: null })}
      />
      {riesgos.isPending ? (
        <Cargando />
      ) : riesgos.isError && !riesgos.data ? (
        <FalloDeLectura error={riesgos.error} alReintentar={() => void riesgos.refetch()} />
      ) : (riesgos.data ?? []).length === 0 ? (
        // sin ningún riesgo, ni la matriz llena de ceros ni «esta vista»: el registro está vacío y se dice cómo empezarlo (rediseño de
        // UX, 2026-10-20)
        <>
          <Vacio titulo={t('riesgos.sinRiesgos')}>{can('social_risk', 'CREATE') ? t('riesgos.sinRiesgosAyuda') : null}</Vacio>
          {conAlertas ? <AlertasActivas proyecto={proyecto} /> : null}
        </>
      ) : (
        <>
          {/* la matriz de 420 px y, en un proyecto, la alerta temprana a su lado (S10); el registro, debajo a todo el ancho */}
          <div className={conAlertas ? 'grid items-start gap-4 lg:grid-cols-[420px_minmax(0,1fr)]' : 'max-w-[420px]'}>
            <Seccion titulo={t('riesgos.mapa.titulo')}>
              <MatrizDeRiesgo
                etiqueta={t('riesgos.mapa.leyenda')}
                celda={(p, i) => ({ n: conteoDeCeldas.get(`${p}-${i}`) ?? 0, nivel: nivelDePuntaje(p * i, umbrales) })}
                umbrales={umbrales}
                elegida={celda}
                alElegir={(c) => lista.cambiar({ cell: c })}
              />
              <p className="text-sm text-sg-text-secondary">{t('riesgos.mapa.sinEvaluar', { n: numeroPe(sinEvaluar) })}</p>
              {celda ? (
                <button type="button" className="text-sm text-sg-primary-text underline" onClick={() => lista.cambiar({ cell: null })}>
                  {t('riesgos.mapa.quitar')}
                </button>
              ) : null}
            </Seccion>
            {conAlertas ? <AlertasActivas proyecto={proyecto} /> : null}
          </div>
          {enMapa && !conUbicacion && filtrados.length > 0 ? <Alert tone="notice">{t('mapa.listaConMapa.sinUbicaciones')}</Alert> : null}
          {filtrados.length === 0 ? (
            // con la celda o el nivel puestos, el vacío los quita (rediseño de UX, 2026-10-20); sin ellos, la vista está vacía
            celda || soloAltos || buscado ? (
              <VacioDeLista conFiltros alLimpiar={() => lista.cambiar({ cell: null, level: null, q: null })} sinFiltros={enLaVistaSinFiltros || undefined} />
            ) : (
              <Vacio titulo={t('riesgos.vacio')} />
            )
          ) : enMapa && conUbicacion ? (
            <ListaConMapa
              objeto="social_risk"
              etiqueta={t('riesgos.tabla')}
              registros={filtrados}
              proyecto={proyecto}
              nombreDe={(r) => [texto(r, 'code'), texto(r, 'title')].filter(Boolean).join(' · ')}
              detalleDe={(r) => (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <NivelDeRiesgo valor={atributo(r, 'risk_level')} />
                  <EstadoChip objeto="social_risk" estado={r.state} />
                </span>
              )}
              accionesDe={(r) => enlaceDe(r)}
              alAbrir={(r) => {
                const ruta = rutaDeFicha('social_risk', r)
                if (ruta) navegar(ruta, { state: paso(t('riesgos.titulo'), ruta) })
              }}
            />
          ) : telefono ? (
            <ListaEnTarjetas
              etiqueta={t('riesgos.tabla')}
              total={filtrados.length}
              tarjetas={filtrados.map((r) => ({
                id: r.id,
                titulo: enlaceDe(r),
                estado: (
                  <>
                    <NivelDeRiesgo valor={atributo(r, 'risk_level')} />
                    <EstadoChip objeto="social_risk" estado={r.state} />
                  </>
                ),
                plazo: <RevisionDelRiesgo riesgo={r} />,
                proyecto: proyecto ? undefined : nombreDelProyecto(texto(r, 'project'))
              }))}
            />
          ) : (
            <TablaPriorizada<Registro>
              etiqueta={t('riesgos.tabla')}
              total={filtrados.length}
              columnas={columnas}
              filas={filtrados}
              clave={(r) => r.id}
              celda={celdaDeTabla}
              valorPlano={valorPlano}
              ocultarUniformes
              orden={orden}
              alOrdenar={setOrden}
              alAbrir={(r) => {
                const ruta = rutaDeFicha('social_risk', r)
                if (ruta) navegar(ruta, { state: paso(t('riesgos.titulo'), ruta) })
              }}
              previaDe={(r) => ({ objeto: 'social_risk', id: r.id })}
              notaAlPie={filtrados.some((r) => !celdaDe(r) || !texto(r, 'score')) ? t('riesgos.notaSinPuntaje') : undefined}
            />
          )}
        </>
      )}
      {crea ? <AltaDeRiesgo proyecto={proyecto} incidente={incidente} abierto={nuevo} alCerrar={() => abrirAlta(false)} /> : null}
    </ContenedorDePagina>
  )
}

// P × I con su puntaje en 800 («4 × 4 = 16», S10)
function PuntajeDelRiesgo({ riesgo: r }: { riesgo: Registro }) {
  return (
    <span className="whitespace-nowrap">
      {texto(r, 'probability')} × {texto(r, 'impact')} = <span className="font-extrabold">{texto(r, 'score')}</span>
    </span>
  )
}

// el nivel con barras y, debajo, su tendencia frente a la revisión anterior (S10)
function NivelYTendencia({ riesgo: r }: { riesgo: Registro }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <NivelDeRiesgo valor={atributo(r, 'risk_level')} />
      <Tendencia valor={atributo(r, 'trend')} />
    </div>
  )
}

// la revisión como situación (S10: «REVISIÓN VENCIDA · 52 DÍAS», «POR REVISAR · 6 DÍAS», «AL DÍA»), con la fecha de la próxima
// revisión debajo. los días son los que faltan o pasaron hasta esa fecha, solo mientras JOB-01 dice una situación
function RevisionDelRiesgo({ riesgo: r }: { riesgo: Registro }) {
  const situacion = atributo(r, 'review_status')
  const proxima = texto(r, 'next_review_date')
  const dias = useDiasDelPlazo(situacion === 'REVISION VENCIDA' || situacion === 'POR REVISAR' ? proxima : null)
  return (
    <div className="flex flex-col items-start gap-1">
      <SituacionDePlazo valor={situacion} revision detalle={dias} />
      {proxima ? (
        <span className="text-sg-caption text-sg-text-muted">
          <Dia valor={proxima} />
        </span>
      ) : null}
    </div>
  )
}

// el alta de un riesgo con su motivo: el formulario de la metadata con el proyecto (y el incidente de origen) fijos
function AltaDeRiesgo({ proyecto, incidente, abierto, alCerrar }: { proyecto: string; incidente: string | null; abierto: boolean; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const motivo = useMotivo()
  const fijos = useMemo(() => (incidente ? { project: proyecto, origin_incident: incidente } : { project: proyecto }), [proyecto, incidente])
  const cerrar = () => {
    motivo.limpiar()
    alCerrar()
  }
  return (
    <Drawer titulo={t('riesgos.identificar')} descripcion={t('riesgos.alta.descripcion')} abierto={abierto} alCerrar={cerrar}>
      {incidente ? <Alert tone="notice">{t('riesgos.alta.desdeIncidente')}</Alert> : null}
      <CampoDeMotivo motivo={motivo} etiqueta={t('comun.motivoObligatorio')} ayuda={t('riesgos.alta.motivoAyuda')} />
      <p className="text-sg-caption text-sg-text-muted">{t('riesgos.alta.cadencia')}</p>
      {abierto ? (
        <FormularioDeRegistro
          objeto="social_risk"
          fijos={fijos}
          campos={CAMPOS_DEL_ALTA}
          motivo={motivo.recortado}
          antesDeEnviar={motivo.exigir}
          alGuardar={cerrar}
          alCancelar={cerrar}
        />
      ) : null}
    </Drawer>
  )
}
