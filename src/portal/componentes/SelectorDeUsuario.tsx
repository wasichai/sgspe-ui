import { Input } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { useUsuarios } from '../proyectos/usuarios'
import { Campo, SelectNativo } from './Campo'
import { Cargando } from './Estados'

// una persona usuaria de la organización por su id y su correo (ASM-023): el responsable o el verificador de un compromiso,
// el responsable de una acción o de un acuerdo. quien lee el directorio (MANAGE_ORGANIZATION, UPS-06) elige de la lista; los
// demás escriben el correo y el identificador, que UserReferenceGuard comprueba en el servidor. sin la lista legible (403 o
// una falla) se escribe a mano, y una falla se dice
export interface Usuaria {
  id: string
  email: string
}

export function SelectorDeUsuario({
  etiqueta,
  valor,
  alCambiar,
  error
}: {
  etiqueta: string
  valor: Usuaria | null
  alCambiar: (valor: Usuaria | null) => void
  error?: string
}) {
  const { t } = useTranslation(NS)
  const usuarios = useUsuarios()
  if (usuarios.isPending) return <Cargando compacto />
  const lista = usuarios.data?.filter((u) => u.enabled) ?? null
  if (lista) {
    return (
      <Campo etiqueta={etiqueta} error={error}>
        {(p) => (
          <SelectNativo
            {...p}
            value={valor?.id ?? ''}
            onChange={(e) => {
              const elegido = lista.find((u) => u.id === e.target.value)
              alCambiar(elegido ? { id: elegido.id, email: elegido.email } : null)
            }}
            opciones={lista.map((u) => ({ valor: u.id, etiqueta: `${u.displayName} · ${u.email}` }))}
          />
        )}
      </Campo>
    )
  }
  const cambiar = (parte: Partial<Usuaria>) => {
    const siguiente = { id: valor?.id ?? '', email: valor?.email ?? '', ...parte }
    alCambiar(siguiente.id === '' && siguiente.email === '' ? null : siguiente)
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sg-body-sm font-medium text-sg-text">{etiqueta}</legend>
      <p className="text-sg-caption text-sg-text-muted">{usuarios.isError ? t('comun.usuario.noLeido') : t('comun.usuario.aMano')}</p>
      <Campo etiqueta={t('comun.usuario.correo', { etiqueta })} error={error}>
        {(p) => <Input {...p} type="email" value={valor?.email ?? ''} onChange={(e) => cambiar({ email: e.target.value.trim() })} />}
      </Campo>
      <Campo etiqueta={t('comun.usuario.identificador', { etiqueta })}>
        {(p) => <Input {...p} value={valor?.id ?? ''} onChange={(e) => cambiar({ id: e.target.value.trim() })} />}
      </Campo>
    </fieldset>
  )
}
