import { Button, MasAcciones } from 'sgspe-kit'

export const EnLaCabecera = () => (
  <div className="flex justify-end gap-2 p-4">
    <Button size="sm" variant="secondary">
      Reprogramar
    </Button>
    <MasAcciones>
      <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-sg-surface-hover">
        Exportar la ficha
      </button>
      <button type="button" className="block w-full px-3 py-2 text-left text-sm text-sg-danger hover:bg-sg-surface-hover">
        Cancelar compromiso
      </button>
    </MasAcciones>
    <Button>Registrar entrega</Button>
  </div>
)
