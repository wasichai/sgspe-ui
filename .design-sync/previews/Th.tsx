import { EstadoChip, Monto, SituacionDePlazo, Table, Td, Th } from 'sgspe-kit'

export const Compromisos = () => (
  <div className="p-4">
    <Table>
      <thead>
        <tr>
          <Th>Código</Th>
          <Th>Compromiso</Th>
          <Th>Estado</Th>
          <Th>Plazo</Th>
          <Th className="text-right">Monto</Th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <Td className="font-sg-mono text-sg-caption">COM-0142</Td>
          <Td>Mejorar el acceso al centro de salud</Td>
          <Td>
            <EstadoChip objeto="commitment" estado="in_progress" />
          </Td>
          <Td>
            <SituacionDePlazo valor="POR VENCER" />
          </Td>
          <Td className="text-right">
            <Monto valor="185000" moneda="PEN" />
          </Td>
        </tr>
        <tr>
          <Td className="font-sg-mono text-sg-caption">COM-0138</Td>
          <Td>Capacitación en manejo de pastos</Td>
          <Td>
            <EstadoChip objeto="commitment" estado="verified" />
          </Td>
          <Td>
            <SituacionDePlazo valor="AL DIA" />
          </Td>
          <Td className="text-right">
            <Monto valor="42500.5" moneda="PEN" />
          </Td>
        </tr>
        <tr>
          <Td className="font-sg-mono text-sg-caption">COM-0131</Td>
          <Td>Reparación del canal de riego Q'ollpa</Td>
          <Td>
            <EstadoChip objeto="commitment" estado="blocked" />
          </Td>
          <Td>
            <SituacionDePlazo valor="VENCIDO" />
          </Td>
          <Td className="text-right">
            <Monto valor="12000" moneda="USD" />
          </Td>
        </tr>
      </tbody>
    </Table>
  </div>
)
