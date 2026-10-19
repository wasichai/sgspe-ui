import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useSiguientePaso } from '../contexto/Rastro'
import { atributo, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// «Ver en el mapa» de una ficha con lugar (revisión de UX, etapa 6): el mapa territorial con su lugar elegido (?selected=), que
// abre su ficha contextual y sus registros; con el proyecto del registro puesto, las cifras son las del proyecto. una comunidad
// o una localidad es su propio lugar; otro registro, su comunidad o, sin ella, su localidad. sin lugar no se ofrece
export function rutaEnElMapa(objeto: string, registro: Registro): string | null {
  const lugar =
    objeto === 'community' || objeto === 'locality'
      ? `${objeto}:${registro.id}`
      : atributo<string>(registro, 'community')
        ? `community:${atributo<string>(registro, 'community')}`
        : atributo<string>(registro, 'locality')
          ? `locality:${atributo<string>(registro, 'locality')}`
          : null
  if (!lugar) return null
  const proyecto = atributo<string>(registro, 'project')
  // URLSearchParams codifica cada valor
  const busqueda = new URLSearchParams(proyecto ? { project: proyecto, selected: lugar } : { selected: lugar })
  return '/territory?' + busqueda.toString()
}

export function VerEnElMapa({ objeto, registro }: { objeto: string; registro: Registro }) {
  const { t } = useTranslation(NS)
  const paso = useSiguientePaso()
  const ruta = rutaEnElMapa(objeto, registro)
  if (!ruta) return null
  return (
    <Button asChild size="sm" variant="secondary">
      <Link to={ruta} state={paso(undefined, ruta)}>
        {t('territorio.verEnMapa')}
      </Link>
    </Button>
  )
}
