import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// arma la página de los prototipos; el CSS es el del kit (node .design-sync/kit/build.mjs), que ya trae sus clases
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react()],
  logLevel: 'warn',
  define: { __SGSPE_ROL_JEFATURA__: JSON.stringify('') },
  build: { outDir: fileURLToPath(new URL('../.cache/prototipos', import.meta.url)), emptyOutDir: true, chunkSizeWarningLimit: 4000 }
})
