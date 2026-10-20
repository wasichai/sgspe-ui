import { Dia } from 'sgspe-kit'

export const Fechas = () => (
  <dl className="grid max-w-xs grid-cols-2 gap-2 p-4 text-sm">
    <dt className="text-sg-text-secondary">Vencimiento</dt>
    <dd>
      <Dia valor="2026-11-15" />
    </dd>
    <dt className="text-sg-text-secondary">Registrado</dt>
    <dd>
      <Dia valor="2026-10-02T15:30:00Z" />
    </dd>
    <dt className="text-sg-text-secondary">Cierre</dt>
    <dd>
      <Dia valor={null} />
    </dd>
  </dl>
)
