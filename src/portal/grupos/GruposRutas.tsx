import { Route, Routes } from 'react-router'
import { GruposPage } from './GruposPage'

// la sección Grupos de interés con alcance global (ux-architecture.md §6.2): la lista y el tablero. la ficha, la matriz y
// la evaluación viven bajo el proyecto (rutasEnProyecto.ts) y la ficha de actor en /actors/:actorId
export function GruposRutas() {
  return (
    <Routes>
      <Route index element={<GruposPage />} />
    </Routes>
  )
}
