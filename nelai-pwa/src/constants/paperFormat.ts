/**
 * Formato de hoja para editor (CSS) y PDF (jsPDF).
 */

export type PaperFormatId = 'a4' | 'letter' | 'legal'

export const DEFAULT_PAPER_FORMAT: PaperFormatId = 'a4'

export const PAPER_SPECS: Record<
  PaperFormatId,
  { jsPdf: PaperFormatId; widthMm: number; heightMm: number; label: string }
> = {
  a4: { jsPdf: 'a4', widthMm: 210, heightMm: 297, label: 'A4 (210 × 297 mm)' },
  letter: { jsPdf: 'letter', widthMm: 216, heightMm: 279, label: 'Carta US (216 × 279 mm)' },
  legal: { jsPdf: 'legal', widthMm: 216, heightMm: 356, label: 'Oficio legal US (216 × 356 mm)' },
}

export function normalizePaperFormat(v: unknown): PaperFormatId {
  if (v === 'letter' || v === 'legal') return v
  return 'a4'
}

/** Ancho útil del cuerpo (márgenes laterales 20 mm c/u, igual que el conversor HTML→PDF). */
export function pdfBodyWidthMm(pageWidthMm: number): number {
  return Math.max(120, pageWidthMm - 40)
}
