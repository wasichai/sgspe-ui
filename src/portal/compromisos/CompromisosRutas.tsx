import { Route, Routes } from 'react-router'
import { CompromisosPage } from './CompromisosPage'
import { TableroCompromisosPage } from './TableroCompromisosPage'
import { NoEncontrada } from '../shell/NoEncontrada'

// la sección Compromisos con alcance global (ux-architecture.md §6.2): la lista (con la vista Candidatos) y el tablero. la
// ficha, el alta y los acuerdos de un proyecto viven bajo el proyecto (rutasEnProyecto.ts); los acuerdos de todos los
// proyectos, en /agreements
export function CompromisosRutas() {
  return (
    <Routes>
      <Route index element={<CompromisosPage />} />
      <Route path="dashboard" element={<TableroCompromisosPage />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
