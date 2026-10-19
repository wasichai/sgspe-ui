import { useQuery } from '@tanstack/react-query'
import { useApiClient, type ApiClient } from '@wasichai/core'
import { usePedir, type Pedido } from './http'

// el nombre visible de una persona de la organización por su correo (GET /api/sgspe/people, ASM-142). los registros guardan
// al responsable por id y correo (ASM-023); el portal muestra el nombre. los correos que se piden en un mismo render se juntan
// en una sola consulta (hasta 100 por vez); sin respuesta (un backend sin el endpoint, un 403) el nombre es null y se ve el
// correo, como antes
interface Persona {
  email: string
  displayName: string
}

const TOPE = 100
type Espera = (nombre: string | null) => void

function crearLote(pedir: Pedido) {
  let pendientes = new Map<string, Espera[]>()
  let programado = false
  const enviar = async () => {
    programado = false
    const lote = pendientes
    pendientes = new Map()
    const correos = [...lote.keys()]
    for (let i = 0; i < correos.length; i += TOPE) {
      const parte = correos.slice(i, i + TOPE)
      let nombres = new Map<string, string>()
      try {
        const personas = await pedir<Persona[]>(`/sgspe/people?${parte.map((c) => `email=${encodeURIComponent(c)}`).join('&')}`)
        nombres = new Map(personas.map((p) => [p.email.toLowerCase(), p.displayName]))
      } catch {
        // sin nombres: cada persona se ve por su correo
      }
      for (const correo of parte) for (const esperar of lote.get(correo) ?? []) esperar(nombres.get(correo) ?? null)
    }
  }
  return (correo: string): Promise<string | null> =>
    new Promise((resolver) => {
      const clave = correo.toLowerCase()
      pendientes.set(clave, [...(pendientes.get(clave) ?? []), resolver])
      if (!programado) {
        programado = true
        setTimeout(() => void enviar(), 0)
      }
    })
}

// un lote por cliente (uno por app): cada componente tiene su propio pedido, pero todos juntan sus correos en el mismo lote
const LOTES = new WeakMap<ApiClient, (correo: string) => Promise<string | null>>()

export function useNombreDePersona(correo: string | null | undefined): string | null {
  const cliente = useApiClient()
  const pedir = usePedir()
  let cargar = LOTES.get(cliente)
  if (!cargar) {
    cargar = crearLote(pedir)
    LOTES.set(cliente, cargar)
  }
  const nombre = useQuery({
    queryKey: ['persona', (correo ?? '').toLowerCase()],
    queryFn: () => cargar(correo ?? ''),
    enabled: Boolean(correo),
    staleTime: 600_000
  })
  return nombre.data ?? null
}
