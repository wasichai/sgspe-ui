import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// un grupo de avisos con su título (que dice cuántos son), los primeros `limite` y «Ver los N» para desplegar el resto: una
// lista de cien enlaces sin agrupar no se lee (Atención requerida del resumen, «Te toca» del calendario)
export function ListaPlegable({ titulo, elementos, limite = 5 }: { titulo: string; elementos: { clave: string; contenido: ReactNode }[]; limite?: number }) {
  const { t } = useTranslation(NS)
  const [abierta, setAbierta] = useState(false)
  const id = useId()
  if (elementos.length === 0) return null
  const visibles = abierta ? elementos : elementos.slice(0, limite)
  return (
    <div role="group" aria-labelledby={id} className="space-y-1">
      <h3 id={id} className="text-sm font-medium">
        {titulo}
      </h3>
      <ul className="space-y-1 text-sm">
        {visibles.map((e) => (
          <li key={e.clave}>{e.contenido}</li>
        ))}
      </ul>
      {elementos.length > limite ? (
        <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => setAbierta(!abierta)}>
          {abierta ? t('comun.verMenos') : t('comun.verTodos', { count: elementos.length })}
        </button>
      ) : null}
    </div>
  )
}
