import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { CaminoDelFlujo } from '../componentes/CaminoDelFlujo'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useMigaDelRegistro } from '../componentes/Migas'
import { CabeceraDeFicha, tituloQueDiceQueEs } from '../componentes/CabeceraDeFicha'
import { CamposPlegables, type CampoDeFicha } from '../componentes/CamposPlegables'
import { Seccion } from '../componentes/Seccion'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { PanelDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { PestanasDeFicha, type PestanaDeFicha } from '../componentes/PestanasDeFicha'
import { rutaDeFicha } from '../datos/fichas'
import { useEvidenciasDe, useNombreDeEvidencia } from '../documentos/api'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Textarea } from '@wasichai/ui'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { BarraDelTope } from '../compromisos/BarraDelTope'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { Cargando, Consulta, esIlegible, NoEsDeSusProyectos } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { RegistrosSimples, type ColumnaSimple } from '../componentes/RegistrosSimples'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { aDiezmilesimos } from '../datos/decimales'
import { APORTE_TERMINADO, enSolicitud, monedaDe, TERMINOS_APROBADOS, totalDeItems } from '../datos/inversion'
import { atributo, texto, usePuedeEditar, useRegistro, useRegistros, useTodosConTope, type Registro } from '../datos/registros'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { NS, numeroPe } from '../i18n'
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
// el camino de WF-P sin sus excepciones (rechazar, cancelar); un estado fuera de él se agrega
const CAMINO = ['requested', 'approved', 'procured', 'delivered', 'closed']
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
  // la anatomía de design-system.md §6.1 (revisión de UX, etapa 4): migas con el código, encabezado, camino del flujo, panel de
  // decisión, pestañas con conteo y trazabilidad en tres grupos
  useMigaDelRegistro(texto(aporte, 'code'))
  const siguiente = useSiguienteAccion('social_contribution', aporte, COMPROBAR)
  const evidencias = useEvidenciasDe('social_contribution', aporte.id)
  const pestanas: PestanaDeFicha[] = [
    { id: 'resumen', etiqueta: t('fichaAporte.pestanas.resumen'), render: () => <Resumen aporte={aporte} /> },
    { id: 'entrega', etiqueta: t('fichaAporte.pestanas.entrega'), render: () => <EntregaDelAporte aporte={aporte} escribe={escribe} /> },
    {
      id: 'evidencias',
      etiqueta: t('fichaAporte.pestanas.evidencias'),
      conteo: evidencias.data?.totalElements ?? null,
      render: () => <EvidenciasDelRegistro objeto="social_contribution" registro={aporte} escribe={escribe} />
    },
    {
      id: 'actividad',
      etiqueta: t('fichaAporte.pestanas.actividad'),
      render: () => (
        <div className="pt-3">
          <Historia objeto="social_contribution" id={aporte.id} vacio={t('fichaAporte.sinActividad')} />
        </div>
      )
    }
  ]
  return (
    <article className="space-y-4">
      <CabeceraDeFicha
        antetitulo={[t('fichaAporte.tipo'), texto(aporte, 'code'), opcion(aporte, 'contribution_type'), texto(aporte, 'occasion')].filter(Boolean).join(' · ')}
        titulo={tituloQueDiceQueEs(texto(aporte, 'declared_purpose'), titulo)}
        tituloDelDocumento={titulo}
        chips={<span className="tabular-nums">{t('fichaAporte.total', { monto: montoPe(atributo(aporte, 'total_amount'), monedaDe(aporte)) })}</span>}
        objeto="social_contribution"
        registro={aporte}
        proyecto={proyecto}
        comprobarAntes={COMPROBAR}
        falta={siguiente?.falta}
        secundarias={
          edita
            ? [
                {
                  clave: 'editar',
                  nodo: (
                    <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                      {t('fichaAporte.editar')}
                    </Button>
                  )
                }
              ]
            : []
        }
      />
      <CaminoDelFlujo objeto="social_contribution" estado={aporte.state} camino={CAMINO} />
      <PanelDeDecision
        objeto="social_contribution"
        estado={aporte.state}
        desde={texto(aporte, 'state_changed_at') || null}
        por={texto(aporte, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={texto(aporte, 'owner_user_email') || null}
        vencimiento={null}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PestanasDeFicha etiqueta={titulo} pestanas={pestanas} />
        {/* en teléfono, «Antes de aprobar» sube antes de los ítems (screens.md S44, Responsive) */}
        <aside className="order-first space-y-4 lg:order-none">
          {solicitud ? <AntesDeAprobar aporte={aporte} escribe={escribe} /> : null}
          <Trazabilidad aporte={aporte} evidencias={evidencias.data?.content ?? []} />
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

function Resumen({ aporte }: { aporte: Registro }) {
  return (
    <div className="space-y-4 pt-3 text-sm">
      <ParaQue aporte={aporte} />
      <ItemsDelAporte aporte={aporte} />
    </div>
  )
}

// para qué y para quién (DD-06 y U-26 del rediseño de UX): primero a quién llega y para qué; después cómo se financia y a qué se
// vincula. cada sección pliega sus campos sin dato
function ParaQue({ aporte }: { aporte: Registro }) {
  const { t } = useTranslation(NS)
  const vinculo = (objeto: string, campo: string) => (texto(aporte, campo) ? <RegistroVinculado objeto={objeto} id={texto(aporte, campo)} /> : null)
  const beneficiarios = atributo(aporte, 'beneficiaries_count')
  const sinergia = atributo(aporte, 'has_institutional_synergy')
  const campo = (clave: string, valor: ReactNode, ancho = false): CampoDeFicha => ({ clave, termino: t(`fichaAporte.paraQue.${clave}`), valor, ancho })
  return (
    <>
      <Seccion titulo={t('fichaAporte.paraQue.titulo')}>
        <CamposPlegables
          campos={[
            campo('proposito', texto(aporte, 'declared_purpose'), true),
            campo('ocasion', texto(aporte, 'occasion')),
            campo('beneficiarios', beneficiarios === null || beneficiarios === undefined ? null : numeroPe(Number(beneficiarios))),
            campo('recibe', vinculo('organization', 'recipient_organization')),
            campo('grupo', vinculo('stakeholder', 'stakeholder')),
            campo('localidad', vinculo('locality', 'locality')),
            campo('festividad', vinculo('festivity', 'festivity')),
            campo('condiciones', texto(aporte, 'conditions'), true)
          ]}
        />
      </Seccion>
      <Seccion titulo={t('fichaAporte.paraQue.financiacion')}>
        <CamposPlegables
          campos={[
            campo('pagador', vinculo('organization', 'payer_organization')),
            campo('tema', vinculo('topic', 'topic')),
            campo('sinergia', sinergia === true ? t('comun.si') : sinergia === false ? t('comun.no') : null),
            campo('acuerdo', vinculo('agreement', 'agreement')),
            campo('compromiso', vinculo('commitment', 'commitment')),
            ...(texto(aporte, 'guideline_deviation_justification') ? [campo('justificacion', texto(aporte, 'guideline_deviation_justification'), true)] : [])
          ]}
        />
      </Seccion>
    </>
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
// la trazabilidad con los grupos fijos (revisión de UX, etapa 4): de dónde viene (la solicitud de origen, el acuerdo, el compromiso
// y la campaña) y lo que lo sustenta (sus evidencias)
function Trazabilidad({ aporte, evidencias }: { aporte: Registro; evidencias: Registro[] }) {
  // una evidencia que lo sustenta se abre en la vista previa, sobre la ficha (revisión de UX, etapa 6)
  const previa = useRutaDeVistaPrevia()
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const leeSolicitudes = can('stakeholder_request', 'READ')
  const solicitudes = useRegistros('stakeholder_request', { created_contribution: aporte.id, size: 1 }, leeSolicitudes)
  const solicitud = solicitudes.data?.content[0]
  const nombreDeEvidencia = useNombreDeEvidencia()
  const vinculo = (campo: string, objeto: string, titulo: string) => ({
    clave: campo,
    titulo,
    contenido: texto(aporte, campo) ? <RegistroVinculado objeto={objeto} id={texto(aporte, campo)} /> : null
  })
  return (
    <PanelDeTrazabilidad
      deDondeViene={[
        {
          clave: 'solicitud',
          titulo: t('fichaAporte.trazabilidad.solicitud'),
          // un div, no un <p>: «Cargando» y el aviso de fallo ya son párrafos o bloques
          contenido: !leeSolicitudes ? null : solicitudes.isPending ? (
            <div>
              <Cargando compacto />
            </div>
          ) : solicitudes.isError && !solicitudes.data ? (
            <FalloDeLectura error={solicitudes.error} alReintentar={() => void solicitudes.refetch()} />
          ) : solicitud ? (
            <EnlaceDeRegistro titulo={texto(solicitud, 'code')} ruta={rutaDeFicha('stakeholder_request', solicitud)} />
          ) : null
        },
        vinculo('agreement', 'agreement', t('fichaAporte.trazabilidad.acuerdo')),
        vinculo('commitment', 'commitment', t('fichaAporte.trazabilidad.compromiso')),
        vinculo('exploration_campaign', 'exploration_campaign', t('fichaAporte.campana'))
      ]}
      vacios={{ deDondeViene: t('fichaAporte.trazabilidad.sinSolicitud') }}
      loSustenta={[
        {
          clave: 'evidencias',
          titulo: t('fichaAporte.pestanas.evidencias'),
          contenido: evidencias.length ? (
            <ul>
              {evidencias.map((e) => (
                <li key={e.id}>
                  <EnlaceDeRegistro titulo={nombreDeEvidencia(e)} ruta={previa('evidence', e.id)} />
                </li>
              ))}
            </ul>
          ) : null
        }
      ]}
    />
  )
}
