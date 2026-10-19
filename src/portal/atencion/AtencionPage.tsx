import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { useChipDeGrupo } from '../componentes/FiltroDeGrupo'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CONTROL, SelectNativo } from '../componentes/Campo'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, Vacio } from '../componentes/Estados'
import { KpiCard } from '../componentes/KpiCard'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { ChipsDeFiltro, useParametrosDeLista, VacioDeLista, VistasGuardadas } from '../componentes/Lista'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useProyectos } from '../contexto/proyectos'
import { estaAbierta, OBJETOS_DE_QCS, plazoQueCorre, rutaDeQcs, type ObjetoDeQcs } from '../datos/atencion'
import { useIndicador, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { atributo, campoDe, texto, useDefinicion, useTodosConTope, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { Persona } from '../componentes/Persona'

// S35 · lista unificada de QCS (screens.md §8): ¿qué QCS vence primero y quién la tiene? tres objetos con ciclos distintos (WF-E1,
// WF-E2, WF-E3) que la lista une para atender por plazo, sin mezclar sus estados: cada fila lleva el estado de su workflow y el plazo
// que corre en él (plazoQueCorre), agrupadas por su situación de plazo (deadline_status, que deriva JOB-01: nunca un estado). la API
// genérica filtra solo por igualdad, así que, como la lista de compromisos, se leen las QCS del alcance con tope (useTodosConTope,
// que avisa del recorte) y las vistas y filtros se arman aquí. cada tipo se lee solo si la cuenta lo lee. una QCS confidencial que
// la cuenta no lee no llega (security.md §9.6) y las cifras lo dicen (confidentialHidden). la persona que plantea es un campo
// restringido y no tiene columna: una anónima se dice «anónima»
const VISTAS = ['atencion', 'quejas', 'consultas', 'solicitudes', 'mias', 'todas'] as const
const DE_LA_VISTA: Partial<Record<string, ObjetoDeQcs>> = { quejas: 'grievance', consultas: 'inquiry', solicitudes: 'stakeholder_request' }
const GRUPOS = ['vencidas', 'porVencer', 'alDia'] as const
type Grupo = (typeof GRUPOS)[number]

// el asunto de una QCS, que no tiene título: el comienzo de su descripción
const asuntoDe = (registro: Registro) => {
  const d = texto(registro, 'description').trim()
  return d.length > 70 ? `${d.slice(0, 70).trimEnd()}…` : d
}

export interface Fila {
  objeto: ObjetoDeQcs
  registro: Registro
}

export function enVista(vista: string, { objeto, registro }: Fila, usuario: string | undefined): boolean {
  const tipo = DE_LA_VISTA[vista]
  if (tipo) return objeto === tipo && estaAbierta(objeto, registro)
  if (vista === 'todas') return true
  if (vista === 'mias') return estaAbierta(objeto, registro) && atributo(registro, 'owner_user_id') === usuario
  return estaAbierta(objeto, registro)
}

// la situación de plazo cuenta solo en los estados que tienen plazo: fuera de ellos, al día o sin plazo
export function grupoDe({ objeto, registro }: Fila): Grupo {
  if (!plazoQueCorre(objeto, registro)) return 'alDia'
  const situacion = texto(registro, 'deadline_status')
  return situacion === 'VENCIDO' ? 'vencidas' : situacion === 'POR VENCER' ? 'porVencer' : 'alDia'
}

// dentro de un grupo, primero lo que vence antes (el plazo que corre en su estado); sin fecha al final; empata la recepción más
// antigua y, luego, el código
export function porPlazo(a: Fila, b: Fila): number {
  const vence = (f: Fila) => {
    const fecha = plazoQueCorre(f.objeto, f.registro)?.fecha
    return fecha ? Date.parse(fecha) : Number.POSITIVE_INFINITY
  }
  const recibida = (f: Fila) => Date.parse(texto(f.registro, 'received_at')) || Number.POSITIVE_INFINITY
  const va = vence(a)
  const vb = vence(b)
  if (va !== vb) return va < vb ? -1 : 1
  const ra = recibida(a)
  const rb = recibida(b)
  if (ra !== rb) return ra < rb ? -1 : 1
  return texto(a.registro, 'code').localeCompare(texto(b.registro, 'code'))
}

export function AtencionPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const lista = useParametrosDeLista('atencion')
  const telefono = useEsTelefono()
  const quejas = useTodosConTope('grievance', { project: proyecto }, can('grievance', 'READ'))
  const consultas = useTodosConTope('inquiry', { project: proyecto }, can('inquiry', 'READ'))
  const solicitudes = useTodosConTope('stakeholder_request', { project: proyecto }, can('stakeholder_request', 'READ'))
  const lecturas = { grievance: quejas, inquiry: consultas, stakeholder_request: solicitudes }
  const legibles = OBJETOS_DE_QCS.filter((o) => can(o, 'READ'))
  const proyectos = useProyectos()
  // canal y categoría usan el mismo ENUM en los tres tipos: sus opciones salen del primero que la cuenta lee. severity es solo de
  // las quejas
  const definicion = useDefinicion(legibles[0])
  const conSeveridad = can('grievance', 'READ')
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
  const filtrosDeIndicador: FiltrosDeIndicador = proyecto ? { project: [proyecto] } : {}
  const abiertas = useIndicador('KPI-GRV-02', filtrosDeIndicador)
  const vencidas = useIndicador('KPI-GRV-06', filtrosDeIndicador)
  const absueltas = useIndicador('KPI-GRV-07', filtrosDeIndicador)
  const cargando = legibles.some((o) => lecturas[o].isPending)
  const fallida = legibles.map((o) => lecturas[o]).find((l) => l.isError && !l.data)
  const truncado = legibles.some((o) => lecturas[o].truncado)
  const filas: Fila[] = legibles.flatMap((o) => (lecturas[o].data ?? []).map((registro) => ({ objeto: o, registro })))
  const q = lista.filtro('q').trim().toLowerCase()
  const canal = lista.filtro('channel')
  const categoria = lista.filtro('category')
  const severidad = lista.filtro('severity')
  // ?stakeholder=<id>: las QCS de un grupo de interés, desde las cifras de su ficha (revisión de UX, etapa 6)
  const grupo = lista.filtro('stakeholder')
  const chipDeGrupo = useChipDeGrupo(grupo)
  const visibles = filas.filter(
    (f) =>
      enVista(lista.vista, f, user?.id) &&
      (!grupo || texto(f.registro, 'stakeholder') === grupo) &&
      (!canal || texto(f.registro, 'channel') === canal) &&
      (!categoria || texto(f.registro, 'category') === categoria) &&
      (!conSeveridad || !severidad || texto(f.registro, 'severity') === severidad) &&
      (!q || texto(f.registro, 'code').toLowerCase().includes(q) || texto(f.registro, 'description').toLowerCase().includes(q))
  )
  const porVencer = filas.filter((f) => estaAbierta(f.objeto, f.registro) && grupoDe(f) === 'porVencer').length
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  // la etapa 3 de la revisión de UX: cada vista con su conteo (con los filtros puestos), los filtros como chips con «Limpiar» y el
  // vacío por filtros con cuántos hay sin ellos
  const conFiltros = (f: Fila) =>
    (!grupo || texto(f.registro, 'stakeholder') === grupo) &&
    (!canal || texto(f.registro, 'channel') === canal) &&
    (!categoria || texto(f.registro, 'category') === categoria) &&
    (!conSeveridad || !severidad || texto(f.registro, 'severity') === severidad) &&
    (!q || texto(f.registro, 'code').toLowerCase().includes(q) || texto(f.registro, 'description').toLowerCase().includes(q))
  const conteoDe = (vista: string) => (cargando || fallida ? null : filas.filter((f) => enVista(vista, f, user?.id) && conFiltros(f)).length)
  const enLaVista = filas.filter((f) => enVista(lista.vista, f, user?.id)).length
  const chips = [
    ...(grupo ? [{ clave: 'stakeholder', etiqueta: chipDeGrupo }] : []),
    ...(q ? [{ clave: 'q', etiqueta: t('atencion.filtroBusqueda', { texto: lista.filtro('q').trim() }) }] : []),
    ...(canal ? [{ clave: 'channel', etiqueta: `${t('atencion.canal')}: ${rotuloDeOpcion(canal)}` }] : []),
    ...(categoria ? [{ clave: 'category', etiqueta: `${t('atencion.categoria')}: ${rotuloDeOpcion(categoria)}` }] : []),
    ...(conSeveridad && severidad ? [{ clave: 'severity', etiqueta: `${t('atencion.severidad')}: ${rotuloDeOpcion(severidad)}` }] : [])
  ]
  const limpiar = () => lista.cambiar({ q: null, channel: null, category: null, severity: null, stakeholder: null })
  const conConfidencialesOcultas = [abiertas, vencidas, absueltas].some((i) => i.data?.confidentialHidden === true)
  // si fallan los tres indicadores, un solo aviso con «Reintentar» y las tarjetas en una línea; si falla uno, su tarjeta lo
  // ofrece (D4, revisión de UX, etapa 7). un 403 no es una falla: es «No disponible»
  const indicadores = [abiertas, vencidas, absueltas]
  const fallanTodos = indicadores.every((i) => i.isError && !i.data && !(i.error instanceof ApiError && i.error.status === 403))
  const reintentarTodos = () => indicadores.forEach((i) => void i.refetch())
  const tarjeta = (titulo: string, consulta: { data?: Indicador; error: unknown; isPending: boolean; refetch: () => unknown }) => (
    <KpiCard
      titulo={titulo}
      indicador={consulta.data}
      cargando={consulta.isPending}
      error={consulta.error}
      alReintentar={fallanTodos ? undefined : () => void consulta.refetch()}
    />
  )
  const nombreDelProyecto = (id: string) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        vistas={<VistasDelModulo modulo="attention" actual="lista" />}
        titulo={t('atencion.titulo')}
        conteo={cargando || fallida || legibles.length === 0 ? undefined : t('atencion.conteo', { count: visibles.length })}
        primaria={<BotonCrear objeto={OBJETOS_DE_QCS} etiqueta={t('atencion.registrar')} resto="attention/new" />}
        secundarias={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link to={`${base}/attention/report`}>{t('atencion.reporte')}</Link>
            </Button>
          </>
        }
      />
      <section aria-label={t('atencion.indicadores')} className="space-y-2">
        {fallanTodos ? <ErrorDeCarga error={abiertas.error} alReintentar={reintentarTodos} /> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tarjeta(abiertas.data?.label || t('atencion.tarjetas.abiertas'), abiertas)}
          {tarjeta(vencidas.data?.label || t('atencion.tarjetas.vencidas'), vencidas)}
          <KpiCard
            titulo={t('atencion.tarjetas.porVencer')}
            cargando={cargando}
            indicador={
              cargando || fallida
                ? undefined
                : // sin ninguna QCS legible no hay cifra: «No disponible», nunca cero
                  { code: 'por-vencer', label: t('atencion.tarjetas.porVencer'), available: legibles.length > 0, value: legibles.length > 0 ? porVencer : null }
            }
            error={fallida?.error}
          />
          {tarjeta(absueltas.data?.label || t('atencion.tarjetas.absueltas'), absueltas)}
        </div>
        <NotaDeConfidenciales oculta={conConfidencialesOcultas} />
      </section>
      <VistasGuardadas
        vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`atencion.vistas.${v}`), conteo: conteoDe(v) }))}
        actual={lista.vista}
        alCambiar={(vista) => lista.cambiar({ view: vista })}
      />
      <div role="group" aria-label={t('comun.filtros')} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block">{t('atencion.buscar')}</span>
          <input type="search" className={CONTROL} value={lista.filtro('q')} onChange={(e) => lista.cambiar({ q: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="block">{t('atencion.canal')}</span>
          <SelectNativo
            textoVacio={t('comun.todos')}
            value={canal}
            onChange={(e) => lista.cambiar({ channel: e.target.value })}
            opciones={opciones('channel')}
          />
        </label>
        <label className="space-y-1">
          <span className="block">{t('atencion.categoria')}</span>
          <SelectNativo
            textoVacio={t('comun.todos')}
            value={categoria}
            onChange={(e) => lista.cambiar({ category: e.target.value })}
            opciones={opciones('category')}
          />
        </label>
        {conSeveridad ? (
          <label className="space-y-1">
            <span className="block">{t('atencion.severidad')}</span>
            <SelectNativo
              textoVacio={t('comun.todos')}
              value={severidad}
              onChange={(e) => lista.cambiar({ severity: e.target.value })}
              opciones={opciones('severity')}
            />
          </label>
        ) : null}
      </div>
      <ChipsDeFiltro chips={chips} alQuitar={(clave) => lista.cambiar({ [clave]: null })} alLimpiar={limpiar} />
      {truncado ? <Alert tone="warning">{t('atencion.truncado', { n: numeroPe(1000) })}</Alert> : null}
      {legibles.length === 0 ? (
        <Alert tone="notice">{t('atencion.sinLectura')}</Alert>
      ) : cargando ? (
        <Cargando />
      ) : fallida ? (
        <FalloDeLectura error={fallida.error} alReintentar={() => legibles.forEach((o) => void lecturas[o].refetch())} />
      ) : visibles.length === 0 ? (
        chips.length > 0 ? (
          <VacioDeLista conFiltros alLimpiar={limpiar} sinFiltros={enLaVista} />
        ) : (
          <Vacio titulo={t('atencion.vacio')} />
        )
      ) : (
        GRUPOS.map((grupo) => {
          const delGrupo = visibles.filter((f) => grupoDe(f) === grupo).sort(porPlazo)
          if (delGrupo.length === 0) return null
          return (
            <section key={grupo} aria-label={t(`atencion.grupos.${grupo}`)} className="space-y-2">
              <h2 className="text-sg-h3 font-semibold">
                {t(`atencion.grupos.${grupo}`)} <span className="text-sg-text-muted">({numeroPe(delGrupo.length)})</span>
              </h2>
              {telefono ? (
                <ListaEnTarjetas
                  etiqueta={t('atencion.tabla', { grupo: t(`atencion.grupos.${grupo}`) })}
                  tarjetas={delGrupo.map((f) => ({
                    id: `${f.objeto}:${f.registro.id}`,
                    titulo: (
                      <>
                        <span className="text-sg-caption text-sg-text-muted">{t(`comun.qcs.${f.objeto}`)} · </span>
                        <EnlaceDeRegistro
                          codigo={texto(f.registro, 'code')}
                          titulo={asuntoDe(f.registro)}
                          ruta={rutaDeQcs(texto(f.registro, 'project'), f.objeto, f.registro.id)}
                          desde={t('atencion.titulo')}
                          previa={{ objeto: f.objeto, id: f.registro.id }}
                          codigoEnElEnlace
                        />
                      </>
                    ),
                    estado: <EstadoChip objeto={f.objeto} estado={f.registro.state} />,
                    plazo: <PlazoDeQcs fila={f} />,
                    proyecto: proyecto ? undefined : nombreDelProyecto(texto(f.registro, 'project'))
                  }))}
                />
              ) : (
                <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
                  <Table aria-label={t('atencion.tabla', { grupo: t(`atencion.grupos.${grupo}`) })}>
                    <thead>
                      <tr>
                        <Th scope="col">{t('atencion.columnas.tipo')}</Th>
                        <Th scope="col">{t('atencion.columnas.codigo')}</Th>
                        {proyecto ? null : <Th scope="col">{t('atencion.columnas.proyecto')}</Th>}
                        <Th scope="col">{t('atencion.columnas.canal')}</Th>
                        <Th scope="col">{t('atencion.columnas.categoria')}</Th>
                        {conSeveridad ? <Th scope="col">{t('atencion.columnas.severidad')}</Th> : null}
                        <Th scope="col">{t('atencion.columnas.estado')}</Th>
                        <Th scope="col">{t('atencion.columnas.plazo')}</Th>
                        <Th scope="col">{t('atencion.columnas.responsable')}</Th>
                        <Th scope="col">{t('atencion.columnas.planteaQuien')}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {delGrupo.map((f) => (
                        <FilaDeQcs
                          key={`${f.objeto}:${f.registro.id}`}
                          fila={f}
                          conProyecto={!proyecto}
                          conSeveridad={conSeveridad}
                          nombreDelProyecto={nombreDelProyecto}
                        />
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </section>
          )
        })
      )}
    </section>
  )
}

// el plazo que corre en su estado, con su situación; fuera de esos estados, «sin plazo»
function PlazoDeQcs({ fila: { objeto, registro } }: { fila: Fila }) {
  const { t } = useTranslation(NS)
  const plazo = plazoQueCorre(objeto, registro)
  return plazo ? (
    <span className="flex flex-wrap items-center gap-1">
      <SituacionDePlazo valor={atributo(registro, 'deadline_status')} />
      {plazo.fecha ? diaPe(plazo.fecha) : t('atencion.plazoPorCalcular')}
    </span>
  ) : (
    <span className="text-sg-text-muted">{t('atencion.sinPlazo')}</span>
  )
}

function FilaDeQcs({
  fila,
  conProyecto,
  conSeveridad,
  nombreDelProyecto
}: {
  fila: Fila
  conProyecto: boolean
  conSeveridad: boolean
  nombreDelProyecto: (id: string) => React.ReactNode
}) {
  const { t } = useTranslation(NS)
  const { objeto, registro } = fila
  return (
    <tr>
      <Td className="text-sm">{t(`comun.qcs.${objeto}`)}</Td>
      <Td className="min-w-56 text-sm" title={texto(registro, 'description') || undefined}>
        <EnlaceDeRegistro
          codigo={texto(registro, 'code')}
          titulo={asuntoDe(registro)}
          ruta={rutaDeQcs(texto(registro, 'project'), objeto, registro.id)}
          desde={t('atencion.titulo')}
          previa={{ objeto, id: registro.id }}
          codigoEnElEnlace
        />
      </Td>
      {conProyecto ? <Td className="text-sm">{nombreDelProyecto(texto(registro, 'project'))}</Td> : null}
      <Td className="text-sm">{opcion(registro, 'channel') || '—'}</Td>
      <Td className="text-sm">{opcion(registro, 'category') || '—'}</Td>
      {conSeveridad ? <Td className="text-sm">{opcion(registro, 'severity') || '—'}</Td> : null}
      <Td>
        <EstadoChip objeto={objeto} estado={registro.state} />
      </Td>
      <Td className="text-sm">
        <PlazoDeQcs fila={fila} />
      </Td>
      <Td className="text-sm">
        <Persona correo={texto(registro, 'owner_user_email')} />
      </Td>
      <Td className="text-sm">{atributo(registro, 'anonymous') === true ? t('atencion.anonima') : t('atencion.identificada')}</Td>
    </tr>
  )
}
