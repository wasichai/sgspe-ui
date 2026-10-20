import { Cargando } from 'sgspe-kit'

export const Pagina = () => (
  <div className="max-w-xl p-4">
    <Cargando etiqueta="Cargando compromisos" />
  </div>
)

export const Compacto = () => (
  <div className="max-w-xs p-4">
    <Cargando compacto />
  </div>
)
