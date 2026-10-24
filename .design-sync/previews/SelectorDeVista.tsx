import { useState } from 'react'
import { SelectorDeVista } from 'sgspe-kit'

const VISTAS = [
  { id: 'activos', etiqueta: 'Activos', n: 96 },
  { id: 'mios', etiqueta: 'Míos', n: 14 },
  { id: 'vencidos', etiqueta: 'Vencidos', n: 7 },
  { id: 'por-verificar', etiqueta: 'Por verificar', n: 5 },
  { id: 'cerrados', etiqueta: 'Cerrados', n: 32 },
  { id: 'candidatos', etiqueta: 'Candidatos' }
]

function Selector({ inicial, visibles }: { inicial: string; visibles?: number }) {
  const [actual, setActual] = useState(inicial)
  return <SelectorDeVista etiqueta="Vistas" vistas={VISTAS} actual={actual} alElegir={setActual} visibles={visibles} />
}

export const Vistas = () => (
  <div className="space-y-4 p-4 pb-48">
    <Selector inicial="activos" />
    <Selector inicial="candidatos" visibles={3} />
  </div>
)
