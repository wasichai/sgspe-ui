import { Insignia } from 'sgspe-kit'

export const EnNavegacion = () => (
  <ul className="w-60 space-y-1 p-4 text-sm">
    <li className="flex items-center justify-between rounded-sg-md px-2 py-1.5 hover:bg-sg-surface-hover">
      <span aria-describedby="i-qcs">Quejas y solicitudes</span>
      <Insignia n={4} id="i-qcs" descripcion="4 quejas esperan respuesta" />
    </li>
    <li className="flex items-center justify-between rounded-sg-md px-2 py-1.5 hover:bg-sg-surface-hover">
      <span aria-describedby="i-tareas">Tareas</span>
      <Insignia n={128} id="i-tareas" descripcion="128 tareas pendientes" />
    </li>
    <li className="flex items-center justify-between rounded-sg-md px-2 py-1.5 hover:bg-sg-surface-hover">
      <span aria-describedby="i-docs">Documentos</span>
      <Insignia n={37} id="i-docs" descripcion="37 documentos" tono="total" />
    </li>
  </ul>
)
