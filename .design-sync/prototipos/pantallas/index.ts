import type { ComponentType } from 'react'
import { P01 } from './P01Inicio'
import { P01Agente } from './P01Agente'
import { P02 } from './P02Listado'
import { P03 } from './P03Proyecto'
import { P04 } from './P04Formulario'
import { P05 } from './P05Bandeja'
import { P06 } from './P06Mapa'
import { P07 } from './P07Tablero'
import { P08 } from './P08Administracion'
import { P09 } from './P09Ficha'
import { PEstados } from './PEstados'

export const PANTALLAS: Record<string, ComponentType> = { P01, P01Agente, P02, P03, P04, P05, P06, P07, P08, P09, PEstados }
