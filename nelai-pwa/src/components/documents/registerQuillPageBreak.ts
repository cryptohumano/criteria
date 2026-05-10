/**
 * Blot de salto de página explícito (CriterIA). Debe registrarse antes de montar Quill.
 */
import Quill from 'quill'
import { BlockEmbed } from 'quill/blots/block.js'
import { CRITERIA_QUILL_PAGE_BREAK_CLASS } from '@/constants/criteriaQuillEmbed'

let registered = false

class CriteriaPageBreak extends BlockEmbed {
  static blotName = 'pageBreak'
  static className = CRITERIA_QUILL_PAGE_BREAK_CLASS
  static tagName = 'DIV'

  static create() {
    const node = super.create() as HTMLDivElement
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('data-criteria-page-break', '1')
    node.setAttribute('aria-label', 'Salto de página')
    return node
  }

  static value() {
    return true
  }
}

export function ensureQuillPageBreak(): void {
  if (registered) return
  registered = true
  Quill.register(CriteriaPageBreak, true)
}
