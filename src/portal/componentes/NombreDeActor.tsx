import { useTranslation } from 'react-i18next'
import { atributo, texto, useRegistro, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// el nombre de un actor (persona u organización, CON-038) como lo puede leer quien mira: los nombres de personas son
// restringidos (security.md §7.9) y, sin ellos, la persona se muestra como "Persona registrada" (screens.md S16, S18)
export function nombreDe(actor: Registro | undefined, objeto: 'person' | 'organization', personaRegistrada: string): string {
  if (!actor) return ''
  if (objeto === 'organization') return texto(actor, 'name')
  const nombre = [texto(actor, 'given_names'), texto(actor, 'surnames')].filter(Boolean).join(' ')
  return nombre || personaRegistrada
}

export function useActorDelGrupo(grupo: Registro | undefined): { objeto: 'person' | 'organization'; id: string | undefined } {
  const persona = atributo<string>(grupo, 'person')
  return persona ? { objeto: 'person', id: persona } : { objeto: 'organization', id: atributo<string>(grupo, 'organization') }
}

// el nombre del actor de un grupo de interés
export function useNombreDelGrupo(grupo: Registro | undefined): string {
  const { t } = useTranslation(NS)
  const { objeto, id } = useActorDelGrupo(grupo)
  const actor = useRegistro(objeto, id)
  // sin id la consulta no corre (isPending sería eterno) y, si la lectura falla, el nombre no se pudo leer: en ambos casos
  // la persona queda como registrada, nunca un «…» eterno ni un nombre vacío
  if (!id || actor.isError) return t('comun.personaRegistrada')
  return nombreDe(actor.data, objeto, t('comun.personaRegistrada')) || (actor.isPending ? '…' : '')
}

export function NombreDelGrupo({ grupo }: { grupo: Registro }) {
  return <>{useNombreDelGrupo(grupo)}</>
}
