import { useNombreDePersona } from '../datos/personas'
import { Correo } from './Correo'

// una persona referida por un registro (responsable, verificador, jefatura): su nombre visible, con el correo en el title; si
// el nombre no se puede leer, el correo (que se parte antes de la «@»); sin correo, «—»
export function Persona({ correo }: { correo: string | null | undefined }) {
  const nombre = useNombreDePersona(correo)
  if (!correo) return <>—</>
  if (!nombre) return <Correo valor={correo} />
  return <span title={correo}>{nombre}</span>
}
