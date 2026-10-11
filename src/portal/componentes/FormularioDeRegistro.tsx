import { CORE_FIELD_TYPES, DynamicForm, toAttributes, toFormValues, type ObjectDefinition, type RecordPayload } from '@wasichai/core'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { esDeComando, esDerivado } from '../datos/derivados'
import { ZONA_DE_LIMA } from '../datos/fechas'
import { useActualizar, useCrear, useDefinicion, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { AvisoDeConflicto, useReleer } from './AvisoDeConflicto'
import { useErroresDeCampo } from './errores'
import { Cargando, ErrorDeCarga } from './Estados'

// el formulario de un registro armado desde la metadata del objeto (screens.md §2: el esquema Zod sale de
// /api/metadata/objects/**), con DynamicForm de @wasichai/core y React Hook Form. lo que SGSPE agrega: los derivados no
// se muestran ni se mandan (DerivedFieldsGuard), las geometrías van aparte (se editan en el mapa o por importación), las
// relaciones fijas (el proyecto, la comunidad de un sector) viajan ocultas y, al cambiar, va If-Match con la versión. un DATETIME
// se lee y se escribe en la hora de Lima (ZONA_DE_LIMA), no en la del navegador
export interface FormularioDeRegistroProps {
  objeto: string
  registro?: Registro
  // relaciones o valores fijos del alta: no se muestran
  fijos?: Record<string, unknown>
  // valores propuestos en el alta (la moneda PEN, el año en curso de Lima): se ven y se pueden cambiar. wasichai no aplica
  // defaultValue (UPS-15); al cambiar un registro no se usan
  iniciales?: Record<string, unknown>
  // los campos que se muestran, en su orden; sin la lista, todos los legibles
  campos?: readonly string[]
  motivo?: string
  alGuardar?: (registro: Registro) => void
  alCancelar?: () => void
}

// las ayudas propias del portal por campo (comun.ayudas.<objeto>.<campo>)
export type AyudasDeCampos = Partial<Record<string, string>>

export function prepararDefinicion(
  definicion: ObjectDefinition,
  objeto: string,
  fijos: Record<string, unknown>,
  campos?: readonly string[],
  ayudas: AyudasDeCampos = {}
): ObjectDefinition {
  const orden = (nombre: string) => (campos ? campos.indexOf(nombre) : 0)
  return {
    ...definicion,
    // el motivo de un objeto requiresReason lo pide la pantalla que abre el formulario (prop motivo) y viaja en X-Change-Reason
    // con useCrear y useActualizar: sin esto, DynamicForm de core 0.6.0 pediría un segundo «Motivo» y lo descartaríamos
    requiresReason: false,
    fields: definicion.fields
      .filter((f) => f.type !== 'GEOMETRY')
      .map((f) => {
        const oculto = esDerivado(objeto, f.name) || f.name in fijos || (campos !== undefined && !campos.includes(f.name))
        // un campo de solo comando (CAMPOS_DE_COMANDO) se ve, pero no se edita: viaja tal como se leyó. la descripción del modelo
        // es documentación (IDs de requisitos, códigos de error, nombres de campos y de estados, la fase): DynamicForm la dibujaría
        // bajo el control, así que se cambia por la ayuda propia del portal o no se muestra (humo F4, D3)
        return {
          ...f,
          description: ayudas[f.name] ?? null,
          visible: f.visible && !oculto,
          editable: f.editable && !esDerivado(objeto, f.name) && !esDeComando(objeto, f.name)
        }
      })
      .sort((a, b) => orden(a.name) - orden(b.name))
  }
}

// sin fijos, siempre el mismo objeto: uno nuevo por render desharía el useMemo de la definición preparada
const SIN_FIJOS: Record<string, unknown> = {}

const TIPOS_DEL_FORMULARIO = new Set<string>(CORE_FIELD_TYPES)
// dos valores del formulario son el mismo dato: null y vacío lo son, y un número igual a su texto (el input de un INTEGER)
const mismoValor = (a: unknown, b: unknown): boolean => {
  if ((a ?? null) === (b ?? null)) return true
  if (a === null || a === undefined || b === null || b === undefined) return false
  return typeof a === 'object' || typeof b === 'object' ? JSON.stringify(a) === JSON.stringify(b) : String(a) === String(b)
}

// lo que la persona cambió: los valores que difieren de los del registro con que se abrió el formulario (sus valores
// iniciales), normalizados como DynamicForm normaliza los suyos (toFormValues y toAttributes). lo no tocado no viaja como
// cambio, así que atributosDeEscritura lo toma del registro vigente: tras «Recargar», un campo que otra persona cambió y que
// esta no tocó conserva el valor nuevo en lugar de volver al viejo (re-revisión, N1). los DATETIME se normalizan
// en la hora de Lima, el mismo huso con que DynamicForm los dibuja y los manda
export function cambiosRespectoDe(definicion: ObjectDefinition, abierto: Registro, enviados: Record<string, unknown>): Record<string, unknown> {
  const campos = definicion.fields.filter((f) => TIPOS_DEL_FORMULARIO.has(f.type))
  const zona = { timeZone: ZONA_DE_LIMA }
  const iniciales = toAttributes(campos, toFormValues(campos, abierto.attributes, zona), zona)
  return Object.fromEntries(Object.entries(enviados).filter(([campo, valor]) => !mismoValor(valor, iniciales[campo])))
}

export function FormularioDeRegistro({
  objeto,
  registro,
  fijos = SIN_FIJOS,
  iniciales = SIN_FIJOS,
  campos,
  motivo,
  alGuardar,
  alCancelar
}: FormularioDeRegistroProps) {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion(objeto)
  // i18next arma un objeto nuevo en cada llamada con returnObjects: se memoriza para no deshacer el useMemo de la definición
  const ayudas = useMemo(() => t(`comun.ayudas.${objeto}`, { returnObjects: true, defaultValue: {} }) as AyudasDeCampos, [t, objeto])
  const crear = useCrear(objeto)
  const actualizar = useActualizar(objeto)
  const erroresDeCampo = useErroresDeCampo()
  const releer = useReleer()
  // el registro con que se abrió el formulario: DynamicForm toma de él sus valores iniciales y no los reinicia (ni tras
  // «Recargar» ni con un refetch), así que es la base para saber qué cambió la persona
  const abierto = useRef<Registro | undefined>(undefined)
  const preparada = useMemo(
    () => (definicion.data ? prepararDefinicion(definicion.data, objeto, fijos, campos, ayudas) : undefined),
    [definicion.data, objeto, fijos, campos, ayudas]
  )
  if (definicion.isPending) return <Cargando />
  if (definicion.isError || !preparada) return <ErrorDeCarga error={definicion.error} />
  const error = crear.error ?? actualizar.error
  // cada error que apunta a un campo del formulario se dice con su etiqueta («Etiqueta: texto») y se muestran todos, para
  // que la persona corrija de una vez; lo que no es de un campo (un objeto, `record`) va como mensaje del formulario
  const deCampo = Object.entries(erroresDeCampo(error))
    .map(([nombre, texto]) => [preparada.fields.find((f) => f.name === nombre)?.label, texto] as const)
    .filter(([etiqueta]) => etiqueta)
    .map(([etiqueta, texto]) => `${etiqueta}: ${texto}`)
  const base = registro ?? { id: '', createdAt: null, updatedAt: null, attributes: { ...iniciales, ...fijos } }
  abierto.current ??= registro
  const enviar = ({ attributes }: RecordPayload) => {
    if (registro) {
      const cambios = { ...cambiosRespectoDe(preparada, abierto.current ?? registro, attributes), ...fijos }
      actualizar.mutate({ registro, cambios, motivo }, { onSuccess: alGuardar })
    } else crear.mutate({ atributos: { ...attributes, ...fijos }, motivo }, { onSuccess: alGuardar })
  }
  // el error va en un aviso que se anuncia (role="alert"), no en el párrafo mudo de DynamicForm. un 412 ofrece «Recargar»:
  // relee el registro (la ficha lo lee con useRegistro, así que le llega al formulario con su updatedAt nuevo) y DynamicForm
  // no reinicia sus valores, así que lo escrito se conserva y el siguiente guardado lleva el If-Match nuevo
  return (
    <div className="space-y-3">
      {error ? (
        <AvisoDeConflicto
          error={error}
          releer={() => releer(['record', objeto, registro?.id])}
          alRecargar={() => actualizar.reset()}
          texto={deCampo.length > 0 ? deCampo.join('; ') : undefined}
        />
      ) : null}
      <DynamicForm
        definition={preparada}
        record={base}
        timeZone={ZONA_DE_LIMA}
        submitting={crear.isPending || actualizar.isPending}
        onSubmit={enviar}
        onCancel={alCancelar}
      />
    </div>
  )
}
