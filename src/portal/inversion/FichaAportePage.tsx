import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Tabs, Textarea } from '@wasichai/ui'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { BarraDelTope } from '../compromisos/BarraDelTope'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, esIlegible, NoEsDeSusProyectos } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { RegistrosSimples, type ColumnaSimple } from '../componentes/RegistrosSimples'
import { EnlaceDeFicha, RegistroVinculado } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { aDiezmilesimos } from '../datos/decimales'
import { APORTE_TERMINADO, enSolicitud, monedaDe, TERMINOS_APROBADOS, totalDeItems } from '../datos/inversion'
import { atributo, texto, usePuedeEditar, useRegistro, useRegistros, useTodosConTope, type Registro } from '../datos/registros'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { NS, numeroPe } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { AntesDeAprobar } from './AntesDeAprobar'
import { EntregaDelAporte } from './EntregaDelAporte'
import { opcion } from '../datos/opciones'

// S44 · aporte social (screens.md §10, WF-P, spec F5 §3.3): la anatomía de design-system.md §6.1 con las transiciones del rol (toda
// transición lleva motivo: requiresReason; aprobar, adquirir, entregar y cerrar se comprueban antes con transition-checks), «Para qué
// y para quién», los ítems con el total que se aprobará (decisión 1: solo en requested; el total es la suma de line_amount, como la
// juzga el servidor, elección 6), el tope de la campaña mientras se decide, «Editar» con motivo (fuera de requested, sin los términos
// que juzgó la aprobación, elección 7; terminado, nada), evidencias, actividad y de dónde viene. «Antes de aprobar» (P1 a P9) y la
// entrega (P8) se suman en esta ficha. un 404 no dice si no existe o no es de sus proyectos (spec 4.4 §3.6)
const EDITABLES = [
  'contribution_type',
  'topic',
  'occasion',
  'declared_purpose',
  'conditions',
  'currency',
  'beneficiaries_count',
  'payer_organization',
  'recipient_organization',
  'stakeholder',
  'locality',
  'festivity',
  'exploration_campaign',
  'commitment',
  'has_institutional_synergy',
  'agreement'
]
const COMPROBAR = ['approve', 'approve_direct', 'register_procurement', 'register_delivery', 'close']
const CAMPOS_DEL_ITEM = ['description', 'item_kind', 'quantity', 'unit', 'unit_cost', 'line_amount']

export function FichaAportePage() {
  const { t } = useTranslation(NS)
  const { projectId = '', contributionId = '' } = useParams()
  const aporte = useRegistro('social_contribution', contributionId)
  const noExiste = (
    <div className="space-y-3">
      <NoEsDeSusProyectos />
      <Link to={`/projects/${encodeURIComponent(projectId)}/programs`} className="text-sm text-sg-primary-text underline">
        {t('fichaAporte.volver')}
      </Link>
    </div>
  )
  // la ficha se monta de nuevo por aporte: pasar a otro no arrastra el drawer, el motivo ni la pestaña
  return (
    <Consulta consulta={aporte} noExiste={noExiste}>
      {(a) => <Ficha key={a.id} aporte={a} />}
    </Consulta>
  )
}

