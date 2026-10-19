import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { useSiguientePaso } from '../contexto/Rastro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Pagination, Table, Td, Th } from '@wasichai/ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, NoDisponible, Restringido, ThConExplicacion, esProhibido } from '../componentes/Estados'
import { ChipsDeFiltro, useParametrosDeLista, VacioDeLista, VistasGuardadas } from '../componentes/Lista'
import { NombreDelGrupo, useNombreDelGrupo } from '../componentes/NombreDeActor'
import { BotonDeVistaPrevia } from '../componentes/VistaPrevia'
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
const POR_PAGINA = 25

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
  const filtrados = (grupos.data ?? []).filter((g) => enVistaLa(lista.vista, g) && conFiltros(g))
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
  const chips = filtros.filter((f) => lista.filtro(f)).map((f) => ({ clave: f, etiqueta: `${t(`grupos.filtros.${f}`)}: ${rotuloDeOpcion(lista.filtro(f))}` }))
  const opciones = (campo: string) => definicion.data?.fields.find((f) => f.name === campo)?.enumOptions ?? []
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''

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
          <VistasGuardadas
            vistas={VISTAS.map((id) => ({ id, etiqueta: t(`grupos.vistas.${id}`, { dias: inactividad }), conteo: conteoDe(id) }))}
            actual={lista.vista}
            alCambiar={(id) => lista.cambiar({ view: id })}
          />
          <div className="flex flex-wrap gap-3">
            {filtros.map((f) => (
              <FiltroDeLista
                key={f}
                etiqueta={t(`grupos.filtros.${f}`)}
                opciones={opciones(f)}
                value={lista.filtro(f)}
                onChange={(e) => lista.cambiar({ [f]: e.target.value })}
              />
            ))}
          </div>
          <ChipsDeFiltro
            chips={chips}
            alQuitar={(c) => lista.cambiar({ [c]: null })}
            alLimpiar={() => lista.cambiar(Object.fromEntries(FILTROS.map((f) => [f, null])))}
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
                // en el teléfono, tarjetas con el nombre, su vista previa, el estado y el proyecto (revisión de UX, etapa 8)
                <ListaEnTarjetas
                  etiqueta={t('grupos.titulo')}
                  tarjetas={pagina.map((g) => ({
                    id: g.id,
                    titulo: <TituloDeGrupo grupo={g} />,
                    estado: <EstadoChip objeto="stakeholder" estado={g.state} />,
                    proyecto: proyecto ? undefined : <ProyectoDelGrupo grupo={g} />,
                    detalle: [opcion(g, 'stakeholder_type'), opcion(g, 'influence_group')].filter(Boolean).join(' · ') || undefined
                  }))}
                />
              ) : (
                <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
                  <Table aria-label={t('grupos.titulo')}>
                    <thead>
                      <tr>
                        {proyecto ? (
                          <Th>
                            <span className="sr-only">{t('comun.seleccionar')}</span>
                          </Th>
                        ) : null}
                        {(
                          [
                            'grupo',
                            ...(proyecto ? [] : ['proyecto']),
                            'territorio',
                            'influencia',
                            'postura',
                            'prioridad',
                            'estado',
                            'relacion',
                            'responsable',
                            'evaluacion',
                            'contacto'
                          ] as const
                        ).map((c) =>
                          c === 'postura' && !leePostura ? (
                            <ThConExplicacion key={c} explicacion={idDeLaPostura} tipo="restringido">
                              {t(`grupos.columnas.${c}`)}
                            </ThConExplicacion>
                          ) : (
                            // Responsable se oculta por debajo de 1440 px: así la evaluación se ve sin desplazar (revisión de UX)
                            <Th key={c} scope="col" className={c === 'responsable' ? 'hidden 2xl:table-cell' : undefined}>
                              {t(`grupos.columnas.${c}`)}
                            </Th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pagina.map((g) => (
                        <Fila
                          key={g.id}
                          grupo={g}
                          global={!proyecto}
                          leePostura={leePostura}
                          idDeLaPostura={idDeLaPostura}
                          seleccionado={seleccion.has(g.id)}
                          alSeleccionar={
                            proyecto
                              ? (si) => {
                                  const siguiente = new Set(seleccion)
                                  if (si) siguiente.add(g.id)
                                  else siguiente.delete(g.id)
                                  setSeleccion(siguiente)
                                }
                              : undefined
                          }
                        />
                      ))}
                    </tbody>
                  </Table>
                </div>
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

function Fila({
  grupo,
  global,
  leePostura,
  idDeLaPostura,
  seleccionado,
  alSeleccionar
}: {
  grupo: Registro
  global: boolean
  leePostura: boolean
  idDeLaPostura: string
  seleccionado: boolean
  alSeleccionar?: (si: boolean) => void
}) {
  const { t } = useTranslation(NS)
  const proyecto = String(atributo(grupo, 'project'))
  const localidad = useRegistro('locality', atributo<string>(grupo, 'locality'))
  const del = useRegistro('project', global ? proyecto : undefined)
  const evaluado = grupo.state === 'assessed' || Boolean(atributo(grupo, 'influence_group'))
  const nombre = useNombreDelGrupo(grupo)
  // la lista (con su territorio y sus filtros) queda en el rastro (revisión de UX, etapa 6)
  const paso = useSiguientePaso()
  return (
    <tr>
      {alSeleccionar ? (
        <Td>
          <input
            type="checkbox"
            aria-label={`${t('comun.seleccionar')} ${grupo.id}`}
            checked={seleccionado}
            onChange={(e) => alSeleccionar(e.target.checked)}
          />
        </Td>
      ) : null}
      <Td className="min-w-48">
        <Link
          to={`/projects/${encodeURIComponent(proyecto)}/stakeholders/${encodeURIComponent(grupo.id)}`}
          state={paso()}
          className="font-medium text-sg-primary-text underline"
        >
          <NombreDelGrupo grupo={grupo} />
        </Link>{' '}
        {/* la vista previa sin dejar la lista (ux-architecture.md §8.3, paso 2; revisión de UX, etapa 6) */}
        <BotonDeVistaPrevia objeto="stakeholder" id={grupo.id} nombre={nombre} />
        <p className="text-sg-caption text-sg-text-muted">{opcion(grupo, 'stakeholder_type')}</p>
      </Td>
      {global ? (
        <Td className="text-sm">
          <ProyectoEnLista proyecto={del.data} />
        </Td>
      ) : null}
      <Td className="text-sm">{texto(localidad.data, 'name') || '—'}</Td>
      <Td className="text-sm">{evaluado ? opcion(grupo, 'influence_group') || '—' : t('grupos.sinEvaluarValor')}</Td>
      <Td className="text-sm">{leePostura ? opcion(grupo, 'stance') || '—' : <Restringido describedPor={idDeLaPostura} />}</Td>
      <Td className="text-sm">{evaluado ? opcion(grupo, 'information_priority') || '—' : t('grupos.sinEvaluarValor')}</Td>
      <Td>
        <EstadoChip objeto="stakeholder" estado={grupo.state} />
      </Td>
      <Td className="text-sm">{opcion(grupo, 'relationship_status') || '—'}</Td>
      <Td className="hidden text-sm 2xl:table-cell">
        <Persona correo={texto(grupo, 'owner_user_email')} />
      </Td>
      <Td className="text-sm">
        <Dia valor={texto(grupo, 'last_assessment_date')} />
      </Td>
      <Td className="text-sm">
        <Dia valor={texto(grupo, 'last_contact_date')} />
      </Td>
    </tr>
  )
}

// el título de la tarjeta de un grupo en el teléfono: su nombre como enlace (con su paso en el rastro) y su vista previa
function TituloDeGrupo({ grupo }: { grupo: Registro }) {
  const nombre = useNombreDelGrupo(grupo)
  const paso = useSiguientePaso()
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
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

function ProyectoDelGrupo({ grupo }: { grupo: Registro }) {
  const del = useRegistro('project', String(atributo(grupo, 'project')))
  return <ProyectoEnLista proyecto={del.data} />
}
