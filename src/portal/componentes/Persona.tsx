import { useNombreDePersona } from '../datos/personas'

// una persona referida por un registro (responsable, verificador, jefatura): su nombre visible, con el correo en el title; si
// el nombre no se puede leer, el correo en una sola línea (D11 de la revisión de UX: partido en dos se leía como dos datos),
// recortado si no cabe y entero en el title; sin correo, «—»
export function Persona({ correo }: { correo: string | null | undefined }) {
  const nombre = useNombreDePersona(correo)
  if (!correo) return <>—</>
  if (!nombre)
    return (
      <span title={correo} className="inline-block max-w-56 truncate whitespace-nowrap align-bottom">
        {correo}
      </span>
    )
  return <span title={correo}>{nombre}</span>
}
