import { Alert } from 'sgspe-kit'

export const Tonos = () => (
  <div className="max-w-xl space-y-3 p-4">
    <Alert tone="success" title="Entrega registrada">
      La entrega del compromiso COM-0142 quedó registrada con su acta y dos fotos.
    </Alert>
    <Alert tone="notice" title="Plazo próximo">
      El compromiso vence en 5 días hábiles y aún no tiene evidencia de entrega.
    </Alert>
    <Alert tone="warning" title="Datos incompletos">
      Falta el responsable. Sin él, el compromiso no puede pasar a aprobación.
    </Alert>
    <Alert tone="danger" title="No se pudo guardar">
      Otra persona cambió este registro mientras lo editaba. Recargue para ver la versión actual.
    </Alert>
  </div>
)
