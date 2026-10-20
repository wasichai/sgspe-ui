import { Button, EncabezadoDePagina, MasAcciones, SituacionDePlazo } from 'sgspe-kit'

export const Listado = () => (
  <div className="p-4">
    <EncabezadoDePagina
      titulo="Compromisos"
      conteo="128 compromisos"
      descripcion="Lo que la organización prometió a las comunidades, con su responsable y su plazo."
      primaria={<Button>Nuevo compromiso</Button>}
      secundarias={
        <Button size="sm" variant="secondary">
          Exportar
        </Button>
      }
    />
  </div>
)

export const Ficha = () => (
  <div className="p-4">
    <EncabezadoDePagina
      ficha
      antetitulo="Compromiso · COM-0142 · Infraestructura"
      titulo="Mejorar el acceso al centro de salud de Huancapampa"
      chips={
        <>
          <SituacionDePlazo valor="POR VENCER" />
          <span className="text-sg-text-secondary">Vence el 15/11/2026</span>
        </>
      }
      primaria={<Button>Registrar entrega</Button>}
      secundarias={
        <Button size="sm" variant="secondary">
          Reprogramar
        </Button>
      }
      mas={
        <MasAcciones>
          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-sg-surface-hover">
            Cancelar compromiso
          </button>
        </MasAcciones>
      }
    />
  </div>
)
