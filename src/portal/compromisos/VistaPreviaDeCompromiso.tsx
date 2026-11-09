import { useAuth } from '@wasichai/core'
import { Sparkles } from 'lucide-react'
import { Fragment, useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando } from '../componentes/Estados'
import { montoPe } from '../componentes/Monto'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { MasAcciones } from '../componentes/Pagina'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { atributo, texto, useRegistros, useRelacionados, type Registro } from '../datos/registros'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { CAJA_DE_IA } from '../ia/MarcaDeIa'
import { NS, numeroPe } from '../i18n'
import { useTransicionesOfrecidas } from '../transiciones/BotonesDeTransicion'
import { COMPROBAR, Trazabilidad } from './FichaCompromisoPage'
import { MotivoDelBloqueo, SituacionDelCompromiso } from './SituacionDelCompromiso'

// la vista previa de un compromiso (S08, design-system.md §5.3): bajo el antetítulo y el título del panel, el estado y la
// situación; la primaria (la siguiente transición del flujo, la misma de la ficha y del panel de decisión) con dos secundarias a
// la vista y el resto en «Más acciones»; el motivo del bloqueo; el panel de decisión de dos por dos; el monto, los grupos de
// interés que lo pidieron y el lugar; la trazabilidad y, si hay candidatos de la IA por decidir en el proyecto, su caja. las
// transiciones son las de la ficha, con su diálogo (verbo en el botón, motivo y transition-checks)
const SECUNDARIAS_A_LA_VISTA = 2

