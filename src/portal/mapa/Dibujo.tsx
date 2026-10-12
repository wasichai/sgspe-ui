import { GeometryField, type GeoJsonGeometry } from '@wasichai/gis'

// el dibujo de una geometría con GeometryField de @wasichai/gis (gis.md §6.5 y §6.6): MapLibre y terra-draw bajan solo cuando se
// abre, y el fondo es el mapa base de la organización (mapaBaseModule). la interfaz de wasichai dibuja tipos de una sola parte; un
// MULTI* que ya existe se muestra igual (RQ-GIS-020). es el único archivo que importa GeometryField: las pruebas lo reemplazan
// por src/test/dibujoFalso.tsx
export interface DibujoProps {
  etiqueta: string
  tipo: string
  srid: number
  valor: GeoJsonGeometry | null
  alCambiar: (geometria: GeoJsonGeometry | null) => void
}

export function Dibujo({ etiqueta, tipo, srid, valor, alCambiar }: DibujoProps) {
  return <GeometryField name="geometria" label={etiqueta} geometryType={tipo} srid={srid} value={valor} onChange={alCambiar} />
}
