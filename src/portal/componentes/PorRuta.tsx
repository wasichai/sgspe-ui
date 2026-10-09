import type { ComponentType } from 'react'
import { useParams } from 'react-router'

// monta la pantalla de nuevo cuando cambian los parámetros de su ruta (el proyecto, el registro): una ficha ya leída se dibuja
// sin pasar por «Cargando», y sin esta clave lo abierto o lo escrito en un registro pasaría a otro del mismo tipo al seguir un
// enlace entre ellos o volver con el historial; lo tecleado en el alta de un proyecto tampoco pasa al de otro
export function PorRuta({ parametros, Pantalla }: { parametros: string[]; Pantalla: ComponentType }) {
  const valores = useParams()
  return <Pantalla key={parametros.map((p) => valores[p] ?? '').join('/')} />
}

// los parámetros que declara una ruta (`commitments/:commitmentId` → `commitmentId`)
export const parametrosDe = (ruta: string): string[] => [...ruta.matchAll(/:(\w+)/g)].map((m) => m[1])
