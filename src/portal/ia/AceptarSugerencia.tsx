import { useAuth, type ObjectDefinition } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useErroresDeCampo } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { RegistroVinculado, useRotuloDeRegistro } from '../componentes/RegistroVinculado'
import { campoDe, puedeEscribir, texto, useDefinicion, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useAceptarSugerencia } from './contrato'
import { personasCitadas, quedanMarcadores } from './marcadores'
import { camposQueFaltan, cuerpoDeAceptacion, filaDe, textosLibres, valoresIniciales, type ValoresRevisados } from './sugerencias'
import { nombresReales, TextoDeIa, useNombresDePersonas } from './TextoDeIa'

// S52 · aceptar una sugerencia (ai-architecture.md §4.2, decisiones 14 y 15 del plan): los valores que la persona revisa, nunca
// los guardados; cada texto libre sin marcadores; el motivo siempre. el duplicado se decide en su comparación (Tarea 8) y el
// borrador de acta en S25 (Tarea 11)
export function AceptarSugerencia({ sugerencia, alCerrar }: { sugerencia: Registro; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const fila = filaDe(sugerencia)
  const citadas = !fila ? [] : 'texto' in fila ? personasCitadas(fila.texto) : 'nombre' in fila ? personasCitadas(fila.nombre) : []
  const { nombres, listo } = useNombresDePersonas(citadas)
  if (!fila || fila.fila === 'resumen' || fila.fila === 'duplicado') return null
  const iniciales = listo ? valoresIniciales(fila, nombresReales(nombres)) : null
  if (!iniciales)
    return (
      <Drawer titulo={t('bandejaIa.aceptacion.titulo')} abierto alCerrar={alCerrar}>
        <Cargando />
      </Drawer>
    )
  return <Formulario sugerencia={sugerencia} iniciales={iniciales} alCerrar={alCerrar} />
}

// los errores del servidor que van junto a un control del formulario; los demás (state, record…) van en el aviso
const CAMPOS_DEL_FORMULARIO: readonly string[] = [
  'value',
  'topic',
  'clause_text',
  'name',
  'organization_type',
  'given_names',
  'surnames',
  'sex',
  'stakeholder_type',
  'minutes',
  'response',
  'reason'
]

// un valor de catálogo que la IA propuso fuera de la lista vigente se muestra igual, para que la persona lo vea y lo cambie
const conValor = (opciones: readonly string[], valor: string): readonly string[] => (valor && !opciones.includes(valor) ? [valor, ...opciones] : opciones)

function Formulario({ sugerencia, iniciales, alCerrar }: { sugerencia: Registro; iniciales: ValoresRevisados; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const aceptar = useAceptarSugerencia()
  const releer = useReleer()
  const erroresDeCampo = useErroresDeCampo()
  const [revisado, setV] = useState<ValoresRevisados>(iniciales)
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const definicion = useDefinicion(texto(sugerencia, 'target_object'))
  const delServidor = Object.fromEntries(Object.entries(erroresDeCampo(aceptar.error)).map(([c, x]) => [c.replace(/^attributes\./, ''), x]))
  // sin permiso para crear grupos de interés el control no se muestra, y el que la IA propuso tampoco se manda
  const v: ValoresRevisados =
    'tipoDeGrupo' in revisado && revisado.tipoDeGrupo !== null && !can('stakeholder', 'CREATE') ? { ...revisado, tipoDeGrupo: null } : revisado
  const faltan = camposQueFaltan(v)
  const conMarcadores = textosLibres(v).some(quedanMarcadores)
  // un actor persona nuevo lo acepta quien escribe sus nombres, restringidos (security.md §7.9)
  const sinNombres =
    v.fila === 'persona' &&
    !v.existente &&
    !(can('person', 'CREATE') && puedeEscribir(definicion.data, 'given_names') && puedeEscribir(definicion.data, 'surnames'))
  const error = (campo: string) => delServidor[campo] ?? (intentado && faltan.includes(campo) ? t('bandejaIa.aceptacion.obligatorio') : undefined)
  const cerrar = () => {
    aceptar.nuevaAccion()
    alCerrar()
  }
  const confirmar = () => {
    setIntentado(true)
    if (faltan.length > 0 || conMarcadores || sinNombres || !motivo.trim()) return
    aceptar.mutate({ sugerencia, atributos: cuerpoDeAceptacion(v), motivo: motivo.trim() }, { onSuccess: alCerrar })
  }
  return (
    <Drawer
      titulo={t('bandejaIa.aceptacion.titulo')}
      descripcion={t('bandejaIa.aceptacion.ayuda')}
      abierto
      alCerrar={cerrar}
      pie={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={aceptar.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={aceptar.isPending || sinNombres} aria-busy={aceptar.isPending}>
            {aceptar.isPending ? t('bandejaIa.aceptacion.aceptando') : t('bandejaIa.aceptacion.confirmar')}
          </Button>
        </>
      }
    >
      <CamposDeLaFila v={revisado} alCambiar={setV} definicion={definicion.data} error={error} />
      {sinNombres ? <Alert tone="notice">{t('bandejaIa.aceptacion.sinNombres')}</Alert> : null}
      {intentado && conMarcadores ? <Alert tone="warning">{t('ia.marcadores.quedan')}</Alert> : null}
      <Campo etiqueta={t('comun.motivoObligatorio')} error={delServidor.reason ?? (intentado && !motivo.trim() ? t('comun.motivoFalta') : undefined)}>
        {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
      </Campo>
      {aceptar.isError && !Object.keys(delServidor).some((c) => CAMPOS_DEL_FORMULARIO.includes(c)) ? (
        <AvisoDeConflicto
          error={aceptar.error}
          propios={{ STATE_MISMATCH: t('bandejaIa.aceptacion.errores.STATE_MISMATCH') }}
          releer={() => releer(['records', 'ai_suggestion'], ['record', 'ai_suggestion', sugerencia.id])}
          alRecargar={() => aceptar.reset()}
        />
      ) : null}
    </Drawer>
  )
}

// un registro elegido (lugar, tema, localidad): el actual con «Quitar», o el buscador
function Elegido({
  etiqueta,
  objeto,
  id,
  buscar,
  error,
  alElegir
}: {
  etiqueta: string
  objeto: string
  id: string
  buscar: string
  error?: string
  alElegir: (id: string) => void
}) {
  const { t } = useTranslation(NS)
  const rotulo = useRotuloDeRegistro()
  return (
    <div className="space-y-1">
      <p className="text-sg-body-sm font-medium">{etiqueta}</p>
      {id ? (
        <p className="text-sm">
          <RegistroVinculado objeto={objeto} id={id} />{' '}
          <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => alElegir('')}>
            {t('comun.quitar')}
          </button>
        </p>
      ) : (
        <BuscadorDeRegistro objeto={objeto} etiqueta={buscar} rotulo={rotulo} alElegir={(r) => alElegir(r.id)} invalido={Boolean(error)} />
      )}
      {error ? <p className="text-sg-caption text-sg-danger">{error}</p> : null}
    </div>
  )
}

function Grupo({
  tipo,
  opciones,
  error,
  alCambiar
}: {
  tipo: string | null
  opciones: readonly string[]
  error?: string
  alCambiar: (tipo: string | null) => void
}) {
  const { t } = useTranslation(NS)
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={tipo !== null} onChange={(e) => alCambiar(e.target.checked ? '' : null)} />
        {t('bandejaIa.aceptacion.grupo')}
      </label>
      {tipo !== null ? (
        <Campo etiqueta={t('bandejaIa.aceptacion.tipoDeGrupo')} error={error}>
          {(p) => <SelectNativo {...p} value={tipo} onChange={(e) => alCambiar(e.target.value)} opciones={conValor(opciones, tipo)} />}
        </Campo>
      ) : null}
    </div>
  )
}

function CamposDeLaFila({
  v,
  alCambiar,
  definicion,
  error
}: {
  v: ValoresRevisados
  alCambiar: (v: ValoresRevisados) => void
  definicion: ObjectDefinition | undefined
  error: (campo: string) => string | undefined
}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const conActor = v.fila === 'organizacion' || v.fila === 'persona'
  const deGrupo = useDefinicion(conActor ? 'stakeholder' : undefined)
  const opciones = (campo: string, de: ObjectDefinition | undefined = definicion) => campoDe(de, campo)?.enumOptions ?? []
  const etiqueta = (campo: string) => campoDe(definicion, campo)?.label ?? t(`bandejaIa.campos.${campo}`, { defaultValue: campo })
  const grupo =
    conActor && can('stakeholder', 'CREATE') ? (
      <Grupo
        tipo={v.tipoDeGrupo}
        opciones={opciones('stakeholder_type', deGrupo.data)}
        error={error('stakeholder_type')}
        alCambiar={(tipoDeGrupo) => alCambiar({ ...v, tipoDeGrupo })}
      />
    ) : null
  switch (v.fila) {
    case 'clasificacion':
      return v.campo === 'topic' ? (
        <Elegido
          etiqueta={etiqueta('topic')}
          objeto="topic"
          id={v.valor}
          buscar={t('bandejaIa.aceptacion.buscarTema')}
          error={error('value')}
          alElegir={(id) => alCambiar({ ...v, valor: id })}
        />
      ) : (
        <Campo etiqueta={etiqueta(v.campo)} error={error('value')}>
          {(p) => (
            <SelectNativo {...p} value={v.valor} onChange={(e) => alCambiar({ ...v, valor: e.target.value })} opciones={conValor(opciones(v.campo), v.valor)} />
          )}
        </Campo>
      )
    case 'lugar':
      return (
        <Elegido
          etiqueta={t(`bandejaIa.campos.${v.campo}`)}
          objeto={v.campo}
          id={v.valor}
          buscar={t('bandejaIa.aceptacion.buscarLugar')}
          error={error('value')}
          alElegir={(id) => alCambiar({ ...v, valor: id })}
        />
      )
    case 'tema':
      return (
        <Elegido
          etiqueta={t('bandejaIa.propuesta.tema')}
          objeto="topic"
          id={v.valor}
          buscar={t('bandejaIa.aceptacion.buscarTema')}
          error={error('topic')}
          alElegir={(id) => alCambiar({ ...v, valor: id })}
        />
      )
    case 'fecha':
      return (
        <Campo etiqueta={t(`bandejaIa.campos.${v.campo}`)} error={error('value')}>
          {(p) => <Input {...p} type="date" value={v.valor} onChange={(e) => alCambiar({ ...v, valor: e.target.value })} />}
        </Campo>
      )
    case 'clausula':
      return (
        <>
          <Campo etiqueta={t('bandejaIa.aceptacion.numero')}>
            {(p) => <Input {...p} value={v.numero} onChange={(e) => alCambiar({ ...v, numero: e.target.value })} />}
          </Campo>
          <Campo etiqueta={t('bandejaIa.aceptacion.texto')} error={error('clause_text')}>
            {(p) => <Textarea {...p} value={v.texto} maxLength={4000} onChange={(e) => alCambiar({ ...v, texto: e.target.value })} />}
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.creaCompromiso} onChange={(e) => alCambiar({ ...v, creaCompromiso: e.target.checked })} />
            {t('bandejaIa.aceptacion.creaCompromiso')}
          </label>
        </>
      )
    case 'organizacion':
      return (
        <>
          <Campo etiqueta={t('bandejaIa.aceptacion.nombre')} error={error('name')}>
            {(p) => <Input {...p} value={v.nombre} onChange={(e) => alCambiar({ ...v, nombre: e.target.value })} />}
          </Campo>
          <Campo etiqueta={t('bandejaIa.aceptacion.tipoDeOrganizacion')} error={error('organization_type')}>
            {(p) => (
              <SelectNativo
                {...p}
                value={v.tipo}
                onChange={(e) => alCambiar({ ...v, tipo: e.target.value })}
                opciones={conValor(opciones('organization_type'), v.tipo)}
              />
            )}
          </Campo>
          <Elegido
            etiqueta={t('bandejaIa.campos.locality')}
            objeto="locality"
            id={v.localidad}
            buscar={t('bandejaIa.aceptacion.buscarLocalidad')}
            alElegir={(id) => alCambiar({ ...v, localidad: id })}
          />
          {grupo}
        </>
      )
    case 'persona':
      return v.existente ? (
        <>
          <p className="text-sm">
            {t('bandejaIa.aceptacion.existente')} <TextoDeIa texto={`[PERSONA:${v.existente}]`} />
          </p>
          {grupo}
        </>
      ) : (
        <>
          <Campo etiqueta={t('bandejaIa.aceptacion.nombres')} error={error('given_names')}>
            {(p) => <Input {...p} value={v.nombres} onChange={(e) => alCambiar({ ...v, nombres: e.target.value })} />}
          </Campo>
          <Campo etiqueta={t('bandejaIa.aceptacion.apellidos')} error={error('surnames')}>
            {(p) => <Input {...p} value={v.apellidos} onChange={(e) => alCambiar({ ...v, apellidos: e.target.value })} />}
          </Campo>
          <Campo etiqueta={t('bandejaIa.aceptacion.sexo')} error={error('sex')}>
            {(p) => (
              <SelectNativo {...p} value={v.sexo} onChange={(e) => alCambiar({ ...v, sexo: e.target.value })} opciones={conValor(opciones('sex'), v.sexo)} />
            )}
          </Campo>
          <Elegido
            etiqueta={t('bandejaIa.campos.locality')}
            objeto="locality"
            id={v.localidad}
            buscar={t('bandejaIa.aceptacion.buscarLocalidad')}
            alElegir={(id) => alCambiar({ ...v, localidad: id })}
          />
          {grupo}
        </>
      )
    case 'borrador':
      return (
        <Campo etiqueta={t('borradorDeActa.texto')} error={error('minutes')}>
          {(p) => <Textarea {...p} className="min-h-[240px]" value={v.texto} onChange={(e) => alCambiar({ ...v, texto: e.target.value })} />}
        </Campo>
      )
    case 'duplicado':
      return null
  }
}
