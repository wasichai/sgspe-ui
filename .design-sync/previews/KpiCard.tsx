import { KpiCard } from 'sgspe-kit'

export const Estados = () => (
  <div className="grid max-w-3xl grid-cols-3 gap-3 p-4">
    <KpiCard titulo="Compromisos vencidos" indicador={{ code: 'KPI-COM-03', label: 'Compromisos vencidos', available: true, value: 7, unit: 'compromisos' }} />
    <KpiCard titulo="Quejas atendidas en plazo" indicador={{ code: 'KPI-QCS-02', label: 'Atendidas en plazo', available: true, value: 86.4, unit: '%' }} />
    <KpiCard
      titulo="Inversión ejecutada"
      indicador={{ code: 'KPI-INV-01', label: 'Inversión ejecutada', available: false, unavailableReason: 'FIELD_NOT_READABLE' }}
    />
    <KpiCard titulo="Riesgos críticos" cargando />
  </div>
)

export const EnUnaLista = () => (
  <div className="max-w-md p-4">
    <div className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <KpiCard
        anidada
        titulo="Quejas con respuesta"
        indicador={{ code: 'KPI-QCS-04', label: 'Con respuesta', available: true, value: 0, unit: '%', numerator: 0, denominator: 4 }}
        cifra={(i) => `${i.value} %`}
        detalle={(i) => `${i.numerator} de ${i.denominator} recibidas este mes tienen respuesta`}
      />
    </div>
  </div>
)
