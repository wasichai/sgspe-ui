import { Pasos } from 'sgspe-kit'

export const EnElSegundo = () => (
  <div className="max-w-2xl p-4">
    <Pasos pasos={['Datos básicos', 'Origen', 'Responsable y plazo', 'Revisión']} actual={1} visitados={2} alIr={() => {}} />
  </div>
)
