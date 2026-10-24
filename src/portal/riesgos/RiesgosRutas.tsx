import { Route, Routes } from 'react-router'
import { ReglasPage } from './ReglasPage'
import { RiesgosPage } from './RiesgosPage'
import { TableroRiesgosPage } from './TableroRiesgosPage'
import { NoEncontrada } from '../shell/NoEncontrada'

// la sección Riesgos con alcance global (ux-architecture.md §6.2): aterriza en el registro y matriz de todos los proyectos (S38 y
// S39, decisión 7 de la revisión de UX; /risks/register sigue valiendo), con el tablero (S62) en /risks/dashboard y las reglas de
// alerta del tenant (S60). la ficha del riesgo, el
// centro de alerta, los incidentes, las menciones, las señales y los impactos viven bajo el proyecto (rutasEnProyecto.ts)
export function RiesgosRutas() {
  return (
    <Routes>
      <Route index element={<RiesgosPage />} />
      <Route path="register" element={<RiesgosPage />} />
      <Route path="dashboard" element={<TableroRiesgosPage />} />
      <Route path="rules" element={<ReglasPage />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