export function VistaPreviaDeCompromiso({ registro: compromiso }: { registro: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(compromiso, 'project')
  const siguiente = useSiguienteAccion('commitment', compromiso, COMPROBAR)
  const idDeFalta = useId()
  const transiciones = useTransicionesOfrecidas({
    objeto: 'commitment',
    registro: compromiso,
    proyecto,
    comprobarAntes: COMPROBAR,
    faltaDeLaPrimaria: siguiente?.falta ? { id: idDeFalta, texto: siguiente.falta } : undefined
  })
  const aLaVista = transiciones.otras.slice(0, SECUNDARIAS_A_LA_VISTA)
  const enMenu = [...transiciones.otras.slice(SECUNDARIAS_A_LA_VISTA), ...transiciones.destructivas]
  const hayAcciones = transiciones.primaria || aLaVista.length > 0 || enMenu.length > 0
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <EstadoChip objeto="commitment" estado={compromiso.state} />
        <SituacionDelCompromiso compromiso={compromiso} />
      </div>
      {hayAcciones ? (
        <div role="group" aria-label={t('transiciones.acciones')} className="space-y-2">
          {/* la primaria sola en su fila y debajo las secundarias con «Más acciones» (S08); sin secundarias, «Más acciones» va
              junto a la primaria */}
          {transiciones.primaria && aLaVista.length > 0 ? <div>{transiciones.primaria.nodo}</div> : null}
          {aLaVista.length > 0 || enMenu.length > 0 || transiciones.primaria ? (
            <div className="flex flex-wrap items-center gap-2">
              {transiciones.primaria && aLaVista.length === 0 ? transiciones.primaria.nodo : null}
              {aLaVista.map((a) => (
                <Fragment key={a.clave}>{a.nodo}</Fragment>
              ))}
              {enMenu.length > 0 ? (
                <MasAcciones>
                  {enMenu.map((a) => (
                    <Fragment key={a.clave}>{a.nodo}</Fragment>
                  ))}
                </MasAcciones>
              ) : null}
            </div>
          ) : null}
          {siguiente?.falta && transiciones.primaria ? (
            <p id={idDeFalta} className="text-sg-caption text-sg-text-secondary">
              {siguiente.falta}
            </p>
          ) : null}
        </div>
      ) : null}
      {transiciones.confirmacion}
      {transiciones.dialogo}
      <MotivoDelBloqueo compromiso={compromiso} />
      <PanelDeDecision
        objeto="commitment"
        proyecto={proyecto}
        estado={compromiso.state}
        desde={texto(compromiso, 'state_changed_at') || null}
        por={texto(compromiso, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={texto(compromiso, 'owner_user_email') || null}
        vencimiento={texto(compromiso, 'due_date') || null}
        situacion={atributo(compromiso, 'deadline_status')}
      />
      <Datos compromiso={compromiso} />
      <section aria-labelledby={`${idDeFalta}-trazabilidad`} className="space-y-2">
        <h3 id={`${idDeFalta}-trazabilidad`} className="text-sm font-bold text-sg-text">
          {t('paginas.trazabilidad.titulo')}
        </h3>
        <Trazabilidad compromiso={compromiso} />
      </section>
      <CandidatosDeIa proyecto={proyecto} />
    </div>
  )
}

// el monto (o «Sin monto registrado», nunca un cero), los grupos de interés que lo pidieron y el lugar, en filas de término y valor
function Datos({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const solicitantes = useRelacionados('commitment', compromiso.id, 'commitment_stakeholder')
  const monto = montoPe(atributo(compromiso, 'amount'), atributo(compromiso, 'currency'))
  const lugar = atributo<string>(compromiso, 'community') ? (
    <Lugar objeto="community" id={atributo<string>(compromiso, 'community')} />
  ) : atributo<string>(compromiso, 'locality') ? (
    <Lugar objeto="locality" id={atributo<string>(compromiso, 'locality')} />
  ) : null
  const filas: { clave: string; termino: string; valor: ReactNode }[] = [
    {
      clave: 'monto',
      termino: t('compromisos.previa.monto'),
      valor:
        monto === '—' ? <span className="text-sg-text-muted">{t('compromisos.previa.sinMonto')}</span> : <span className="font-bold tabular-nums">{monto}</span>
    },
    {
      clave: 'grupos',
      termino: t('compromisos.previa.grupos'),
      valor: solicitantes.isPending ? (
        <Cargando compacto />
      ) : solicitantes.data && solicitantes.data.content.length > 0 ? (
        <ul>
          {solicitantes.data.content.map((g) => (
            <li key={g.id}>
              <NombreDelGrupo grupo={g} />
            </li>
          ))}
        </ul>
      ) : solicitantes.data ? (
        <span className="text-sg-text-muted">{t('compromisos.previa.sinGrupos')}</span>
      ) : null
    },
    ...(lugar ? [{ clave: 'lugar', termino: t('compromisos.previa.lugar'), valor: lugar }] : [])
  ]
  return (
    <dl className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-4 gap-y-2">
      {filas.map((f) => (
        <Fragment key={f.clave}>
          <dt className="text-sg-text-secondary">{f.termino}</dt>
          <dd className="min-w-0 text-sg-text">{f.valor}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

// el lugar como etiqueta de territorio (.tag.terr del lienzo): la localidad o la comunidad, con su nombre leído como quien mira
function Lugar({ objeto, id }: { objeto: 'community' | 'locality'; id: string | undefined }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-sg-md border border-sg-territory-border bg-sg-territory-soft px-2 py-0.5 text-sg-caption font-bold text-sg-territory [&_a]:text-sg-territory">
      <RegistroVinculado objeto={objeto} id={id} rotulo={(r) => texto(r, 'name') || texto(r, 'title')} />
    </span>
  )
}

// los candidatos que la IA propuso en el proyecto y nadie decidió todavía (S08): cuántos, con el conteo del servidor, y el enlace
// a la vista Candidatos. la IA no crea compromisos: una persona los acepta. sin candidatos de la IA, o sin leerlos, nada
function CandidatosDeIa({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const lee = can('commitment_candidate', 'READ')
  const candidatos = useRegistros('commitment_candidate', { project: proyecto, state: 'proposed', ai_generated: true, size: 1 }, lee && proyecto !== '')
  const n = candidatos.data?.totalElements ?? 0
  if (!lee || n === 0) return null
  return (
    <section aria-label={t('compromisos.previa.candidatos', { count: n, n: numeroPe(n) })} className={`${CAJA_DE_IA} space-y-2`}>
      <p className="flex items-center gap-2 text-sg-caption font-extrabold tracking-[0.06em] text-sg-ai uppercase">
        <Sparkles aria-hidden className="size-3.5 shrink-0" />
        {t('compromisos.previa.candidatos', { count: n, n: numeroPe(n) })}
      </p>
      <p className="text-sg-text">{t('compromisos.previa.candidatosTexto')}</p>
      <Link
        to={`/projects/${encodeURIComponent(proyecto)}/commitments?view=candidatos`}
        className="inline-flex min-h-8 items-center rounded-sg-md border border-sg-primary px-3 text-sm font-bold text-sg-primary-text hover:bg-sg-surface-hover"
      >
        {t('compromisos.previa.revisarCandidatos')}
      </Link>
    </section>
  )
}
