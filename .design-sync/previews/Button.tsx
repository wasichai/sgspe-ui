import { Button } from 'sgspe-kit'

export const Variantes = () => (
  <div className="flex flex-wrap items-center gap-2 p-4">
    <Button>Registrar compromiso</Button>
    <Button variant="secondary">Exportar</Button>
    <Button variant="ghost">Cancelar</Button>
    <Button variant="danger">Anular</Button>
  </div>
)

export const Tamanos = () => (
  <div className="flex flex-wrap items-center gap-2 p-4">
    <Button size="md">Guardar</Button>
    <Button size="sm" variant="secondary">
      Ver en el mapa
    </Button>
    <Button size="sm" variant="secondary" disabled>
      Guardando…
    </Button>
  </div>
)

export const AccionPrincipalConSecundarias = () => (
  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-sg-border p-4">
    <Button variant="ghost">Cancelar</Button>
    <Button variant="secondary">Guardar borrador</Button>
    <Button>Enviar a aprobación</Button>
  </div>
)
