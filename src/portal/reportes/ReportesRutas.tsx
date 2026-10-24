import { Route, Routes } from 'react-router'
import { PorRuta } from '../componentes/PorRuta'
import { EntregablePage } from '../entregables/EntregablePage'
import { PresentacionesPage } from '../entregables/PresentacionesPage'
import { PlantillasPage } from '../entregables/PlantillasPage'
import { ReportesPage } from './ReportesPage'
import { NoEncontrada } from '../shell/NoEncontrada'

// la sección Reportes: las exportaciones de F2 a F4 y, desde F8, los entregables (S49 en ReportesPage y S50 por registro;
// ux-architecture.md §6.2)
export function ReportesRutas() {
  return (
    <Routes>
      <Route index element={<ReportesPage />} />
      <Route path="templates" element={<PlantillasPage />} />
      <Route path="deliverables/:deliverableId" element={<PorRuta parametros={['deliverableId']} Pantalla={EntregablePage} />} />
      <Route path="deliverables/:deliverableId/presentations" element={<PorRuta parametros={['deliverableId']} Pantalla={PresentacionesPage} />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