function Ficha({ aporte }: { aporte: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(aporte, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const puedeEditar = usePuedeEditar('social_contribution')
  const terminado = APORTE_TERMINADO.includes(aporte.state ?? '')
  const edita = puedeEditar && escribe && !terminado
  const solicitud = enSolicitud(aporte)
  const campos = solicitud ? EDITABLES : EDITABLES.filter((c) => !TERMINOS_APROBADOS.includes(c))
  const [editando, setEditando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const cerrar = () => {
    setEditando(false)
    setMotivo('')
  }
  const titulo = t('fichaAporte.titulo', { codigo: texto(aporte, 'code') })
  const pestanas: { id: string; label: string; render: () => ReactNode }[] = [
    { id: 'resumen', label: t('fichaAporte.pestanas.resumen'), render: () => <Resumen aporte={aporte} /> },
    { id: 'entrega', label: t('fichaAporte.pestanas.entrega'), render: () => <EntregaDelAporte aporte={aporte} escribe={escribe} /> },
    {
      id: 'evidencias',
      label: t('fichaAporte.pestanas.evidencias'),
      render: () => <EvidenciasDelRegistro objeto="social_contribution" registro={aporte} escribe={escribe} />
    },
    {
      id: 'actividad',
      label: t('fichaAporte.pestanas.actividad'),
      render: () => (
        <div className="pt-3">
          <Historia objeto="social_contribution" id={aporte.id} vacio={t('fichaAporte.sinActividad')} />
        </div>
      )
    }
  ]
  return (
    <article className="space-y-4">
      <Link to={`/projects/${encodeURIComponent(proyecto)}/programs`} className="text-sm text-sg-primary-text underline">
        {t('fichaAporte.volver')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">
            {[opcion(aporte, 'contribution_type'), texto(aporte, 'occasion')].filter(Boolean).join(' · ') || '—'}
          </p>
          <h1 className="text-sg-h1 font-semibold">{titulo}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <EstadoChip objeto="social_contribution" estado={aporte.state} />
            <span className="tabular-nums">{t('fichaAporte.total', { monto: montoPe(atributo(aporte, 'total_amount'), monedaDe(aporte)) })}</span>
            {texto(aporte, 'exploration_campaign') ? (
              <span>
                {t('fichaAporte.campana')}: <RegistroVinculado objeto="exploration_campaign" id={texto(aporte, 'exploration_campaign')} />
              </span>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          {edita ? (
            <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
              {t('fichaAporte.editar')}
            </Button>
          ) : null}
          <BotonesDeTransicion objeto="social_contribution" registro={aporte} proyecto={proyecto} comprobarAntes={COMPROBAR} />
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Tabs label={titulo} tabs={pestanas} />
        {/* en teléfono, «Antes de aprobar» sube antes de los ítems (screens.md S44, Responsive) */}
        <aside className="order-first space-y-4 lg:order-none">
          {solicitud ? <AntesDeAprobar aporte={aporte} escribe={escribe} /> : null}
          <Trazabilidad aporte={aporte} />
        </aside>
      </div>
      <Drawer
        titulo={t('fichaAporte.editarTitulo')}
        descripcion={solicitud ? undefined : t('fichaAporte.terminosCongelados')}
        abierto={editando}
        alCerrar={cerrar}
      >
        <Campo etiqueta={t('fichaAporte.motivo')} ayuda={t('fichaAporte.motivoAyuda')}>
          {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
        </Campo>
        {editando ? (
          <FormularioDeRegistro
            objeto="social_contribution"
            registro={aporte}
            campos={campos}
            motivo={motivo.trim() || undefined}
            alGuardar={cerrar}
            alCancelar={cerrar}
          />
        ) : null}
      </Drawer>
    </article>
  )
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sg-caption text-sg-text-muted">{termino}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  )
}

function Resumen({ aporte }: { aporte: Registro }) {
  return (
    <div className="space-y-4 pt-3 text-sm">
      <ParaQue aporte={aporte} />
      <ItemsDelAporte aporte={aporte} />
    </div>
  )
}

function ParaQue({ aporte }: { aporte: Registro }) {
  const { t } = useTranslation(NS)
  const valor = (campo: string) => texto(aporte, campo) || '—'
  const vinculo = (objeto: string, campo: string) => (texto(aporte, campo) ? <RegistroVinculado objeto={objeto} id={texto(aporte, campo)} /> : '—')
  const beneficiarios = atributo(aporte, 'beneficiaries_count')
  return (
    <section aria-label={t('fichaAporte.paraQue.titulo')} className="space-y-2">
      <h2 className="font-semibold">{t('fichaAporte.paraQue.titulo')}</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Dato termino={t('fichaAporte.paraQue.proposito')}>{valor('declared_purpose')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.ocasion')}>{valor('occasion')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.recibe')}>{vinculo('organization', 'recipient_organization')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.grupo')}>{vinculo('stakeholder', 'stakeholder')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.localidad')}>{vinculo('locality', 'locality')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.festividad')}>{vinculo('festivity', 'festivity')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.condiciones')}>{valor('conditions')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.beneficiarios')}>
          {beneficiarios === null || beneficiarios === undefined ? '—' : numeroPe(Number(beneficiarios))}
        </Dato>
        <Dato termino={t('fichaAporte.paraQue.pagador')}>{vinculo('organization', 'payer_organization')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.tema')}>{vinculo('topic', 'topic')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.sinergia')}>{atributo(aporte, 'has_institutional_synergy') === true ? t('comun.si') : t('comun.no')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.acuerdo')}>{vinculo('agreement', 'agreement')}</Dato>
        <Dato termino={t('fichaAporte.paraQue.compromiso')}>{vinculo('commitment', 'commitment')}</Dato>
        {texto(aporte, 'guideline_deviation_justification') ? (
          <Dato termino={t('fichaAporte.paraQue.justificacion')}>{valor('guideline_deviation_justification')}</Dato>
        ) : null}
      </dl>
    </section>
  )
}

// los ítems del aporte (decisión 1): se cargan, cambian y borran solo en requested; fuera de él la lista lo dice y no ofrece escribir
// (el servidor responde ITEMS_FROZEN igual). el total que se aprobará es la suma exacta de line_amount de los ítems leídos en la
// moneda del aporte; el derivado total_amount lo pone al día ContributionTotalsListener. escribir un ítem deja viejos el aporte (su
// total), su consulta en seco y su actividad
function ItemsDelAporte({ aporte }: { aporte: Registro }) {
  const { t } = useTranslation(NS)
  const cliente = useQueryClient()
  const filtros = useMemo(() => ({ social_contribution: aporte.id }), [aporte.id])
  const items = useTodosConTope('contribution_item', filtros)
  const moneda = monedaDe(aporte)
  const solicitud = enSolicitud(aporte)
  const suma = totalDeItems(items.data ?? [], moneda)
  // con un monto inválido la suma está incompleta (o es un cero que no es real): no se dice como total, se dicen los inválidos. con
  // la lectura cortada por el tope, tampoco: podría faltar algún ítem (como los beneficiarios de S43)
  const invalidos = suma.invalidos
  const total = invalidos > 0 || items.truncado ? null : suma.total
  const derivado = aDiezmilesimos(atributo(aporte, 'total_amount'))
  const columnas: ColumnaSimple[] = [
    { id: 'descripcion', encabezado: t('fichaAporte.items.columnas.descripcion'), celda: (r) => texto(r, 'description') },
    { id: 'tipo', encabezado: t('fichaAporte.items.columnas.tipo'), celda: (r) => opcion(r, 'item_kind') || '—' },
    {
      id: 'cantidad',
      encabezado: t('fichaAporte.items.columnas.cantidad'),
      celda: (r) => [texto(r, 'quantity'), texto(r, 'unit')].filter(Boolean).join(' ') || '—'
    },
    { id: 'costo', encabezado: t('fichaAporte.items.columnas.costo'), celda: (r) => montoPe(atributo(r, 'unit_cost'), moneda) },
    { id: 'monto', encabezado: t('fichaAporte.items.columnas.monto'), celda: (r) => montoPe(atributo(r, 'line_amount'), moneda) }
  ]
  const alCambiar = () => {
    for (const queryKey of [
      ['record', 'social_contribution', aporte.id],
      ['transition-check', 'social_contribution', aporte.id],
      ['history', 'social_contribution', aporte.id]
    ])
      void cliente.invalidateQueries({ queryKey })
  }
  return (
    <div className="space-y-2">
      <RegistrosSimples
        objeto="contribution_item"
        titulo={t('fichaAporte.items.titulo')}
        filtros={filtros}
        fijos={filtros}
        columnas={columnas}
        campos={CAMPOS_DEL_ITEM}
        proyecto={texto(aporte, 'project')}
        textoNuevo={t('fichaAporte.items.nuevo')}
        textoVacio={t('fichaAporte.items.vacio')}
        congelado={solicitud ? undefined : t('fichaAporte.items.congelados')}
        mensajesAlBorrar={{ ITEMS_FROZEN: t('fichaAporte.items.congeladosAlBorrar') }}
        alCambiar={alCambiar}
      />
      {items.data && total !== null ? (
        <p className="font-medium tabular-nums">
          {t(solicitud ? 'fichaAporte.items.seAprobara' : 'fichaAporte.items.aprobado', { monto: montoPe(total, moneda) })}
        </p>
      ) : null}
      {invalidos > 0 ? <Alert tone="warning">{t('fichaAporte.items.invalidos')}</Alert> : null}
      {items.truncado ? <Alert tone="warning">{t('fichaAporte.items.truncados')}</Alert> : null}
      {solicitud && total !== null && derivado !== null && derivado !== aDiezmilesimos(total) ? (
        <p className="text-sg-caption text-sg-text-muted">{t('fichaAporte.items.actualizando')}</p>
      ) : null}
      {/* con un monto ilegible o la lista cortada el tope no se dibuja: diría «Este aporte S/ 0.00» y un «Queda» inflado; la alerta dice por qué */}
      {solicitud && texto(aporte, 'exploration_campaign') && items.data && invalidos === 0 && !items.truncado ? (
        <TopeDeLaCampana aporte={aporte} total={total} />
      ) : null}
    </div>
  )
}

// mientras el aporte se decide, lo aprobado en la campaña, este aporte y lo que queda (P1). la campaña que la cuenta no lee no se
// dibuja: su vínculo ya dice «Registro reservado» en el encabezado
function TopeDeLaCampana({ aporte, total }: { aporte: Registro; total: string | null }) {
  const campana = useRegistro('exploration_campaign', texto(aporte, 'exploration_campaign'))
  if (campana.isPending) return <Cargando compacto />
  if (campana.isError && !campana.data)
    return esIlegible(campana.error) ? null : <FalloDeLectura error={campana.error} alReintentar={() => void campana.refetch()} />
  if (!campana.data) return null
  return <BarraDelTope campana={campana.data} monto={total} moneda={monedaDe(aporte)} excluir={aporte.id} de="aporte" />
}

// de dónde viene el aporte: la solicitud aceptada que lo creó (created_contribution). una QCS que la cuenta no lee no la trae la
// lista (alcance y confidencialidad), así que solo se dice que no nace de una solicitud que la cuenta lea
function Trazabilidad({ aporte }: { aporte: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const leeSolicitudes = can('stakeholder_request', 'READ')
  const solicitudes = useRegistros('stakeholder_request', { created_contribution: aporte.id, size: 1 }, leeSolicitudes)
  const solicitud = solicitudes.data?.content[0]
  return (
    <section aria-label={t('fichaAporte.trazabilidad.titulo')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('fichaAporte.trazabilidad.titulo')}</h2>
      {leeSolicitudes ? (
        // un div, no un <p>: «Cargando» y el aviso de fallo ya son párrafos o bloques
        <div>
          {t('fichaAporte.trazabilidad.solicitud')}:{' '}
          {solicitudes.isPending ? (
            <Cargando compacto />
          ) : solicitudes.isError && !solicitudes.data ? (
            <FalloDeLectura error={solicitudes.error} alReintentar={() => void solicitudes.refetch()} />
          ) : solicitud ? (
            <EnlaceDeFicha objeto="stakeholder_request" registro={solicitud}>
              {texto(solicitud, 'code')}
            </EnlaceDeFicha>
          ) : (
            t('fichaAporte.trazabilidad.sinSolicitud')
          )}
        </div>
      ) : null}
    </section>
  )
}
