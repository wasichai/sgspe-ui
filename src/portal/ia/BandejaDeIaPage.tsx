import { useQueries } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Campo, SelectNativo } from '../componentes/Campo'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { RevisionDeCandidato } from '../compromisos/Candidatos'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { usePedir } from '../datos/http'
import { atributo, texto, useTodosConTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useEstadoDeIa } from './contrato'
import { TarjetaDeCandidatoEnBandeja, TarjetaDeSugerencia } from './Propuesta'
import { enLaBandeja, ordenarPropuestas, type Propuesta } from './sugerencias'

// S52 · bandeja de revisión de IA (screens.md §13, ai-architecture.md §9.3, flujo 7): lo que la IA y las personas propusieron
// en el proyecto, en proposed, por confianza y fecha. una persona decide cada propuesta; no hay acciones masivas. aceptar no
// llama a un modelo, así que la bandeja funciona aunque la organización no tenga la IA activada (api.md §4.14)
type FiltroDeTipo = 'todos' | 'candidato' | 'EXTRACCION' | 'BORRADOR DE ACTA' | 'CLASIFICACION' | 'DUPLICADO'
const TIPOS: readonly FiltroDeTipo[] = ['todos', 'candidato', 'EXTRACCION', 'BORRADOR DE ACTA', 'CLASIFICACION', 'DUPLICADO']
type FiltroDeOrigen = 'todos' | 'ia' | 'persona'
const ORIGENES: readonly FiltroDeOrigen[] = ['todos', 'ia', 'persona']

function coincide(propuesta: Propuesta, tipo: FiltroDeTipo, origen: FiltroDeOrigen): boolean {
  const ia = propuesta.clase === 'sugerencia' || atributo(propuesta.registro, 'ai_generated') === true
  if ((origen === 'ia' && !ia) || (origen === 'persona' && ia)) return false
  if (tipo === 'todos') return true
  return tipo === 'candidato' ? propuesta.clase === 'candidato' : propuesta.clase === 'sugerencia' && texto(propuesta.registro, 'suggestion_kind') === tipo
}

// «no aparece una sugerencia cuyo destino la persona no pueda leer» (ai-architecture.md §9.3): se lee cada destino con la misma
// clave que useRegistro; un 403 o un 404 la saca de la bandeja. un actor nuevo no tiene destino que leer
function useDestinosLegibles(propuestas: readonly Propuesta[]) {
  const pedir = usePedir()
  const conDestino = propuestas.filter((p) => p.clase === 'sugerencia' && texto(p.registro, 'target_record_id'))
  const lecturas = useQueries({
    queries: conDestino.map((p) => {
      const objeto = texto(p.registro, 'target_object')
      const id = texto(p.registro, 'target_record_id')
      return { queryKey: ['record', objeto, id], queryFn: () => pedir<Registro>(`/objects/${objeto}/records/${id}`) }
    })
  })
  const ilegibles = new Set(conDestino.filter((_, i) => lecturas[i]?.isError).map((p) => p.registro.id))
  return { pendiente: lecturas.some((l) => l.isPending), legible: (p: Propuesta) => !ilegibles.has(p.registro.id) }
}

