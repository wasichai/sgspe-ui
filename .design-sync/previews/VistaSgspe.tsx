import { Button, EncabezadoDePagina, EstadoChip, VistaSgspe } from 'sgspe-kit'

export const TemaOscuro = () => (
  <VistaSgspe tema="dark">
    <div className="space-y-3 p-4">
      <EncabezadoDePagina titulo="Compromisos" conteo="128 compromisos" primaria={<Button>Nuevo compromiso</Button>} />
      <div className="flex gap-2">
        <EstadoChip objeto="commitment" estado="in_progress" />
        <EstadoChip objeto="commitment" estado="verified" />
      </div>
    </div>
  </VistaSgspe>
)
