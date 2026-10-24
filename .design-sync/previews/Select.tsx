import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'sgspe-kit'

export const Abierto = () => (
  <div className="max-w-xs space-y-1 p-4">
    <Label>Tipo de recurso</Label>
    <Select defaultOpen defaultValue="infra">
      <SelectTrigger>
        <SelectValue placeholder="Elija un tipo" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="infra">Infraestructura</SelectItem>
        <SelectItem value="salud">Salud</SelectItem>
        <SelectItem value="educacion">Educación</SelectItem>
        <SelectItem value="empleo">Empleo local</SelectItem>
      </SelectContent>
    </Select>
  </div>
)
