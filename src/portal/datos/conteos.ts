import { useQueries } from '@tanstack/react-query'
import { usePedir } from './http'
import { consulta, type Pagina, type Parametros } from './registros'

// cuántos registros cumplen una consulta, con size=1 y el totalElements de la API genérica (api.md §3.4), sumados por clave:
// los conteos de las pestañas del proyecto y las cifras de «Mis proyectos». comparte la clave de useRegistros, así una escritura
// los invalida. una suma con una parte que no llegó o falló engañaría: entonces null
export interface PedidoDeConteo {
  clave: string
  objeto: string
  filtros: Parametros
}

export function useSumasDeConteos(pedidos: PedidoDeConteo[], activo = true): Record<string, number | null> {
  const pedir = usePedir()
  const respuestas = useQueries({
    queries: pedidos.map(({ objeto, filtros }) => {
      const busqueda = consulta({ ...filtros, size: 1 })
      return { queryKey: ['records', objeto, busqueda], queryFn: () => pedir<Pagina>(`/objects/${objeto}/records?${busqueda}`), enabled: activo }
    })
  })
  const sumas: Record<string, number | null> = {}
  pedidos.forEach(({ clave }, i) => {
    const n = respuestas[i].data?.totalElements
    sumas[clave] = n == null || sumas[clave] === null ? null : (sumas[clave] ?? 0) + n
  })
  return sumas
}
