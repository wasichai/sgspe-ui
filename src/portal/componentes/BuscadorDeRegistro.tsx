import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegistros, type Parametros, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { CONTROL } from './Campo'

// buscar antes de crear (flows.md, flujo 3): un texto que consulta la API genérica con q (búsqueda en los campos de texto)
// y una lista de resultados; elegir uno devuelve el registro. sirve para organizaciones, personas, localidades, grupos de
// interés y temas
export function BuscadorDeRegistro({
  objeto,
  etiqueta,
  rotulo,
  filtros = {},
  alElegir
}: {
  objeto: string
  etiqueta: string
  rotulo: (registro: Registro) => string
  filtros?: Parametros
  alElegir: (registro: Registro) => void
}) {
  const { t } = useTranslation(NS)
  const [q, setQ] = useState('')
  const resultados = useRegistros(objeto, { ...filtros, q, size: 10 }, q.trim().length >= 2)
  const lista = resultados.data?.content ?? []
  return (
    <div className="space-y-1">
      <input type="search" aria-label={etiqueta} placeholder={etiqueta} value={q} onChange={(e) => setQ(e.target.value)} className={CONTROL} />
      {q.trim().length >= 2 ? (
        lista.length === 0 ? (
          <p className="text-sg-caption text-sg-text-muted">{resultados.isPending ? t('comun.cargando') : t('comun.sinResultados')}</p>
        ) : (
          <ul aria-label={`${etiqueta}: ${t('comun.seleccionar')}`} className="max-h-48 overflow-y-auto rounded-sg-md border border-sg-border">
            {lista.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="w-full px-2.5 py-1.5 text-left text-sm hover:bg-sg-surface-hover"
                  onClick={() => {
                    alElegir(r)
                    setQ('')
                  }}
                >
                  {rotulo(r)}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}
