import { Route, Routes } from 'react-router'
import { ReportesPage } from './ReportesPage'

// la sección Reportes en F2: las exportaciones; los entregables llegan en F8 (ux-architecture.md §6.2)
export function ReportesRutas() {
  return (
    <Routes>
      <Route index element={<ReportesPage />} />
    </Routes>
  )
}
