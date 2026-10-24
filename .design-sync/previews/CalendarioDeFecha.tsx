import { CalendarioDeFecha } from 'sgspe-kit'

// el calendario flota bajo su campo (absolute, top-full): aquí bajo una caja que hace de campo
export const MesConRango = () => (
  <div className="p-4 pb-96">
    <div className="relative w-72">
      <div className="h-9 rounded-sg-md border border-sg-border-strong bg-sg-surface px-3 py-2 text-sm">15/11/2026</div>
      <CalendarioDeFecha elegido="2026-11-15" etiqueta="Fecha comprometida" min="2026-10-23" max="2026-12-31" alElegir={() => {}} />
    </div>
  </div>
)
