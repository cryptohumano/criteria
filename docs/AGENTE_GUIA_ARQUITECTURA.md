# Agente Guía — Arquitectura y Configuración

Documento de diseño para el **Agente Guía** de Nelai: explica al usuario qué datos serán públicos, cuáles privados, riesgos de privacidad y verificabilidad **antes** de confirmar acciones sensibles (registrar on-chain, publicar en DKG).

---

## 1. Objetivo

Antes de que el usuario confirme:
- **"Registrar on-chain"** (avisos de salida, etc.) — **no emergencias** (prioridad: velocidad)
- **"Publicar en DKG"** (evidencias firmadas)
- **Firmar documentos** / **Verificar procedencia**

…mostrar un modal o panel con texto explicativo que responda:
- ¿Qué datos serán **públicos** y permanentes?
- ¿Qué datos quedan **privados** o solo en el dispositivo?
- ¿Qué **riesgos de privacidad** implica?
- ¿Qué significa la **verificabilidad** para el usuario?

---

## 2. Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENTE GUÍA (Nelai)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐   │
│   │  Puntos de      │     │  GuideAgentService  │     │  GuideModal     │   │
│   │  integración    │────▶│  (lógica central)   │────▶│  (UI)           │   │
│   │  (triggers)     │     │                     │     │                 │   │
│   └─────────────────┘     │  • actionType       │     │  • Plantillas   │   │
│                           │  • fieldsToPublish  │     │  • Entendido    │   │
│   ImageGallery            │  • getGuideContent  │     │  • Opcional LLM  │   │
│   (emergencias: sin guía)  └──────────────────────┘     └─────────────────┘   │
│   DocumentDetail                 │                              │             │
│   (futuro)                       │                              │             │
│                                  ▼                              ▼             │
│                           ┌──────────────┐              ┌──────────────┐     │
│                           │  Plantillas  │              │  Config      │     │
│                           │  (JSON)     │              │  (API Keys)  │     │
│                           └──────────────┘              └──────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes

### 3.1 `GuideAgentService` (módulo de lógica)

**Ubicación:** `src/services/nelai/guideAgent.ts`

**Responsabilidades:**
- Recibir `actionType` y `fieldsToPublish` (nombres de campos, sin valores sensibles)
- Resolver el contenido explicativo:
  - **MVP:** plantillas predefinidas por tipo de acción
  - **Opcional:** llamada a LLM vía API configurada
- Devolver texto en español, tono claro y no alarmista

**API:**
```ts
export type GuideActionType =
  | 'publish-dkg'
  | 'register-emergency-onchain'
  | 'register-aviso-onchain'
  | 'sign-document'
  | 'sign-evidence'

export interface GuideContext {
  actionType: GuideActionType
  fieldsToPublish: string[]  // ej: ['author', 'contentHash', 'createdAt', 'geolocation']
  /** Opcional: si hay datos sensibles que el usuario debe conocer */
  hasGeolocation?: boolean
  hasPersonalData?: boolean
}

export interface GuideResult {
  title: string
  content: string
  /** Secciones opcionales para UI estructurada */
  sections?: { heading: string; body: string }[]
}

export function getGuideContent(ctx: GuideContext): GuideResult
export async function getGuideContentWithLLM(ctx: GuideContext, apiConfig?: LLMApiConfig): Promise<GuideResult>
```

---

### 3.2 `GuideModal` (componente UI)

**Ubicación:** `src/components/nelai/GuideModal.tsx`

**Props:**
```tsx
interface GuideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionType: GuideActionType
  fieldsToPublish: string[]
  /** Callback cuando el usuario hace clic en "Entendido" */
  onAcknowledged: () => void
  /** Opcional: datos adicionales para el contexto */
  hasGeolocation?: boolean
  hasPersonalData?: boolean
}
```

**Comportamiento:**
1. Al abrir, llama a `getGuideContent()` con el contexto
2. Muestra título + contenido (texto o secciones)
3. Botón **"Entendido"** → `onAcknowledged()` → cierra modal
4. El flujo padre solo ejecuta la acción real (DKG, on-chain) después de que el usuario confirme

---

### 3.3 Plantillas (configuración)

**Ubicación:** `src/config/guideAgentTemplates.ts`

**Estructura:**
```ts
export const GUIDE_TEMPLATES: Record<GuideActionType, {
  title: string
  template: string  // Puede incluir placeholders {fields}, {hasGeolocation}, etc.
  sections?: { heading: string; body: string }[]
}> = {
  'publish-dkg': {
    title: 'Antes de publicar en DKG',
    template: `Al publicar en DKG (OriginTrail), estos datos serán **públicos y permanentes** en el grafo de conocimiento:

