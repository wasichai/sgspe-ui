import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// DD-06 (U-25): el panel de decisión es el único lugar del estado de una ficha, con el camino del flujo plegado dentro de
// «Estado actual». abrirCamino lo despliega y devuelve la lista del camino
export async function abrirCamino(): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole('button', { name: 'Ver el camino' }))
  return screen.findByRole('list', { name: 'Camino del flujo' })
}

// los EstadoChip de la ficha (su <article>) fuera de sus listas, tablas y pestañas: el estado del registro, que se dice
// una vez. el del proyecto en la barra de contexto queda fuera
export const estadosDeLaFicha = (): Element[] =>
  Array.from(document.querySelectorAll('article [data-estado]')).filter((e) => !e.closest('[role="tabpanel"], [role="dialog"], table, li'))
