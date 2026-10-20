import { NoDisponible, Reservado, Restringido } from 'sgspe-kit'

export const EnUnaFicha = () => (
  <dl className="grid max-w-md grid-cols-[10rem_1fr] gap-x-4 gap-y-3 p-4 text-sm">
    <dt className="text-sg-text-secondary">Quien presenta</dt>
    <dd>
      <Restringido />
    </dd>
    <dt className="text-sg-text-secondary">Queja vinculada</dt>
    <dd>
      <Reservado />
    </dd>
    <dt className="text-sg-text-secondary">Inversión del año</dt>
    <dd>
      <NoDisponible />
    </dd>
  </dl>
)
