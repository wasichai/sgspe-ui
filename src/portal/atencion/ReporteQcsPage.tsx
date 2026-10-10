import { useQuery } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Pagination, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { CONTROL, SelectNativo } from '../componentes/Campo'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Cargando, NoDisponible, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { esQcs, OBJETOS_DE_QCS, rutaDeQcs, type ObjetoDeQcs } from '../datos/atencion'
import { codigoDelError, usePedir } from '../datos/http'
import { campoDe, consulta, useDefinicion } from '../datos/registros'
import { diaPe, fechaYHoraPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'

// el reporte unificado de QCS (api.md §4.6, plan 4.2a): GET /api/sgspe/attention/report con el proyecto del contexto (sin él, los
// proyectos de quien mira), el periodo de recepción, el tipo, el canal y la categoría, paginado. lee como quien llama: los conteos
// (cada planteamiento una vez, AttentionCounting) y la lista no incluyen las QCS confidenciales que la cuenta no lee, y
// confidentialHidden lo dice; un tipo que no lee sale «No disponible», nunca con ceros. la lista nunca trae texto libre ni la
// persona. 400 TOO_MANY_RECORDS pide acotar y INVALID_FILTER dice que un filtro no vale; los filtros viven en la URL
const CONTEOS = ['received', 'open', 'closed', 'rejected', 'withdrawn', 'absolved', 'overdue'] as const
const DESGLOSES = ['byState', 'byChannel', 'byCategory'] as const
const POR_PAGINA = 25

type Conteos = Partial<Record<(typeof CONTEOS)[number], number>>
interface Fila {
  key: string
  value: number
}
type DelTipo = Conteos & { type: string; available: boolean } & Partial<Record<(typeof DESGLOSES)[number], Fila[]>>

interface ItemDelReporte {
  type: string
  id: string
  code: string | null
  state: string | null
  channel: string | null
  category: string | null
  severity: string | null
  receivedAt: string | null
  deadlineStatus: string | null
  dueDate: string | null
  ownerEmail: string | null
  respondedAt: string | null
  anonymous: boolean | null
}

export interface ReporteDeQcs {
  totals: Conteos
  byType: DelTipo[]
  confidentialHidden: boolean
  page: { items: ItemDelReporte[]; page: number; size: number; totalElements: number }
}

export function ReporteQcsPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const pedir = usePedir()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const [busqueda, fijar] = useSearchParams()
  const legible = OBJETOS_DE_QCS.find((o) => can(o, 'READ'))
  const definicion = useDefinicion(legible)
  const filtro = (clave: string) => busqueda.get(clave) ?? ''
  const pagina = Number(busqueda.get('page') ?? '0') || 0
  const parametros = {
    project: proyecto,
    periodStart: filtro('periodStart'),
    periodEnd: filtro('periodEnd'),
    type: filtro('type'),
    channel: filtro('channel'),
    category: filtro('category'),
    page: pagina,
    size: POR_PAGINA
  }
  const reporte = useQuery({
    queryKey: ['attention-report', consulta(parametros)],
    queryFn: () => pedir<ReporteDeQcs>(`/sgspe/attention/report?${consulta(parametros)}`)
  })
  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(busqueda)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    if (clave !== 'page') siguiente.delete('page')
    fijar(siguiente, { replace: true })
  }
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const base = proyecto ? `/projects/${encodeURIComponent(proyecto)}` : ''
  const codigo = codigoDelError(reporte.error)
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('reporteQcs.titulo')}</h1>
        <Link to={`${base}/attention`} className="text-sm text-sg-primary-text underline">
          {t('reporteQcs.verLista')}
        </Link>
      </div>
      <p className="text-sm text-sg-text-secondary">{t('reporteQcs.ayuda')}</p>
      <div role="group" aria-label={t('comun.filtros')} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block">{t('reporteQcs.filtros.desde')}</span>
          <input type="date" className={CONTROL} value={filtro('periodStart')} onChange={(e) => cambiar('periodStart', e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block">{t('reporteQcs.filtros.hasta')}</span>
          <input type="date" className={CONTROL} value={filtro('periodEnd')} onChange={(e) => cambiar('periodEnd', e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block">{t('reporteQcs.filtros.tipo')}</span>
          <SelectNativo
            vacio={false}
            value={filtro('type')}
            onChange={(e) => cambiar('type', e.target.value)}
            opciones={[{ valor: '', etiqueta: t('reporteQcs.filtros.todos') }, ...OBJETOS_DE_QCS.map((o) => ({ valor: o, etiqueta: t(`comun.qcs.${o}`) }))]}
          />
        </label>
        <label className="space-y-1">
          <span className="block">{t('reporteQcs.filtros.canal')}</span>
          <SelectNativo value={filtro('channel')} onChange={(e) => cambiar('channel', e.target.value)} opciones={opciones('channel')} />
        </label>
        <label className="space-y-1">
          <span className="block">{t('reporteQcs.filtros.categoria')}</span>
          <SelectNativo value={filtro('category')} onChange={(e) => cambiar('category', e.target.value)} opciones={opciones('category')} />
        </label>
      </div>
      {reporte.isPending ? (
        <Cargando />
      ) : reporte.isError && !reporte.data ? (
        codigo === 'TOO_MANY_RECORDS' ? (
          <Alert tone="warning">{t('reporteQcs.acotar')}</Alert>
        ) : codigo === 'INVALID_FILTER' ? (
          <Alert tone="warning">{t('reporteQcs.filtroInvalido')}</Alert>
        ) : reporte.error instanceof ApiError && reporte.error.status === 403 ? (
          <NoDisponible motivo={codigo} />
        ) : (
          <FalloDeLectura error={reporte.error} alReintentar={() => void reporte.refetch()} />
        )
      ) : (
        <Contenido reporte={reporte.data as ReporteDeQcs} proyecto={proyecto} alPagina={(p) => cambiar('page', String(p))} />
      )}
    </section>
  )
}

function Contenido({ reporte, proyecto, alPagina }: { reporte: ReporteDeQcs; proyecto?: string; alPagina: (pagina: number) => void }) {
  const { t } = useTranslation(NS)
  const cifra = (v: number | undefined) => (typeof v === 'number' ? numeroPe(v) : '—')
  const { items, page, totalElements } = reporte.page
  return (
    <div className="space-y-4">
      <NotaDeConfidenciales oculta={reporte.confidentialHidden} />
      <section aria-label={t('reporteQcs.porTipo')} className="space-y-2">
        <h2 className="text-sg-h3 font-semibold">{t('reporteQcs.porTipo')}</h2>
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={t('reporteQcs.porTipo')}>
            <thead>
              <tr>
                <Th scope="col">{t('reporteQcs.tipo')}</Th>
                {CONTEOS.map((c) => (
                  <Th key={c} scope="col">
                    {t(`reporteQcs.conteos.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reporte.byType.map((d) => (
                <tr key={d.type}>
                  <Th scope="row" className="text-sm font-normal">
                    {t(`comun.qcs.plural.${d.type}`, { defaultValue: d.type })}
                  </Th>
                  {d.available ? (
                    CONTEOS.map((c) => (
                      <Td key={c} className="text-sm tabular-nums">
                        {cifra(d[c])}
                      </Td>
                    ))
                  ) : (
                    <Td colSpan={CONTEOS.length} className="text-sm">
                      <NoDisponible enLista />
                    </Td>
                  )}
                </tr>
              ))}
              <tr>
                <Th scope="row" className="text-sm">
                  {t('reporteQcs.totales')}
                </Th>
                {CONTEOS.map((c) => (
                  <Td key={c} className="text-sm font-semibold tabular-nums">
                    {cifra(reporte.totals[c])}
                  </Td>
                ))}
              </tr>
            </tbody>
          </Table>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reporte.byType
            .filter((d) => d.available && esQcs(d.type))
            .flatMap((d) =>
              DESGLOSES.map((desglose) => <Desglose key={`${d.type}-${desglose}`} tipo={d.type as ObjetoDeQcs} desglose={desglose} filas={d[desglose] ?? []} />)
            )}
        </div>
      </section>
      <section aria-label={t('reporteQcs.lista')} className="space-y-2">
        <h2 className="text-sg-h3 font-semibold">{t('reporteQcs.lista')}</h2>
        {items.length === 0 ? (
          <Vacio titulo={t('reporteQcs.vacio')} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
              <Table aria-label={t('reporteQcs.lista')}>
                <thead>
                  <tr>
                    {(
                      [
                        'tipo',
                        'codigo',
                        'estado',
                        'canal',
                        'categoria',
                        'severidad',
                        'recibida',
                        'situacion',
                        'plazo',
                        'responsable',
                        'respondida',
                        'anonima'
                      ] as const
                    ).map((c) => (
                      <Th key={c} scope="col">
                        {t(`reporteQcs.columnas.${c}`)}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((x) => (
                    <tr key={`${x.type}:${x.id}`}>
                      <Td className="text-sm">{t(`comun.qcs.${x.type}`, { defaultValue: x.type })}</Td>
                      <Td className="font-sg-mono text-sm">
                        {proyecto && esQcs(x.type) ? (
                          <Link to={rutaDeQcs(proyecto, x.type, x.id)} className="text-sg-primary-text underline">
                            {x.code ?? '—'}
                          </Link>
                        ) : (
                          (x.code ?? '—')
                        )}
                      </Td>
                      <Td>{esQcs(x.type) ? <EstadoChip objeto={x.type} estado={x.state} /> : x.state}</Td>
                      <Td className="text-sm">{x.channel ?? '—'}</Td>
                      <Td className="text-sm">{x.category ?? '—'}</Td>
                      <Td className="text-sm">{x.severity ?? '—'}</Td>
                      <Td className="text-sm">{x.receivedAt ? fechaYHoraPe(new Date(x.receivedAt)) : '—'}</Td>
                      <Td>
                        <SituacionDePlazo valor={x.deadlineStatus} />
                      </Td>
                      <Td className="text-sm">{x.dueDate ? diaPe(x.dueDate) : '—'}</Td>
                      <Td className="text-sm">{x.ownerEmail ?? '—'}</Td>
                      <Td className="text-sm">{x.respondedAt ? fechaYHoraPe(new Date(x.respondedAt)) : '—'}</Td>
                      <Td className="text-sm">{x.anonymous === true ? t('comun.si') : t('comun.no')}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {totalElements > POR_PAGINA ? (
              <Pagination page={page} totalPages={Math.ceil(totalElements / POR_PAGINA)} totalElements={totalElements} onPage={alPagina} />
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}

function Desglose({ tipo, desglose, filas }: { tipo: ObjetoDeQcs; desglose: (typeof DESGLOSES)[number]; filas: Fila[] }) {
  const { t } = useTranslation(NS)
  const etiquetas = useEtiquetasDeEstado(tipo)
  if (filas.length === 0) return null
  const titulo = t('reporteQcs.desgloseDe', { tipo: t(`comun.qcs.plural.${tipo}`), desglose: t(`reporteQcs.desgloses.${desglose}`) })
  return (
    <Table aria-label={titulo}>
      <caption className="text-left text-sm font-medium">{titulo}</caption>
      <thead>
        <tr>
          <Th scope="col">{t('reporteQcs.clave')}</Th>
          <Th scope="col">{t('reporteQcs.cantidad')}</Th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.key}>
            <Td className="text-sm">{desglose === 'byState' ? (etiquetas[f.key] ?? f.key) : f.key}</Td>
            <Td className="text-sm tabular-nums">{numeroPe(f.value)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
