import { Route, Routes } from 'react-router'
import { FichaComunidadPage } from './FichaComunidadPage'
import { FichaLocalidadPage } from './FichaLocalidadPage'
import { ImportacionPage } from './ImportacionPage'
import { TerritorioPage } from './TerritorioPage'

// la sección Territorio (ux-architecture.md §6.2): el mapa territorial, las fichas de comunidad y de localidad y la
// importación geoespacial; el territorio es del tenant y puede llevar ?project= para mirarlo desde un proyecto
export function TerritorioRutas() {
  return (
    <Routes>
      <Route index element={<TerritorioPage />} />
      <Route path="communities/:id" element={<FichaComunidadPage />} />
      <Route path="localities/:id" element={<FichaLocalidadPage />} />
      <Route path="imports/:id" element={<ImportacionPage />} />
    </Routes>
  )
}
