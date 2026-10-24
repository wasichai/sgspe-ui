import { Route, Routes } from 'react-router'
import { CalidadPage } from './CalidadPage'
import { FichaComunidadPage } from './FichaComunidadPage'
import { FichaLocalidadPage } from './FichaLocalidadPage'
import { ImportacionPage } from './ImportacionPage'
import { TerritorioPage } from './TerritorioPage'
import { NoEncontrada } from '../shell/NoEncontrada'

// la sección Territorio (ux-architecture.md §6.2): el mapa territorial, las fichas de comunidad y de localidad, la
// importación geoespacial y, desde F6, el tablero territorial (S12 en modo tablero) y la calidad de datos (S63); el territorio es del tenant y puede llevar ?project= para mirarlo desde un proyecto
export function TerritorioRutas() {
  return (
    <Routes>
      <Route index element={<TerritorioPage />} />
      <Route path="dashboard" element={<TerritorioPage modo="tablero" />} />
      <Route path="quality" element={<CalidadPage />} />
      <Route path="communities/:id" element={<FichaComunidadPage />} />
      <Route path="localities/:id" element={<FichaLocalidadPage />} />
      <Route path="imports/:id" element={<ImportacionPage />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
