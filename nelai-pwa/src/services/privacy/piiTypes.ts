/** Categorías de PII detectadas por patrones (no exhaustivo). */
export type PiiKind =
  | 'EMAIL'
  | 'PHONE'
  | 'IBAN'
  | 'DNI'
  | 'NIE'
  | 'RFC_MX'
  | 'CURP'
  /** Monto en pesos con leyenda típica (M.N., pesos X/100, etc.). Capa contrato MX. */
  | 'AMOUNT_MXN'
  /** Hueco de borrador frecuente en minutas (p. ej. «Nombre entidad»). Capa contrato MX. */
  | 'CONTRACT_SLOT'
  /** Referencia «Escritura Pública número …». Capa contrato MX. */
  | 'ESCRITURA_REF'
  /** «Folio electrónico número …» (RPP). Capa contrato MX. */
  | 'REGISTRY_FOLIO'
  /** Rango elegido por el usuario en el diálogo de revisión. */
  | 'MANUAL'

export interface PiiMatch {
  kind: PiiKind
  start: number
  end: number
  text: string
}

/** Dónde se aplicó la sustitución (heurístico; no define un esquema formal de PII). */
export type PiiSubstitutionSource = 'document' | 'message' | 'pdf_import'

export interface PiiReviewRow {
  kind: PiiKind
  original: string
  placeholder: string
  source?: PiiSubstitutionSource
}
