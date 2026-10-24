import { PanelDeTrazabilidad } from 'sgspe-kit'

const enlace = (texto: string) => <a className="text-sg-primary-text hover:underline">{texto}</a>

export const Compromiso = () => (
  <div className="max-w-sm p-4">
    <PanelDeTrazabilidad
      deDondeViene={[{ clave: 'acta', titulo: 'Acta', contenido: enlace('Asamblea comunal del 12 de octubre') }]}
      queGenero={[
        { clave: 'entregas', titulo: 'Entregas', contenido: enlace('2 entregas parciales') },
        { clave: 'tareas', titulo: 'Tareas', contenido: enlace('Coordinar con la posta de salud') }
      ]}
      loSustenta={[{ clave: 'evidencias', titulo: 'Evidencias', contenido: enlace('Acta firmada (PDF)') }]}
    />
  </div>
)
