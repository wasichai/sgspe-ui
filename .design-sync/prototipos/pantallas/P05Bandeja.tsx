// P-05 · bandeja de trabajo: aprobar con el contexto a la vista y decidir sin salir (flujo F-E)
import { Alert, Button, Campo, EstadoChip, Monto, Textarea } from '../../kit/index'
import { useL } from '../idioma'
import { Marco } from '../marco'
import { SelectorDeVista, Seccion } from '../piezas'

export function P05() {
  const l = useL()
  const items = [[l('Alquiler de equipo de sonido por dos días', 'Sound system hire, two days'), l('Servicio', 'Service'), '1', '1400']]
  return (
    <Marco activa="tareas" persona="Aprobación (demo)" ocultas={['territorio', 'reportes']} insignias={{ tareas: 1 }}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-sg-h1 font-semibold">{l('Aprobaciones', 'Approvals')}</h1>
          <p className="text-sg-body-sm text-sg-text-secondary">
            {l('Lo que espera su decisión en sus proyectos.', 'What awaits your decision in your projects.')}
          </p>
        </div>
        <SelectorDeVista
          etiqueta={l('Vista', 'View')}
          actual="pend"
          vistas={[
            { id: 'pend', etiqueta: l('Por decidir', 'To decide'), n: 2 },
            { id: 'esc', etiqueta: l('Escalamientos', 'Escalations'), n: 0 },
            { id: 'hechas', etiqueta: l('Decididas', 'Decided') }
          ]}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <ul className="space-y-2" aria-label={l('Por decidir', 'To decide')}>
          {[
            {
              t: l('Aporte DEMO-AP-01 · Apoyo en especie', 'Contribution DEMO-AP-01 · In-kind support'),
              d: l('Fiesta patronal de Quishuar', 'Quishuar patron saint festival'),
              m: '1400',
              w: l('Espera desde hoy', 'Waiting since today'),
              sel: true
            },
            {
              t: l('Compromiso DEMO-C-12 · Reunión informativa', 'Commitment DEMO-C-12 · Briefing'),
              d: l('Municipalidad distrital', 'District municipality'),
              m: '1500',
              w: l('Espera desde ayer', 'Waiting since yesterday')
            }
          ].map((x) => (
            <li key={x.t}>
              <a
                aria-current={x.sel ? 'true' : undefined}
                className={`block rounded-sg-lg border p-3 ${x.sel ? 'border-sg-primary bg-sg-primary-soft' : 'border-sg-border bg-sg-surface hover:bg-sg-surface-hover'}`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sg-body font-medium">{x.t}</span>
                  <span className="whitespace-nowrap">
                    <Monto valor={x.m} moneda="PEN" />
                  </span>
                </span>
                <span className="block text-sg-body-sm text-sg-text-secondary">{x.d}</span>
                <span className="block text-sg-caption text-sg-text-muted">{x.w} · Proyecto Wayra Ejemplo</span>
              </a>
            </li>
          ))}
        </ul>
        <Seccion
          titulo={l('Aporte DEMO-AP-01 · Apoyo en especie', 'Contribution DEMO-AP-01 · In-kind support')}
          descripcion={l(
            'Para la fiesta patronal del caserío Quishuar · lo pidió la junta directiva',
            'For the Quishuar patron saint festival · requested by the board'
          )}
          acciones={<EstadoChip objeto="social_contribution" estado="requested" />}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sg-body font-semibold">{l('Ítems', 'Items')}</h3>
              <table className="w-full text-sg-body-sm">
                <tbody>
                  {items.map(([b, t, c, m]) => (
                    <tr key={b} className="border-b border-sg-border-subtle">
                      <td className="py-1.5">
                        {b}
                        <span className="block text-sg-caption text-sg-text-muted">
                          {t} · {c}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <Monto valor={m} moneda="PEN" />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 font-semibold">{l('Total', 'Total')}</td>
                    <td className="py-1.5 text-right font-semibold">
                      <Monto valor="1400" moneda="PEN" />
                    </td>
                  </tr>
                </tbody>
              </table>
              <h3 className="mb-1 mt-4 text-sg-body font-semibold">{l('Tope de la campaña', 'Campaign cap')}</h3>
              <div className="h-2 overflow-hidden rounded-full bg-sg-surface-sunken">
                <div className="h-full bg-sg-warning" style={{ width: '93.8%' }} />
              </div>
              <p className="mt-1 text-sg-body-sm text-sg-text-secondary">
                {l('Con este aporte: S/ 56,300 de S/ 60,000 (93.8 %)', 'With this one: PEN 56,300 of PEN 60,000 (93.8%)')}
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-sg-body font-semibold">{l('Antes de aprobar', 'Before approving')}</h3>
              <ul className="space-y-1.5 text-sg-body-sm">
                <li>✓ {l('Sin entrega de dinero: el proveedor instala y retira', 'No cash: the supplier installs and removes')}</li>
                <li>✓ {l('Dentro del tope de la campaña', 'Within the campaign cap')}</li>
                <li>✓ {l('Quien aprueba no lo solicitó', 'The approver did not request it')}</li>
              </ul>
              <Alert tone="notice" title={l('A tener en cuenta', 'Note')} className="mt-3">
                {l('Deja S/ 3,700 de margen en la campaña.', 'Leaves PEN 3,700 of headroom in the campaign.')}
              </Alert>
            </div>
          </div>
          <div className="mt-4 border-t border-sg-border pt-4">
            <Campo etiqueta={l('Motivo de la decisión', 'Reason for the decision')}>
              {(p) => <Textarea {...p} rows={2} placeholder={l('Queda en el historial del aporte', 'Kept in the contribution history')} />}
            </Campo>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost">{l('Rechazar…', 'Reject…')}</Button>
              <Button variant="secondary">{l('Observar', 'Send back')}</Button>
              <Button>{l('Aprobar', 'Approve')}</Button>
            </div>
          </div>
        </Seccion>
      </div>
    </Marco>
  )
}
