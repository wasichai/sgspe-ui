import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { useSiguientePaso } from '../contexto/Rastro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Pagination } from '@wasichai/ui'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, NoDisponible, Restringido, esProhibido } from '../componentes/Estados'
import { TablaPriorizada, type ColumnaPriorizada } from '../componentes/TablaPriorizada'
import { ordenarEnCliente, posicionEn } from '../componentes/ordenEnCliente'
import { ordenEnUrl, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { NombreDelGrupo, useNombreDelGrupo } from '../componentes/NombreDeActor'
import { BotonDeVistaPrevia, useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { useProyecto } from '../contexto/proyectos'
import { filtroDeTerritorio } from '../contexto/rutas'
import { diasEntre, hoyEnLima } from '../datos/fechas'
import { atributo, puedeLeer, texto, useDefinicion, useRegistro, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useContextFilters } from '../shell/context'
import { useTableroDisponible } from '../tableros/comunes'
import { NuevoGrupo } from './NuevoGrupo'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { Persona } from '../componentes/Persona'

// S16 · lista de grupos de interés (screens.md §5): la misma página con alcance global (agrega la columna Proyecto) o de un
// proyecto (ASM-076). vistas del sistema, filtros en la URL, selección para registrar una interacción con varios y el chip
// de territorio. sin permiso para leer stance la columna dice "Restringido" y no se filtra por ella (security.md §7.9)
const VISTAS = ['prioridad', 'mios', 'sinEvaluar', 'sinContacto', 'todos', 'retirados'] as const
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
  const previa = useRutaDeVistaPrevia()
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
  const conFiltros = (g: Registro) => filtros.every((f) => !lista.filtro(f) || texto(g, f) === lista.filtro(f))
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
  const pagina = filtrados.slice(lista.pagina * POR_PAGINA, (lista.pagina + 1) * POR_PAGINA)
  // la selección es de lo que se ve: al cambiar de vista, de filtro o de página se reinicia, y nunca viaja una fila oculta
  const claveDeVista = [lista.vista, lista.pagina, ...FILTROS.map((f) => lista.filtro(f))].join('|')
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
  const chips = filtros.filter((f) => lista.filtro(f)).map((f) => ({ clave: f, etiqueta: `${t(`grupos.filtros.${f}`)}: ${rotuloDeOpcion(lista.filtro(f))}` }))
  const opciones = (campo: string) => definicion.data?.fields.find((f) => f.name === campo)?.enumOptions ?? []
  const limpiarFiltros = () => lista.cambiar(Object.fromEntries(FILTROS.map((f) => [f, null])))
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

  // la tabla de escritorio con prioridad de columnas (hallazgo U-06, DD-05): a 1440 px cabe sin desplazar. esenciales lo que
  // decide (quién, su grupo de influencia, su postura, su prioridad y su estado); secundarias, desde xl, el territorio, el
  // responsable y el último contacto; la relación y la fecha de la evaluación son opcionales: desde 1536 px, hasta que las elija
  // «Columnas». en «Míos» el responsable es siempre quien mira: no se dibuja
  const columnas: ColumnaPriorizada[] = [
    ...(proyecto ? [{ id: 'seleccionar', encabezado: t('comun.seleccionar'), prioridad: 'esencial' as const, encabezadoOculto: true }] : []),
    { id: 'grupo', encabezado: t('grupos.columnas.grupo'), prioridad: 'esencial', claseDeCelda: 'min-w-48' },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('grupos.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    { id: 'territorio', encabezado: t('grupos.columnas.territorio'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'influencia', encabezado: t('grupos.columnas.influencia'), prioridad: 'esencial', claseDeCelda: 'text-sm' },
    {
      id: 'postura',
      encabezado: t('grupos.columnas.postura'),
      prioridad: 'esencial',
      claseDeCelda: 'text-sm',
      explicacion: leePostura ? undefined : { id: idDeLaPostura, tipo: 'restringido' }
    },
    { id: 'prioridad', encabezado: t('grupos.columnas.prioridad'), prioridad: 'esencial', claseDeCelda: 'text-sm', ordenable: true },
    { id: 'estado', encabezado: t('grupos.columnas.estado'), prioridad: 'esencial' },
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
    { id: 'evaluacion', encabezado: t('grupos.columnas.evaluacion'), prioridad: 'opcional', claseDeCelda: 'text-sm' },
    { id: 'contacto', encabezado: t('grupos.columnas.contacto'), prioridad: 'secundaria', claseDeCelda: 'text-sm' }
  ]
  const celdaDe = (g: Registro, columna: string): ReactNode => {
    const evaluado = g.state === 'assessed' || Boolean(atributo(g, 'influence_group'))
    switch (columna) {
      case 'seleccionar':
        return <CasillaDeGrupo grupo={g} seleccionado={seleccion.has(g.id)} alSeleccionar={(si) => alternar(g.id, si)} />
      case 'grupo':
        return <CeldaDelGrupo grupo={g} />
      case 'proyecto':
        return <ProyectoDelGrupo grupo={g} />
      case 'territorio':
        return <LocalidadDelGrupo grupo={g} />
      case 'influencia':
        return evaluado ? opcion(g, 'influence_group') || '—' : t('grupos.sinEvaluarValor')
      case 'postura':
        return leePostura ? opcion(g, 'stance') || '—' : <Restringido describedPor={idDeLaPostura} />
      case 'prioridad':
        return evaluado ? opcion(g, 'information_priority') || '—' : t('grupos.sinEvaluarValor')
      case 'estado':
        return <EstadoChip objeto="stakeholder" estado={g.state} />
      case 'relacion':
        return opcion(g, 'relationship_status') || '—'
      case 'responsable':
        return <Persona correo={texto(g, 'owner_user_email')} />
      case 'evaluacion':
        return <Dia valor={texto(g, 'last_assessment_date')} />
      default:
        return <Dia valor={texto(g, 'last_contact_date')} />
    }
  }
  // lo que decide si una columna no esencial dice lo mismo en toda la página: el dato guardado, no su rótulo
  const valorPlano = (g: Registro, columna: string): string => {
    switch (columna) {
      case 'territorio':
        return String(atributo(g, 'locality') ?? '')
      case 'responsable':
        return texto(g, 'owner_user_email').toLowerCase()
      case 'contacto':
        return texto(g, 'last_contact_date')
      default:
        return g.id
    }
  }

  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        vistas={<VistasDelModulo modulo="stakeholders" actual="lista" conTablero={conTablero} />}
        titulo={t('grupos.titulo')}
        conteo={t('grupos.conteo', { n: filtrados.length, count: filtrados.length })}
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
                vistas={VISTAS.map((id) => ({ id, etiqueta: t(`grupos.vistas.${id}`, { dias: inactividad }), n: conteoDe(id) }))}
                actual={lista.vista}
                alElegir={(id) => lista.cambiar({ view: id })}
                // cinco a la vista: solo «Retirados» va en «Más vistas»
                visibles={5}
              />
            }
            frecuentes={<>{filtros.filter((f) => FRECUENTES.includes(f)).map(filtroDe)}</>}
            todos={<>{filtros.filter((f) => !FRECUENTES.includes(f)).map(filtroDe)}</>}
            aplicados={chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
            alLimpiar={limpiarFiltros}
          />
          {elegidos.length > 0 && proyecto ? (
            <div
              role="region"
              aria-label={t('comun.seleccionados', { n: elegidos.length, count: elegidos.length })}
              className="flex items-center gap-3 rounded-sg-md bg-sg-primary-soft px-3 py-2 text-sm"
            >
              <span aria-live="polite">{t('comun.seleccionados', { n: elegidos.length, count: elegidos.length })}</span>
              {can('engagement', 'CREATE') && escribeEnElProyecto ? (
                <Button size="sm" onClick={() => navegar(`${base}/engagements/new?stakeholders=${elegidos.map(encodeURIComponent).join(',')}`)}>
                  {t('grupos.registrarConEllos')}
                </Button>
              ) : null}
            </div>
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
              alLimpiar={() => lista.cambiar({ view: null, ...Object.fromEntries(FILTROS.map((f) => [f, null])) })}
            >
              {t('grupos.vacio')}
            </VacioDeLista>
          ) : (
            <>
              {telefono ? (
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
                  alPrevisualizar={(g) => navegar(previa('stakeholder', g.id))}
                />
              )}
              {filtrados.length > POR_PAGINA ? (
                <Pagination
                  page={lista.pagina}
                  totalPages={Math.ceil(filtrados.length / POR_PAGINA)}
                  totalElements={filtrados.length}
                  onPage={(p) => lista.cambiar({ page: String(p) })}
                />
              ) : null}
            </>
          )}
        </>
      )}
      {proyecto ? <NuevoGrupo proyecto={proyecto} abierto={creando} alCerrar={() => setCreando(false)} /> : null}
    </section>
  )
}

// las celdas de la tabla de escritorio: las que leen otro registro (la localidad, el proyecto, el nombre) son componentes
function CeldaDelGrupo({ grupo }: { grupo: Registro }) {
  const nombre = useNombreDelGrupo(grupo)
  // la lista (con su territorio y sus filtros) queda en el rastro (revisión de UX, etapa 6)
  const paso = useSiguientePaso()
  return (
    <>
      <Link to={rutaDelGrupo(grupo)} state={paso()} className="font-medium text-sg-primary-text underline">
        <NombreDelGrupo grupo={grupo} />
      </Link>{' '}
      {/* la vista previa sin dejar la lista (ux-architecture.md §8.3, paso 2; revisión de UX, etapa 6) */}
      <BotonDeVistaPrevia objeto="stakeholder" id={grupo.id} nombre={nombre} enFila />
      <p className="text-sg-caption text-sg-text-muted">{opcion(grupo, 'stakeholder_type')}</p>
    </>
  )
}

function LocalidadDelGrupo({ grupo }: { grupo: Registro }) {
  const localidad = useRegistro('locality', atributo<string>(grupo, 'locality'))
  return <>{texto(localidad.data, 'name') || '—'}</>
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
