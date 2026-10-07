import type { ComponentType } from 'react'
import { ofrece, type Oferta, type Par } from './shell/navTree'

// el inicio por rol (ASM-078, docs/ux/ux-architecture.md §5 y §7.2): / muestra la variante que corresponde a lo que la
// cuenta hace. sin nombres de rol (RQ-SEC-005): cada variante dice con qué permisos se ofrece, como las secciones, y gana
// la primera que la cuenta tiene, en el orden de ux-architecture §5. F1 no registra ninguna: todos los inicios por rol
// son pantallas de F2 en adelante (Project 360, matriz, territorio, tareas, aprobaciones…) y una variante sin pantalla no
// existe, igual que una sección sin pantalla. sin variante, el inicio es la bienvenida de F1. cuando una cuenta tenga más
// de una, la persona podrá elegir la suya (ASM-078); en F1 no hay qué elegir
export interface VarianteDeInicio {
  clave: string
  // alguna de estas alternativas, cada una una lista de pares que la cuenta debe tener todos
  seOfreceCon: Par[][]
  Pantalla: ComponentType
}

export const INICIOS: VarianteDeInicio[] = []

export function inicioPara(inicios: VarianteDeInicio[], oferta: Pick<Oferta, 'can'>): VarianteDeInicio | null {
  return inicios.find((variante) => ofrece(variante.seOfreceCon, oferta.can)) ?? null
}
