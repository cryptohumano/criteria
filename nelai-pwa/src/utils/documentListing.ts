/**
 * Listados de documentos: ámbito Legal/Académico y etiquetas de usuario.
 */
import type { Document } from '@/types/documents'
import type { AgentProfile } from '@/services/criteria/systemPrompts'
import {
  AGENT_PROFILE_TAG_ACADEMIC_ES,
  AGENT_PROFILE_TAG_LEGAL_MX,
} from '@/services/criteria/systemPrompts'

export type CriteriaDomain = 'legal' | 'academic'

export function inferCriteriaDomain(doc: Document): CriteriaDomain {
  const raw = doc.metadata.criteriaDomain
  if (raw === 'legal' || raw === 'academic') return raw
  const ks = doc.metadata.keywords ?? []
  if (ks.includes(AGENT_PROFILE_TAG_LEGAL_MX)) return 'legal'
  if (ks.includes(AGENT_PROFILE_TAG_ACADEMIC_ES)) return 'academic'
  if (doc.type === 'contract') return 'legal'
  return 'academic'
}

export function criteriaDomainLabel(d: CriteriaDomain): string {
  return d === 'legal' ? 'Legal' : 'Académico'
}

export function criteriaDomainFromAgentProfile(profile: AgentProfile): CriteriaDomain {
  return profile === 'legal_mx' ? 'legal' : 'academic'
}

/** Parsea "foo, bar baz" → tags únicos en minúsculas (guiones por espacios). */
export function parseUserTagsInput(line: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of line.split(/[,;]+/)) {
    const t = part.trim().toLowerCase().replace(/\s+/g, '-')
    if (t.length < 1 || t.length > 48) continue
    if (seen.has(t)) continue
    seen.add(t)
    if (out.length >= 24) break
    out.push(t)
  }
  return out
}

export function formatUserTagsInput(tags: string[] | undefined): string {
  return (tags ?? []).join(', ')
}

/** Ruta de edición acorde al origen del documento (Etherpad vs Quill local). */
export function documentEditorPath(documentId: string, doc: Pick<Document, 'category'>): string {
  return doc.category === 'etherpad'
    ? `/documents/${documentId}/edit`
    : `/documents/${documentId}/edit-quill`
}
