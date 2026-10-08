import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Pagination, Table, Td, Th } from '@wasichai/ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { SelectNativo } from '../componentes/Campo'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, ExplicacionDeColumna, NoDisponible, Restringido } from '../componentes/Estados'
import { ChipsDeFiltro, useParametrosDeLista, VacioDeLista, VistasGuardadas } from '../componentes/Lista'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { useProyecto } from '../contexto/proyectos'
import { filtroDeTerritorio } from '../contexto/rutas'
import { diasEntre, hoyEnLima } from '../datos/fechas'
import { atributo, puedeLeer, texto, useDefinicion, useRegistro, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useAsignadoAlProyecto } from '../contexto/ProyectoLayout'
import { useContextFilters } from '../shell/context'
import { useTableroDisponible } from '../tableros/comunes'
import { NuevoGrupo } from './NuevoGrupo'

// S16 · lista de grupos de interés (screens.md §5): la misma página con alcance global (agrega la columna Proyecto) o de un
// proyecto (ASM-076). vistas del sistema, filtros en la URL, selección para registrar una interacción con varios y el chip
// de territorio. sin permiso para leer stance la columna dice "Restringido" y no se filtra por ella (security.md §7.9)
const VISTAS = ['prioridad', 'mios', 'sinEvaluar', 'sinContacto', 'todos', 'retirados'] as const
const FILTROS = ['influence_group', 'stance', 'stakeholder_scope', 'relationship_status', 'stakeholder_type'] as const
const POR_PAGINA = 25
const sinPermiso = (error: unknown): boolean => error instanceof ApiError && error.status === 403

