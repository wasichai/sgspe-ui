import { Mountain } from 'lucide-react'
import { unir } from '../componentes/clases'

// la marca de SGSPE: la montaña en un recuadro, del color del texto que la rodea (el de la cabecera azul, o el de la tarjeta
// del ingreso de /admin). la dibujan la cabecera del portal y, como appLogo de core, la barra, la cabecera angosta y el ingreso
// de /admin, que la declaran aria-hidden. `className` decide cuándo se ve (la cabecera la oculta bajo md); sin ella va siempre
export function MarcaDeSgspe({ className = 'flex' }: { className?: string }) {
  return (
    <span aria-hidden data-marca="sgspe" className={unir('size-9 shrink-0 items-center justify-center rounded-sg-md border-2 border-current', className)}>
      <Mountain className="size-5" />
    </span>
  )
}
