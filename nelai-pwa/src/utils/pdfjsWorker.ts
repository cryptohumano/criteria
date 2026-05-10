import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let configured = false

export function ensurePdfjsWorker(): void {
  if (configured) return
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  configured = true
}

export { pdfjs }
