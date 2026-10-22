import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Input } from '@wasichai/ui'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Campo, CONTROL, SelectNativo } from '../componentes/Campo'
import { CampoFecha } from '../componentes/CampoFecha'
import { useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { useCrear } from '../datos/registros'
import { NS } from '../i18n'
import { useNombresDeRol, useUsuarios } from './usuarios'

// una asignación al proyecto (RF-PRJ-005): usuario, rol y vigencia. es la fuente del alcance de escritura
// (ProjectScopeGuard) y de la jefatura (ASM-080). active va siempre en el alta: wasichai no aplica el defaultValue (UPS-15)
const campos = z.object({
  member_user_id: z.guid(),
  member_user_email: z.email(),
  role_name: z.string().trim().min(1),
  start_date: z.string(),
  end_date: z.string()
})
const fechasEnOrden = (v: { start_date: string; end_date: string }) => !v.start_date || !v.end_date || v.start_date <= v.end_date
const esquema = campos.refine(fechasEnOrden, { path: ['end_date'] })
// la asignación propia (P40): el usuario es la cuenta de la sesión, que no se teclea ni se valida aquí
const esquemaPropio = campos.extend({ member_user_id: z.string().min(1), member_user_email: z.string().min(1) }).refine(fechasEnOrden, { path: ['end_date'] })

type Valores = z.infer<typeof esquema>
const CAMPOS: readonly string[] = ['member_user_id', 'member_user_email', 'role_name', 'start_date', 'end_date']

// propia: la cuenta se asigna a sí misma (P40, el alta de S07): solo elige su rol, de la lista si lee los roles o tecleado,
// y la vigencia empieza hoy (sin fechas), para que dé escritura enseguida
export function FormularioDeAsignacion({ proyecto, alGuardar, propia = false }: { proyecto: string; alGuardar?: () => void; propia?: boolean }) {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const usuarios = useUsuarios(!propia)
  const roles = useNombresDeRol()
  const crear = useCrear('project_assignment')
  const mensaje = useMensajeDeError()
  const erroresDeCampo = useErroresDeCampo()
  const { register, handleSubmit, setValue, watch, formState, reset, setError, control } = useForm<Valores>({
    resolver: zodResolver(propia ? esquemaPropio : esquema),
    defaultValues: {
      member_user_id: propia ? (user?.id ?? '') : '',
      member_user_email: propia ? (user?.email ?? '') : '',
      role_name: '',
      start_date: '',
      end_date: ''
    }
  })
  const usuarioElegido = watch('member_user_id')
  // un error de campo ya está junto a su control: el aviso al pie es para lo que no cae en un campo
  // en la asignación propia el usuario y las fechas no se muestran: un error sobre ellos (USER_REFERENCE…) va al pie, no a un
  // campo oculto donde nadie lo vería (re-revisión, menor 2)
  const visibles = propia ? ['role_name'] : CAMPOS
  const camposConError = Object.keys(erroresDeCampo(crear.error))
  const avisoAlPie = crear.isError && (camposConError.length === 0 || camposConError.some((c) => !visibles.includes(c)))
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
            if (visibles.includes(campo)) setError(campo as keyof Valores, { type: 'manual', message: texto })
        }
      }
    )
  )

  // mientras se averigua si la cuenta lee el directorio no se muestra el modo manual para que luego salte a la lista
  if ((!propia && usuarios.isPending) || roles.isPending) return <Cargando />

  return (
    <form onSubmit={enviar} className="space-y-3" aria-label={t(propia ? 'p360.asignacion.asignarme' : 'p360.asignacion.titulo')}>
      {propia ? null : usuarios.data ? (
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
      {propia ? null : (
        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="start_date"
            render={({ field }) => (
              <CampoFecha
                etiqueta={t('p360.asignacion.desde')}
                error={error('start_date')}
                valor={field.value || null}
                alCambiar={(v) => field.onChange(v ?? '')}
              />
            )}
          />
          <Controller
            control={control}
            name="end_date"
            render={({ field }) => (
              <CampoFecha
                etiqueta={t('p360.asignacion.hasta')}
                error={error('end_date')}
                valor={field.value || null}
                alCambiar={(v) => field.onChange(v ?? '')}
              />
            )}
          />
        </div>
      )}
      {avisoAlPie ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
      <Button type="submit" disabled={crear.isPending}>
        {crear.isPending ? t('comun.guardando') : t(propia ? 'p360.asignacion.asignarme' : 'p360.asignacion.asignar')}
      </Button>
    </form>
  )
}
