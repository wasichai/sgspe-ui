import { Label, Textarea } from 'sgspe-kit'

export const Motivo = () => (
  <div className="max-w-md space-y-1 p-4">
    <Label htmlFor="motivo">Motivo del cambio</Label>
    <Textarea id="motivo" rows={4} defaultValue="La comunidad pidió aplazar la obra hasta después de la cosecha, según el acta del 12 de octubre." />
  </div>
)
