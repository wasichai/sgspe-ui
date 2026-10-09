import { useComando } from '../datos/comandos'
import type { Registro } from '../datos/registros'

// los comandos de WF-K (api.md §4.5): el alta humana de un candidato (IK), aceptarlo creando el compromiso en draft (IK, IM, CR) y
// marcarlo duplicado de un compromiso del mismo proyecto (IM, CR). rechazar es la transición reject con motivo
export interface Aceptado {
  commitment: Registro
  candidate: Registro
}

const invalidarCandidatos = () => [
  ['records', 'commitment_candidate'],
  ['records', 'commitment'],
  ['transitions', 'commitment_candidate']
]

export function useRegistrarCandidato() {
  return useComando<Registro, { atributos: Record<string, unknown> }>(
    ({ atributos }) => ({ ruta: '/sgspe/commitment-candidates', json: { attributes: atributos } }),
    { invalidar: invalidarCandidatos }
  )
}

export function useAceptarCandidato() {
  return useComando<Aceptado, { candidato: Registro; atributos: Record<string, unknown>; motivo: string }>(
    ({ candidato, atributos, motivo }) => ({
      ruta: `/sgspe/commitment-candidates/${candidato.id}/accept`,
      json: { attributes: atributos },
      version: candidato.updatedAt,
      motivo
    }),
    { invalidar: invalidarCandidatos }
  )
}

export function useMarcarDuplicado() {
  return useComando<{ candidate: Registro }, { candidato: Registro; compromiso: string; motivo: string }>(
    ({ candidato, compromiso, motivo }) => ({
      ruta: `/sgspe/commitment-candidates/${candidato.id}/duplicate`,
      json: { duplicateOf: compromiso },
      version: candidato.updatedAt,
      motivo
    }),
    { conClave: false, invalidar: invalidarCandidatos }
  )
}
