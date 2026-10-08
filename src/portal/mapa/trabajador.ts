// el script del worker de MapLibre, que main.tsx fija una vez (Vite lo empaqueta con ?worker&url, como srtm-ui). el mapa
// del portal lo lee antes de crear su primer mapa; así main.tsx no carga MapLibre, que baja con el primer mapa
let url: string | null = null

export function fijarTrabajadorDelMapa(valor: string): void {
  url = valor
}

export const trabajadorDelMapa = (): string | null => url
