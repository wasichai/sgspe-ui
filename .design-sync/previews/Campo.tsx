import { Campo, Input, SelectNativo } from 'sgspe-kit'

export const ConAyudaYError = () => (
  <div className="max-w-md space-y-4 p-4">
    <Campo etiqueta="Título" ayuda="Lo que se prometió, en palabras de la comunidad.">
      {(props) => <Input {...props} defaultValue="Mejorar el acceso al centro de salud" />}
    </Campo>
    <Campo etiqueta="Responsable" error="Elija a la persona responsable del compromiso.">
      {(props) => <Input {...props} placeholder="Correo de la persona" />}
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
)
