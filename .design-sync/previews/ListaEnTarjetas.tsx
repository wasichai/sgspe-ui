import { EstadoChip, ListaEnTarjetas, SituacionDePlazo } from 'sgspe-kit'

export const EnMovil = () => (
  <div className="max-w-sm p-4">
    <ListaEnTarjetas
      etiqueta="Compromisos"
      tarjetas={[
        {
          id: '1',
          titulo: <a className="font-medium text-sg-primary-text">Mejorar el acceso al centro de salud</a>,
          estado: <EstadoChip objeto="commitment" estado="in_progress" />,
          plazo: <SituacionDePlazo valor="POR VENCER" />,
          detalle: 'relacionista@sgspe.test'
        },
        {
          id: '2',
          titulo: <a className="font-medium text-sg-primary-text">Reparación del canal de riego</a>,
          estado: <EstadoChip objeto="commitment" estado="blocked" />,
          plazo: <SituacionDePlazo valor="VENCIDO" />,
          detalle: 'logistica@sgspe.test'
        }
      ]}
    />
  </div>
)
