import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { useSiguientePaso } from '../contexto/Rastro'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, NoDisponible, Restringido, esProhibido } from '../componentes/Estados'
import { Nivel, Postura } from '../componentes/Nivel'
import { TablaPriorizada, type ColumnaPriorizada } from '../componentes/TablaPriorizada'
import { ordenarEnCliente, posicionEn } from '../componentes/ordenEnCliente'
import { ordenEnUrl, PaginacionDelServidor, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { BarraDeSeleccion } from '../componentes/BarraDeSeleccion'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { NombreDelGrupo, useNombreDelGrupo, useNombresDeGrupos } from '../componentes/NombreDeActor'
import { comparable } from '../componentes/FiltroDeGrupo'
import { BotonDeVistaPrevia } from '../componentes/VistaPrevia'
import { useProyecto } from '../contexto/proyectos'
import { filtroDeTerritorio } from '../contexto/rutas'
import { diasEntre, hoyEnLima } from '../datos/fechas'
import { desglose, useIndicador } from '../datos/indicadores'
import { atributo, puedeLeer, texto, useDefinicion, useRegistro, useTodos, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useContextFilters } from '../shell/context'
import { useTableroDisponible } from '../tableros/comunes'
import { NuevoGrupo } from './NuevoGrupo'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { Persona } from '../componentes/Persona'
import { ListaConMapa, ofreceMapa, VISTA_MAPA } from '../mapa/ListaConMapa'

// S16 · lista de grupos de interés (screens.md §5): la misma página con alcance global (agrega la columna Proyecto) o de un
// proyecto (ASM-076). vistas del sistema, filtros en la URL, selección para registrar una interacción con varios y el chip
// de territorio. sin permiso para leer stance la columna dice "Restringido" y no se filtra por ella (security.md §7.9)
// «En el mapa» (VISTA_MAPA) es la vista «Lista + mapa» (design-system.md §5.3): los vigentes junto al mapa, cada uno en su localidad;
// nunca la de entrada y solo si algún grupo de la lista tiene localidad
const VISTAS = ['prioridad', 'mios', 'sinEvaluar', 'sinContacto', 'todos', 'retirados', VISTA_MAPA] as const
const FILTROS = ['influence_group', 'stance', 'stakeholder_scope', 'relationship_status', 'stakeholder_type'] as const
// los tres a la vista en la barra (DD-04); el ámbito y el tipo, en «Más filtros»
const FRECUENTES: readonly string[] = ['influence_group', 'stance', 'relationship_status']
const POR_PAGINA = 25
// el orden por columna (05-especificacion §1.6) es del portal, que filtra y pagina aquí: solo la prioridad informativa, por su orden
// de negocio (de media a muy alta), nunca por su texto. el nombre no: es el de la persona o la organización de cada grupo, que se
// lee aparte por fila (y el de una persona puede estar restringido); el grupo de influencia es un cuadrante, sin orden
const ORDEN_DE_PRIORIDAD = ['MEDIA', 'ALTA', 'MUY ALTA'] as const

export function GruposPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const navegar = useNavigate()
  const { scope, territory } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const registroDelProyecto = useProyecto(proyecto)
  const escribeEnElProyecto = useEscribeEnProyecto(proyecto)
  const lista = useParametrosDeLista('todos')
  const definicion = useDefinicion('stakeholder')
  const territorio = filtroDeTerritorio(territory, { locality: 'locality', area: 'area_of_influence' })
  const grupos = useTodos('stakeholder', { project: proyecto, ...(territorio ?? {}) })
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [creando, setCreando] = useState(false)
  // la explicación única de la columna Postura cuando sus celdas están restringidas
  const idDeLaPostura = useId()
  const conTablero = useTableroDisponible('stakeholders')
  const telefono = useEsTelefono()
  // ni la postura ni la tolerancia de inactividad se deciden antes de que lleguen la definición y el proyecto: sin ellas, una
  // cuenta con acceso vería "Restringido" un instante y la vista "Sin contacto" usaría 90 días. en el alcance global no hay
  // un proyecto: la tolerancia es la de 90 días de la etiqueta y de la vista (cada proyecto tiene la suya)
  const preparando = definicion.isPending || (proyecto !== undefined && registroDelProyecto.isPending)
  const leePostura = definicion.isSuccess && puedeLeer(definicion.data, 'stance')
  const inactividad = Number(atributo(registroDelProyecto.data, 'inactivity_days') ?? 90)
  const filtros = FILTROS.filter((f) => f !== 'stance' || leePostura)
  // los grupos cuyo grupo de influencia se ajustó a mano en su evaluación vigente: lo dice la matriz del proyecto (KPI-STK-03, el
  // mismo desglose que S19), la única fuente que lo trae por grupo. en el alcance global no hay matriz: no se marca
  const matriz = useIndicador('KPI-STK-03', { project: proyecto ? [proyecto] : [] }, Boolean(proyecto))
  const ajustados = new Set(
    matriz.data
      ? desglose(matriz.data, 'stakeholder')
          .filter((p) => p.overridden === true)
          .map((p) => p.key)
      : []
  )

  const hoy = hoyEnLima()
  const enVistaLa = (vista: string, g: Registro) => {
    switch (vista) {
      case 'prioridad':
        return g.state !== 'retired' && ['MUY ALTA', 'ALTA'].includes(texto(g, 'information_priority'))
      case 'mios':
        return g.state !== 'retired' && atributo(g, 'owner_user_id') === user?.id
      case 'sinEvaluar':
        return g.state === 'identified' || g.state === 'profiled'
      case 'sinContacto': {
        // los días son de calendario de Lima, no de reloj: un contacto de hoy a las 19:00 no es de "mañana"
        const dias = diasEntre(atributo(g, 'last_contact_date'), hoy)
        return g.state !== 'retired' && (dias === null || dias > inactividad)
      }
      case 'retirados':
        return g.state === 'retired'
      default:
        return g.state !== 'retired'
    }
  }
  // la búsqueda (?q=) por el nombre que ve quien mira, sin tildes ni mayúsculas (tercera pasada de UX, 3.7): el nombre está en la
  // persona u organización del grupo, así que se leen solo mientras se busca
  const busqueda = lista.filtro('q').trim()
  const buscado = comparable(busqueda)
  const nombres = useNombresDeGrupos(buscado ? (grupos.data ?? []) : [])
  const conFiltros = (g: Registro) =>
    filtros.every((f) => !lista.filtro(f) || texto(g, f) === lista.filtro(f)) && (!buscado || comparable(nombres.get(g.id) ?? '').includes(buscado))
  // el orden viaja en la URL (ordenEnUrl, DD-37): volver de una ficha lo conserva, y otro orden vuelve a la primera página. sin
  // elegir uno, el de la lectura
  const [orden, ordenar] = ordenEnUrl(lista, undefined, ['prioridad'])
  const filtrados = ordenarEnCliente(
    (grupos.data ?? []).filter((g) => enVistaLa(lista.vista, g) && conFiltros(g)),
    orden,
    // un grupo sin evaluar dice «Sin evaluar» en la columna: va al final, como uno sin prioridad
    (g) => (g.state === 'assessed' || atributo(g, 'influence_group') ? posicionEn(ORDEN_DE_PRIORIDAD, atributo(g, 'information_priority')) : null)
  )
  // la etapa 3 de la revisión de UX: cada vista dice cuántos tiene con los filtros puestos
  const conteoDe = (vista: string) => (grupos.data ? grupos.data.filter((g) => enVistaLa(vista, g) && conFiltros(g)).length : null)
  const vigentes = (grupos.data ?? []).filter((g) => g.state !== 'retired').length
  const pagina = filtrados.slice(lista.pagina * POR_PAGINA, (lista.pagina + 1) * POR_PAGINA)
  // «Lista + mapa»: se ofrece si algún grupo de la lista tiene localidad; en ella, sin ninguno, se dice y queda la tabla
  const enMapa = lista.vista === VISTA_MAPA
  const conUbicacion = ofreceMapa('stakeholder', filtrados)
  const nombresEnElMapa = useNombresDeGrupos(enMapa ? pagina : [])
  // la selección es de lo que se ve: al cambiar de vista, de filtro o de página se reinicia, y nunca viaja una fila oculta
  const claveDeVista = [lista.vista, lista.pagina, busqueda, ...FILTROS.map((f) => lista.filtro(f))].join('|')
  const [claveVista, setClaveVista] = useState(claveDeVista)
  if (claveVista !== claveDeVista) {
    setClaveVista(claveDeVista)
    setSeleccion(new Set())
  }
  const elegidos = pagina.filter((g) => seleccion.has(g.id)).map((g) => g.id)
  const alternar = (id: string, si: boolean) => {
    const siguiente = new Set(seleccion)
    if (si) siguiente.add(id)
    else siguiente.delete(id)
    setSeleccion(siguiente)
  }
  const chips = [
    ...filtros.filter((f) => lista.filtro(f)).map((f) => ({ clave: f, etiqueta: `${t(`grupos.filtros.${f}`)}: ${rotuloDeOpcion(lista.filtro(f))}` })),
    ...(busqueda ? [{ clave: 'q', etiqueta: t('comun.contiene', { texto: busqueda }) }] : [])
  ]
  const opciones = (campo: string) => definicion.data?.fields.find((f) => f.name === campo)?.enumOptions ?? []
  const limpiarFiltros = () => lista.cambiar({ q: null, ...Object.fromEntries(FILTROS.map((f) => [f, null])) })
  const filtroDe = (f: string) => (
    <FiltroDeLista
      key={f}
      etiqueta={t(`grupos.filtros.${f}`)}
      opciones={opciones(f)}
      value={lista.filtro(f)}
      onChange={(e) => lista.cambiar({ [f]: e.target.value })}
    />
  )
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
  const paso = useSiguientePaso()

  // la tabla de escritorio de S06 con prioridad de columnas (hallazgo U-06, DD-05): a 1440 px cabe sin desplazar y junto a la vista
  // previa acoplada. cuatro esenciales, como el lienzo: el grupo con su tipo, su lugar y su grupo de influencia en la línea de
  // metadatos (y «ajustado» si se ajustó a mano); su postura; su prioridad con barras; y su estado con el último contacto debajo.
  // el responsable, secundaria desde xl; la relación y la fecha de la evaluación, opcionales: desde 1536 px, hasta que las elija
  // «Columnas». en «Míos» el responsable es siempre quien mira: no se dibuja
  const columnas: ColumnaPriorizada[] = [
    ...(proyecto ? [{ id: 'seleccionar', encabezado: t('comun.seleccionar'), prioridad: 'esencial' as const, encabezadoOculto: true }] : []),
    { id: 'grupo', encabezado: t('grupos.columnas.grupoEInfluencia'), prioridad: 'esencial', titulo: true },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('grupos.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    {
      id: 'postura',
      encabezado: t('grupos.columnas.postura'),
      prioridad: 'esencial',
      // la postura larga («En contra pero abierto a escuchar») se parte en líneas, como en S06
      claseDeCelda: 'min-w-32 max-w-44 whitespace-normal',
      explicacion: leePostura ? undefined : { id: idDeLaPostura, tipo: 'restringido' }
    },
    { id: 'prioridad', encabezado: t('grupos.columnas.prioridad'), prioridad: 'esencial', claseDeCelda: 'text-sm', ordenable: true },
    // el último contacto se parte antes de la fecha si la vista previa acoplada deja la tabla angosta
    { id: 'estado', encabezado: t('grupos.columnas.estadoYContacto'), prioridad: 'esencial', claseDeCelda: 'min-w-40 whitespace-normal' },
    { id: 'relacion', encabezado: t('grupos.columnas.relacion'), prioridad: 'opcional', claseDeCelda: 'text-sm' },
    ...(lista.vista === 'mios'
      ? []
      : // en el alcance global la columna Proyecto ocupa su lugar: el responsable pasa a opcional para que la tabla quepa a 1440 px
        [
          {
            id: 'responsable',
            encabezado: t('grupos.columnas.responsable'),
            prioridad: proyecto ? ('secundaria' as const) : ('opcional' as const),
            claseDeCelda: 'text-sm'
          }
        ]),
    { id: 'evaluacion', encabezado: t('grupos.columnas.evaluacion'), prioridad: 'opcional', claseDeCelda: 'text-sm' }
  ]
  const celdaDe = (g: Registro, columna: string): ReactNode => {
    const evaluado = g.state === 'assessed' || Boolean(atributo(g, 'influence_group'))
    switch (columna) {
      case 'seleccionar':
        return <CasillaDeGrupo grupo={g} seleccionado={seleccion.has(g.id)} alSeleccionar={(si) => alternar(g.id, si)} />
      case 'grupo':
        return <CeldaDelGrupo grupo={g} evaluado={evaluado} ajustado={ajustados.has(g.id)} />
      case 'proyecto':
        return <ProyectoDelGrupo grupo={g} />
      case 'postura':
        return leePostura ? <Postura valor={atributo(g, 'stance')} /> : <Restringido femenina describedPor={idDeLaPostura} />
      case 'prioridad':
        return evaluado ? (
          <Nivel valor={atributo(g, 'information_priority')} escala="prioridad" nombre={t('grupos.columnas.prioridad')} />
        ) : (
          t('grupos.sinEvaluarValor')
        )
      case 'estado':
        return (
          <div className="flex flex-col items-start gap-1.25">
            <EstadoChip objeto="stakeholder" estado={g.state} />
            <UltimoContacto dia={texto(g, 'last_contact_date')} />
          </div>
        )
      case 'relacion':
        return opcion(g, 'relationship_status') || '—'
      case 'responsable':
        return <Persona correo={texto(g, 'owner_user_email')} />
      default:
        return <Dia valor={texto(g, 'last_assessment_date')} />
    }
  }
  // lo que decide si una columna no esencial dice lo mismo en toda la página: el dato guardado, no su rótulo
  const valorPlano = (g: Registro, columna: string): string => {
    switch (columna) {
      case 'responsable':
        return texto(g, 'owner_user_email').toLowerCase()
      default:
        return g.id
    }
  }

  return (
    <ContenedorDePagina elemento="section">
      <EncabezadoDePagina
        vistas={<VistasDelModulo modulo="stakeholders" actual="lista" conTablero={conTablero} />}
        titulo={t('grupos.titulo')}
        conteo={
          // «85 en total · esta vista muestra 23» (S06): el total sin retirados y lo que la vista y los filtros dejan
          grupos.data && filtrados.length !== vigentes
            ? t('grupos.conteoDeVista', { total: numeroPe(vigentes), n: numeroPe(filtrados.length) })
            : t('grupos.conteo', { n: filtrados.length, count: filtrados.length })
        }
        primaria={
          proyecto && escribeEnElProyecto && can('stakeholder', 'CREATE') ? (
            <Button size="sm" onClick={() => setCreando(true)}>
              {t('grupos.nuevo')}
            </Button>
          ) : undefined
        }
        secundarias={
          <>
            {proyecto ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={`${base}/stakeholders/matrix`}>{t('grupos.verMatriz')}</Link>
              </Button>
            ) : null}
            {can('stakeholder', 'EXPORT') ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={`${base}/reports`}>{t('grupos.exportar')}</Link>
              </Button>
            ) : null}
          </>
        }
      />
      {territorio === null ? <Alert tone="notice">{t('contexto.noAplica')}</Alert> : null}
      {definicion.isError && !definicion.data ? (
        esProhibido(definicion.error) ? (
          <NoDisponible />
        ) : (
          <ErrorDeCarga error={definicion.error} alReintentar={() => void definicion.refetch()} />
        )
      ) : preparando ? (
        <Cargando />
      ) : (
        <>
          {/* la barra de filtros (hallazgos U-18 y U-22, DD-03 y DD-04): las vistas en el selector, con su conteo, en lugar de una
              segunda fila de pestañas; tres filtros a la vista, el resto en «Más filtros», y un chip por filtro. ?view= y los
              parámetros de filtro son los mismos */}
          <BarraDeFiltros
            vista={
              <SelectorDeVista
                etiqueta={t('comun.vistas')}
                vistas={VISTAS.filter((id) => id !== VISTA_MAPA || conUbicacion || enMapa).map((id) => ({
                  id,
                  etiqueta: t(`grupos.vistas.${id}`, { dias: inactividad }),
                  n: id === VISTA_MAPA ? undefined : conteoDe(id)
                }))}
                actual={lista.vista}
                alElegir={(id) => lista.cambiar({ view: id })}
                // cinco a la vista: solo «Retirados» va en «Más vistas»
                visibles={5}
              />
            }
            busqueda={{ etiqueta: t('grupos.buscarEnLista'), valor: lista.filtro('q'), alCambiar: (q) => lista.cambiar({ q }) }}
            frecuentes={<>{filtros.filter((f) => FRECUENTES.includes(f)).map(filtroDe)}</>}
            todos={<>{filtros.filter((f) => !FRECUENTES.includes(f)).map(filtroDe)}</>}
            aplicados={chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
            alLimpiar={limpiarFiltros}
          />
          {proyecto ? (
            <BarraDeSeleccion
              n={elegidos.length}
              acciones={
                can('engagement', 'CREATE') && escribeEnElProyecto ? (
                  <Button size="sm" onClick={() => navegar(`${base}/engagements/new?stakeholders=${elegidos.map(encodeURIComponent).join(',')}`)}>
                    {t('grupos.registrarConEllos')}
                  </Button>
                ) : null
              }
              todos={pagina.length}
              alElegirTodos={() => setSeleccion(new Set(pagina.map((g) => g.id)))}
              alQuitar={() => setSeleccion(new Set())}
            />
          ) : null}
          {grupos.isPending ? (
            <Cargando />
          ) : grupos.isError && !grupos.data ? (
            esProhibido(grupos.error) ? (
              <NoDisponible />
            ) : (
              <ErrorDeCarga error={grupos.error} alReintentar={() => void grupos.refetch()} />
            )
          ) : filtrados.length === 0 ? (
            <VacioDeLista
              conFiltros={chips.length > 0 || lista.vista !== 'todos'}
              sinFiltros={(grupos.data ?? []).filter((g) => g.state !== 'retired').length}
              alLimpiar={() => lista.cambiar({ view: null, q: null, ...Object.fromEntries(FILTROS.map((f) => [f, null])) })}
            >
              {t('grupos.vacio')}
            </VacioDeLista>
          ) : (
            <>
              {enMapa && !conUbicacion ? <Alert tone="notice">{t('mapa.listaConMapa.sinUbicaciones')}</Alert> : null}
              {enMapa && conUbicacion ? (
                <ListaConMapa
                  objeto="stakeholder"
                  etiqueta={t('grupos.titulo')}
                  registros={pagina}
                  proyecto={proyecto}
                  nombreDe={(g) => nombresEnElMapa.get(g.id) || '…'}
                  detalleDe={(g) => (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {[opcion(g, 'stakeholder_type'), opcion(g, 'influence_group')].filter(Boolean).join(' · ')}
                      {leePostura && atributo(g, 'stance') ? <Postura valor={atributo(g, 'stance')} /> : null}
                    </span>
                  )}
                  accionesDe={(g) => (
                    <>
                      <Link to={rutaDelGrupo(g)} state={paso()} className="font-semibold text-sg-primary-text underline">
                        {t('grupos.abrirFicha', { nombre: nombresEnElMapa.get(g.id) ?? '' })}
                      </Link>
                      <BotonDeVistaPrevia objeto="stakeholder" id={g.id} nombre={nombresEnElMapa.get(g.id) ?? ''} />
                    </>
                  )}
                  alAbrir={(g) => navegar(rutaDelGrupo(g), { state: paso() })}
                />
              ) : telefono ? (
                // en el teléfono, tarjetas con el nombre, su vista previa, el estado y el proyecto (revisión de UX, etapa 8); en un
                // proyecto, cada una con su casilla para registrar una interacción con los elegidos
                <ListaEnTarjetas
                  etiqueta={t('grupos.titulo')}
                  total={filtrados.length}
                  tarjetas={pagina.map((g) => ({
                    id: g.id,
                    titulo: <TituloDeGrupo grupo={g} seleccionado={seleccion.has(g.id)} alSeleccionar={proyecto ? (si) => alternar(g.id, si) : undefined} />,
                    estado: <EstadoChip objeto="stakeholder" estado={g.state} />,
                    proyecto: proyecto ? undefined : <ProyectoDelGrupo grupo={g} />,
                    detalle: [opcion(g, 'stakeholder_type'), opcion(g, 'influence_group')].filter(Boolean).join(' · ') || undefined
                  }))}
                />
              ) : (
                <TablaPriorizada<Registro>
                  etiqueta={t('grupos.titulo')}
                  total={filtrados.length}
                  idDeTabla="grupos"
                  columnas={columnas}
                  filas={pagina}
                  clave={(g) => g.id}
                  celda={celdaDe}
                  valorPlano={valorPlano}
                  ocultarUniformes
                  orden={orden}
                  alOrdenar={ordenar}
                  alAbrir={(g) => navegar(rutaDelGrupo(g), { state: paso() })}
                  // Espacio abre la vista previa, como el ojo de la fila
                  previaDe={(g) => ({ objeto: 'stakeholder', id: g.id })}
                />
              )}
              {filtrados.length > POR_PAGINA ? (
                <PaginacionDelServidor
                  datos={{ page: lista.pagina, size: POR_PAGINA, totalPages: Math.ceil(filtrados.length / POR_PAGINA), totalElements: filtrados.length }}
                  alPagina={(p) => lista.cambiar({ page: String(p) })}
                />
              ) : null}
            </>
          )}
        </>
      )}
      {proyecto ? <NuevoGrupo proyecto={proyecto} abierto={creando} alCerrar={() => setCreando(false)} /> : null}
    </ContenedorDePagina>
  )
}

