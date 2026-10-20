import { Monto } from 'sgspe-kit'

export const Monedas = () => (
  <dl className="grid max-w-xs grid-cols-2 gap-2 p-4 text-sm">
    <dt className="text-sg-text-secondary">Presupuesto</dt>
    <dd className="text-right">
      <Monto valor="185000" moneda="PEN" />
    </dd>
    <dt className="text-sg-text-secondary">Aporte</dt>
    <dd className="text-right">
      <Monto valor="12000.75" moneda="USD" />
    </dd>
    <dt className="text-sg-text-secondary">Sin dato</dt>
    <dd className="text-right">
      <Monto valor={null} moneda="PEN" />
    </dd>
  </dl>
)
