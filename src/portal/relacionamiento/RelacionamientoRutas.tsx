import { Route, Routes } from 'react-router'
import { InteraccionesPage } from './InteraccionesPage'
import { TableroRelacionamientoPage } from './TableroRelacionamientoPage'

// la sección Relacionamiento con alcance global (ux-architecture.md §6.2): la lista, el calendario y el tablero. las fichas,
// el registro, el acta y las visitas viven bajo el proyecto (rutasEnProyecto.ts); las visitas globales en /field-visits
export function RelacionamientoRutas() {
  return (
    <Routes>
      <Route index element={<InteraccionesPage vista="lista" />} />
      <Route path="calendar" element={<InteraccionesPage vista="mes" />} />
      <Route path="dashboard" element={<TableroRelacionamientoPage />} />
    </Routes>
  )
}

export function InteraccionesListaPage() {
  return <InteraccionesPage vista="lista" />
}

export function InteraccionesCalendarioPage() {
  return <InteraccionesPage vista="mes" />
}
