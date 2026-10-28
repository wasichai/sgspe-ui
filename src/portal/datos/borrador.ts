import { useAuth } from '@wasichai/core'
import { useEffect, useRef } from 'react'

// el borrador de un alta en este navegador (design-system.md §6.3: guardado automático; tercera pasada de UX, 2.4): lo escrito se
// guarda por pantalla y proyecto mientras se completa, se recupera al volver (AvisoDeBorrador) y se borra al registrar. guarda los
// valores del formulario y los ids elegidos fuera de él (los solicitantes de un compromiso, los grupos de una QCS). si el navegador
// no guarda, el alta sigue sin borrador. es de quien lo escribió: la clave lleva su cuenta, para que en un navegador compartido
// no se ofrezca a otra persona, y «Cerrar sesión» borra los de este navegador. lo restringido nunca se guarda aquí
export interface Borrador<T> {
  valores: T
  elegidos?: Record<string, string[]>
  guardado: string
}
export type ContenidoDelBorrador<T> = Omit<Borrador<T>, 'guardado'>

const PREFIJO = 'sgspe.borrador.'

// la clave del borrador de una pantalla (y su proyecto, su visita…) para quien mira
export function useClaveDelBorrador(...partes: (string | null | undefined)[]): string {
  const { user } = useAuth()
  return `${PREFIJO}${[...partes.filter(Boolean), user?.id ?? 'sin-cuenta'].join('.')}`
}

// los borradores de este navegador, de toda cuenta: al cerrar la sesión no quedan para quien use el navegador después
export function borrarBorradores() {
  try {
    const claves = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => k?.startsWith(PREFIJO) ?? false)
    for (const clave of claves) localStorage.removeItem(clave)
  } catch {
    // sin almacenamiento no hay borradores
  }
}

// un valor sin dato: vacío, sin marcar, en cero, una lista sin elementos o un objeto sin datos (los conteos del modo rápido)
const sinDato = (v: unknown): boolean =>
  v === '' ||
  v === undefined ||
  v === null ||
  v === false ||
  v === 0 ||
  (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.values(v).every(sinDato))

export function leerBorrador<T>(clave: string): Borrador<T> | null {
  try {
    const crudo = localStorage.getItem(clave)
    if (!crudo) return null
    const borrador = JSON.parse(crudo) as Borrador<T> | null
    return borrador && typeof borrador.valores === 'object' && borrador.valores !== null ? borrador : null
  } catch {
    return null
  }
}

function escribir<T>(clave: string, { valores, elegidos }: ContenidoDelBorrador<T>) {
  try {
    const vacio = Object.values(valores as Record<string, unknown>).every(sinDato) && Object.values(elegidos ?? {}).every((ids) => ids.length === 0)
    if (vacio) localStorage.removeItem(clave)
    else localStorage.setItem(clave, JSON.stringify({ valores, elegidos, guardado: new Date().toISOString() } satisfies Borrador<T>))
  } catch {
    // sin almacenamiento, el alta sigue sin borrador
  }
}

// borra un borrador sin su pantalla: el del otro modo de la interacción, al guardarla en uno
export function descartarBorrador(clave: string) {
  try {
    localStorage.removeItem(clave)
  } catch {
    // nada que borrar
  }
}

// guarda el contenido medio segundo después del último cambio y, al salir de la pantalla, lo que quedaba por guardar: salir
// antes del medio segundo no pierde lo último. activo en false (sin cambios, o el alta ya hecha) no guarda. descartar borra el
// borrador y lo pendiente (al terminar el alta o con «Descartar el borrador»); guardarYa es el de «Guardar y salir»
export function useBorradorLocal<T>(clave: string, contenido: ContenidoDelBorrador<T>, activo: boolean) {
  const serie = JSON.stringify(contenido)
  const ultimo = useRef(contenido)
  const pendiente = useRef<ContenidoDelBorrador<T> | null>(null)
  const plazo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    ultimo.current = contenido
    if (!activo) {
      pendiente.current = null
      return
    }
    pendiente.current = contenido
    plazo.current = setTimeout(() => {
      escribir(clave, contenido)
      pendiente.current = null
    }, 500)
    return () => clearTimeout(plazo.current)
    // la serie dice si el contenido cambió: un objeto nuevo con lo mismo no vuelve a guardar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, serie, activo])
  useEffect(
    () => () => {
      if (pendiente.current) escribir(clave, pendiente.current)
    },
    [clave]
  )
  return {
    descartar: () => {
      clearTimeout(plazo.current)
      pendiente.current = null
      descartarBorrador(clave)
    },
    guardarYa: () => {
      clearTimeout(plazo.current)
      pendiente.current = null
      escribir(clave, ultimo.current)
    }
  }
}
