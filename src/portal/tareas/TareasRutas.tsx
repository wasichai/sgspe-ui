import { Route, Routes } from 'react-router'
import { PorRuta } from '../componentes/PorRuta'
import { AprobacionesPage } from './AprobacionesPage'
import { AprobacionPage } from './AprobacionPage'
import { MisTareasPage } from './MisTareasPage'
import { NoEncontrada } from '../shell/NoEncontrada'

// la sección Tareas (ux-architecture.md §6.2): mis tareas, la bandeja de aprobaciones y escalamientos y la aprobación de un
// compromiso (S31), que lleva el objeto y el registro porque una aprobación es una transición y no una tarea; se monta de
// nuevo por compromiso
export function TareasRutas() {
  return (
    <Routes>
      <Route index element={<MisTareasPage />} />
      <Route path="approvals" element={<AprobacionesPage />} />
      <Route path="approvals/commitment/:recordId" element={<PorRuta parametros={['recordId']} Pantalla={AprobacionPage} />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
