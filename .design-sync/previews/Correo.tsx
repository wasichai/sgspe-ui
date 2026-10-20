import { Correo } from 'sgspe-kit'

export const EnUnaFicha = () => (
  <dl className="grid max-w-sm grid-cols-2 gap-2 p-4 text-sm">
    <dt className="text-sg-text-secondary">Responsable</dt>
    <dd>
      <Correo valor="relacionista.campo@sgspe.test" />
    </dd>
    <dt className="text-sg-text-secondary">Aprobó</dt>
    <dd>
      <Correo valor={null} />
    </dd>
  </dl>
)
