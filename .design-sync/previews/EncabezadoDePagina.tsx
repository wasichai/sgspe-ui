import { Button, EncabezadoDePagina, SituacionDePlazo } from 'sgspe-kit'

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

// la cabecera de una ficha como la arma CabeceraDeFicha: una primaria (la siguiente acción del flujo, deshabilitada con lo
// que falta dicho debajo), dos secundarias a la vista y el resto, con lo destructivo, en «Más acciones»
export const Ficha = () => (
  <div className="p-4 pb-40">
    <EncabezadoDePagina
      ficha
      antetitulo="Compromiso · COM-0142 · Infraestructura"
      antetituloEnSans
      titulo="Mejorar el acceso al centro de salud de Huancapampa"
      chips={
        <>
          <SituacionDePlazo valor="POR VENCER" />
          <span className="text-sg-text-secondary">Vence el 15/11/2026</span>
        </>
      }
      etiquetaDeAcciones="Acciones del registro"
      secundarias={
        <>
          <Button size="sm" variant="secondary">
            Editar
          </Button>
          <Button size="sm" variant="secondary">
            Reprogramar
          </Button>
        </>
      }
      mas={
        <>
          <Button size="sm" variant="secondary">
            Bloquear
          </Button>
          <Button size="sm" variant="secondary" className="text-sg-danger">
            Cancelar el compromiso
          </Button>
        </>
      }
      primaria={
        <Button size="sm" disabled aria-describedby="falta-com-0142" title="Falta una evidencia de la entrega">
          Marcar como cumplido
        </Button>
      }
      pieDeAcciones={
        <p id="falta-com-0142" className="text-sg-caption text-sg-text-secondary">
          Falta una evidencia de la entrega
        </p>
      }
    />
  </div>
)
