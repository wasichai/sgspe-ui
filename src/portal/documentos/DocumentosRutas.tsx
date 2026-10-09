import { Route, Routes } from 'react-router'
import { PorRuta } from '../componentes/PorRuta'
import { BibliotecaPage } from './BibliotecaPage'
import { FichaEvidenciaPage } from './FichaEvidenciaPage'

// la sección Documentos con alcance global (ux-architecture.md §6.2): la biblioteca y la ficha de una evidencia de la
// organización, montada de nuevo por evidencia; la de un proyecto vive bajo el proyecto
export function DocumentosRutas() {
  return (
    <Routes>
      <Route index element={<BibliotecaPage />} />
      <Route path=":documentId" element={<PorRuta parametros={['documentId']} Pantalla={FichaEvidenciaPage} />} />
    </Routes>
  )
}
