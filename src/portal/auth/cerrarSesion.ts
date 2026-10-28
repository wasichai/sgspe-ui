import { useAuth } from '@wasichai/core'
import { borrarBorradores } from '../datos/borrador'

// «Cerrar sesión» del menú de la cuenta: además de cerrar la sesión, borra los borradores de altas de este navegador, para que no
// queden para quien lo use después (tercera pasada de UX, 2.4). la sesión vencida no los borra: quien vuelve a entrar los recupera
export function useCerrarSesion(): () => void {
  const { signOut } = useAuth()
  return () => {
    borrarBorradores()
    signOut()
  }
}
