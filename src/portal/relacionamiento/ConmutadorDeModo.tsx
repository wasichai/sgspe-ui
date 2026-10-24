import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { NS } from '../i18n'
import { conModo } from './modos'

// F-D (02-arquitectura-de-informacion.md §6): el modo rápido de campo es un conmutador de la cabecera del registro, no un enlace
// suelto. encendido lleva al modo rápido y apagado al asistente, con la misma búsqueda (grupos, visita de campo, territorio)
export function ConmutadorDeModo({ rapido }: { rapido: boolean }) {
  const { t } = useTranslation(NS)
  const [busqueda] = useSearchParams()
  const navegar = useNavigate()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rapido}
      onClick={() => navegar({ search: conModo(busqueda, rapido ? 'full' : 'quick') })}
      className="inline-flex items-center gap-2 rounded-sg-md px-2 py-1 text-sm text-sg-text-secondary hover:bg-sg-surface-hover focus-visible:outline-2 focus-visible:outline-sg-focus"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${
          rapido ? 'border-sg-primary bg-sg-primary' : 'border-sg-border-strong bg-sg-surface-sunken'
        }`}
      >
        <span
          className={`absolute top-0.5 size-3.5 rounded-full shadow-sg-sm transition-[left] ${rapido ? 'left-[18px] bg-sg-on-primary' : 'left-0.5 bg-sg-text-muted'}`}
        />
      </span>
      {t('relacionamiento.registro.rapido')}
    </button>
  )
}
