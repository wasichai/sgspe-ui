import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Drawer } from '../componentes/Drawer'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { nombreDe } from '../componentes/NombreDeActor'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'

// flujo 3 · registrar grupo de interés: buscar antes de crear (un actor por persona u organización en el tenant), crear el
// actor solo si no existe y después el grupo de interés del proyecto, que nace identified
type Tipo = 'organization' | 'person'
const CAMPOS_DEL_GRUPO = [
  'stakeholder_type',
  'stakeholder_scope',
  'inclusion_reason',
  'interview_status',
  'relationship_status',
  'owner_user_id',
  'owner_user_email',
  'locality',
  'area_of_influence'
] as const

export function NuevoGrupo({ proyecto, abierto, alCerrar }: { proyecto: string; abierto: boolean; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const navegar = useNavigate()
  const [tipo, setTipo] = useState<Tipo>('organization')
  const [actor, setActor] = useState<Registro | null>(null)
  const [creandoActor, setCreandoActor] = useState(false)
  // el mismo objeto entre renders: uno nuevo por render desharía la definición preparada del formulario
  const fijos = useMemo(() => (actor ? { project: proyecto, [tipo]: actor.id } : undefined), [actor, proyecto, tipo])
  const rotulo = (r: Registro) => nombreDe(r, tipo, t('comun.personaRegistrada'))
  const cerrar = () => {
    setActor(null)
    setCreandoActor(false)
    alCerrar()
  }
  return (
    <Drawer titulo={t('grupos.nuevo')} abierto={abierto} alCerrar={cerrar}>
      {!actor ? (
        <section className="space-y-3" aria-label={t('grupos.nuevoGrupo.buscar')}>
          <h3 className="font-medium">{t('grupos.nuevoGrupo.buscar')}</h3>
          <div role="radiogroup" className="flex gap-4 text-sm">
            {(['organization', 'person'] as const).map((x) => (
              <label key={x} className="flex items-center gap-1">
                <input type="radio" name="tipo-de-actor" checked={tipo === x} onChange={() => setTipo(x)} />
                {x === 'organization' ? t('grupos.nuevoGrupo.organizacion') : t('grupos.nuevoGrupo.persona')}
              </label>
            ))}
          </div>
          {creandoActor ? (
            <FormularioDeRegistro objeto={tipo} alGuardar={setActor} alCancelar={() => setCreandoActor(false)} />
          ) : (
            <>
              <BuscadorDeRegistro objeto={tipo} etiqueta={t('grupos.nuevoGrupo.buscar')} rotulo={rotulo} alElegir={setActor} />
              <button type="button" className="text-sm text-sg-primary-text underline" onClick={() => setCreandoActor(true)}>
                {t('grupos.nuevoGrupo.crearActor', { tipo: tipo === 'organization' ? t('grupos.nuevoGrupo.organizacion') : t('grupos.nuevoGrupo.persona') })}
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="space-y-3" aria-label={t('grupos.nuevoGrupo.datos')}>
          <p className="text-sm">{t('grupos.nuevoGrupo.elegido', { nombre: rotulo(actor) })}</p>
          <FormularioDeRegistro
            objeto="stakeholder"
            fijos={fijos}
            campos={CAMPOS_DEL_GRUPO}
            alGuardar={(g) => {
              cerrar()
              navegar(`/projects/${encodeURIComponent(proyecto)}/stakeholders/${encodeURIComponent(g.id)}`)
            }}
            alCancelar={cerrar}
          />
        </section>
      )}
    </Drawer>
  )
}
