import { useAuth } from '@wasichai/core'
import { Alert, Button, Pagination, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CONTROL, SelectNativo } from '../componentes/Campo'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { ChipsDeFiltro, useParametrosDeLista, VacioDeLista, VistasGuardadas } from '../componentes/Lista'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { montoPe } from '../componentes/Monto'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useProyectos } from '../contexto/proyectos'
import { filtroDeTerritorio } from '../contexto/rutas'
import { atributo, texto, useTodosConTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useTableroDisponible } from '../tableros/comunes'
import { Candidatos } from './Candidatos'
import { Dia } from '../componentes/Dia'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { Persona } from '../componentes/Persona'

// S28 · lista de compromisos (screens.md §7): lo que se debe, a quién y desde cuándo, con lo vencido a un clic. la misma página
// con alcance global (columna Proyecto) o de un proyecto (ASM-076), con el chip de territorio (localidad o comunidad). la API
// genérica filtra solo por igualdad y no por estado de workflow, así que, como la lista de grupos de interés de F2, se leen los
// compromisos del alcance con tope (useTodosConTope, que avisa del recorte) y las vistas se arman aquí. la vista Candidatos es
// la de WF-K
const VISTAS = ['abiertos', 'vencidos', 'porVencer', 'bloqueados', 'mios', 'cerrados', 'candidatos'] as const
type VistaDeCompromisos = (typeof VISTAS)[number]
const CERRADOS = ['closed', 'cancelled']
const POR_PAGINA = 25

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

