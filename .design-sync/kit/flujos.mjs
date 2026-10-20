// copia los workflows de SGSPE (sgspe/model/workflows, la fuente de verdad) sin sus roles: solo los estados y las
// transiciones que dibujan EstadoChip y CaminoDelFlujo. se corre a mano cuando cambia un workflow:
//   node .design-sync/kit/flujos.mjs ../sgspe/model/workflows
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const origen = process.argv[2]
if (!origen) throw new Error('falta la carpeta de los workflows (sgspe/model/workflows)')
const flujos = {}
for (const archivo of readdirSync(origen)
  .filter((f) => f.endsWith('.json'))
  .sort()) {
  const { name, label, definition } = JSON.parse(readFileSync(join(origen, archivo), 'utf8'))
  flujos[basename(archivo, '.json')] = {
    name,
    label,
    enabled: true,
    definition: {
      states: definition.states.map(({ name, label, type }) => ({ name, label, type })),
      transitions: definition.transitions.map(({ name, label, from, to }) => ({ name, label, from, to }))
    }
  }
}
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'flujos.json'), JSON.stringify(flujos, null, 2) + '\n')
console.log(`flujos: ${Object.keys(flujos).length}`)
