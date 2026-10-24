import { cn } from '@wasichai/ui'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// los atributos de una sección de ficha (U-26 y DD-06 del rediseño de UX): a la vista, los que tienen dato; los vacíos,
// plegados tras «Mostrar los N campos sin dato», para que la ficha no sea un muro de guiones. un dato restringido no es un
// vacío (llega como el candado de Restringido): se ve siempre
export interface CampoDeFicha {
  clave: string
  termino: string
  // null, undefined, '' o «—» es un campo sin dato
  valor: ReactNode
  // ocupa el ancho entero (un texto largo)
  ancho?: boolean
}

export const sinDato = (valor: ReactNode): boolean => valor === null || valor === undefined || valor === '' || valor === '—'

function Lista({ campos, columnas, id }: { campos: readonly CampoDeFicha[]; columnas: 2 | 3; id?: string }) {
  return (
    <dl id={id} className={cn('grid gap-3 text-sm', columnas === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {campos.map((c) => (
        <div key={c.clave} className={c.ancho ? 'sm:col-span-full' : undefined}>
          <dt className="text-sg-caption text-sg-text-muted">{c.termino}</dt>
          <dd>{sinDato(c.valor) ? '—' : c.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CamposPlegables({ campos, columnas = 2 }: { campos: readonly CampoDeFicha[]; columnas?: 2 | 3 }) {
  const { t } = useTranslation(NS)
  const id = useId()
  const [abiertos, setAbiertos] = useState(false)
  const conDato = campos.filter((c) => !sinDato(c.valor))
  const vacios = campos.filter((c) => sinDato(c.valor))
  return (
    <div className="space-y-2">
      {conDato.length > 0 ? <Lista campos={conDato} columnas={columnas} /> : null}
      {vacios.length > 0 ? (
        <>
          {abiertos ? <Lista id={id} campos={vacios} columnas={columnas} /> : null}
          <button
            type="button"
            aria-expanded={abiertos}
            aria-controls={abiertos ? id : undefined}
            onClick={() => setAbiertos((x) => !x)}
            className="text-sg-body-sm font-medium text-sg-primary-text hover:underline"
          >
            {abiertos ? t('comun.camposPlegables.ocultar') : t('comun.camposPlegables.mostrar', { count: vacios.length })}
          </button>
        </>
      ) : null}
    </div>
  )
}
