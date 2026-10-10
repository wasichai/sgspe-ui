import { useAuth } from '@wasichai/core'
import { Alert, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CONTROL, SelectNativo } from '../componentes/Campo'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { KpiCard } from '../componentes/KpiCard'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useParametrosDeLista, VistasGuardadas } from '../componentes/Lista'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { nombreDeProyecto, useProyectos } from '../contexto/proyectos'
import { estaAbierta, OBJETOS_DE_QCS, plazoQueCorre, rutaDeQcs, type ObjetoDeQcs } from '../datos/atencion'
import { useIndicador, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { atributo, campoDe, texto, useDefinicion, useTodosConTope, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'

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

export function AtencionPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const lista = useParametrosDeLista('atencion')
  const quejas = useTodosConTope('grievance', { project: proyecto }, can('grievance', 'READ'))
  const consultas = useTodosConTope('inquiry', { project: proyecto }, can('inquiry', 'READ'))
  const solicitudes = useTodosConTope('stakeholder_request', { project: proyecto }, can('stakeholder_request', 'READ'))
  const lecturas = { grievance: quejas, inquiry: consultas, stakeholder_request: solicitudes }
  const legibles = OBJETOS_DE_QCS.filter((o) => can(o, 'READ'))
  const proyectos = useProyectos()
  const definicion = useDefinicion('grievance')
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
  const visibles = filas.filter(
    (f) =>
      enVista(lista.vista, f, user?.id) &&
      (!canal || texto(f.registro, 'channel') === canal) &&
      (!categoria || texto(f.registro, 'category') === categoria) &&
      (!severidad || texto(f.registro, 'severity') === severidad) &&
      (!q || texto(f.registro, 'code').toLowerCase().includes(q) || texto(f.registro, 'description').toLowerCase().includes(q))
  )
  const porVencer = filas.filter((f) => estaAbierta(f.objeto, f.registro) && grupoDe(f) === 'porVencer').length
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const crea = proyecto !== undefined && escribe && OBJETOS_DE_QCS.some((o) => can(o, 'CREATE'))
  const conConfidencialesOcultas = [abiertas, vencidas, absueltas].some((i) => i.data?.confidentialHidden === true)
  const tarjeta = (titulo: string, consulta: { data?: Indicador; error: unknown; isPending: boolean }) => (
    <KpiCard titulo={titulo} indicador={consulta.data} cargando={consulta.isPending} error={consulta.error} />
  )
  const nombreDelProyecto = (id: string) => {
    const p = proyectos.data?.find((x) => x.id === id)
    return p ? nombreDeProyecto(p) : '…'
  }
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('atencion.titulo')}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link to={`${base}/attention/dashboard`} className="text-sg-primary-text underline">
            {t('atencion.tablero')}
          </Link>
          <Link to={`${base}/attention/report`} className="text-sg-primary-text underline">
            {t('atencion.reporte')}
          </Link>
          {crea ? (
            <Link to={`${base}/attention/new`} className="rounded-sg-md bg-sg-primary px-3 py-1.5 font-medium text-sg-on-primary">
              {t('atencion.registrar')}
            </Link>
          ) : null}
        </div>
      </div>
      {!proyecto && OBJETOS_DE_QCS.some((o) => can(o, 'CREATE')) ? <p className="text-sm text-sg-text-muted">{t('atencion.eligeProyecto')}</p> : null}
      <section aria-label={t('atencion.indicadores')} className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tarjeta(abiertas.data?.label || t('atencion.tarjetas.abiertas'), abiertas)}
          {tarjeta(vencidas.data?.label || t('atencion.tarjetas.vencidas'), vencidas)}
          <KpiCard
            titulo={t('atencion.tarjetas.porVencer')}
            cargando={cargando}
            indicador={cargando || fallida ? undefined : { code: 'por-vencer', label: t('atencion.tarjetas.porVencer'), available: true, value: porVencer }}
            error={fallida?.error}
          />
          {tarjeta(absueltas.data?.label || t('atencion.tarjetas.absueltas'), absueltas)}
        </div>
        <NotaDeConfidenciales oculta={conConfidencialesOcultas} />
      </section>
      <VistasGuardadas
        vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`atencion.vistas.${v}`) }))}
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
          <SelectNativo value={canal} onChange={(e) => lista.cambiar({ channel: e.target.value })} opciones={opciones('channel')} />
        </label>
        <label className="space-y-1">
          <span className="block">{t('atencion.categoria')}</span>
          <SelectNativo value={categoria} onChange={(e) => lista.cambiar({ category: e.target.value })} opciones={opciones('category')} />
        </label>
        <label className="space-y-1">
          <span className="block">{t('atencion.severidad')}</span>
          <SelectNativo value={severidad} onChange={(e) => lista.cambiar({ severity: e.target.value })} opciones={opciones('severity')} />
        </label>
      </div>
      {truncado ? <Alert tone="warning">{t('atencion.truncado', { n: numeroPe(1000) })}</Alert> : null}
      {legibles.length === 0 ? (
        <Alert tone="notice">{t('atencion.sinLectura')}</Alert>
      ) : cargando ? (
        <Cargando />
      ) : fallida ? (
        <FalloDeLectura error={fallida.error} alReintentar={() => legibles.forEach((o) => void lecturas[o].refetch())} />
      ) : visibles.length === 0 ? (
        <Vacio titulo={t('atencion.vacio')} />
      ) : (
        GRUPOS.map((grupo) => {
          const delGrupo = visibles.filter((f) => grupoDe(f) === grupo)
          if (delGrupo.length === 0) return null
          return (
            <section key={grupo} aria-label={t(`atencion.grupos.${grupo}`)} className="space-y-2">
              <h2 className="text-sg-h3 font-semibold">
                {t(`atencion.grupos.${grupo}`)} <span className="text-sg-text-muted">({numeroPe(delGrupo.length)})</span>
              </h2>
              <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
                <Table aria-label={t('atencion.tabla', { grupo: t(`atencion.grupos.${grupo}`) })}>
                  <thead>
                    <tr>
                      <Th scope="col">{t('atencion.columnas.tipo')}</Th>
                      <Th scope="col">{t('atencion.columnas.codigo')}</Th>
                      {proyecto ? null : <Th scope="col">{t('atencion.columnas.proyecto')}</Th>}
                      <Th scope="col">{t('atencion.columnas.canal')}</Th>
                      <Th scope="col">{t('atencion.columnas.categoria')}</Th>
                      <Th scope="col">{t('atencion.columnas.severidad')}</Th>
                      <Th scope="col">{t('atencion.columnas.estado')}</Th>
                      <Th scope="col">{t('atencion.columnas.plazo')}</Th>
                      <Th scope="col">{t('atencion.columnas.responsable')}</Th>
                      <Th scope="col">{t('atencion.columnas.planteaQuien')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {delGrupo.map((f) => (
                      <FilaDeQcs key={`${f.objeto}:${f.registro.id}`} fila={f} conProyecto={!proyecto} nombreDelProyecto={nombreDelProyecto} />
                    ))}
                  </tbody>
                </Table>
              </div>
            </section>
          )
        })
      )}
    </section>
  )
}