- **Tu dirección de cuenta** (autor)
- **Hash del contenido** (contentHash) — no revela el archivo, solo su huella
- **Fecha de creación**

La parte privada (metadata completa, archivo original) queda solo en tu dispositivo. Cualquiera con el UAL podrá verificar la autenticidad y el autor, pero no acceder al contenido completo.

**Verificabilidad:** Cualquier persona con el UAL puede comprobar que tú firmaste este contenido en la fecha indicada.`,
    sections: [
      { heading: 'Datos públicos', body: '...' },
      { heading: 'Datos privados', body: '...' },
      { heading: 'Verificabilidad', body: '...' }
    ]
  },
  'register-emergency-onchain': {
    title: 'Antes de registrar la emergencia on-chain',
    template: `Al registrar on-chain, estos datos serán **públicos y permanentes** en la blockchain:

- Tu dirección de cuenta (reporter)
- Tipo y severidad de la emergencia
- Descripción (si la incluyes)
- Ubicación GPS (si la activaste)
- Fecha y hora

Cualquiera podrá ver esta información en el explorador de la blockchain. Las coordenadas GPS pueden revelar tu ubicación exacta en el momento del reporte.

**Riesgo de privacidad:** Considera si deseas incluir descripción detallada o ubicación precisa.`,
    // ...
  },
  // ...
}
```

---

## 4. Puntos de integración (triggers)

| Flujo | Archivo | Trigger | ActionType |
|-------|---------|---------|------------|
| **Proteger en DKG** | `ImageGallery.tsx` | Clic en "Proteger en DKG" | `publish-dkg` |
| **Emergencia on-chain** | `EmergencyButton.tsx` | Antes de `createAndSubmitEmergency` | `register-emergency-onchain` |
| **Aviso de salida on-chain** | `AvisoSalidaForm.tsx` (si aplica) | Antes de enviar on-chain | `register-aviso-onchain` |
| **Firmar documento** | Flujo de documentos | Antes de `signDocumentWithSubstrate` | `sign-document` |
| **Firmar evidencia** | Ya es automático al añadir imagen | Opcional: modal antes de firmar | `sign-evidence` |

### Flujo de integración (ejemplo: Proteger en DKG)

```
Usuario hace clic "Proteger en DKG"
         │
         ▼
┌─────────────────────────┐
│ ¿Mostrar Guía?          │  ← Config: guideAgent.enabled (default: true)
│ (si first-time o config) │
└─────────────────────────┘
         │
         ▼ Sí
┌─────────────────────────┐
│ GuideModal abre         │
│ getGuideContent({       │
│   actionType: 'publish-dkg',
│   fieldsToPublish: ['author','contentHash','createdAt']
│ })                      │
└─────────────────────────┘
         │
         ▼ Usuario hace clic "Entendido"
┌─────────────────────────┐
│ onAcknowledged()        │
│ → Cerrar modal          │
│ → Continuar con flujo   │
│   (diálogo contraseña   │
│   → publishEvidenceToDKG)
└─────────────────────────┘
```

---

## 5. Configuración

### 5.1 Config local (MVP)

**Ubicación:** `src/config/guideAgent.ts`

```ts
export const GUIDE_AGENT_CONFIG = {
  /** Mostrar el modal de guía antes de acciones sensibles */
  enabled: true,
  /** Tipos de acción donde se muestra (por defecto todos) */
  enabledActions: ['publish-dkg', 'register-emergency-onchain', 'register-aviso-onchain', 'sign-document'] as GuideActionType[],
  /** Recordar "no volver a mostrar" por acción (localStorage) */
  rememberDismissed: true,
  /** Clave localStorage para dismissed */
  dismissedStorageKey: 'nelai-guide-dismissed',
}
```

### 5.2 Config con LLM (opcional)

**Ubicación:** Settings > APIs Externas (o módulo API Keys)

```ts
interface LLMApiConfig {
  provider: 'openai' | 'anthropic' | 'custom'
  endpoint?: string
  apiKey?: string
  model?: string
}

// Prompt base para el Guía
const GUIDE_LLM_PROMPT = `Eres un asistente de confianza y seguridad digital. 
El usuario va a realizar la siguiente acción: {actionType}.
Los campos que se publicarán son: {fieldsToPublish}.
Explica en 2-3 frases qué va on-chain o en DKG, qué queda off-chain, riesgos de privacidad y qué significa la verificabilidad.
Tono claro, no alarmista. En español.`
```

---

## 6. Estructura de archivos propuesta

