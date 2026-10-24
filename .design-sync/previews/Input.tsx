import { Input, Label } from 'sgspe-kit'

export const ConEtiqueta = () => (
  <div className="max-w-sm space-y-4 p-4">
    <div className="space-y-1">
      <Label htmlFor="titulo">Título del compromiso</Label>
      <Input id="titulo" defaultValue="Mejorar el acceso al centro de salud" />
    </div>
    <div className="space-y-1">
      <Label htmlFor="lugar">Lugar</Label>
      <Input id="lugar" placeholder="Localidad o comunidad" />
    </div>
    <div className="space-y-1">
      <Label htmlFor="codigo">Código</Label>
      <Input id="codigo" defaultValue="COM-0142" disabled />
    </div>
  </div>
)
