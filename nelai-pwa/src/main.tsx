// Polyfills para Node.js modules en el navegador
import { Buffer } from 'buffer'
window.Buffer = Buffer
globalThis.Buffer = Buffer

// Polyfill para crypto.randomUUID si no está disponible
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  ;(crypto as any).randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}

// Verificar que crypto.subtle esté disponible
if (typeof crypto === 'undefined' || !crypto.subtle) {
  console.error('⚠️ crypto.subtle no está disponible. Asegúrate de usar HTTPS o localhost.')
  console.error('La encriptación no funcionará correctamente sin crypto.subtle.')
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { ThemeProvider } from './contexts/ThemeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
)

