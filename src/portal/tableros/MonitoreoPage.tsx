import { useAuth } from '@wasichai/core'
import { Badge, Button, Table, Td, Th } from '@wasichai/ui'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { CONTROL } from '../componentes/Campo'
import { NoDisponible } from '../componentes/Estados'
import { useLeeTodosLosProyectos, useProyectos } from '../contexto/proyectos'
import { hoyEnLima } from '../datos/fechas'
import { useTablero } from '../datos/indicadores'
import { texto } from '../datos/registros'
import { fechaPe, NS, numeroPe } from '../i18n'
import { CerrarPeriodo } from './CerrarPeriodo'
import { ConsultaDeTablero } from './comunes'
import { mesAnterior, periodoDelMes, type FilaDeMonitoreo, type TableroDeMonitoreo } from './contratoF8'

// el monitoreo de la Tabla 9.5 (screens.md, dashboards.md §5.5): el mes (?month=AAAA-MM; por defecto el anterior en Lima, el
// que ya se puede cerrar) y el proyecto (?project=; sin él, mis proyectos o todos) gobiernan el pedido. la cifra oficial sale solo
// cuando el pedido coincide con la medición (el servidor lo decide) y se marca; #2 y #3 dicen no disponible a quien no lee la
// postura. «Cerrar periodo…» se ofrece a quien tiene CREATE sobre indicator_measurement, con el indicatorId de la fila
// (decisión 4 del plan; null: no se cierra)
const valorDe = (valor: number | null) => (valor === null ? '—' : numeroPe(valor))

export function MonitoreoPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const [busqueda, fijar] = useSearchParams()
  const mes = busqueda.get('month') ?? mesAnterior(hoyEnLima())
  const proyecto = busqueda.get('project') ?? ''
  const { desde, hasta } = periodoDelMes(mes)
  const filtros = useMemo(() => ({ periodStart: desde, periodEnd: hasta, ...(proyecto ? { project: [proyecto] } : {}) }), [desde, hasta, proyecto])
  const tablero = useTablero<TableroDeMonitoreo>('monitoring', filtros)
  const cierra = can('indicator_measurement', 'CREATE')
  const proyectos = useProyectos()
  const leeTodo = useLeeTodosLosProyectos()
  const [cerrando, setCerrando] = useState<FilaDeMonitoreo | null>(null)
  const delProyecto = (proyectos.data ?? []).find((p) => p.id === proyecto)
  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(busqueda)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    fijar(siguiente, { replace: true })
  }
  // el detalle calcula la misma cifra que la fila (el periodo y el proyecto) y vuelve al mismo mes y proyecto
  const detalle = (code: string) => {
    const consulta = new URLSearchParams({ periodStart: desde, periodEnd: hasta, month: mes })
    if (proyecto) consulta.set('project', proyecto)
    return `/dashboards/indicators/${encodeURIComponent(code)}?${consulta}`
  }
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-sg-h1 font-semibold">{t('tablerosF8.monitoreo.titulo')}</h1>
          <p className="text-sm text-sg-text-secondary">{t('tablerosF8.monitoreo.ayuda')}</p>
        </div>
        <Link to="/dashboards/indicators" className="text-sm text-sg-primary-text underline">
          {t('tablerosF8.monitoreo.catalogo')}
        </Link>
      </header>
      <div role="group" aria-label={t('tableros.filtros')} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block text-sg-label">{t('tablerosF8.monitoreo.mes')}</span>
          <input type="month" className={CONTROL} value={mes} onChange={(e) => cambiar('month', e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block text-sg-label">{t('tablerosF8.monitoreo.proyecto')}</span>
          <select className={CONTROL} value={proyecto} onChange={(e) => cambiar('project', e.target.value)}>
            <option value="">{leeTodo ? t('tablerosF8.monitoreo.todosLosProyectos') : t('tablerosF8.monitoreo.misProyectos')}</option>
            {(proyectos.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {texto(p, 'code')} · {texto(p, 'name')}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={() => void tablero.refetch()}>
          {t('tableros.actualizar')}
        </Button>
      </div>
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => (
          <div className="space-y-3">
            <p role="note" className="rounded-sg-md bg-sg-surface-sunken p-3 text-sm">
              {datos.rows.some((f) => f.official) ? t('tablerosF8.monitoreo.cerrado') : t('tablerosF8.monitoreo.vivo')}
            </p>
            <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
              <Table aria-label={t('tablerosF8.monitoreo.titulo')}>
                <thead>
                  <tr>
                    {(['numero', 'indicador', 'valor', 'meta', 'origen', 'oficial', 'medio', 'entregable'] as const).map((c) => (
                      <Th key={c} scope="col">
                        {t(`tablerosF8.monitoreo.columnas.${c}`)}
                      </Th>
                    ))}
                    {cierra ? <Th scope="col">{t('tablerosF8.monitoreo.columnas.acciones')}</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {datos.rows.map((f) => {
                    const id = f.indicatorId
                    return (
                      <tr key={f.code}>
                        <Td className="text-sm tabular-nums">{f.number}</Td>
                        <Td className="text-sm">
                          <Link to={detalle(f.code)} className="text-sg-primary-text underline">
                            {f.label}
                          </Link>
                        </Td>
                        <Td className="text-sm tabular-nums">{f.available ? valorDe(f.value) : <NoDisponible enLista />}</Td>
                        <Td className="text-sm tabular-nums">{valorDe(f.target)}</Td>
                        <Td className="text-sm">{t(`tablerosF8.monitoreo.origenes.${f.targetSource}`)}</Td>
                        <Td className="text-sm">
                          {f.official ? (
                            <span className="space-y-0.5">
                              <Badge className="bg-sg-success-soft text-sg-success">
                                {t('tablerosF8.monitoreo.oficial', { valor: valorDe(f.official.value) })}
                              </Badge>
                              {f.official.closedAt ? (
                                <span className="block text-sg-caption text-sg-text-muted">
                                  {t('tablerosF8.monitoreo.oficialCerrada', { fecha: fechaPe(new Date(f.official.closedAt)) })}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-sg-text-muted">{t('tablerosF8.monitoreo.sinOficial')}</span>
                          )}
                        </Td>
                        <Td className="text-sm">{f.verificationMeans}</Td>
                        <Td className="text-sm">{f.deliverable}</Td>
                        {cierra ? (
                          <Td className="text-sm">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!id}
                              title={id ? undefined : t('tablerosF8.monitoreo.sinCatalogo')}
                              onClick={() => setCerrando(f)}
                            >
                              {t('tablerosF8.monitoreo.cerrar')}
                            </Button>
                          </Td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </ConsultaDeTablero>
      {cerrando?.indicatorId ? (
        <CerrarPeriodo
          fila={cerrando}
          indicador={cerrando.indicatorId}
          proyecto={proyecto}
          nombreDelProyecto={delProyecto ? `${texto(delProyecto, 'code')} · ${texto(delProyecto, 'name')}` : proyecto}
          desde={desde}
          hasta={hasta}
          alCerrar={() => setCerrando(null)}
        />
      ) : null}
    </section>
  )
}
