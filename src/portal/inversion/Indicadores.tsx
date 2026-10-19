import { useAuth } from '@wasichai/core'
import { Button, Table, Td, Th } from '@wasichai/ui'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { Cargando, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { RegistrosSimples, type ColumnaSimple } from '../componentes/RegistrosSimples'
import { atributo, texto, useRegistros, useTodos, useTodosConTope, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { Dia } from '../componentes/Dia'

// los indicadores de un programa (screens.md S43, spec F5 §3.6, GAP-032): línea base, meta y la última medición (la más reciente por
// period_start_date); un indicador sin mediciones se marca. «Registrar medición» elige el indicador y crea la medición; las
// mediciones son appendOnly (RQ-AUD-003): se ven en su historial sin «Editar» ni «Borrar», y un periodo repetido lo rechaza el
// único del modelo. un indicador con mediciones no se borra: wasichai responde 409 sin código (AppendOnlyReferences), que la ficha
// dice con su texto
const CAMPOS_DEL_INDICADOR = ['name', 'definition', 'unit', 'baseline_value', 'target_value', 'frequency']
const CAMPOS_DE_LA_MEDICION = ['period_start_date', 'period_end_date', 'measured_value', 'notes']

// un valor DECIMAL de un indicador (no es dinero: NOT_MONEY, elección 11) con números es-PE; sin valor, la raya
const valorDe = (valor: unknown): string => {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : NaN
  return Number.isFinite(n) ? numeroPe(n) : '—'
}

export function Indicadores({ programa, escribe }: { programa: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const filtros = useMemo(() => ({ social_program: programa.id }), [programa.id])
  const indicadores = useTodosConTope('program_indicator', filtros)
  const [midiendo, setMidiendo] = useState(false)
  const [historial, setHistorial] = useState<Registro | null>(null)
  const lista = indicadores.data ?? []
  const mide = escribe && can('program_measurement', 'CREATE') && lista.length > 0
  const columnas: ColumnaSimple[] = [
    { id: 'nombre', encabezado: t('fichaPrograma.indicadores.columnas.nombre'), celda: (r) => texto(r, 'name') },
    { id: 'unidad', encabezado: t('fichaPrograma.indicadores.columnas.unidad'), celda: (r) => texto(r, 'unit') || '—' },
    { id: 'base', encabezado: t('fichaPrograma.indicadores.columnas.base'), celda: (r) => valorDe(atributo(r, 'baseline_value')) },
    { id: 'meta', encabezado: t('fichaPrograma.indicadores.columnas.meta'), celda: (r) => valorDe(atributo(r, 'target_value')) },
    { id: 'ultima', encabezado: t('fichaPrograma.indicadores.columnas.ultima'), celda: (r) => <UltimaMedicion indicador={r} /> },
    {
      id: 'historial',
      encabezado: t('fichaPrograma.indicadores.columnas.historial'),
      celda: (r) => (
        <button type="button" className="text-sg-primary-text underline" onClick={() => setHistorial(r)}>
          {t('fichaPrograma.indicadores.verMediciones', { nombre: texto(r, 'name') })}
        </button>
      )
    }
  ]
  return (
    <div className="space-y-3 pt-3 text-sm">
      {mide ? <Button onClick={() => setMidiendo(true)}>{t('fichaPrograma.indicadores.registrarMedicion')}</Button> : null}
      <RegistrosSimples
        objeto="program_indicator"
        titulo={t('fichaPrograma.indicadores.titulo')}
        filtros={filtros}
        fijos={filtros}
        columnas={columnas}
        campos={CAMPOS_DEL_INDICADOR}
        proyecto={texto(programa, 'project')}
        textoNuevo={t('fichaPrograma.indicadores.nuevo')}
        textoVacio={t('fichaPrograma.indicadores.vacio')}
        mensajesAlBorrar={{ '409': t('fichaPrograma.indicadores.conMediciones') }}
      />
      {historial ? <Mediciones indicador={historial} alCerrar={() => setHistorial(null)} /> : null}
      {midiendo ? <NuevaMedicion indicadores={lista} alCerrar={() => setMidiendo(false)} /> : null}
    </div>
  )
}

function UltimaMedicion({ indicador }: { indicador: Registro }) {
  const { t } = useTranslation(NS)
  const ultima = useRegistros('program_measurement', { program_indicator: indicador.id, sort: 'period_start_date', dir: 'desc', size: 1 })
  if (ultima.isPending) return <Cargando compacto />
  if (ultima.isError && !ultima.data) return <FalloDeLectura error={ultima.error} alReintentar={() => void ultima.refetch()} />
  const medicion = ultima.data?.content[0]
  if (!medicion) return <span className="text-sg-warning">{t('fichaPrograma.indicadores.sinMediciones')}</span>
  return (
    <>
      {t('fichaPrograma.indicadores.ultima', {
        valor: valorDe(atributo(medicion, 'measured_value')),
        desde: diaPe(texto(medicion, 'period_start_date')),
        hasta: diaPe(texto(medicion, 'period_end_date'))
      })}
    </>
  )
}

function Mediciones({ indicador, alCerrar }: { indicador: Registro; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const mediciones = useTodos('program_measurement', { program_indicator: indicador.id, sort: 'period_start_date', dir: 'desc' })
  const titulo = t('fichaPrograma.indicadores.historialTitulo', { nombre: texto(indicador, 'name') })
  return (
    <Drawer titulo={titulo} descripcion={t('fichaPrograma.indicadores.inmutables')} abierto alCerrar={alCerrar}>
      {mediciones.isPending ? (
        <Cargando />
      ) : mediciones.isError && !mediciones.data ? (
        <FalloDeLectura error={mediciones.error} alReintentar={() => void mediciones.refetch()} />
      ) : mediciones.data.length === 0 ? (
        <Vacio titulo={t('fichaPrograma.indicadores.sinMediciones')} />
      ) : (
        <Table aria-label={titulo}>
          <thead>
            <tr>
              <Th scope="col">{t('fichaPrograma.indicadores.columnas.periodo')}</Th>
              <Th scope="col">{t('fichaPrograma.indicadores.columnas.valor')}</Th>
              <Th scope="col">{t('fichaPrograma.indicadores.columnas.notas')}</Th>
            </tr>
          </thead>
          <tbody>
            {mediciones.data.map((m) => (
              <tr key={m.id}>
                <Td className="text-sm">
                  <Dia valor={texto(m, 'period_start_date')} /> – <Dia valor={texto(m, 'period_end_date')} />
                </Td>
                <Td className="text-sm tabular-nums">{valorDe(atributo(m, 'measured_value'))}</Td>
                <Td className="text-sm">{texto(m, 'notes') || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Drawer>
  )
}

// la medición nueva del indicador elegido: el formulario se vuelve a montar al cambiar de indicador (lo tecleado no pasa a otro)
function NuevaMedicion({ indicadores, alCerrar }: { indicadores: Registro[]; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const [elegido, setElegido] = useState(indicadores[0]?.id ?? '')
  const fijos = useMemo(() => ({ program_indicator: elegido }), [elegido])
  return (
    <Drawer titulo={t('fichaPrograma.indicadores.registrarMedicion')} descripcion={t('fichaPrograma.indicadores.inmutables')} abierto alCerrar={alCerrar}>
      <Campo etiqueta={t('fichaPrograma.indicadores.indicador')}>
        {(p) => (
          <SelectNativo
            {...p}
            vacio={false}
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
            opciones={indicadores.map((i) => ({ valor: i.id, etiqueta: texto(i, 'name') }))}
          />
        )}
      </Campo>
      <FormularioDeRegistro
        key={elegido}
        objeto="program_measurement"
        fijos={fijos}
        campos={CAMPOS_DE_LA_MEDICION}
        alGuardar={alCerrar}
        alCancelar={alCerrar}
      />
    </Drawer>
  )
}
