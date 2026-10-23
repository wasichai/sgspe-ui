import { Button, KpiCard, Seccion } from 'sgspe-kit'

export const ConTituloYAcciones = () => (
  <div className="max-w-3xl p-4">
    <Seccion
      titulo="Compromisos del proyecto"
      descripcion="Lo que la organización prometió a las comunidades de Huancapampa."
      acciones={
        <Button size="sm" variant="secondary">
          Ver todos
        </Button>
      }
    >
      <p className="text-sm text-sg-text-secondary">128 compromisos, 7 vencidos y 12 por vencer.</p>
    </Seccion>
  </div>
)

export const Anidadas = () => (
  <div className="max-w-3xl p-4">
    <Seccion titulo="Cómo está el proyecto">
      <div className="grid gap-3 sm:grid-cols-2">
        <Seccion titulo="Compromisos">
          <p className="text-sm text-sg-text-secondary">7 vencidos de 128.</p>
        </Seccion>
        <Seccion titulo="Quejas">
          <p className="text-sm text-sg-text-secondary">3 abiertas fuera de plazo.</p>
        </Seccion>
      </div>
      <KpiCard
        anidada
        titulo="Compromisos verificados"
        indicador={{ code: 'KPI-COM-01', label: 'Verificados', available: true, value: 64, unit: '%', numerator: 82, denominator: 128 }}
      />
    </Seccion>
  </div>
)

export const Aside = () => (
  <div className="max-w-sm p-4">
    <Seccion elemento="aside" titulo="Qué pasará" descripcion="Al aprobar, el compromiso pasa a ejecución.">
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Se avisa a la persona responsable.</li>
        <li>El plazo empieza a contar desde hoy.</li>
      </ul>
    </Seccion>
  </div>
)
