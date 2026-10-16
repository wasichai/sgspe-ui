import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { CONTROL } from '../componentes/Campo'
import { texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { TIPOS_DE_MENCION, type TipoDeMencion } from './menciones'
import { codigoGi } from './tipos'

// el selector de menciones de S50: una persona (por los nombres que la cuenta lee), un cargo o un grupo de interés del proyecto
// (por su código GI-, que no es un dato personal). elegir inserta [[tipo:<id>]] en el editor
export function SelectorDeMenciones({ proyecto, alElegir }: { proyecto: string; alElegir: (tipo: TipoDeMencion, id: string, etiqueta: string) => void }) {
  const { t } = useTranslation(NS)
  const [tipo, setTipo] = useState<TipoDeMencion>('person')
  const rotulo = (r: Registro): string =>
    tipo === 'person'
      ? [texto(r, 'given_names'), texto(r, 'surnames')].filter(Boolean).join(' ') || t('entregables.menciones.tipos.person')
      : tipo === 'position'
        ? texto(r, 'position_title') || t('entregables.menciones.tipos.position')
        : codigoGi(r.id)
  return (
    <div role="group" aria-label={t('entregables.menciones.titulo')} className="flex flex-wrap items-start gap-2 text-sm">
      <label className="space-y-1">
        <span className="block text-sg-label">{t('entregables.menciones.tipo')}</span>
        <select className={CONTROL} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeMencion)}>
          {TIPOS_DE_MENCION.map((x) => (
            <option key={x} value={x}>
              {t(`entregables.menciones.tipos.${x}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="min-w-56 flex-1">
        <BuscadorDeRegistro
          key={tipo}
          objeto={tipo}
          etiqueta={t(`entregables.menciones.buscar.${tipo}`)}
          filtros={tipo === 'stakeholder' ? { project: proyecto } : {}}
          rotulo={rotulo}
          alElegir={(r) => alElegir(tipo, r.id, rotulo(r))}
        />
      </div>
    </div>
  )
}
