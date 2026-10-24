import { Tabs } from 'sgspe-kit'

export const Ficha = () => (
  <div className="max-w-2xl p-4">
    <Tabs
      label="Secciones del compromiso"
      tabs={[
        { id: 'resumen', label: 'Resumen', render: () => <p className="p-3 text-sm">Origen, responsable y plazo del compromiso.</p> },
        { id: 'entregas', label: 'Entregas', render: () => <p className="p-3 text-sm">Dos entregas parciales con acta.</p> },
        { id: 'historial', label: 'Historial', render: () => <p className="p-3 text-sm">Cambios de estado y de plazo.</p> }
      ]}
    />
  </div>
)
