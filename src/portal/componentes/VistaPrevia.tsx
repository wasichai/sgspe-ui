import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useSiguientePaso } from '../contexto/Rastro'
import { rutaDeFicha } from '../datos/fichas'
import { opcion } from '../datos/opciones'
import { campoDe, texto, useDefinicion, useRegistro, type Registro } from '../datos/registros'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { NS } from '../i18n'
import { Drawer } from './Drawer'
import { EstadoChip } from './EstadoChip'
import { Cargando, esIlegible, esProhibido, NoDisponible, Reservado } from './Estados'
import { FalloDeLectura } from './LecturaConEstados'
import { PanelDeDecision } from './PanelDeDecision'
import { useRotuloDeRegistro } from './RegistroVinculado'

// la vista previa de ux-architecture.md §8.1 (revisión de UX, etapa 6): un registro relacionado en un drawer, sin salir de la
// lista, el mapa o la ficha. vive en la consulta (?peek=objeto:id), así que una vista previa reemplaza a otra y nunca se apilan;
// «Abrir ficha» la convierte en la vista principal y cerrar la quita de la consulta, con el resto de la búsqueda intacto
const PATRON = /^([a-z_]+):([^:]+)$/

// la ruta de la pantalla actual con la vista previa de un registro abierta
export function useRutaDeVistaPrevia(): (objeto: string, id: string) => string {
  const { pathname, search } = useLocation()
  return (objeto, id) => {
    const busqueda = new URLSearchParams(search)
    busqueda.set('peek', `${objeto}:${id}`)
    return `${pathname}?${busqueda.toString()}`
  }
}

export function VistaPrevia() {
  const [busqueda] = useSearchParams()
  const { pathname, state } = useLocation()
  const navegar = useNavigate()
  const pedida = PATRON.exec(busqueda.get('peek') ?? '')
  if (!pedida) return null
  const [, objeto, id] = pedida
  const cerrar = () => {
    const resto = new URLSearchParams(busqueda)
    resto.delete('peek')
    const consulta = resto.toString()
    // el rastro (estado del historial) se conserva al cerrar
    navegar(`${pathname}${consulta ? `?${consulta}` : ''}`, { replace: true, state })
  }
  // la clave remonta el contenido al cambiar de registro: una vista previa reemplaza a la otra
  return <ContenidoDeVistaPrevia key={`${objeto}:${id}`} objeto={objeto} id={id} alCerrar={cerrar} />
}

function ContenidoDeVistaPrevia({ objeto, id, alCerrar }: { objeto: string; id: string; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const registro = useRegistro(objeto, id)
  const rotulo = useRotuloDeRegistro()
  const paso = useSiguientePaso()
  const ruta = registro.data ? rutaDeFicha(objeto, registro.data) : null
  return (
    <Drawer
      titulo={registro.data ? rotulo(registro.data) : t('paginas.vistaPrevia.titulo')}
      abierto
      alCerrar={alCerrar}
      pie={
        ruta ? (
          <Button asChild size="sm">
            <Link to={ruta} state={paso(undefined, ruta)}>
              {t('paginas.vistaPrevia.abrirFicha')}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {registro.isPending ? (
        <Cargando />
      ) : registro.isError && !registro.data ? (
        esIlegible(registro.error) ? (
          <Reservado />
        ) : esProhibido(registro.error) ? (
          <NoDisponible />
        ) : (
          <FalloDeLectura error={registro.error} alReintentar={() => void registro.refetch()} />
        )
      ) : (
        <Resumen objeto={objeto} registro={registro.data as Registro} />
      )}
    </Drawer>
  )
}

// el encabezado de la ficha en pequeño: el tipo y el código, el estado y, con workflow, el panel de decisión. de una evidencia,
// su tipo y su clasificación (su nombre de archivo y su huella, solo en su ficha y para quien la descarga)
function Resumen({ objeto, registro }: { objeto: string; registro: Registro }) {
  const definicion = useDefinicion(objeto)
  const siguiente = useSiguienteAccion(objeto, registro)
  const tipo = definicion.data?.label ?? ''
  const antetitulo = [tipo, texto(registro, 'code')].filter(Boolean).join(' · ')
  const dato = (campo: string) =>
    opcion(registro, campo) ? (
      <div key={campo}>
        <dt className="text-sg-caption text-sg-text-muted">{campoDe(definicion.data, campo)?.label ?? campo}</dt>
        <dd>{opcion(registro, campo)}</dd>
      </div>
    ) : null
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {antetitulo ? <span className="font-sg-mono text-sg-caption text-sg-text-muted">{antetitulo}</span> : null}
        <EstadoChip objeto={objeto} estado={registro.state} />
      </div>
      {objeto === 'evidence' ? <dl className="grid gap-2 sm:grid-cols-2">{['evidence_type', 'classification'].map(dato)}</dl> : null}
      {registro.state ? (
        <PanelDeDecision
          objeto={objeto}
          estado={registro.state}
          desde={texto(registro, 'state_changed_at') || null}
          por={texto(registro, 'state_changed_by') || null}
          siguiente={siguiente}
          responsable={texto(registro, 'owner_user_email') || null}
          vencimiento={texto(registro, 'due_date') || null}
          situacion={texto(registro, 'deadline_status') || undefined}
        />
      ) : null}
    </div>
  )
}
