import { EstadoChip } from 'sgspe-kit'

export const Compromiso = () => (
  <div className="flex flex-wrap gap-2 p-4">
    {['draft', 'pending_approval', 'approved', 'in_progress', 'blocked', 'fulfilled', 'verified', 'closed', 'cancelled'].map((e) => (
      <EstadoChip key={e} objeto="commitment" estado={e} />
    ))}
  </div>
)

export const Queja = () => (
  <div className="flex flex-wrap gap-2 p-4">
    {['received', 'in_assessment', 'in_action', 'resolved', 'rejected'].map((e) => (
      <EstadoChip key={e} objeto="grievance" estado={e} />
    ))}
  </div>
)