```
nelai-pwa/src/
├── config/
│   ├── guideAgent.ts              # Config enabled, dismissed, etc.
│   └── guideAgentTemplates.ts     # Plantillas por actionType
├── services/
│   └── nelai/
│       ├── guideAgent.ts          # getGuideContent, getGuideContentWithLLM
│       ├── dkgPublish.ts          # (existente)
│       └── evidenceSigning.ts     # (existente)
├── components/
│   └── nelai/
│       └── GuideModal.tsx         # Modal reutilizable
└── hooks/
    └── useGuideAgent.ts           # Hook: shouldShowGuide, showGuide, acknowledge
```

---

## 7. Hook `useGuideAgent`

Simplifica la integración en los componentes:

```ts
export function useGuideAgent(actionType: GuideActionType, options?: {
  fieldsToPublish?: string[]
  hasGeolocation?: boolean
  hasPersonalData?: boolean
}) {
  const [showModal, setShowModal] = useState(false)
  const wasDismissed = useMemo(() => 
    GUIDE_AGENT_CONFIG.rememberDismissed && 
    localStorage.getItem(`${GUIDE_AGENT_CONFIG.dismissedStorageKey}-${actionType}`) === 'true'
  , [actionType])

  const shouldShowGuide = () => 
    GUIDE_AGENT_CONFIG.enabled && 
    GUIDE_AGENT_CONFIG.enabledActions.includes(actionType) && 
    !wasDismissed

  const triggerGuide = (onAcknowledged: () => void) => {
    if (!shouldShowGuide()) {
      onAcknowledged()
      return
    }
    setShowModal(true)
    // Guardar callback para ejecutar tras "Entendido"
    setPendingAction(onAcknowledged)
  }

  const acknowledge = () => {
    if (GUIDE_AGENT_CONFIG.rememberDismissed) {
      localStorage.setItem(`${GUIDE_AGENT_CONFIG.dismissedStorageKey}-${actionType}`, 'true')
    }
    setShowModal(false)
    pendingAction?.()
  }

  return { showModal, setShowModal, triggerGuide, acknowledge, shouldShowGuide, ... }
}
```

---

## 8. Resumen de implementación

| Fase | Qué implementar |
|------|-----------------|
| **1. Core** | `guideAgent.ts` (service), `guideAgentTemplates.ts`, `GuideModal.tsx` |
| **2. Config** | `guideAgent.ts` (config), `useGuideAgent` hook |
| **3. Integración** | ImageGallery (Proteger en DKG), EmergencyButton (emergencia on-chain) |
| **4. Opcional** | LLM vía API Keys, más actionTypes (aviso, documento) |

---

## 9. Diagrama de secuencia (Proteger en DKG)

```
Usuario          ImageGallery       useGuideAgent      GuideModal       guideAgent.ts
   │                   │                   │                 │                  │
   │  Clic "Proteger"  │                   │                 │                  │
   │──────────────────▶│                   │                 │                  │
   │                   │ triggerGuide()    │                 │                  │
   │                   │──────────────────▶│                 │                  │
   │                   │                   │ shouldShow?     │                  │
   │                   │                   │─────────────────│                  │
   │                   │                   │                 │ getGuideContent  │
   │                   │                   │                 │─────────────────▶│
   │                   │                   │                 │◀─────────────────│
   │                   │                   │  setShowModal   │   {title, content}│
   │                   │                   │◀─────────────────│                  │
   │                   │  Modal abre      │                 │                  │
   │                   │◀──────────────────│                 │                  │
   │  [Ve explicación]  │                   │                 │                  │
   │                   │                   │                 │                  │
   │  Clic "Entendido" │                   │                 │                  │
   │──────────────────▶│                   │                 │                  │
   │                   │  acknowledge()    │                 │                  │
   │                   │──────────────────▶│                 │                  │
   │                   │                   │  onAcknowledged │                  │
   │                   │                   │  (doPublishDkg)│                  │
   │                   │◀──────────────────│                 │                  │
   │                   │  [Continuar flujo: diálogo pwd → DKG]│                  │
```

---

## 8. Prioridades del asistente LLM

**Emergencias:** Sin guía ni LLM. La velocidad es prioritaria; el usuario debe poder enviar la alerta de inmediato.

**Donde sí vale la pena el asistente LLM:**
- **Documentos:** Crear, editar, firmar — más espacio para creatividad y explicaciones.
- **Firmas criptográficas:** Explicar qué se firma, verificabilidad, uso de la identidad Polkadot.
- **Verificar procedencia:** Ayudar a interpretar reportes, UAL, autenticidad.
- **Transacciones:** Asistir con envíos, balances, explicar fees.

**Bitácoras:** Caso puntual; menos creatividad que documentos o transacciones. El LLM puede ayudar en publicar en DKG (ImageGallery) pero no en emergencias.

**Principio:** El asistente debe enfatizar la **función actual** en la que está el usuario (pantalla, acción) y ofrecer contexto relevante.

---

*Documento de diseño — Nelai / iSAFE Hackathon 2026*
