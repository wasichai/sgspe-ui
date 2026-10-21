// los prototipos del rediseño (docs/ux/redesign/04-prototipos): ?p=<id>&tema=light|dark&idioma=es|en
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { VistaSgspe } from '../kit/index'
import { PANTALLAS } from './pantallas'

const q = new URLSearchParams(location.search)
const Pantalla = PANTALLAS[q.get('p') ?? 'P01'] ?? (() => <p>?</p>)
const tema = q.get('tema') === 'dark' ? 'dark' : 'light'
const idioma = q.get('idioma') === 'en' ? 'en' : 'es'
document.documentElement.lang = idioma === 'en' ? 'en' : 'es-PE'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <VistaSgspe tema={tema} idioma={idioma}>
      <Pantalla />
    </VistaSgspe>
  </StrictMode>
)
