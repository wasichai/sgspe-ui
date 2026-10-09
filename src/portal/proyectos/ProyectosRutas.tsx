import { Navigate, Route, Routes } from 'react-router'
import { parametrosDe, PorRuta } from '../componentes/PorRuta'
import { ProyectoLayout } from '../contexto/ProyectoLayout'
import { GuardaDeSeccion } from '../shell/GuardaDeSeccion'
import { NAV_TREE } from '../shell/navTree'
import { RUTAS_EN_PROYECTO } from './rutasEnProyecto'
import { NuevoProyectoPage } from './NuevoProyectoPage'
import { ProyectosPage } from './ProyectosPage'

// la sección Proyectos (ux-architecture.md §6.2): /projects, /projects/new y, bajo /projects/:projectId, Project 360 con
// las listas y fichas de los módulos montadas con el alcance del proyecto (ASM-076). cada módulo agrega sus rutas en
// rutasEnProyecto.ts
export function ProyectosRutas() {
  return (
    <Routes>
      <Route index element={<ProyectosPage />} />
      <Route path="new" element={<NuevoProyectoPage />} />
      <Route path=":projectId" element={<ProyectoLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        {RUTAS_EN_PROYECTO.map(({ ruta, Pantalla, seccion }) => {
          const guarda = seccion ? NAV_TREE.find((s) => s.clave === seccion) : undefined
          // cada pantalla se monta de nuevo por su proyecto y su registro: nada de lo abierto o escrito pasa a otro
          const pantalla = <PorRuta parametros={['projectId', ...parametrosDe(ruta)]} Pantalla={Pantalla} />
          return <Route key={ruta} path={ruta} element={guarda ? <GuardaDeSeccion seccion={guarda}>{pantalla}</GuardaDeSeccion> : pantalla} />
        })}
      </Route>
    </Routes>
  )
}
