import { Navigate, Route, Routes } from 'react-router'
import { ProyectoLayout } from '../contexto/ProyectoLayout'
import { GuardaDeSeccion } from '../shell/GuardaDeSeccion'
import { NAV_TREE } from '../shell/navTree'
import { RUTAS_EN_PROYECTO } from './rutasEnProyecto'
import { ProyectosPage } from './ProyectosPage'

// la sección Proyectos (ux-architecture.md §6.2): /projects, /projects/new y, bajo /projects/:projectId, Project 360 con
// las listas y fichas de los módulos montadas con el alcance del proyecto (ASM-076). cada módulo agrega sus rutas en
// rutasEnProyecto.ts
export function ProyectosRutas() {
  return (
    <Routes>
      <Route index element={<ProyectosPage />} />
      <Route path=":projectId" element={<ProyectoLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        {RUTAS_EN_PROYECTO.map(({ ruta, Pantalla, seccion }) => {
          const guarda = seccion ? NAV_TREE.find((s) => s.clave === seccion) : undefined
          return (
            <Route
              key={ruta}
              path={ruta}
              element={
                guarda ? (
                  <GuardaDeSeccion seccion={guarda}>
                    <Pantalla />
                  </GuardaDeSeccion>
                ) : (
                  <Pantalla />
                )
              }
            />
          )
        })}
      </Route>
    </Routes>
  )
}