// las celdas de la tabla de escritorio: las que leen otro registro (la localidad, el proyecto, el nombre) son componentes. el grupo va
// en dos líneas (S06): su nombre, que lleva a la ficha, con el ojo de la vista previa; y debajo su tipo, su lugar y su grupo de
// influencia («Sin evaluar» si aún no lo tiene), con «ajustado» si el grupo se fijó a mano
function CeldaDelGrupo({ grupo, evaluado, ajustado }: { grupo: Registro; evaluado: boolean; ajustado: boolean }) {
  const { t } = useTranslation(NS)
  const nombre = useNombreDelGrupo(grupo)
  // la lista (con su territorio y sus filtros) queda en el rastro (revisión de UX, etapa 6)
  const paso = useSiguientePaso()
  // el lugar, si se lee: mientras llega o sin acceso no deja un hueco en la línea
  const localidad = useRegistro('locality', atributo<string>(grupo, 'locality'))
  const piezas = [
    opcion(grupo, 'stakeholder_type'),
    texto(localidad.data, 'name'),
    evaluado ? opcion(grupo, 'influence_group') : t('grupos.sinEvaluarValor')
  ].filter(Boolean)
  return (
    <>
      <Link to={rutaDelGrupo(grupo)} state={paso()} className="font-semibold text-sg-text hover:text-sg-primary-text hover:underline">
        <NombreDelGrupo grupo={grupo} />
      </Link>{' '}
      {/* la vista previa sin dejar la lista (ux-architecture.md §8.3, paso 2; revisión de UX, etapa 6) */}
      <BotonDeVistaPrevia objeto="stakeholder" id={grupo.id} nombre={nombre} enFila />
      {piezas.length > 0 || ajustado ? (
        <p className="text-sg-caption text-sg-text-secondary">
          {piezas.map((p, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : null}
              <span>{p}</span>
            </span>
          ))}
          {ajustado ? (
            <span
              title={t('grupos.ajustadoAyuda')}
              className="ml-1.5 rounded-sg-xs border border-sg-border-strong px-1 text-sg-caption font-semibold text-sg-text-secondary"
            >
              {t('grupos.ajustado')}
            </span>
          ) : null}
        </p>
      ) : null}
    </>
  )
}

