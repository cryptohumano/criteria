/** Copy y rutas de capturas para /producto (alineado con sitio Peranto + meta de compartir). */

export const PERANTO_APP_URL = 'https://peranto.app'

export const PRODUCT_LEAD =
  'Redacción legal y académica asistida por IA con procedencia verificable: editor colaborativo, agente LLM, firma C2PA e identidad Polkadot/Substrate. Datos en tu dispositivo; código bajo FSL-1.1-MIT.'

export const PRODUCT_HERO_IMAGE = {
  src: 'marketing/screenshots/criteria-editor.png',
  alt: 'Editor CriterIA con asistente IA: criterio académico, nivel de calidad y consejos en contexto',
  caption: 'El editor con asistente IA: tu documento y el criterio en la misma pantalla.',
} as const

export function productAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const baseWithSlash = base.endsWith('/') ? base : `${base}/`
  const normalized = path.replace(/^\//, '')
  return `${baseWithSlash}${normalized}`
}

export const PRODUCT_FEATURES: { title: string; description: string }[] = [
  {
    title: 'Editor colaborativo Etherpad',
    description:
      'Same-origin, presencia en tiempo real y exportación PDF, DOCX y ODT.',
  },
  {
    title: 'Agente LLM (Gemini vía proxy seguro)',
    description: 'Flujo proponer → revisar → aplicar sobre el documento.',
  },
  {
    title: 'Evaluación de calidad académica',
    description: 'Puntuación, nivel y aspectos concretos a mejorar.',
  },
  {
    title: 'Documentos no repudiables',
    description: 'Firma C2PA en servidor y firma Substrate en cliente (Polkadot).',
  },
  {
    title: 'Redacción reversible de PII',
    description: 'Por patrones antes de enviar contenido al modelo.',
  },
  {
    title: 'PWA con datos locales',
    description: 'Autohospedaje con tu API key. Licencia FSL-1.1-MIT (apertura diferida a MIT).',
  },
  {
    title: 'Cuentas y organizaciones',
    description: 'Personales o de equipo, con cuotas de tokens por plan.',
  },
  {
    title: 'Bitácora de fuentes',
    description: 'Citas APA y trazabilidad de lo consultado por el agente.',
  },
]

export type ProductScreenshot = {
  id: string
  src: string
  alt: string
  caption: string
}

/** Galería completa (incluye la del hero para verla ampliada). */
export const PRODUCT_SCREENSHOTS: ProductScreenshot[] = [
  {
    id: 'editor',
    src: PRODUCT_HERO_IMAGE.src,
    alt: PRODUCT_HERO_IMAGE.alt,
    caption: PRODUCT_HERO_IMAGE.caption,
  },
  {
    id: 'quality',
    src: 'marketing/screenshots/criteria-quality.png',
    alt: 'Evaluación del documento con puntuación, nivel y aspectos concretos a mejorar',
    caption: 'Evaluación del documento con puntuación, nivel y aspectos concretos a mejorar.',
  },
  {
    id: 'documents',
    src: 'marketing/screenshots/criteria-documents.png',
    alt: 'Biblioteca local de documentos con PDF en el dispositivo y colaboración opcional',
    caption: 'Biblioteca local de documentos con PDF en el dispositivo y colaboración opcional.',
  },
  {
    id: 'sources',
    src: 'marketing/screenshots/criteria-sources.png',
    alt: 'Bitácora de fuentes con citas APA y trazabilidad de lo consultado',
    caption: 'Bitácora de fuentes con citas APA y trazabilidad de lo consultado.',
  },
  {
    id: 'identity',
    src: 'marketing/screenshots/criteria-identity.png',
    alt: 'Identidad digital: cuenta de plataforma y wallet Substrate en tu dispositivo',
    caption: 'Identidad digital: cuenta de plataforma y wallet Substrate en tu dispositivo.',
  },
  {
    id: 'security',
    src: 'marketing/screenshots/criteria-security.png',
    alt: 'Seguridad con WebAuthn para desbloquear la wallet sin depender solo de contraseña',
    caption: 'Seguridad con WebAuthn para desbloquear la wallet sin depender solo de contraseña.',
  },
]

export const PRODUCT_STRIPE_NOTE =
  'CriterIA no te encierra: el software es autohospedable y auditable. El plan gestionado (~29 USD/mes, 2M tokens, hasta 5 personas) pasa hoy por Stripe como atajo de facturación — no como identidad del producto. La wallet Substrate en tu dispositivo es la capa de confianza; la salida de pasarelas concentradas es la dirección del ecosistema, no una promesa de marketing.'
