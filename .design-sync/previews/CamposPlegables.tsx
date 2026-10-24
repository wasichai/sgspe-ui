import { CamposPlegables, Monto, Restringido } from 'sgspe-kit'

export const Atributos = () => (
  <div className="max-w-3xl p-4">
    <CamposPlegables
      columnas={3}
      campos={[
        { clave: 'tipo', termino: 'Tipo de recurso', valor: 'Infraestructura' },
        { clave: 'origen', termino: 'Origen', valor: 'Acta de la asamblea del 12/10/2026' },
        { clave: 'monto', termino: 'Monto estimado', valor: <Monto valor="185000" moneda="PEN" /> },
        { clave: 'beneficiario', termino: 'Persona beneficiaria', valor: <Restringido /> },
        { clave: 'lugar', termino: 'Lugar', valor: null },
        { clave: 'acuerdo', termino: 'Acuerdo', valor: '—' },
        { clave: 'notas', termino: 'Notas', valor: '', ancho: true },
        { clave: 'descripcion', termino: 'Descripción', valor: 'Mejorar la trocha carrozable y el puente peatonal que llevan al centro de salud.', ancho: true }
      ]}
    />
  </div>
)
