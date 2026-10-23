import { PanelDeDecision } from 'sgspe-kit'

export const EnCurso = () => (
  <div className="p-4">
    <PanelDeDecision
      objeto="commitment"
      estado="in_progress"
      camino={['draft', 'pending_approval', 'approved', 'in_progress', 'fulfilled', 'verified', 'closed']}
      desde="2026-10-02T15:30:00Z"
      por="coordinacion@sgspe.test"
      siguiente={{ etiqueta: 'Registrar la entrega', falta: 'Falta una evidencia de la entrega' }}
      responsable="relacionista@sgspe.test"
      vencimiento="2026-11-15"
      situacion="POR VENCER"
    />
  </div>
)

export const Vencido = () => (
  <div className="p-4">
    <PanelDeDecision
      objeto="commitment"
      estado="blocked"
      desde="2026-09-20T13:00:00Z"
      por="jefatura@sgspe.test"
      siguiente={{ etiqueta: 'Desbloquear' }}
      responsable="logistica@sgspe.test"
      vencimiento="2026-10-01"
      situacion="VENCIDO"
    />
  </div>
)
