import { Route, Routes } from 'react-router'
import { ProgramasPage } from './ProgramasPage'
import { TableroInversionPage } from './TableroInversionPage'
import { NoEncontrada } from '../shell/NoEncontrada'

// la sección Programas sociales con alcance global (ux-architecture.md §6.2): S42 de todos los proyectos (/programs) y el tablero de
// inversión social (/programs/dashboard). las fichas de un programa (S43) y de un aporte (S44) viven bajo el proyecto
// (rutasEnProyecto.ts)
export function ProgramasRutas() {
  return (
    <Routes>
      <Route index element={<ProgramasPage />} />
      <Route path="dashboard" element={<TableroInversionPage />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
