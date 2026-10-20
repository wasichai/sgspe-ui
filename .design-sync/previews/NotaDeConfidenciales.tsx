import { NotaDeConfidenciales } from 'sgspe-kit'

export const BajoUnaCifra = () => (
  <div className="max-w-sm space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
    <p className="text-sg-caption text-sg-text-muted">Quejas abiertas</p>
    <p className="text-sg-kpi font-semibold tabular-nums">12</p>
    <NotaDeConfidenciales oculta />
  </div>
)
