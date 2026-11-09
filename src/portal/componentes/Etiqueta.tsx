import type { ReactNode } from 'react'
import { unir } from './clases'

// la etiqueta de un dato fijo (design-system.md §5.3, .tag del lienzo): el nivel de divulgación de un entregable (INTERNO,
// EXTERNO) o su tipo (T1, T2). 24 px de alto, borde de 1,5 px border-strong, texto de 12,5 px 700 en MAYÚSCULAS; no es un estado
// ni un chip que se quita. con «nombre», lo visible es una abreviatura y el lector de pantalla oye el nombre entero
export function Etiqueta({ children, nombre, mono = false, className }: { children: ReactNode; nombre?: string; mono?: boolean; className?: string }) {
  return (
    <span
      title={nombre}
      className={unir(
        'inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-sg-sm border-[1.5px] border-sg-border-strong bg-sg-surface px-1.75 text-sg-caption font-bold uppercase tracking-[0.03em] text-sg-text',
        mono && 'font-sg-mono',
        className
      )}
    >
      {nombre ? (
        <>
          <span aria-hidden>{children}</span>
          <span className="sr-only">{nombre}</span>
        </>
      ) : (
        children
      )}
    </span>
  )
}
