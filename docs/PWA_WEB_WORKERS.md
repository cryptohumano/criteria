# Web Workers: evitar bloqueo del hilo principal

Las PWAs corren JavaScript en un **hilo único** por defecto. Las operaciones pesadas (cálculos, parsing de JSON grande, crypto) pueden bloquear la UI.

## Solución: Web Workers

Los **Web Workers** ejecutan código en un hilo separado. No pueden acceder al DOM, pero sí:

- Hacer `fetch`
- Procesar datos (JSON, crypto)
- Cálculos intensivos

Comunicación: `postMessage` / `onmessage`.

## Ejemplo: mover la llamada LLM a un Worker

```javascript
// llmWorker.js
self.onmessage = async (e) => {
  const { url, init } = e.data
  try {
    const res = await fetch(url, init)
    const text = await res.text()
    self.postMessage({ ok: res.ok, status: res.status, body: text })
  } catch (err) {
    self.postMessage({ error: err.message })
  }
}
```

```typescript
// En el main thread
const worker = new Worker(new URL('./llmWorker.ts', import.meta.url))
worker.postMessage({ url, init })
worker.onmessage = (e) => {
  const { ok, body, error } = e.data
  // procesar respuesta
}
```

## ¿Cuándo vale la pena?

| Operación        | ¿Bloquea?                    | ¿Worker útil?      |
|------------------|------------------------------|--------------------|
| `fetch` LLM      | No (async, espera red)       | Poco beneficio     |
| `JSON.parse`     | Sí si el payload es enorme   | Sí                 |
| `crypto.subtle` | Sí (hashing, firmas)        | Sí                 |
| Generación PDF   | Sí (pdf-lib, jsPDF)          | Sí                 |

**Recomendación:** Priorizar Workers para crypto, PDF y parsing de respuestas muy grandes. Para `fetch` normal, el async ya evita bloquear durante la espera.

## Vite + Workers

Vite soporta Workers con `new Worker(new URL('./worker.ts', import.meta.url))`. El bundler los empaqueta correctamente.
