import { Route, Routes } from 'react-router'
import { ReglasPage } from './ReglasPage'
import { RiesgosPage } from './RiesgosPage'
import { TableroRiesgosPage } from './TableroRiesgosPage'

// la sección Riesgos con alcance global (ux-architecture.md §6.2, screens.md S62): el tablero de riesgos es su entrada (/risks),
// con el registro y matriz de todos los proyectos (S38 y S39) y las reglas de alerta del tenant (S60). la ficha del riesgo, el
// centro de alerta, los incidentes, las menciones, las señales y los impactos viven bajo el proyecto (rutasEnProyecto.ts)
export function RiesgosRutas() {
  return (
    <Routes>
      <Route index element={<TableroRiesgosPage />} />
      <Route path="register" element={<RiesgosPage />} />
      <Route path="rules" element={<ReglasPage />} />
    </Routes>
  )
}
