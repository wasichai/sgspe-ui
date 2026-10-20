import { Route, Routes } from 'react-router'
import { AtencionPage } from './AtencionPage'
import { ReporteQcsPage } from './ReporteQcsPage'
import { TableroAtencionPage } from './TableroAtencionPage'
import { NoEncontrada } from '../shell/NoEncontrada'

// la sección Quejas, consultas y solicitudes con alcance global (ux-architecture.md §6.2): la lista unificada (S35), el tablero
// (S34) y el reporte unificado. el alta (S37) y las fichas (S36 y S57) viven bajo el proyecto (rutasEnProyecto.ts)
export function AtencionRutas() {
  return (
    <Routes>
      <Route index element={<AtencionPage />} />
      <Route path="dashboard" element={<TableroAtencionPage />} />
      <Route path="report" element={<ReporteQcsPage />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
