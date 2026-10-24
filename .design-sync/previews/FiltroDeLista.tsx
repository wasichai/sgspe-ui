import { FiltroDeLista } from 'sgspe-kit'

export const Filtros = () => (
  <div className="flex flex-wrap gap-3 p-4">
    <FiltroDeLista
      etiqueta="Estado"
      opciones={[
        { valor: 'in_progress', etiqueta: 'En ejecución' },
        { valor: 'verified', etiqueta: 'Verificado' }
      ]}
    />
    <FiltroDeLista
      etiqueta="Plazo"
      defaultValue="POR VENCER"
      opciones={[
        { valor: 'AL DIA', etiqueta: 'Al día' },
        { valor: 'POR VENCER', etiqueta: 'Por vencer' },
        { valor: 'VENCIDO', etiqueta: 'Vencido' }
      ]}
    />
  </div>
)
