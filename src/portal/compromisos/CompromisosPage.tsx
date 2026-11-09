import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { PaginasDeCompromisos } from '../acuerdos/PaginasDeCompromisos'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { SelectorDeGrupo, useChipDeGrupo } from '../componentes/FiltroDeGrupo'
import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { ordenEnUrl, PaginacionDelServidor, useParametrosDeLista } from '../componentes/Lista'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { TablaPriorizada, type ColumnaPriorizada, type GrupoDeFilas, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { useCuerpoDeVistaPrevia } from '../componentes/VistaPrevia'
import { ordenarEnCliente } from '../componentes/ordenEnCliente'
import { useSiguientePaso } from '../contexto/Rastro'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { montoPe } from '../componentes/Monto'
import { ResultadoDeLista } from '../contexto/Origen'
import { useProyectos } from '../contexto/proyectos'
import { filtroDeTerritorio } from '../contexto/rutas'
import { atributo, conEstado, estados, texto, useConteo, useConteos, useRegistros, useRelacionados, type Parametros, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useTableroDisponible } from '../tableros/comunes'
import { Candidatos } from './Candidatos'
import { Dia } from '../componentes/Dia'
import { SituacionDelCompromiso } from './SituacionDelCompromiso'
import { VistaPreviaDeCompromiso } from './VistaPreviaDeCompromiso'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { Persona } from '../componentes/Persona'

// S28 · lista de compromisos (screens.md §7): lo que se debe, a quién y desde cuándo, con lo vencido a un clic. la misma página
// con alcance global (columna Proyecto) o de un proyecto (ASM-076), con el chip de territorio (localidad o comunidad). la página
// y el conteo de cada vista los da el servidor (D10 de la revisión de UX): una vista es una consulta de la lista genérica, con el
// estado del workflow en state y state_not (api.md §3.4), y la búsqueda es su q. el filtro por grupo de interés es una relación de
// muchos a muchos que la lista no filtra: con él, la fuente son los compromisos relacionados del grupo y las vistas se arman aquí
// con enVista. la vista Candidatos es la de WF-K
const VISTAS = ['abiertos', 'vencidos', 'porVencer', 'bloqueados', 'mios', 'cerrados', 'candidatos'] as const
type VistaDeCompromisos = (typeof VISTAS)[number]
const DE_LA_LISTA = VISTAS.filter((v) => v !== 'candidatos')
const CERRADOS = ['closed', 'cancelled']
const POR_PAGINA = 25
// los órdenes (05-especificacion §1.6): el vencimiento (el que la lista ya pedía), el código y el título, en los dos sentidos. el
// estado y la situación no: su código no dice su orden; el monto tampoco, porque mezcla monedas (ASM-063). con la columna
// «Compromiso» de S08 (el código, el título y el responsable con la fecha en una celda) el orden se elige en la barra de filtros
const CAMPO_DE_ORDEN: Record<string, string> = { codigo: 'code', compromiso: 'title', vence: 'due_date' }
const ORDEN_INICIAL: OrdenDeTabla = { columna: 'vence', dir: 'asc' }
const ORDENES = ['vence:asc', 'vence:desc', 'codigo:asc', 'codigo:desc', 'compromiso:asc', 'compromiso:desc'] as const
// los grupos por situación de S08, en este orden; lo que no corre plazo (sin vencimiento, cerrado) va al final
const GRUPOS: [string, string | null][] = [
  ['vencidos', 'VENCIDO'],
  ['porVencer', 'POR VENCER'],
  ['alDia', 'AL DIA'],
  ['sinPlazo', null]
]
const grupoDe = (c: Registro): string => GRUPOS.find(([, valor]) => valor !== null && atributo(c, 'deadline_status') === valor)?.[0] ?? 'sinPlazo'

export function enVista(vista: string, c: Registro, usuario: string | undefined): boolean {
  switch (vista as VistaDeCompromisos) {
    case 'vencidos':
      return texto(c, 'deadline_status') === 'VENCIDO'
    case 'porVencer':
      return texto(c, 'deadline_status') === 'POR VENCER'
    case 'bloqueados':
      return c.state === 'blocked'
    case 'mios':
      return !CERRADOS.includes(c.state ?? '') && atributo(c, 'owner_user_id') === usuario
    case 'cerrados':
      return CERRADOS.includes(c.state ?? '')
    default:
      return !CERRADOS.includes(c.state ?? '')
  }
}

// lo mismo que enVista, como consulta del servidor; null si la vista no puede tener registros («Míos» sin saber quién mira)
export function consultaDeVista(vista: string, usuario: string | undefined): Parametros | null {
  switch (vista as VistaDeCompromisos) {
    case 'vencidos':
      return { deadline_status: 'VENCIDO' }
    case 'porVencer':
      return { deadline_status: 'POR VENCER' }
    case 'bloqueados':
      return { state: 'blocked' }
    case 'mios':
      return usuario ? { owner_user_id: usuario, state_not: estados(CERRADOS) } : null
    case 'cerrados':
      return { state: estados(CERRADOS) }
    default:
      return { state_not: estados(CERRADOS) }
  }
}

export function CompromisosPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const { scope, territory } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const lista = useParametrosDeLista('abiertos')
  const territorio = filtroDeTerritorio(territory, { locality: 'locality', community: 'community' })
  const proyectos = useProyectos()
  const etiquetas = useEtiquetasDeEstado('commitment')
  // la vista previa de una fila con la anatomía de S08 (panel acoplado desde xl, cajón por debajo)
  useCuerpoDeVistaPrevia('commitment', VistaPreviaDeCompromiso)
  const conTablero = useTableroDisponible('commitments')
  const telefono = useEsTelefono()
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
  const busqueda = lista.filtro('q').trim()
  const q = busqueda.toLowerCase()
  const estado = lista.filtro('state')
  const enCandidatos = lista.vista === 'candidatos'
  // ?stakeholder=<id>: los compromisos que pidió un grupo de interés (commitment_stakeholder), desde las cifras de su ficha
  const grupo = lista.filtro('stakeholder')
  const delGrupo = useRelacionados('stakeholder', grupo || undefined, 'commitment_stakeholder')
  const chipDeGrupo = useChipDeGrupo(grupo)
  const chips = [
    ...(grupo ? [{ clave: 'stakeholder', etiqueta: chipDeGrupo }] : []),
    ...(estado ? [{ clave: 'state', etiqueta: t('compromisos.filtroEstado', { estado: etiquetas[estado] ?? estado }) }] : []),
    ...(q ? [{ clave: 'q', etiqueta: t('compromisos.filtroBusqueda', { texto: busqueda }) }] : [])
  ]
  const limpiar = () => lista.cambiar({ state: null, q: null, stakeholder: null })
  // el orden viaja en la URL (ordenEnUrl, DD-37): volver de una ficha lo conserva, y otro orden vuelve a la primera página
  const [orden, ordenar] = ordenEnUrl(lista, ORDEN_INICIAL, ['codigo', 'compromiso', 'vence'])
  // Enter en una fila abre su ficha y Espacio su vista previa (05-especificacion §1.6), como el enlace y el ojo de la fila
  const navegar = useNavigate()
  const paso = useSiguientePaso()

  // sin grupo: el servidor. la consulta de una vista lleva el alcance, el territorio, el estado elegido y la búsqueda
  const alcance: Parametros = { project: proyecto, ...(territorio ?? {}) }
  const consultaDe = (vista: string): Parametros | null => {
    const deLaVista = conEstado(consultaDeVista(vista, user?.id), estado)
    return deLaVista && { ...alcance, ...deLaVista, q: busqueda }
  }
  const actual = consultaDe(lista.vista)
  const servidor = !grupo && !enCandidatos
  const pedida = useRegistros(
    'commitment',
    { ...actual, sort: CAMPO_DE_ORDEN[orden.columna], dir: orden.dir, page: lista.pagina, size: POR_PAGINA },
    servidor && actual !== null
  )
  const conteos = useConteos('commitment', Object.fromEntries(DE_LA_LISTA.map((v) => [v, consultaDe(v)])), !grupo)
  // el vacío por filtros dice cuántos hay en la vista sin ellos
  const deLaVista = consultaDeVista(lista.vista, user?.id)
  const sinFiltrosDelServidor = useConteo('commitment', deLaVista && { ...alcance, ...deLaVista }, servidor && chips.length > 0)

  // con grupo: sus compromisos relacionados, del alcance y del territorio, con las vistas armadas aquí
  const relacionados = (delGrupo.data?.content ?? []).filter((c) =>
    Object.entries(alcance).every(([campo, valor]) => valor === undefined || valor === null || valor === '' || texto(c, campo) === String(valor))
  )
  const conFiltros = (c: Registro) =>
    (!estado || c.state === estado) && (!q || texto(c, 'code').toLowerCase().includes(q) || texto(c, 'title').toLowerCase().includes(q))
  // con grupo se filtra y pagina aquí: el orden también, por el mismo campo que se pediría al servidor
  const filtrados = ordenarEnCliente(
    relacionados.filter((c) => enVista(lista.vista, c, user?.id) && conFiltros(c)),
    orden,
    (c, columna) => texto(c, CAMPO_DE_ORDEN[columna])
  )

  const lectura = grupo ? delGrupo : pedida
  const filas = grupo ? filtrados.slice(lista.pagina * POR_PAGINA, (lista.pagina + 1) * POR_PAGINA) : actual ? (pedida.data?.content ?? []) : []
  const total = grupo ? (delGrupo.data ? filtrados.length : null) : actual ? (pedida.data?.totalElements ?? null) : 0
  const cargando = (grupo || actual !== null) && lectura.isPending
  const fallo = (grupo || actual !== null) && lectura.isError && !lectura.data
  const conteoDe = (vista: string) =>
    grupo ? (delGrupo.data ? relacionados.filter((c) => enVista(vista, c, user?.id) && conFiltros(c)).length : null) : (conteos[vista] ?? null)
  const sinFiltros = grupo ? relacionados.filter((c) => enVista(lista.vista, c, user?.id)).length : (sinFiltrosDelServidor ?? undefined)
  // la lista relacionada llega en una página de 200: si el grupo tiene más, se dice
  const truncado = Boolean(grupo && delGrupo.data && (delGrupo.data.totalElements ?? 0) > delGrupo.data.content.length)
  const nombreDelProyecto = (id: string) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
  const rutaDe = (c: Registro) => `/projects/${encodeURIComponent(texto(c, 'project'))}/commitments/${encodeURIComponent(c.id)}`
  // el código en mono arriba del título, en la tabla y en la tarjeta del teléfono (S08 y M17b)
  const enlace = (c: Registro) => (
    <EnlaceDeRegistro
      codigo={texto(c, 'code')}
      titulo={texto(c, 'title')}
      ruta={rutaDe(c)}
      desde={t('compromisos.titulo')}
      previa={{ objeto: 'commitment', id: c.id }}
    />
  )
  // en la tarjeta, el monto solo si se registró (con su moneda); sin monto, nada: la tarjeta no tiene la nota al pie del «—»
  const montoDeTarjeta = (c: Registro) => {
    const monto = montoPe(atributo(c, 'amount'), atributo(c, 'currency'))
    return monto === '—' ? undefined : <span className="tabular-nums">{t('compromisos.montoEnTarjeta', { monto })}</span>
  }
  // la tabla de S08 (hallazgo U-06, DD-05): «Compromiso» con el código en mono arriba, el título en dos líneas como mucho y
  // «responsable · fecha» debajo; el proyecto (en lo global); «Estado y situación» apilados (el chip del flujo y, debajo, la
  // situación derivada con su reloj y sus días, sin caja: no compiten); y el monto a la derecha, con «—» y su nota al pie
  const columnas: ColumnaPriorizada[] = [
    { id: 'compromiso', encabezado: t('compromisos.columnas.compromiso'), prioridad: 'esencial', titulo: true },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('compromisos.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    { id: 'estado', encabezado: t('compromisos.columnas.estadoYSituacion'), prioridad: 'esencial' },
    { id: 'monto', encabezado: t('compromisos.columnas.monto'), prioridad: 'esencial', numerica: true }
  ]
  const responsableYFecha = (c: Registro) => {
    const correo = texto(c, 'owner_user_email')
    const dia = texto(c, 'due_date')
    if (!correo && !dia) return null
    return (
      <span className="mt-0.5 block text-sg-caption text-sg-text-secondary">
        {correo ? <Persona correo={correo} /> : t('compromisos.sinResponsable')}
        {dia ? (
          <>
            {' · '}
            <Dia valor={dia} />
          </>
        ) : null}
      </span>
    )
  }
  const estadoYSituacion = (c: Registro) => (
    <span className="flex flex-col items-start gap-1.5">
      <EstadoChip objeto="commitment" estado={c.state} />
      <SituacionDelCompromiso compromiso={c} />
    </span>
  )
  const celda = (c: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'compromiso':
        return (
          <>
            {enlace(c)}
            {responsableYFecha(c)}
          </>
        )
      case 'proyecto':
        return nombreDelProyecto(texto(c, 'project'))
      case 'estado':
        return estadoYSituacion(c)
      default:
        return montoPe(atributo(c, 'amount'), atributo(c, 'currency'))
    }
  }
  // agrupados por situación (S08) solo con el orden por vencimiento: la página la da el servidor, así que se agrupan las filas de
  // esta página por la situación que ya trae cada una, sin conteos que el servidor no da (el de cada grupo es el de la página, y la
  // nota al pie lo dice). con otro orden, la lista sin grupos
  const agrupada = orden.columna === 'vence'
  const grupos: GrupoDeFilas<Registro>[] | undefined = agrupada
    ? GRUPOS.map(([clave]) => ({ clave, titulo: t(`compromisos.grupos.${clave}`), filas: filas.filter((c) => grupoDe(c) === clave) })).filter(
        (g) => g.filas.length > 0
      )
    : undefined
  const vacioPorFiltros = (
    <Vacio
      titulo={t('compromisos.vacioPorFiltros', { count: chips.length })}
      accion={
        <Button variant="secondary" onClick={limpiar}>
          {t('compromisos.quitarFiltros')}
        </Button>
      }
    >
      {sinFiltros ? <p>{t('comun.sinFiltrosHay', { count: sinFiltros })}</p> : null}
    </Vacio>
  )
  return (
    <ContenedorDePagina elemento="section">
      <EncabezadoDePagina
        vistas={
          <>
            <PaginasDeCompromisos actual="commitments" />
            <VistasDelModulo modulo="commitments" actual="lista" conTablero={conTablero} />
          </>
        }
        titulo={t('compromisos.titulo')}
        conteo={
          !enCandidatos && total !== null
            ? t('compromisos.conteoDeLaVista', {
                vista: t(`compromisos.vistas.${lista.vista}`, { defaultValue: '' }),
                conteo: t('compromisos.conteo', { count: total })
              })
            : undefined
        }
        primaria={<BotonCrear objeto="commitment" etiqueta={t('compromisos.nuevo')} resto="commitments/new" />}
        secundarias={
          <>
            {can('commitment', 'EXPORT') ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={`${base}/reports`}>{t('compromisos.exportar')}</Link>
              </Button>
            ) : null}
          </>
        }
      />
      {/* la barra de filtros (hallazgos U-18 y U-22): las vistas en una sola fila, con su conteo, la búsqueda, el estado, el grupo
          de interés en «Más filtros» y un chip por filtro. ?view= y los parámetros de filtro siguen siendo los mismos; los
          candidatos no se filtran */}
      <BarraDeFiltros
        vista={
          <SelectorDeVista
            etiqueta={t('comun.vistas')}
            vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`compromisos.vistas.${v}`), n: v === 'candidatos' ? undefined : conteoDe(v) }))}
            actual={lista.vista}
            alElegir={(vista) => lista.cambiar({ view: vista })}
          />
        }
        busqueda={enCandidatos ? undefined : { etiqueta: t('compromisos.buscar'), valor: lista.filtro('q'), alCambiar: (q) => lista.cambiar({ q }) }}
        frecuentes={
          enCandidatos ? undefined : (
            <>
              <FiltroDeLista
                etiqueta={t('compromisos.estado')}
                value={estado}
                onChange={(e) => lista.cambiar({ state: e.target.value })}
                opciones={Object.entries(etiquetas).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
              />
              {/* el orden (S08: «Agrupar por situación»): por vencimiento, la tabla se agrupa por situación */}
              <FiltroDeLista
                etiqueta={t('compromisos.orden.etiqueta')}
                vacio={false}
                value={`${orden.columna}:${orden.dir}`}
                onChange={(e) => {
                  const [columna, dir] = e.target.value.split(':')
                  ordenar({ columna, dir: dir === 'desc' ? 'desc' : 'asc' })
                }}
                opciones={ORDENES.map((o) => ({ valor: o, etiqueta: t(`compromisos.orden.${o.replace(':', '_')}`) }))}
              />
            </>
          )
        }
        // «Más filtros» (flujo F-C): el grupo de interés, con su búsqueda; escribe el mismo ?stakeholder= que las cifras de la ficha
        // del grupo, y su chip es el mismo. solo para quien lee los grupos
        todos={
          enCandidatos || !can('stakeholder', 'READ') ? undefined : (
            <SelectorDeGrupo
              proyecto={proyecto}
              valor={grupo}
              alElegir={(id) => lista.cambiar({ stakeholder: id })}
              textos={{
                etiqueta: t('compromisos.porGrupo.etiqueta'),
                buscar: t('compromisos.porGrupo.buscar'),
                lista: t('compromisos.porGrupo.lista'),
                ninguno: t('compromisos.porGrupo.ninguno'),
                vacio: t('compromisos.porGrupo.vacio')
              }}
            />
          )
        }
        aplicados={enCandidatos ? [] : chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
        alLimpiar={limpiar}
      />
      {enCandidatos ? (
        <Candidatos proyecto={proyecto} />
      ) : (
        <>
          {territorio === null ? <Alert tone="notice">{t('compromisos.territorioNoAplica')}</Alert> : null}
          {truncado ? <Alert tone="warning">{t('compromisos.truncado', { n: numeroPe(delGrupo.data?.content.length ?? 0) })}</Alert> : null}
          {/* los estados de E18: el título y los filtros no se mueven; solo cambia la zona de resultados */}
          {cargando ? (
            <Cargando etiqueta={t('compromisos.cargando')} />
          ) : fallo ? (
            <FalloDeLectura titulo={t('compromisos.errorDeCarga')} error={lectura.error} alReintentar={() => void lectura.refetch()} />
          ) : filas.length === 0 ? (
            chips.length > 0 ? (
              vacioPorFiltros
            ) : (
              // cómo se empieza, sin otro botón: «Nuevo compromiso» ya está en la cabecera (tercera pasada de UX, 3.12)
              <Vacio titulo={t('compromisos.vacio')}>{t('compromisos.comoEmpezar')}</Vacio>
            )
          ) : (
            // el resultado de la vista con sus filtros (flujo F-C): la ficha abierta desde aquí dice «Volver a Compromisos (N)»
            <ResultadoDeLista total={total}>
              {telefono ? (
                <ListaEnTarjetas
                  etiqueta={t('compromisos.tabla')}
                  total={total}
                  tarjetas={filas.map((c) => ({
                    id: c.id,
                    titulo: (
                      <>
                        {enlace(c)}
                        {responsableYFecha(c)}
                      </>
                    ),
                    estado: <EstadoChip objeto="commitment" estado={c.state} />,
                    plazo: <SituacionDelCompromiso compromiso={c} />,
                    proyecto: proyecto ? undefined : nombreDelProyecto(texto(c, 'project')),
                    detalle: montoDeTarjeta(c)
                  }))}
                />
              ) : (
                <TablaPriorizada<Registro>
                  etiqueta={t('compromisos.tabla')}
                  total={total}
                  columnas={columnas}
                  filas={grupos ? undefined : filas}
                  grupos={grupos}
                  clave={(c) => c.id}
                  celda={celda}
                  alAbrir={(c) => navegar(rutaDe(c), { state: paso(t('compromisos.titulo'), rutaDe(c)) })}
                  previaDe={(c) => ({ objeto: 'commitment', id: c.id })}
                  notaAlPie={
                    <>
                      <span>{t('compromisos.notaAlPie')}</span>
                      {grupos ? <span> {t('compromisos.agrupadosEnLaPagina')}</span> : null}
                    </>
                  }
                />
              )}
              {total !== null && total > POR_PAGINA ? (
                <PaginacionDelServidor
                  datos={{ page: lista.pagina, size: POR_PAGINA, totalPages: Math.ceil(total / POR_PAGINA), totalElements: total }}
                  alPagina={(p) => lista.cambiar({ page: String(p) })}
                />
              ) : null}
            </ResultadoDeLista>
          )}
        </>
      )}
    </ContenedorDePagina>
  )
}
