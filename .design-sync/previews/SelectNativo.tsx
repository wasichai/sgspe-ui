import { Label, SelectNativo } from 'sgspe-kit'

export const ConOpciones = () => (
  <div className="max-w-xs space-y-1 p-4">
    <Label htmlFor="prioridad">Prioridad</Label>
    <SelectNativo
      id="prioridad"
      defaultValue="alta"
      opciones={[
        { valor: 'alta', etiqueta: 'Alta' },
        { valor: 'media', etiqueta: 'Media' },
        { valor: 'baja', etiqueta: 'Baja' }
      ]}
    />
  </div>
)
