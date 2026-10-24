import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// compila solo el CSS del kit (estilos.css) desde la raíz del portal: las mismas fuentes que `yarn build` más las previews
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [tailwindcss()],
  logLevel: 'warn',
  build: {
    outDir: fileURLToPath(new URL('./dist/css', import.meta.url)),
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: { input: fileURLToPath(new URL('./estilos.ts', import.meta.url)) }
  }
})
