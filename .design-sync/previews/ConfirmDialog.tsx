import { ConfirmDialog } from 'sgspe-kit'

export const Anular = () => (
  <ConfirmDialog
    title="¿Anular el compromiso COM-0142?"
    description="El compromiso deja de contar en los tableros y no se puede reabrir. La comunidad verá el motivo en el acta de seguimiento."
    confirmLabel="Anular compromiso"
    cancelLabel="Volver"
    onConfirm={() => {}}
    onCancel={() => {}}
  />
)