function FilaDeQcs({ fila, conProyecto, nombreDelProyecto }: { fila: Fila; conProyecto: boolean; nombreDelProyecto: (id: string) => string }) {
  const { t } = useTranslation(NS)
  const { objeto, registro } = fila
  const plazo = plazoQueCorre(objeto, registro)
  return (
    <tr>
      <Td className="text-sm">{t(`comun.qcs.${objeto}`)}</Td>
      <Td className="font-sg-mono text-sm">
        <Link to={rutaDeQcs(texto(registro, 'project'), objeto, registro.id)} className="text-sg-primary-text underline">
          {texto(registro, 'code')}
        </Link>
      </Td>
      {conProyecto ? <Td className="text-sm">{nombreDelProyecto(texto(registro, 'project'))}</Td> : null}
      <Td className="text-sm">{texto(registro, 'channel') || '—'}</Td>
      <Td className="text-sm">{texto(registro, 'category') || '—'}</Td>
      <Td className="text-sm">{texto(registro, 'severity') || '—'}</Td>
      <Td>
        <EstadoChip objeto={objeto} estado={registro.state} />
      </Td>
      <Td className="text-sm">
        {plazo ? (
          <span className="flex flex-wrap items-center gap-1">
            <SituacionDePlazo valor={atributo(registro, 'deadline_status')} />
            {plazo.fecha ? diaPe(plazo.fecha) : t('atencion.plazoPorCalcular')}
          </span>
        ) : (
          <span className="text-sg-text-muted">{t('atencion.sinPlazo')}</span>
        )}
      </Td>
      <Td className="text-sm">{texto(registro, 'owner_user_email') || '—'}</Td>
      <Td className="text-sm">{atributo(registro, 'anonymous') === true ? t('atencion.anonima') : t('atencion.identificada')}</Td>
    </tr>
  )
}
