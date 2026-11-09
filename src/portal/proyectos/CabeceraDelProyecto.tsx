import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { Map as MapaIcono, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, esProhibido, NoDisponible } from '../componentes/Estados'
import { montoPe } from '../componentes/Monto'
import { MasAcciones } from '../componentes/Pagina'
import { Persona } from '../componentes/Persona'
import { ROL_DE_JEFATURA } from '../config'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { porcentaje } from '../datos/inversion'
import { opcion } from '../datos/opciones'
import { atributo, texto, usePuedeEditar, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useTransicionesOfrecidas } from '../transiciones/BotonesDeTransicion'

// la banda del proyecto de Civic Modern (design-system.md §5.2 y §6.7, S05 y T17): en el resumen del proyecto la banda de
// contexto crece con el antetítulo «Proyecto · CÓDIGO», el h1 con el chip de estado, una fila de datos (jefatura, etapa, fase y
// la campaña en curso con su tope) y las acciones a la derecha. la dibuja ProyectoLayout a todo el ancho, encima de la navegación
// local y del contenido, solo en el resumen: en las demás pestañas la banda de contexto con el sello del proyecto basta (S06).
// un dato que no llegó no se dibuja («—» no dice nada); la jefatura que no se pudo leer lo dice, nunca «Sin jefatura»
export function CabeceraDelProyecto({ proyecto }: { proyecto: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const escribe = useEscribeEnProyecto(proyecto.id)
  // un rol con "u" sobre project (el analista SIG, que solo vincula concesiones) no completa el borrador
  const editaProyecto = usePuedeEditar('project')
  const base = `/projects/${encodeURIComponent(proyecto.id)}`
  const etapa = opcion(proyecto, 'stage')
  const fase = opcion(proyecto, 'exploration_phase')
  return (
    <section aria-label={t('p360.resumen.cabecera')} className="border-b-2 border-sg-border-strong bg-sg-surface px-4 pt-1 pb-4 md:px-6 lg:px-8">
      {/* un <header> de la página del proyecto (no el banner: role="none" para quien cuenta todo <header> como tal) */}
      <header role="none" className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sg-overline tracking-wide text-sg-text-muted uppercase">
            {t('contexto.selloProyecto', { codigo: texto(proyecto, 'code') || proyecto.id })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-sg-h1 text-sg-text">{texto(proyecto, 'name')}</h1>
            <EstadoChip objeto="project" estado={proyecto.state} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4.5 gap-y-1 text-sg-body-sm text-sg-text-secondary">
            <Dato rotulo={t('p360.resumen.jefatura')}>
              <Jefatura proyecto={proyecto.id} />
            </Dato>
            {/* sin dato, la línea no se dibuja (tercera pasada de UX, como A16 en el compromiso): un «—» no dice nada */}
            {etapa ? <Dato rotulo={t('p360.resumen.etapa')}>{etapa}</Dato> : null}
            {fase ? <Dato rotulo={t('p360.resumen.fase')}>{fase}</Dato> : null}
            <CampanaEnCurso proyecto={proyecto.id} />
          </div>
        </div>
        <AccionesDelProyecto
          proyecto={proyecto}
          base={base}
          registra={escribe && can('engagement', 'CREATE')}
          completa={proyecto.state === 'draft' && editaProyecto}
        />
      </header>
    </section>
  )
}

// «Jefatura Rodrigo Ccahuana Ponce»: el rótulo en text-secondary y el dato en 600 text
function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <span>{rotulo}:</span>
      <span className="font-semibold text-sg-text">{children}</span>
    </span>
  )
}

