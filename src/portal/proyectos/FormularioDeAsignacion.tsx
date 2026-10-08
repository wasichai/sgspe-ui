import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Input } from '@wasichai/ui'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Campo, CONTROL, SelectNativo } from '../componentes/Campo'
import { useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { useCrear } from '../datos/registros'
import { NS } from '../i18n'
import { useNombresDeRol, useUsuarios } from './usuarios'

// una asignación al proyecto (RF-PRJ-005): usuario, rol y vigencia. es la fuente del alcance de escritura
// (ProjectScopeGuard) y de la jefatura (ASM-080). active va siempre en el alta: wasichai no aplica el defaultValue (UPS-15)
const esquema = z
  .object({
    member_user_id: z.guid(),
    member_user_email: z.email(),
    role_name: z.string().trim().min(1),
    start_date: z.string(),
    end_date: z.string()
  })
  .refine((v) => !v.start_date || !v.end_date || v.start_date <= v.end_date, { path: ['end_date'] })

type Valores = z.infer<typeof esquema>
const CAMPOS: readonly string[] = ['member_user_id', 'member_user_email', 'role_name', 'start_date', 'end_date']

export function FormularioDeAsignacion({ proyecto, alGuardar }: { proyecto: string; alGuardar?: () => void }) {
  const { t } = useTranslation(NS)
  const usuarios = useUsuarios()
  const roles = useNombresDeRol()
  const crear = useCrear('project_assignment')
  const mensaje = useMensajeDeError()
  const erroresDeCampo = useErroresDeCampo()
  const { register, handleSubmit, setValue, watch, formState, reset, setError } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { member_user_id: '', member_user_email: '', role_name: '', start_date: '', end_date: '' }
  })
  const usuarioElegido = watch('member_user_id')
  // un error de campo ya está junto a su control: el aviso al pie es para lo que no cae en un campo
  const camposConError = Object.keys(erroresDeCampo(crear.error))
  const avisoAlPie = crear.isError && (camposConError.length === 0 || camposConError.some((c) => !CAMPOS.includes(c)))
  const error = (campo: keyof Valores) => {
    const e = formState.errors[campo]
    return e ? (e.type === 'manual' ? e.message : t('p360.asignacion.invalido')) : undefined
  }

  const enviar = handleSubmit((valores) =>
    crear.mutate(
      { atributos: { ...valores, project: proyecto, active: true } },
      {
        onSuccess: () => {
          reset()
          alGuardar?.()
        },
        onError: (e) => {
          for (const [campo, texto] of Object.entries(erroresDeCampo(e)))
            if (campo in valores) setError(campo as keyof Valores, { type: 'manual', message: texto })
        }
      }
    )
  )

  // mientras se averigua si la cuenta lee el directorio no se muestra el modo manual para que luego salte a la lista
  if (usuarios.isPending || roles.isPending) return <Cargando />

  return (
    <form onSubmit={enviar} className="space-y-3" aria-label={t('p360.asignacion.titulo')}>
      {usuarios.data ? (
        <Campo etiqueta={t('p360.asignacion.usuario')} error={error('member_user_id') ?? error('member_user_email')}>
          {(props) => (
            <select
              {...props}
              className={CONTROL}
              value={usuarioElegido}
              onChange={(e) => {
                const u = usuarios.data?.find((x) => x.id === e.target.value)
                setValue('member_user_id', u?.id ?? '', { shouldValidate: true })
                setValue('member_user_email', u?.email ?? '', { shouldValidate: true })
              }}
            >
              <option value="">{t('comun.seleccionar')}</option>
              {usuarios.data
                ?.filter((u) => u.enabled)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
            </select>
          )}
        </Campo>
      ) : (
        <>
          <p className="text-sg-caption text-sg-text-muted">{t('p360.asignacion.aMano')}</p>
          <Campo etiqueta={t('p360.asignacion.correo')} error={error('member_user_email')}>
            {(props) => <Input {...props} type="email" {...register('member_user_email')} />}
          </Campo>
          <Campo etiqueta={t('p360.asignacion.idUsuario')} error={error('member_user_id')}>
            {(props) => <Input {...props} {...register('member_user_id')} />}
          </Campo>
        </>
      )}
      <Campo etiqueta={t('p360.asignacion.rol')} error={error('role_name')}>
        {(props) =>
          roles.data ? (
            <SelectNativo {...props} opciones={roles.data.map((r) => ({ valor: r.name, etiqueta: r.label }))} {...register('role_name')} />
          ) : (
            <Input {...props} {...register('role_name')} />
          )
        }
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={t('p360.asignacion.desde')}>{(props) => <Input {...props} type="date" {...register('start_date')} />}</Campo>
        <Campo etiqueta={t('p360.asignacion.hasta')} error={error('end_date')}>
          {(props) => <Input {...props} type="date" {...register('end_date')} />}
        </Campo>
      </div>
      {avisoAlPie ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
      <Button type="submit" disabled={crear.isPending}>
        {crear.isPending ? t('comun.guardando') : t('p360.asignacion.asignar')}
      </Button>
    </form>
  )
}
