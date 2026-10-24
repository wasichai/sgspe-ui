import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePedir } from '../datos/http'
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

function actorDelGrupo(grupo: Registro | undefined): { objeto: 'person' | 'organization'; id: string | undefined } {
  const persona = atributo<string>(grupo, 'person')
  return persona ? { objeto: 'person', id: persona } : { objeto: 'organization', id: atributo<string>(grupo, 'organization') }
}

export function useActorDelGrupo(grupo: Registro | undefined): { objeto: 'person' | 'organization'; id: string | undefined } {
  return actorDelGrupo(grupo)
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

// los nombres de varios grupos de interés a la vez (el selector de «Más filtros» busca por ellos), con las mismas reglas que
// useNombreDelGrupo y la misma clave de caché que useRegistro: lo que se leyó para la lista o el chip no se vuelve a pedir
export function useNombresDeGrupos(grupos: Registro[]): Map<string, string> {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const actores = grupos.map(actorDelGrupo)
  const lecturas = useQueries({
    queries: actores.map(({ objeto, id }) => ({
      queryKey: ['record', objeto, id],
      queryFn: () => pedir<Registro>(`/objects/${objeto}/records/${encodeURIComponent(id ?? '')}`),
      enabled: Boolean(id)
    }))
  })
  const registrada = t('comun.personaRegistrada')
  return new Map(
    grupos.map((g, i) => {
      const { objeto, id } = actores[i]
      const lectura = lecturas[i]
      if (!id || lectura.isError) return [g.id, registrada]
      return [g.id, nombreDe(lectura.data, objeto, registrada) || (lectura.isPending ? '…' : '')]
    })
  )
}

export function NombreDelGrupo({ grupo }: { grupo: Registro }) {
  return <>{useNombreDelGrupo(grupo)}</>
}