export function CompromisosPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const { scope, territory } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const lista = useParametrosDeLista('abiertos')
  const territorio = filtroDeTerritorio(territory, { locality: 'locality', community: 'community' })
  const compromisos = useTodosConTope('commitment', { project: proyecto, ...(territorio ?? {}), sort: 'due_date', dir: 'asc' }, lista.vista !== 'candidatos')
  const proyectos = useProyectos()
  const etiquetas = useEtiquetasDeEstado('commitment')
  const conTablero = useTableroDisponible('commitments')
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
  const q = lista.filtro('q').trim().toLowerCase()
  const estado = lista.filtro('state')
  const filtrados = (compromisos.data ?? []).filter(
    (c) =>
      enVista(lista.vista, c, user?.id) &&
      (!estado || c.state === estado) &&
      (!q || texto(c, 'code').toLowerCase().includes(q) || texto(c, 'title').toLowerCase().includes(q))
  )
  const pagina = filtrados.slice(lista.pagina * POR_PAGINA, (lista.pagina + 1) * POR_PAGINA)
  const nombreDelProyecto = (id: string) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
  // la etapa 3 de la revisión de UX: cada vista dice cuántos tiene (con la búsqueda y el estado puestos), los filtros activos
  // son chips con «Limpiar» y el vacío por filtros dice cuántos hay sin ellos
  const conFiltros = (c: Registro) =>
    (!estado || c.state === estado) && (!q || texto(c, 'code').toLowerCase().includes(q) || texto(c, 'title').toLowerCase().includes(q))
  const conteoDe = (vista: string) => (compromisos.data ? compromisos.data.filter((c) => enVista(vista, c, user?.id) && conFiltros(c)).length : null)
  const enLaVista = (compromisos.data ?? []).filter((c) => enVista(lista.vista, c, user?.id)).length
  const chips = [
    ...(estado ? [{ clave: 'state', etiqueta: t('compromisos.filtroEstado', { estado: etiquetas[estado] ?? estado }) }] : []),
    ...(q ? [{ clave: 'q', etiqueta: t('compromisos.filtroBusqueda', { texto: lista.filtro('q').trim() }) }] : [])
  ]
  const limpiar = () => lista.cambiar({ state: null, q: null })
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        titulo={t('compromisos.titulo')}
        conteo={lista.vista !== 'candidatos' && compromisos.data ? t('compromisos.conteo', { count: filtrados.length }) : undefined}
        primaria={<BotonCrear objeto="commitment" etiqueta={t('compromisos.nuevo')} resto="commitments/new" />}
        secundarias={
          <>
            {conTablero ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={`${base}/commitments/dashboard`}>{t('compromisos.tablero')}</Link>
              </Button>
            ) : null}
            {can('commitment', 'EXPORT') ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={`${base}/reports`}>{t('compromisos.exportar')}</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <VistasGuardadas
        vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`compromisos.vistas.${v}`), conteo: v === 'candidatos' ? undefined : conteoDe(v) }))}
        actual={lista.vista}
        alCambiar={(vista) => lista.cambiar({ view: vista })}
      />
      {lista.vista === 'candidatos' ? (
        <Candidatos proyecto={proyecto} />
      ) : (
        <>
          {territorio === null ? <Alert tone="notice">{t('compromisos.territorioNoAplica')}</Alert> : null}
          <div role="group" aria-label={t('comun.filtros')} className="flex flex-wrap items-end gap-3 text-sm">
            <label className="space-y-1">
              <span className="block">{t('compromisos.buscar')}</span>
              <input type="search" className={CONTROL} value={lista.filtro('q')} onChange={(e) => lista.cambiar({ q: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="block">{t('compromisos.estado')}</span>
              <SelectNativo
                textoVacio={t('comun.todos')}
                value={estado}
                onChange={(e) => lista.cambiar({ state: e.target.value })}
                opciones={Object.entries(etiquetas).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
              />
            </label>
          </div>
          <ChipsDeFiltro chips={chips} alQuitar={(clave) => lista.cambiar({ [clave]: null })} alLimpiar={limpiar} />
          {compromisos.truncado ? <Alert tone="warning">{t('compromisos.truncado', { n: numeroPe(compromisos.data?.length ?? 0) })}</Alert> : null}
          {compromisos.isPending ? (
            <Cargando />
          ) : compromisos.isError && !compromisos.data ? (
            <FalloDeLectura error={compromisos.error} alReintentar={() => void compromisos.refetch()} />
          ) : filtrados.length === 0 ? (
            chips.length > 0 ? (
              <VacioDeLista conFiltros alLimpiar={limpiar} sinFiltros={enLaVista} />
            ) : (
              <Vacio titulo={t('compromisos.vacio')} />
            )
          ) : (
            <>
              <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
                <Table aria-label={t('compromisos.tabla')}>
                  <thead>
                    <tr>
                      <Th scope="col">{t('compromisos.columnas.compromiso')}</Th>
                      {proyecto ? null : <Th scope="col">{t('compromisos.columnas.proyecto')}</Th>}
                      <Th scope="col">{t('compromisos.columnas.estado')}</Th>
                      <Th scope="col">{t('compromisos.columnas.situacion')}</Th>
                      <Th scope="col">{t('compromisos.columnas.vence')}</Th>
                      <Th scope="col">{t('compromisos.columnas.responsable')}</Th>
                      <Th scope="col" className="text-right">
                        {t('compromisos.columnas.monto')}
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagina.map((c) => (
                      <tr key={c.id}>
                        <Td className="min-w-64 text-sm">
                          <EnlaceDeRegistro
                            codigo={texto(c, 'code')}
                            titulo={texto(c, 'title')}
                            ruta={`/projects/${encodeURIComponent(texto(c, 'project'))}/commitments/${encodeURIComponent(c.id)}`}
                            desde={t('compromisos.titulo')}
                          />
                        </Td>
                        {proyecto ? null : <Td className="text-sm">{nombreDelProyecto(texto(c, 'project'))}</Td>}
                        <Td>
                          <EstadoChip objeto="commitment" estado={c.state} />
                        </Td>
                        <Td>
                          <SituacionDePlazo valor={atributo(c, 'deadline_status')} />
                        </Td>
                        <Td className="text-sm">
                          <Dia valor={texto(c, 'due_date')} />
                        </Td>
                        <Td className="text-sm">
                          <Persona correo={texto(c, 'owner_user_email')} />
                        </Td>
                        <Td className="text-right text-sm tabular-nums">{montoPe(atributo(c, 'amount'), atributo(c, 'currency'))}</Td>
                      </tr>
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
    </section>
  )
}
