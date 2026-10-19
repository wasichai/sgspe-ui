import { atributo, type Registro } from '../datos/registros'

// el proyecto en la columna de una lista global: su código, que no se parte, y el nombre en el title y para el lector de
// pantalla; así la columna no le quita el ancho al título del registro. sin el proyecto todavía, «…»
export function ProyectoEnLista({ proyecto }: { proyecto: Registro | undefined }) {
  if (!proyecto) return <>…</>
  const codigo = String(atributo(proyecto, 'code') ?? '')
  const nombre = String(atributo(proyecto, 'name') ?? '')
  return (
    <span title={nombre}>
      <span className="font-sg-mono">{codigo}</span>
      <span className="sr-only"> · {nombre}</span>
    </span>
  )
}
