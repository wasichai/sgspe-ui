import { PestanasDesplazables } from 'sgspe-kit'

const pestanas = ['Resumen', 'Mapa', 'Grupos de interés', 'Relacionamiento', 'Compromisos', 'Quejas y solicitudes', 'Riesgos', 'Programas', 'Documentos']

export const SubnavegacionDelProyecto = () => (
  <div className="max-w-2xl p-4">
    <PestanasDesplazables etiqueta="Secciones del proyecto">
      {pestanas.map((p, i) => (
        <a
          key={p}
          aria-current={i === 4 ? 'page' : undefined}
          className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-sg-text-secondary aria-[current=page]:border-sg-primary aria-[current=page]:font-medium aria-[current=page]:text-sg-text"
        >
          {p}
        </a>
      ))}
    </PestanasDesplazables>
  </div>
)
