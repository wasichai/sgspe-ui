import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from 'sgspe-kit'

export const Abierto = () => (
  <Dialog open>
    <DialogContent>
      <DialogTitle className="text-sg-h3 font-semibold">Reprogramar el compromiso</DialogTitle>
      <DialogDescription className="text-sm text-sg-text-secondary">
        La nueva fecha queda en el historial con su motivo y la ve quien aprobó el compromiso.
      </DialogDescription>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost">Cancelar</Button>
        <Button>Reprogramar</Button>
      </div>
    </DialogContent>
  </Dialog>
)