export function GruposPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const navegar = useNavigate()
  const { scope, territory } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const registroDelProyecto = useProyecto(proyecto)
  const asignado = useAsignadoAlProyecto(proyecto)
  const lista = useParametrosDeLista('todos')
  const definicion = useDefinicion('stakeholder')
  const territorio = filtroDeTerritorio(territory, { locality: 'locality', area: 'area_of_influence' })
  const grupos = useTodos('stakeholder', { project: proyecto, ...(territorio ?? {}) })
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [creando, setCreando] = useState(false)
  // la explicación única de la columna Postura cuando sus celdas están restringidas
  const idDeLaPostura = useId()
  const conTablero = useTableroDisponible('stakeholders')
  // ni la postura ni la tolerancia de inactividad se deciden antes de que lleguen la definición y el proyecto: sin ellas, una
  // cuenta con acceso vería "Restringido" un instante y la vista "Sin contacto" usaría 90 días. en el alcance global no hay
  // un proyecto: la tolerancia es la de 90 días de la etiqueta y de la vista (cada proyecto tiene la suya)
  const preparando = definicion.isPending || (proyecto !== undefined && registroDelProyecto.isPending)
  const leePostura = definicion.isSuccess && puedeLeer(definicion.data, 'stance')
  const inactividad = Number(atributo(registroDelProyecto.data, 'inactivity_days') ?? 90)
  const filtros = FILTROS.filter((f) => f !== 'stance' || leePostura)

  const hoy = hoyEnLima()
  const enVista = (g: Registro) => {
    switch (lista.vista) {
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
  const filtrados = (grupos.data ?? []).filter((g) => enVista(g) && filtros.every((f) => !lista.filtro(f) || texto(g, f) === lista.filtro(f)))
  const pagina = filtrados.slice(lista.pagina * POR_PAGINA, (lista.pagina + 1) * POR_PAGINA)
  // la selección es de lo que se ve: al cambiar de vista, de filtro o de página se reinicia, y nunca viaja una fila oculta
  const claveDeVista = [lista.vista, lista.pagina, ...FILTROS.map((f) => lista.filtro(f))].join('|')
  const [claveVista, setClaveVista] = useState(claveDeVista)
  if (claveVista !== claveDeVista) {
    setClaveVista(claveDeVista)
    setSeleccion(new Set())
  }
  const elegidos = pagina.filter((g) => seleccion.has(g.id)).map((g) => g.id)
  const chips = filtros.filter((f) => lista.filtro(f)).map((f) => ({ clave: f, etiqueta: `${t(`grupos.filtros.${f}`)}: ${lista.filtro(f)}` }))
  const opciones = (campo: string) => definicion.data?.fields.find((f) => f.name === campo)?.enumOptions ?? []
  const base = proyecto ? `/projects/${proyecto}` : ''

  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sg-h1 font-semibold">{t('grupos.titulo')}</h1>
          <p className="text-sm text-sg-text-muted">{t('grupos.conteo', { n: filtrados.length })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {proyecto ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`${base}/stakeholders/matrix`}>{t('grupos.verMatriz')}</Link>
            </Button>
          ) : null}
          {conTablero ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`${base}/stakeholders/dashboard`}>{t('grupos.tablero')}</Link>
            </Button>
          ) : null}
          {can('stakeholder', 'EXPORT') ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`${base}/reports`}>{t('grupos.exportar')}</Link>
            </Button>
          ) : null}
          {proyecto && asignado && can('stakeholder', 'CREATE') ? (
            <Button size="sm" onClick={() => setCreando(true)}>
              {t('grupos.nuevo')}
            </Button>
          ) : null}
        </div>
      </div>
      {territorio === null ? <Alert tone="notice">{t('contexto.noAplica')}</Alert> : null}
      {definicion.isError && !definicion.data ? (
        <ErrorDeCarga error={definicion.error} alReintentar={() => void definicion.refetch()} />
      ) : preparando ? (
        <Cargando />
      ) : (
        <>
          <VistasGuardadas
            vistas={VISTAS.map((id) => ({ id, etiqueta: t(`grupos.vistas.${id}`, { dias: inactividad }) }))}
            actual={lista.vista}
            alCambiar={(id) => lista.cambiar({ view: id })}
          />
          <div className="flex flex-wrap gap-3">
            {filtros.map((f) => (
              <SelectNativo
                key={f}
                aria-label={t(`grupos.filtros.${f}`)}
                className="w-auto"
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
              aria-label={t('comun.seleccionados', { n: elegidos.length })}
              className="flex items-center gap-3 rounded-sg-md bg-sg-primary-soft px-3 py-2 text-sm"
            >
              <span aria-live="polite">{t('comun.seleccionados', { n: elegidos.length })}</span>
              {can('engagement', 'CREATE') && asignado ? (
                <Button size="sm" onClick={() => navegar(`${base}/engagements/new?stakeholders=${elegidos.join(',')}`)}>
                  {t('grupos.registrarConEllos')}
                </Button>
              ) : null}
            </div>
          ) : null}
          {grupos.isPending ? (
            <Cargando />
          ) : grupos.isError && !grupos.data ? (
            sinPermiso(grupos.error) ? (
              <NoDisponible />
            ) : (
              <ErrorDeCarga error={grupos.error} alReintentar={() => void grupos.refetch()} />
            )
          ) : filtrados.length === 0 ? (
            <VacioDeLista
              conFiltros={chips.length > 0 || lista.vista !== 'todos'}
              alLimpiar={() => lista.cambiar({ view: null, ...Object.fromEntries(FILTROS.map((f) => [f, null])) })}
            >
              {t('grupos.vacio')}
            </VacioDeLista>
          ) : (
            <>
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
                      ).map((c) => (
                        <Th key={c} scope="col">
                          {t(`grupos.columnas.${c}`)}
                          {c === 'postura' && !leePostura ? <ExplicacionDeColumna id={idDeLaPostura} tipo="restringido" /> : null}
                        </Th>
                      ))}
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
      <Td>
        <Link to={`/projects/${proyecto}/stakeholders/${grupo.id}`} className="font-medium text-sg-primary-text">
          <NombreDelGrupo grupo={grupo} />
        </Link>
        <p className="text-sg-caption text-sg-text-muted">{texto(grupo, 'stakeholder_type')}</p>
      </Td>
      {global ? <Td className="font-sg-mono text-sg-caption">{texto(del.data, 'code')}</Td> : null}
      <Td className="text-sm">{texto(localidad.data, 'name') || '—'}</Td>
      <Td className="text-sm">{evaluado ? texto(grupo, 'influence_group') || '—' : t('grupos.sinEvaluarValor')}</Td>
      <Td className="text-sm">{leePostura ? texto(grupo, 'stance') || '—' : <Restringido describedPor={idDeLaPostura} />}</Td>
      <Td className="text-sm">{evaluado ? texto(grupo, 'information_priority') || '—' : t('grupos.sinEvaluarValor')}</Td>
      <Td>
        <EstadoChip objeto="stakeholder" estado={grupo.state} />
      </Td>
      <Td className="text-sm">{texto(grupo, 'relationship_status') || '—'}</Td>
      <Td className="text-sm">{texto(grupo, 'owner_user_email') || '—'}</Td>
      <Td className="text-sm">{texto(grupo, 'last_assessment_date') || '—'}</Td>
      <Td className="text-sm">{texto(grupo, 'last_contact_date') || '—'}</Td>
    </tr>
  )
}
