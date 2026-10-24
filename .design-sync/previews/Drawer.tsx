import { Button, Drawer } from 'sgspe-kit'

export const VistaPrevia = () => (
  <Drawer
    abierto
    alCerrar={() => {}}
    titulo="COM-0142 · Acceso al centro de salud"
    descripcion="Vista previa del compromiso"
    pie={
      <div className="flex justify-end gap-2">
        <Button variant="secondary">Cerrar</Button>
        <Button>Abrir ficha</Button>
      </div>
    }
  >
    <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-sg-text-secondary">Responsable</dt>
      <dd>relacionista@sgspe.test</dd>
      <dt className="text-sg-text-secondary">Vence</dt>
      <dd>15 nov. 2026</dd>
      <dt className="text-sg-text-secondary">Origen</dt>
      <dd>Acta de la asamblea del 12 de octubre</dd>
    </dl>
  </Drawer>
)
