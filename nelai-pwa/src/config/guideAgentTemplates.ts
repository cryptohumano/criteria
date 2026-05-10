/**
 * Plantillas del Agente Guía por tipo de acción
 */

import type { GuideActionType } from './guideAgent'

export interface GuideTemplate {
  title: string
  content: string
  sections?: { heading: string; body: string }[]
}

export const GUIDE_TEMPLATES: Record<GuideActionType, GuideTemplate> = {
  'publish-dkg': {
    title: 'Antes de publicar en DKG',
    content: `Al publicar en DKG (OriginTrail), estos datos serán **públicos y permanentes** en el grafo de conocimiento:

- **Tu dirección de cuenta** (autor)
- **Hash del contenido** (contentHash) — no revela el archivo, solo su huella
- **Fecha de creación**

La parte privada (metadata completa, archivo original) queda solo en tu dispositivo. Cualquiera con el UAL podrá verificar la autenticidad y el autor, pero no acceder al contenido completo.

**Verificabilidad:** Cualquier persona con el UAL puede comprobar que tú firmaste este contenido en la fecha indicada.`,
    sections: [
      {
        heading: 'Datos públicos',
        body: 'Tu dirección de cuenta, hash del contenido y fecha de creación serán visibles de forma permanente en el grafo de conocimiento.',
      },
      {
        heading: 'Datos privados',
        body: 'El archivo original y la metadata completa permanecen solo en tu dispositivo.',
      },
      {
        heading: 'Verificabilidad',
        body: 'Cualquiera con el UAL puede comprobar la autenticidad y el autor del contenido.',
      },
    ],
  },
  'register-emergency-onchain': {
    title: 'Antes de registrar la emergencia on-chain',
    content: `Al registrar on-chain, estos datos serán **públicos y permanentes** en la blockchain:

- Tu dirección de cuenta (reporter)
- Tipo y severidad de la emergencia
- Descripción (si la incluyes)
- Ubicación GPS (si la activaste)
- Fecha y hora

Cualquiera podrá ver esta información en el explorador de la blockchain. Las coordenadas GPS pueden revelar tu ubicación exacta en el momento del reporte.

**Riesgo de privacidad:** Considera si deseas incluir descripción detallada o ubicación precisa.`,
    sections: [
      {
        heading: 'Datos públicos',
        body: 'Tipo de emergencia, severidad, descripción, ubicación GPS (si aplica) y fecha serán visibles en la blockchain.',
      },
      {
        heading: 'Riesgo de privacidad',
        body: 'Las coordenadas GPS pueden revelar tu ubicación exacta. Considera si deseas incluirlas.',
      },
    ],
  },
  'register-aviso-onchain': {
    title: 'Antes de registrar el aviso on-chain',
    content: `Al registrar el aviso de salida on-chain, los datos del formulario serán **públicos y permanentes** en la blockchain:

- Datos del guía/líder
- Destino y actividad
- Participantes y contactos de emergencia
- Fecha y hora

Esta información quedará visible en el explorador de la blockchain para fines de rescate y coordinación.`,
    sections: [
      {
        heading: 'Datos públicos',
        body: 'Toda la información del aviso de salida será visible en la blockchain.',
      },
    ],
  },
  'sign-document': {
    title: 'Antes de firmar el documento',
    content: `Al firmar, estos datos quedarán asociados de forma **verificable**:

- Tu dirección de cuenta (autor)
- Hash del documento
- Fecha de firma

La firma se guarda localmente. Si más adelante registras on-chain o publicas en DKG, esos datos serán públicos.`,
    sections: [
      {
        heading: 'Qué se firma',
        body: 'El hash del documento, tu identidad y la fecha quedan asociados de forma criptográfica verificable.',
      },
    ],
  },
  'sign-evidence': {
    title: 'Antes de firmar la evidencia',
    content: `Al firmar, estos datos quedarán asociados de forma **verificable**:

- Tu dirección de cuenta (autor)
- Hash del contenido (imagen/archivo)
- Fecha de firma

La firma se guarda localmente. Puedes publicar en DKG más adelante si lo deseas.`,
    sections: [
      {
        heading: 'Qué se firma',
        body: 'El hash del contenido, tu identidad y la fecha quedan asociados de forma criptográfica verificable.',
      },
    ],
  },
}
