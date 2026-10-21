import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { useChipDeGrupo } from '../componentes/FiltroDeGrupo'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Pagination, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { montoPe } from '../componentes/Monto'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useProyectos } from '../contexto/proyectos'
import { filtroDeTerritorio } from '../contexto/rutas'
import { atributo, conEstado, estados, texto, useConteo, useConteos, useRegistros, useRelacionados, type Parametros, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useTableroDisponible } from '../tableros/comunes'
import { Candidatos } from './Candidatos'
import { Dia } from '../componentes/Dia'
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

  // sin grupo: el servidor. la consulta de una vista lleva el alcance, el territorio, el estado elegido y la búsqueda
  const alcance: Parametros = { project: proyecto, ...(territorio ?? {}) }
  const consultaDe = (vista: string): Parametros | null => {
    const deLaVista = conEstado(consultaDeVista(vista, user?.id), estado)
    return deLaVista && { ...alcance, ...deLaVista, q: busqueda }
  }
  const actual = consultaDe(lista.vista)
  const servidor = !grupo && !enCandidatos
  const pedida = useRegistros('commitment', { ...actual, sort: 'due_date', dir: 'asc', page: lista.pagina, size: POR_PAGINA }, servidor && actual !== null)
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
  const filtrados = relacionados.filter((c) => enVista(lista.vista, c, user?.id) && conFiltros(c))

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
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        vistas={<VistasDelModulo modulo="commitments" actual="lista" conTablero={conTablero} />}
        titulo={t('compromisos.titulo')}
        conteo={!enCandidatos && total !== null ? t('compromisos.conteo', { count: total }) : undefined}
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
      {/* la barra de filtros (hallazgos U-18 y U-22): las vistas en una sola fila, con su conteo, la búsqueda, el estado y un
          chip por filtro. ?view= y los parámetros de filtro siguen siendo los mismos; los candidatos no se filtran */}
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
            <FiltroDeLista
              etiqueta={t('compromisos.estado')}
              value={estado}
              onChange={(e) => lista.cambiar({ state: e.target.value })}
              opciones={Object.entries(etiquetas).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
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
          {cargando ? (
            <Cargando />
          ) : fallo ? (
            <FalloDeLectura error={lectura.error} alReintentar={() => void lectura.refetch()} />
          ) : filas.length === 0 ? (
            chips.length > 0 ? (
              <VacioDeLista conFiltros alLimpiar={limpiar} sinFiltros={sinFiltros} />
            ) : (
              <Vacio titulo={t('compromisos.vacio')} />
            )
          ) : (
            <>
              {telefono ? (
                <ListaEnTarjetas
                  etiqueta={t('compromisos.tabla')}
                  tarjetas={filas.map((c) => ({
                    id: c.id,
                    titulo: (
                      <EnlaceDeRegistro
                        codigo={texto(c, 'code')}
                        titulo={texto(c, 'title')}
                        ruta={`/projects/${encodeURIComponent(texto(c, 'project'))}/commitments/${encodeURIComponent(c.id)}`}
                        desde={t('compromisos.titulo')}
                        previa={{ objeto: 'commitment', id: c.id }}
                      />
                    ),
                    estado: <EstadoChip objeto="commitment" estado={c.state} />,
                    plazo: (
                      <>
                        <SituacionDePlazo valor={atributo(c, 'deadline_status')} />
                        <Dia valor={texto(c, 'due_date')} />
                      </>
                    ),
                    proyecto: proyecto ? undefined : nombreDelProyecto(texto(c, 'project'))
                  }))}
                />
              ) : (
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
                      {filas.map((c) => (
                        <tr key={c.id}>
                          <Td className="min-w-64 text-sm">
                            <EnlaceDeRegistro
                              codigo={texto(c, 'code')}
                              titulo={texto(c, 'title')}
                              ruta={`/projects/${encodeURIComponent(texto(c, 'project'))}/commitments/${encodeURIComponent(c.id)}`}
                              desde={t('compromisos.titulo')}
                              previa={{ objeto: 'commitment', id: c.id }}
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
              )}
              {total !== null && total > POR_PAGINA ? (
                <Pagination
                  page={lista.pagina}
                  totalPages={Math.ceil(total / POR_PAGINA)}
                  totalElements={total}
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
