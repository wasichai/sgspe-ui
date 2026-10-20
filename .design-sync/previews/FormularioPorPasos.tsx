import { Campo, FormularioPorPasos, Input, SelectNativo } from 'sgspe-kit'

export const NuevoCompromiso = () => (
  <div className="max-w-3xl p-4">
    <FormularioPorPasos
      titulo="Nuevo compromiso"
      descripcion="Proyecto Huancapampa"
      pasos={['Datos básicos', 'Origen', 'Responsable y plazo', 'Revisión']}
      actual={0}
      visitados={1}
      alAnterior={() => {}}
      anteriorDeshabilitado
      alCancelar={() => {}}
      alEnviar={(e) => e.preventDefault()}
    >
      <div className="space-y-4">
        <Campo etiqueta="Título" ayuda="Lo que se prometió, en palabras de la comunidad.">
          {(props) => <Input {...props} defaultValue="Mejorar el acceso al centro de salud" />}
        </Campo>
        <Campo etiqueta="Tipo de recurso">
          {(props) => (
            <SelectNativo
              {...props}
              opciones={[
                { valor: 'infra', etiqueta: 'Infraestructura' },
                { valor: 'salud', etiqueta: 'Salud' }
              ]}
            />
          )}
        </Campo>
      </div>
    </FormularioPorPasos>
  </div>
)
