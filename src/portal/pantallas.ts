import type { ComponentType } from 'react'
import type { ClaveDeSeccion } from './shell/navTree'

// la pantalla de cada sección, por su clave (como PANTALLAS de caja-ui@a45b224). una sección sin pantalla no se dibuja:
// una entrada de menú que no lleva a ninguna parte es un defecto. cada fase registra aquí las suyas; F1 no tiene ninguna,
// porque el Dashboard es la ruta índice y Administración es /admin
export const PANTALLAS: Partial<Record<ClaveDeSeccion, ComponentType>> = {}
