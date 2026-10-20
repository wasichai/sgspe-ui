import { BotonRecargar } from 'sgspe-kit'

export const TrasUnConflicto = () => (
  <div className="flex items-center gap-3 p-4 text-sm">
    <span className="text-sg-text-secondary">Este registro cambió desde que lo abrió.</span>
    <BotonRecargar releer={async () => {}} alRecargar={() => {}} />
  </div>
)
