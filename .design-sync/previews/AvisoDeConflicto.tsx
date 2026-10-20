import { AvisoDeConflicto } from 'sgspe-kit'

export const Conflicto = () => (
  <div className="max-w-xl p-4">
    <AvisoDeConflicto
      error={null}
      texto="Otra persona cambió este compromiso mientras lo editaba. Recargue para ver la versión actual; lo que escribió se conserva."
      releer={async () => {}}
      alRecargar={() => {}}
    />
  </div>
)
