import { Route, Routes } from 'react-router'
import { DetalleDeIndicadorPage } from '../tableros/DetalleDeIndicadorPage'
import { GruposPage } from './GruposPage'
import { TableroGruposPage } from './TableroGruposPage'
import { NoEncontrada } from '../shell/NoEncontrada'

// la sección Grupos de interés con alcance global (ux-architecture.md §6.2): la lista, el tablero y el detalle de un indicador. la ficha, la matriz y
// la evaluación viven bajo el proyecto (rutasEnProyecto.ts) y la ficha de actor en /actors/:actorId
export function GruposRutas() {
  return (
    <Routes>
      <Route index element={<GruposPage />} />
      <Route path="dashboard" element={<TableroGruposPage />} />
      <Route path="indicators/:code" element={<DetalleDeIndicadorPage />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
