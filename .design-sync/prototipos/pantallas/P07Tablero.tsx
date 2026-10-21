// P-07 · tablero ejecutivo: qué cambió, qué es crítico, dónde y quién lo atiende, con periodo y fecha de cálculo
import { Button, KpiCard, NotaDeConfidenciales } from '../../kit/index'
import { useL } from '../idioma'
import { Marco } from '../marco'
import { BarraDeFiltros, Seccion } from '../piezas'

export function P07() {
  const l = useL()
  const meses = [0, 0, 0, 0, 0, 78, 4, 4, 6, 6, 3, 0]
  return (
    <Marco activa="inicio" persona="Gestión social (demo)">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-sg-h1 font-semibold">{l('Revisión ejecutiva', 'Executive review')}</h1>
          <p className="text-sg-body-sm text-sg-text-secondary">
            {l('Octubre 2026 · todos sus proyectos · calculado hoy a las 6:00', 'October 2026 · all your projects · computed today at 6:00')}
          </p>
        </div>
        <Button size="sm" variant="secondary">
          {l('Exportar PDF', 'Export PDF')}
        </Button>
      </div>
      <BarraDeFiltros
        busqueda={l('Proyecto', 'Project')}
        filtros={[
          { etiqueta: l('Periodo', 'Period'), valor: l('Octubre 2026', 'October 2026') },
          { etiqueta: l('Ámbito', 'Scope'), valor: l('Todos', 'All') }
        ]}
        masFiltros={l('Más filtros', 'More filters')}
        limpiar=""
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          titulo={l('Compromisos vencidos', 'Overdue commitments')}
          indicador={{ code: 'KPI-EXE-03', label: '', available: true, value: 1, unit: l('de 11 abiertos', 'of 11 open') }}
        />
        <KpiCard
          titulo={l('QCS abiertas', 'Open grievances')}
          indicador={{ code: 'KPI-EXE-04', label: '', available: true, value: 9, unit: l('3 vencen esta semana', '3 due this week') }}
          notas={<NotaDeConfidenciales oculta />}
        />
        <KpiCard
          titulo={l('Riesgos altos o críticos', 'High or critical risks')}
          indicador={{ code: 'KPI-EXE-05', label: '', available: true, value: 3, unit: l('sin cambios desde setiembre', 'unchanged since September') }}
        />
        <KpiCard
          titulo={l('Inversión ejecutada', 'Investment executed')}
          indicador={{ code: 'KPI-EXE-08', label: '', available: false, unavailableReason: 'FIELD_NOT_READABLE' }}
        />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Seccion titulo={l('Qué es crítico y quién lo atiende', 'What is critical and who handles it')}>
          <table className="w-full text-sg-body-sm">
            <thead>
              <tr className="text-left text-sg-overline uppercase tracking-wide text-sg-text-muted">
                <th className="pb-2 font-semibold">{l('Asunto', 'Item')}</th>
                <th className="pb-2 font-semibold">{l('Desde', 'Since')}</th>
                <th className="pb-2 font-semibold">{l('Responsable', 'Owner')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-border-subtle">
              {[
                [
                  l('Riesgo alto · bloqueo de la trocha durante la campaña', 'High risk · road block during the campaign'),
                  '17 set.',
                  'Gestión de riesgos (demo)'
                ],
                [
                  l('Alerta · convocatoria a bloqueo en redes sociales', 'Alert · call to block on social media'),
                  l('hoy', 'today'),
                  'Gestión de riesgos (demo)'
                ],
                [
                  l('Compromiso vencido · cemento para el canal Yanaccocha', 'Overdue commitment · cement for the Yanaccocha canal'),
                  '15 set.',
                  'Gestión de compromisos (demo)'
                ]
              ].map(([a, d, r]) => (
                <tr key={a}>
                  <td className="py-2 pr-3">
                    <a className="font-medium hover:text-sg-primary-text">{a}</a>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-sg-text-secondary">{d}</td>
                  <td className="py-2 text-sg-text-secondary">{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
        <Seccion
          titulo={l('Interacciones realizadas, 12 meses', 'Interactions held, 12 months')}
          acciones={
            <Button size="sm" variant="ghost">
              {l('Ver datos', 'See data')}
            </Button>
          }
        >
          <div className="flex h-36 items-end gap-1.5">
            {meses.map((n, i) => (
              <span
                key={i}
                className="flex-1 rounded-t-sg-xs"
                style={{ height: `${Math.max(2, (n / 78) * 100)}%`, background: 'var(--sg-data-1)' }}
                title={String(n)}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-sg-caption text-sg-text-muted">
            <span>nov. 2025</span>
            <span>oct. 2026</span>
          </div>
          <p className="mt-2 text-sg-body-sm text-sg-text-secondary">
            {l('El pico de abril son las 78 entrevistas de la línea base.', 'The April peak is the 78 baseline interviews.')}
          </p>
        </Seccion>
      </div>
      <Seccion className="mt-4" titulo={l('Por proyecto', 'By project')}>
        <table className="w-full text-sg-body-sm">
          <thead>
            <tr className="text-left text-sg-overline uppercase tracking-wide text-sg-text-muted">
              <th className="pb-2 font-semibold">{l('Proyecto', 'Project')}</th>
              <th className="pb-2 text-right font-semibold">{l('QCS abiertas', 'Open grievances')}</th>
              <th className="pb-2 text-right font-semibold">{l('Compromisos vencidos', 'Overdue commitments')}</th>
              <th className="pb-2 text-right font-semibold">{l('Riesgos altos', 'High risks')}</th>
              <th className="pb-2 text-right font-semibold">{l('Alertas activas', 'Active alerts')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-sg-border-subtle">
              <td className="py-2 font-medium">Proyecto Wayra Ejemplo</td>
              <td className="py-2 text-right tabular-nums">9</td>
              <td className="py-2 text-right tabular-nums text-sg-warning">1</td>
              <td className="py-2 text-right tabular-nums text-sg-danger">3</td>
              <td className="py-2 text-right tabular-nums">1</td>
            </tr>
          </tbody>
        </table>
      </Seccion>
    </Marco>
  )
}
