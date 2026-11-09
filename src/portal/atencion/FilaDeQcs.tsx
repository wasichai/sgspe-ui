import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CaminoDelFlujo } from '../componentes/CaminoDelFlujo'
import { Dia } from '../componentes/Dia'
import { useDiasDelPlazo } from '../componentes/DiasDelPlazo'
import { Restringido } from '../componentes/Estados'
import { nombreDe } from '../componentes/NombreDeActor'
import { Persona } from '../componentes/Persona'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useSiguientePaso } from '../contexto/Rastro'
import { CAMINO_DE_QCS, COMPROBAR_DE_QCS, plazoQueCorre, rutaDeQcs, type ObjetoDeQcs } from '../datos/atencion'
import { atributo, texto, type Registro } from '../datos/registros'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { NS } from '../i18n'
import { useTransicionesOfrecidas } from '../transiciones/BotonesDeTransicion'

// las piezas de una fila de la cola de QCS (S11): quién la plantea, el plazo que corre con sus días y la fila abierta con el ciclo
// de vida de su workflow (WF-E1, WF-E2 o WF-E3, el real del registro), la siguiente acción con su responsable y su primaria

// quién la plantea: «anónima» si lo es (el dato anonymous se lee siempre), «Restringido» a quien no lee la persona (un campo
// restringido, security.md §7.9), la persona registrada o, sin ella, «—»
export function PlanteaDeQcs({ qcs, leePersona }: { qcs: Registro; leePersona: boolean }) {
  const { t } = useTranslation(NS)
  if (atributo(qcs, 'anonymous') === true) return <span className="italic text-sg-text-secondary">{t('atencion.anonima')}</span>
  if (!leePersona) return <Restringido />
  const persona = atributo<string>(qcs, 'person')
  if (!persona) return <span className="text-sg-text-muted">—</span>
  return <RegistroVinculado objeto="person" id={persona} rotulo={(p) => nombreDe(p, 'person', t('comun.personaRegistrada'))} />
}

// el plazo que corre en su estado como situación con sus días («VENCIDO · 10 DÍAS HÁBILES»: el acuse de una queja en días hábiles,
// lo demás en días corridos; ASM-100), con la fecha debajo; fuera de esos estados, «sin plazo»
export function PlazoDeQcs({ objeto, qcs }: { objeto: ObjetoDeQcs; qcs: Registro }) {
  const { t } = useTranslation(NS)
  const plazo = plazoQueCorre(objeto, qcs)
  const situacion = atributo(qcs, 'deadline_status')
  const dias = useDiasDelPlazo(plazo?.fecha && situacion ? plazo.fecha : null, plazo?.campo === 'ack_due_date')
  if (!plazo) return <span className="text-sg-text-muted">{t('atencion.sinPlazo')}</span>
  return (
    <div className="flex flex-col items-start gap-1">
      <SituacionDePlazo valor={situacion} detalle={dias} />
      <span className="text-sg-caption text-sg-text-muted">{plazo.fecha ? <Dia valor={plazo.fecha} /> : t('atencion.plazoPorCalcular')}</span>
    </div>
  )
}

// la fila abierta: el camino del workflow con el estado actual, la siguiente acción y su responsable, y la primaria (la transición
// del camino que la cuenta puede dar, con su motivo y sus comprobaciones, como en la ficha; sin ella, «Abrir ficha»). aplicada una
// transición, la cola se vuelve a leer
export function CicloDeQcs({ objeto, qcs, alAplicar }: { objeto: ObjetoDeQcs; qcs: Registro; alAplicar: () => void }) {
  const { t } = useTranslation(NS)
  const paso = useSiguientePaso()
  const proyecto = texto(qcs, 'project')
  const siguiente = useSiguienteAccion(objeto, qcs, COMPROBAR_DE_QCS[objeto])
  const { primaria, confirmacion, dialogo } = useTransicionesOfrecidas({
    objeto,
    registro: qcs,
    proyecto,
    comprobarAntes: COMPROBAR_DE_QCS[objeto],
    primariaSoloDelCamino: true,
    alAplicar
  })
  const ruta = rutaDeQcs(proyecto, objeto, qcs.id)
  const ficha = (
    <Button asChild size="sm" variant={primaria ? 'ghost' : 'primary'}>
      <Link to={ruta} state={paso(t('atencion.titulo'), ruta)}>
        {t('atencion.fila.abrirFicha')}
      </Link>
    </Button>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-96">
        <CaminoDelFlujo objeto={objeto} estado={qcs.state} camino={CAMINO_DE_QCS[objeto]} />
      </div>
      <div className="text-sm">
        <p className="text-sg-caption text-sg-text-secondary">{t('atencion.fila.siguienteYResponsable')}</p>
        <p className="font-bold text-sg-text">
          {siguiente?.etiqueta ?? t('atencion.fila.sinSiguiente')} · <Persona correo={texto(qcs, 'owner_user_email') || null} />
        </p>
        {siguiente?.falta ? <p className="text-sg-caption text-sg-danger">{siguiente.falta}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {primaria?.nodo}
        {ficha}
      </div>
      {confirmacion ? <div className="basis-full">{confirmacion}</div> : null}
      {dialogo}
    </div>
  )
}
