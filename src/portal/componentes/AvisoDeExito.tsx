import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Alert } from '@wasichai/ui'

// lo que hizo la pantalla anterior (un alta), dicho por la ficha a la que llegó, bajo su cabecera (tercera pasada de UX, 2.12;
// DD-34): «Se registró la queja Q-005. Se creó la tarea de acusar recibo.». viaja en el estado del historial (conHecho, que conserva
// lo demás: el rastro y el origen de la ficha) y se dice una sola vez: al leerlo se saca del historial, así volver a esta entrada
// no lo repite. queda a la vista hasta que la persona deja la ficha
export function conHecho(estado: unknown, hecho: string): Record<string, unknown> {
  return { ...(estado && typeof estado === 'object' ? (estado as Record<string, unknown>) : {}), hecho }
}

export function AvisoDeExito() {
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const [texto] = useState(() => {
    const hecho = (ubicacion.state as { hecho?: unknown } | null)?.hecho
    return typeof hecho === 'string' && hecho !== '' ? hecho : null
  })
  useEffect(() => {
    if (!texto) return
    const resto = { ...((ubicacion.state ?? {}) as Record<string, unknown>) }
    delete resto.hecho
    navegar(
      { pathname: ubicacion.pathname, search: ubicacion.search, hash: ubicacion.hash },
      { replace: true, state: Object.keys(resto).length > 0 ? resto : null, preventScrollReset: true }
    )
    // solo al montar: el texto ya se leyó
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!texto) return null
  // la alerta de éxito de design-system.md §5.3, en role="status": la caja, el borde de 2 px y el ícono los pone la capa de
  // componentes sobre el Alert de wasichai
  return <Alert tone="success">{texto}</Alert>
}
