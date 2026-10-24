import { useEffect } from 'react'
import type { PropsDelReproductor } from '../portal/presentaciones/Presentador'

// el reproductor de presentaciones sin Remotion, para probar las pantallas: dice en qué lámina está y cuántas trae la
// especificación, y no admite una de otra versión de esquema que la 1, como el esquema del paquete. se instala con
// vi.mock('../presentaciones/PresentadorImpl', () => import('../../test/presentadorFalso'))
export default function PresentadorFalso({ especificacion, lamina, etiqueta, alNoAdmitir }: PropsDelReproductor) {
  const { schema, slides } = (especificacion ?? {}) as { schema?: unknown; slides?: unknown[] }
  const admitida = schema === 1 && Array.isArray(slides)
  useEffect(() => {
    if (!admitida) alNoAdmitir()
  }, [admitida, alNoAdmitir])
  if (!admitida) return null
  return <p aria-label={etiqueta}>{`reproduciendo la lámina ${lamina + 1} de ${slides.length}`}</p>
}