export function BandejaDeIaPage() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { can } = useAuth()
  const estado = useEstadoDeIa()
  const escribe = useEscribeEnProyecto(projectId)
  const leeSugerencias = can('ai_suggestion', 'READ')
  const leeCandidatos = can('commitment_candidate', 'READ')
  const sugerencias = useTodosConTope('ai_suggestion', { project: projectId, sort: 'created_at', dir: 'desc' }, leeSugerencias)
  const candidatos = useTodosConTope('commitment_candidate', { project: projectId, sort: 'created_at', dir: 'desc' }, leeCandidatos)
  const [tipo, setTipo] = useState<FiltroDeTipo>('todos')
  const [origen, setOrigen] = useState<FiltroDeOrigen>('todos')
  const [revisando, setRevisando] = useState<string | null>(null)
  const propuestas = ordenarPropuestas([
    ...(sugerencias.data ?? []).filter((s) => s.state === 'proposed' && enLaBandeja(s)).map((registro) => ({ clase: 'sugerencia' as const, registro })),
    ...(candidatos.data ?? []).filter((c) => c.state === 'proposed').map((registro) => ({ clase: 'candidato' as const, registro }))
  ])
  const destinos = useDestinosLegibles(propuestas)
  const visibles = propuestas.filter((p) => destinos.legible(p))
  const filtradas = visibles.filter((p) => coincide(p, tipo, origen))
  // una consulta apagada (sin permiso) queda pending para siempre: solo cuentan las que corren
  const cargando = (leeSugerencias && sugerencias.isPending) || (leeCandidatos && candidatos.isPending) || destinos.pendiente
  const fallida = [leeSugerencias ? sugerencias : null, leeCandidatos ? candidatos : null].find((c) => c?.isError && !c.data)
  const enRevision = (candidatos.data ?? []).find((c) => c.id === revisando)
  return (
    <section aria-label={t('bandejaIa.titulo')} className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-sg-h1 font-semibold">{t('bandejaIa.titulo')}</h1>
        <p className="text-sm text-sg-text-secondary">{t('bandejaIa.ayuda')}</p>
      </header>
      {estado.data && !estado.data.enabled ? <Alert tone="notice">{t('bandejaIa.sinIaOrganizacion')}</Alert> : null}
      {sugerencias.truncado || candidatos.truncado ? <Alert tone="warning">{t('bandejaIa.truncado', { n: numeroPe(propuestas.length) })}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Campo etiqueta={t('bandejaIa.filtros.tipo')}>
              {(p) => (
                <SelectNativo
                  {...p}
                  vacio={false}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as FiltroDeTipo)}
                  opciones={TIPOS.map((x) => ({ valor: x, etiqueta: x === 'todos' ? t('bandejaIa.filtros.todos') : t(`bandejaIa.tipos.${x}`) }))}
                />
              )}
            </Campo>
            <Campo etiqueta={t('bandejaIa.filtros.origen')}>
              {(p) => (
                <SelectNativo
                  {...p}
                  vacio={false}
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value as FiltroDeOrigen)}
                  opciones={ORIGENES.map((x) => ({ valor: x, etiqueta: t(`bandejaIa.filtros.${x}`) }))}
                />
              )}
            </Campo>
          </div>
          {cargando ? (
            <Cargando />
          ) : fallida ? (
            <FalloDeLectura error={fallida.error} alReintentar={() => void fallida.refetch()} />
          ) : visibles.length === 0 ? (
            <Vacio titulo={t('bandejaIa.vacio')} />
          ) : filtradas.length === 0 ? (
            <Vacio titulo={t('bandejaIa.vacioPorFiltros')} />
          ) : (
            <ul aria-label={t('bandejaIa.lista')} className="space-y-3">
              {filtradas.map((p) =>
                p.clase === 'sugerencia' ? (
                  <TarjetaDeSugerencia key={p.registro.id} sugerencia={p.registro} proyecto={projectId} />
                ) : (
                  <TarjetaDeCandidatoEnBandeja
                    key={p.registro.id}
                    candidato={p.registro}
                    alRevisar={escribe && can('commitment_candidate', 'UPDATE') ? () => setRevisando(p.registro.id) : undefined}
                  />
                )
              )}
            </ul>
          )}
        </div>
        <aside aria-label={t('bandejaIa.reglas.titulo')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
          <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('bandejaIa.reglas.titulo')}</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>{t('bandejaIa.reglas.unaPersona')}</li>
            <li>{t('bandejaIa.reglas.revisados')}</li>
            <li>{t('bandejaIa.reglas.motivo')}</li>
          </ul>
        </aside>
      </div>
      {enRevision ? <RevisionDeCandidato key={enRevision.id} candidato={enRevision} alCerrar={() => setRevisando(null)} /> : null}
    </section>
  )
}