function Jefatura({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const jefatura = useTodos('project_assignment', { project: proyecto, role_name: ROL_DE_JEFATURA, active: true })
  if (jefatura.isPending) return <Cargando compacto />
  if (jefatura.isError)
    return esProhibido(jefatura.error) ? (
      <NoDisponible />
    ) : (
      <span className="inline-flex items-center gap-2 font-normal">
        <span className="text-sg-danger">{t('p360.resumen.jefaturaConError')}</span>
        <Button variant="secondary" size="sm" onClick={() => void jefatura.refetch()}>
          {t('comun.reintentar')}
        </Button>
      </span>
    )
  if (!jefatura.data.length) return <span className="font-normal text-sg-text-secondary italic">{t('proyectos.sinJefatura')}</span>
  return (
    <>
      {jefatura.data.map((j, i) => (
        <span key={j.id}>
          {i ? ', ' : ''}
          <Persona correo={texto(j, 'member_user_email')} />
        </span>
      ))}
    </>
  )
}

// la campaña en curso con lo ejecutado frente a su tope y el medidor (S05): solo si hay una campaña EN EJECUCION con tope y la
// cuenta lee lo ejecutado (un derivado). sin tope, solo el nombre. lo que no se lee no se dibuja: nunca un cero supuesto
function CampanaEnCurso({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const campanas = useTodos('exploration_campaign', { project: proyecto, campaign_status: 'EN EJECUCION' }, can('exploration_campaign', 'READ'))
  const campana = campanas.data?.[0]
  if (!campana) return null
  const moneda = texto(campana, 'currency') || 'PEN'
  const tope = atributo(campana, 'social_support_cap')
  const ejecutado = atributo(campana, 'executed_social_amount')
  const parte = porcentaje(ejecutado, tope)
  const conTope = parte !== null
  const dicho = conTope ? t('p360.resumen.campanaTope', { ejecutado: montoPe(ejecutado, moneda), tope: montoPe(tope, moneda) }) : ''
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span>{texto(campana, 'name')}</span>
      {conTope ? (
        <>
          <span className="font-semibold text-sg-text tabular-nums">{dicho}</span>
          <span
            role="meter"
            aria-label={t('p360.resumen.campanaMedidor', { nombre: texto(campana, 'name') })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(100, Math.max(0, parte)))}
            aria-valuetext={dicho}
            className="inline-flex h-2.5 w-25 overflow-hidden rounded-sg-xs border border-sg-border-strong bg-sg-surface-sunken"
          >
            <span className="block h-full bg-sg-primary" style={{ width: `${Math.min(100, Math.max(0, parte))}%` }} />
          </span>
        </>
      ) : null}
    </span>
  )
}

// una sola primaria (A13 de la segunda pasada de UX, recuperado en la tercera): con el proyecto activo, «Registrar interacción»;
// mientras no lo está, su decisión (enviar a revisión, aprobar, reanudar: siguienteTransicion) y «Registrar interacción» como
// secundaria. lo demás (devolver, suspender, cerrar) y lo destructivo (anular) van en «Más acciones», lejos de la primaria. en el
// orden del lienzo: «…», «Ver en el mapa» y la primaria
function AccionesDelProyecto({ proyecto, base, registra, completa }: { proyecto: Registro; base: string; registra: boolean; completa: boolean }) {
  const { t } = useTranslation(NS)
  const activo = proyecto.state === 'active'
  const transiciones = useTransicionesOfrecidas({
    objeto: 'project',
    registro: proyecto,
    proyecto: proyecto.id,
    sinPrimaria: activo && registra,
    primariaSoloDelCamino: true
  })
  const registrar = (variante: 'primary' | 'secondary') => (
    <Button asChild variant={variante}>
      <Link to={`${base}/engagements/new`}>
        {variante === 'primary' ? <Plus aria-hidden className="size-4" /> : null}
        {t('p360.resumen.registrarInteraccion')}
      </Link>
    </Button>
  )
  const enMenu = [...transiciones.otras, ...transiciones.destructivas]
  return (
    <div className="space-y-2">
      <div role="group" aria-label={t('transiciones.acciones')} className="flex flex-wrap items-center gap-2">
        {enMenu.length > 0 ? <MasAcciones>{enMenu.map((x) => x.nodo)}</MasAcciones> : null}
        {completa ? (
          <Button asChild variant="secondary">
            <Link to={`/projects/new?draft=${encodeURIComponent(proyecto.id)}`}>{t('p360.resumen.completar')}</Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link to={`${base}/map`}>
            <MapaIcono aria-hidden className="size-4" />
            {t('p360.resumen.verMapa')}
          </Link>
        </Button>
        {registra && !activo ? registrar('secondary') : null}
        {registra && activo ? registrar('primary') : transiciones.primaria?.nodo}
      </div>
      {transiciones.confirmacion}
      {transiciones.dialogo}
    </div>
  )
}
