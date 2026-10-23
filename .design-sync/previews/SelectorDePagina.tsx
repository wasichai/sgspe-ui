import { SelectorDePagina } from 'sgspe-kit'

export const PaginasDeRiesgos = () => (
  <div className="p-4">
    <SelectorDePagina
      etiqueta="Páginas de Riesgos"
      actual="registro"
      paginas={[
        { id: 'registro', etiqueta: 'Registro', a: '/risks', n: 24 },
        { id: 'incidentes', etiqueta: 'Incidentes', a: '/risks/incidents', n: 6 },
        { id: 'alertas', etiqueta: 'Alerta temprana', a: '/risks/warnings', n: 3 },
        { id: 'reglas', etiqueta: 'Reglas', a: '/risks/rules' }
      ]}
    />
  </div>
)