// el último contacto bajo el estado (S06): el día, o que no se registró ninguno
function UltimoContacto({ dia }: { dia: string }) {
  const { t } = useTranslation(NS)
  return (
    <span className="text-sg-caption text-sg-text-secondary">
      {dia ? (
        <>
          {t('grupos.ultimoContacto')}: <Dia valor={dia} />
        </>
      ) : (
        t('grupos.nuncaContactado')
      )}
    </span>
  )
}

// la casilla de un grupo en la tabla: se anuncia con su nombre, como la de la tarjeta del teléfono, nunca con su id (tercera pasada
// de UX: un lector de pantalla leía «Seleccionar 3f2a…»)
function CasillaDeGrupo({ grupo, seleccionado, alSeleccionar }: { grupo: Registro; seleccionado: boolean; alSeleccionar: (si: boolean) => void }) {
  const { t } = useTranslation(NS)
  const nombre = useNombreDelGrupo(grupo)
  return <input type="checkbox" aria-label={t('comun.seleccionarA', { nombre })} checked={seleccionado} onChange={(e) => alSeleccionar(e.target.checked)} />
}

// el título de la tarjeta de un grupo en el teléfono: su casilla (en un proyecto), su nombre como enlace (con su paso en el
// rastro) y su vista previa
function TituloDeGrupo({ grupo, seleccionado, alSeleccionar }: { grupo: Registro; seleccionado: boolean; alSeleccionar?: (si: boolean) => void }) {
  const { t } = useTranslation(NS)
  const nombre = useNombreDelGrupo(grupo)
  const paso = useSiguientePaso()
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {alSeleccionar ? (
        <input
          type="checkbox"
          aria-label={t('comun.seleccionarA', { nombre })}
          checked={seleccionado}
          onChange={(e) => alSeleccionar(e.target.checked)}
          className="mr-1 size-5"
        />
      ) : null}
      <Link
        to={`/projects/${encodeURIComponent(String(atributo(grupo, 'project')))}/stakeholders/${encodeURIComponent(grupo.id)}`}
        state={paso()}
        className="font-medium text-sg-primary-text underline"
      >
        {nombre}
      </Link>
      <BotonDeVistaPrevia objeto="stakeholder" id={grupo.id} nombre={nombre} />
    </span>
  )
}

const rutaDelGrupo = (grupo: Registro) => `/projects/${encodeURIComponent(String(atributo(grupo, 'project')))}/stakeholders/${encodeURIComponent(grupo.id)}`

function ProyectoDelGrupo({ grupo }: { grupo: Registro }) {
  const del = useRegistro('project', String(atributo(grupo, 'project')))
  return <ProyectoEnLista proyecto={del.data} />
}
