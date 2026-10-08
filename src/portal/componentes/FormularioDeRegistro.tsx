import { DynamicForm, type ObjectDefinition, type RecordPayload } from '@wasichai/core'
import { useMemo } from 'react'
import { esDerivado } from '../datos/derivados'
import { useActualizar, useCrear, useDefinicion, type Registro } from '../datos/registros'
import { useErroresDeCampo, useMensajeDeError } from './errores'
import { Cargando, ErrorDeCarga } from './Estados'

// el formulario de un registro armado desde la metadata del objeto (screens.md §2: el esquema Zod sale de
// /api/metadata/objects/**), con DynamicForm de @wasichai/core y React Hook Form. lo que SGSPE agrega: los derivados no
// se muestran ni se mandan (DerivedFieldsGuard), las geometrías van aparte (se editan en el mapa o por importación), las
// relaciones fijas (el proyecto, la comunidad de un sector) viajan ocultas y, al cambiar, va If-Match con la versión
export interface FormularioDeRegistroProps {
  objeto: string
  registro?: Registro
  // relaciones o valores fijos del alta: no se muestran
  fijos?: Record<string, unknown>
  // los campos que se muestran, en su orden; sin la lista, todos los legibles
  campos?: readonly string[]
  motivo?: string
  alGuardar?: (registro: Registro) => void
  alCancelar?: () => void
}

export function prepararDefinicion(definicion: ObjectDefinition, objeto: string, fijos: Record<string, unknown>, campos?: readonly string[]): ObjectDefinition {
  const orden = (nombre: string) => (campos ? campos.indexOf(nombre) : 0)
  return {
    ...definicion,
    fields: definicion.fields
      .filter((f) => f.type !== 'GEOMETRY')
      .map((f) => {
        const oculto = esDerivado(objeto, f.name) || f.name in fijos || (campos !== undefined && !campos.includes(f.name))
        return { ...f, visible: f.visible && !oculto, editable: f.editable && !esDerivado(objeto, f.name) }
      })
      .sort((a, b) => orden(a.name) - orden(b.name))
  }
}

export function FormularioDeRegistro({ objeto, registro, fijos = {}, campos, motivo, alGuardar, alCancelar }: FormularioDeRegistroProps) {
  const definicion = useDefinicion(objeto)
  const crear = useCrear(objeto)
  const actualizar = useActualizar(objeto)
  const mensaje = useMensajeDeError()
  const erroresDeCampo = useErroresDeCampo()
  const preparada = useMemo(
    () => (definicion.data ? prepararDefinicion(definicion.data, objeto, fijos, campos) : undefined),
    [definicion.data, objeto, fijos, campos]
  )
  if (definicion.isPending) return <Cargando />
  if (definicion.isError || !preparada) return <ErrorDeCarga error={definicion.error} />
  const error = crear.error ?? actualizar.error
  // el primer error que apunta a un campo del formulario se dice con su etiqueta; el resto (un objeto, `record`) va como
  // mensaje del formulario
  const campo = Object.entries(erroresDeCampo(error))
    .map(([nombre, texto]) => [preparada.fields.find((f) => f.name === nombre)?.label, texto] as const)
    .find(([etiqueta]) => etiqueta)
  const base = registro ?? { id: '', createdAt: null, updatedAt: null, attributes: fijos }
  const enviar = ({ attributes }: RecordPayload) => {
    const atributos = { ...attributes, ...fijos }
    if (registro) actualizar.mutate({ registro, cambios: atributos, motivo }, { onSuccess: alGuardar })
    else crear.mutate({ atributos, motivo }, { onSuccess: alGuardar })
  }
  return (
    <DynamicForm
      definition={preparada}
      record={base}
      submitting={crear.isPending || actualizar.isPending}
      error={error ? (campo ? `${campo[0]}: ${campo[1]}` : mensaje(error)) : null}
      onSubmit={enviar}
      onCancel={alCancelar}
    />
  )
}
