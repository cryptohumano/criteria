/**
 * Asistente IA para el editor de documentos
 * Permite al usuario interactuar con la IA y que la IA edite el documento
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  Paperclip,
  X,
  Bot,
  ArrowUp,
  Copy,
  User,
  FileCheck,
  Shield,
  AlertTriangle,
  FileText,
  LocateFixed,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { stripMarkdown } from '@/utils/markdownStrip'
import { getActiveLLMConfig } from '@/config/llmConfig'
import { canUseLlmForAgent } from '@/utils/llmAvailability'
import { chatCompletion } from '@/services/criteria/llmClient'
import { toast } from 'sonner'
import type { EditorApi } from './RichTextEditor'
import { PiiReviewPanel, type PiiReviewConfirmPayload } from './PiiReviewPanel'
import { extractTextFromPdfBase64 } from '@/services/privacy/pdfTextExtract'
import { anonymizePlainText, anonymizeDocAndMessage } from '@/services/privacy/piiAnonymize'
import type { PiiMatch, PiiReviewRow } from '@/services/privacy/piiTypes'
import { PrivacyMappingDialog, PrivacySubstitutionTable } from './PrivacyMappingDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PrivacyPlaceholderEntry, ResearchEvidenceLogEntry } from '@/types/documents'
import {
  buildResearchEvidenceEntries,
  buildResearchEvidenceEntriesFromRefs,
  collectAssistantSourceRefs,
  extractHttpUrlsFromText,
} from '@/utils/researchEvidenceLog'
import { kindFromNelaiBracketToken } from '@/services/privacy/criteriaPlaceholders'
import {
  SCORE_API_REMINDER,
  agentSystemPromptForProfile,
  inferAgentProfile,
  type AgentProfile,
} from '@/services/criteria/systemPrompts'
import {
  documentScoreUiLabels,
  stripAndParseDocumentScore,
  type AgentDocumentScore,
} from '@/utils/agentDocumentScore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function dedupePiiRowsByPlaceholder(rows: PiiReviewRow[]): PiiReviewRow[] {
  const seen = new Set<string>()
  const out: PiiReviewRow[] = []
  for (const r of rows) {
    if (!r.placeholder || seen.has(r.placeholder)) continue
    seen.add(r.placeholder)
    out.push(r)
  }
  return out
}

export interface DocumentEditorAgentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Al cambiar de documento o al recargar desde almacenamiento, hidrata el chat */
  documentId?: string
  /** ID estable para la bitácora de fuentes (p. ej. UUID de sesión si aún no hay `documentId` en la ruta). */
  evidenceDocumentId?: string
  chatSessionKey?: number
  documentContext: {
    title: string
    type: string
    description: string
    contentPlain: string
  }
  /** Override explícito del perfil del agente (por tags del documento). */
  agentProfileOverride?: AgentProfile
  /** Placeholders ya incrustados en el documento y patrones pendientes (texto plano actual). */
  documentPrivacyScan?: {
    embeddedInDocument: PiiReviewRow[]
    pendingDocMatches: PiiMatch[]
  }
  /** Sustituye en el editor un match detectado por el último escaneo. */
  onApplyDocumentPendingMatch?: (m: PiiMatch) => void
  documentPlaceholderRegistry?: PrivacyPlaceholderEntry[]
  onRevertDocumentPlaceholder?: (placeholder: string) => void
  onSetDocumentPlaceholderLabel?: (placeholder: string, label: string) => void
  onRegisterPrivacyMappingsFromRows?: (rows: PiiReviewRow[]) => void
  /** Lleva la vista y la selección del Quill al token en el documento. */
  onGoToDocumentPlaceholder?: (placeholder: string) => void
  /** Pestaña inicial del panel (p. ej. `privacy` para analizar contrato con sanitización). */
  initialSubView?: 'chat' | 'privacy'
  editorApiRef: React.RefObject<EditorApi | null>
  initialMessages?: ChatMessage[]
  onMessagesChange?: (messages: ChatMessage[]) => void
  /** Persiste URLs / fuentes detectadas en el hilo (IndexedDB vía el padre). */
  onResearchEvidenceAppend?: (entries: ResearchEvidenceLogEntry[]) => void
  /** Cuenta autora (p. ej. SS58) para trazabilidad en la bitácora. */
  researchEvidenceAddedBy?: string
  onContentChange?: (content: string, description: string) => void
  appliedMods?: Record<string, number>
  onAppliedModsChange?: (mods: Record<string, number>) => void
}

/** Lista de modelos Gemini disponibles para el usuario según su cuota actual */
/** IDs deben coincidir con models/... en la API (p. ej. gemini-3.x suelen publicarse como *-preview). */
const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Inteligencia máxima de frontera y agentic coding' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Velocidad extrema y razonamiento avanzado' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Modelo avanzado estable para tareas complejas' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Excelente balance precio-rendimiento y baja latencia' },
]

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Marca temporal (ms) al crear el mensaje; se persiste en `Document.chatHistory[].timestamp`. */
  timestamp?: number
  /** Score extraído del bloque [SCORE_LEGAL] (respuesta ya sin ese bloque en `content`). */
  documentScore?: AgentDocumentScore | null
  attachments?: Array<{ mimeType: string; data: string; fileName: string }>
  /** Error de API (429, red, etc.): presentación distinta, sin insertar en documento */
  isError?: boolean
  /** El modelo cortó por límite de salida (MAX_TOKENS) */
  truncated?: boolean
  /** El texto enviado al modelo sustituyó PII estructural por placeholders */
  privacySanitized?: boolean
  /** Mapeo enviado a la IA en este turno: puede mezclar sustituciones nuevas del envío con todos los placeholders del documento que siguen activos (transparencia en UI, no solo “novedades”). */
  privacySubstitutions?: PiiReviewRow[]
}

/** Mensajes antiguos o sin flag: detectar errores por texto */
function isAssistantErrorMessage(content: string): boolean {
  const c = content.trim()
  if (c.startsWith('Error:')) return true
  if (c.startsWith('⚠️')) return true
  if (c.includes('Límite de solicitudes de la IA')) return true
  if (c.includes('No hay API de IA configurada')) return true
  if (/^API error \d+/i.test(c)) return true
  return false
}

const MIN_CHARS_FOR_INSERT = 320

function shouldRequireLegalScore(
  userText: string,
  hasAttachments: boolean,
  documentHasPlainContent: boolean
): boolean {
  if (hasAttachments) return true
  const t = userText.trim().toLowerCase()
  if (!t) return false
  if (t.includes('analiza') || t.includes('análisis') || t.includes('analizar')) return true
  if (t.includes('revisa') || t.includes('revisar') || t.includes('revisión')) return true
  if (t.includes('evalúa') || t.includes('evaluar') || t.includes('evaluación')) return true
  if (t.includes('compliant') || (t.includes('cumplimiento') && t.includes('ley'))) return true
  if (t.includes('ley mexicana') || /\bmexican[ao]\b/.test(t)) return true
  if (t.includes('fallas') || t.includes('oportunidades de mejora')) return true
  if (t.includes('riesgo') && (t.includes('documento') || t.includes('contrato'))) return true
  if (
    documentHasPlainContent &&
    /\b(documento|contrato|texto|cláusula|acuerdo)\b/.test(t) &&
    /\b(qué|opinión|vale|correcto|válido|problema)\b/.test(t)
  ) {
    return true
  }
  if (/^(continúa|continua|sigue|continúe|continúa el análisis)\b/i.test(t)) return true
  if (t.includes('calidad académica') || t.includes('calidad academica')) return true
  if (t.includes('calidad editorial') || t.includes('engagement') || t.includes('retención') || t.includes('retencion'))
    return true
  if (/\b(guion|guión|script|newsletter|carrusel|titular|titulares|cta)\b/.test(t) && /\b(revisa|evalúa|evalua|analiza|mejora)\b/.test(t))
    return true
  if (t.includes('rigor') && (t.includes('académic') || t.includes('texto') || t.includes('ensayo'))) return true
  if (/\b(rúbrica|rubrica)\b/.test(t)) return true
  if (t.includes('tesis') && (t.includes('evalúa') || t.includes('evalua') || t.includes('revisa'))) return true
  if (t.includes('ensayo') && (t.includes('evalúa') || t.includes('evalua') || t.includes('calif'))) return true
  return false
}

export type ReferenceAttachment = { mimeType: string; data: string; fileName: string }

function mergeReferenceFiles(prev: ReferenceAttachment[], incoming: ReferenceAttachment[]): ReferenceAttachment[] {
  const byName = new Map<string, ReferenceAttachment>()
  for (const f of prev) byName.set(f.fileName, f)
  for (const f of incoming) byName.set(f.fileName, f)
  return Array.from(byName.values())
}

function collectAttachmentsFromMessages(msgs: ChatMessage[]): ReferenceAttachment[] {
  const byName = new Map<string, ReferenceAttachment>()
  for (const m of msgs) {
    if (m.role !== 'user' || !m.attachments?.length) continue
    for (const a of m.attachments) {
      const name = a.fileName?.trim() || 'adjunto'
      byName.set(name, { mimeType: a.mimeType, data: a.data, fileName: name })
    }
  }
  return Array.from(byName.values())
}

const MAX_FILE_SIZE_MB = 15
const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png,image/webp'

/** Mensajes del hilo que se envían al modelo (sin contar system ni el turno actual). */
const RECENT_MESSAGE_WINDOW = 20

/**
 * Caracteres del documento en texto plano incluidos en el system prompt.
 * Alineado con ventanas de contexto grandes de Gemini 2.5+ (el modelo trunca si excede su límite).
 */
const DOC_CONTEXT_MAX_CHARS = 48_000

/**
 * Tokens de salida (maxOutputTokens) según familia de modelo, para no cortar respuestas largas (MAX_TOKENS).
 * Flash suele tener techo menor que Pro en la API de Google.
 */
function maxOutputTokensForAgentModel(modelId: string): number {
  const id = modelId.toLowerCase()
  if (id.includes('flash')) return 8192
  if (id.includes('2.5-pro') || id.includes('3.1-pro')) return 32_768
  return 16_384
}

export function DocumentEditorAgent({
  open,
  onOpenChange,
  documentId,
  evidenceDocumentId,
  chatSessionKey = 0,
  documentContext,
  agentProfileOverride,
  documentPlaceholderRegistry,
  editorApiRef,
  initialMessages = [],
  onMessagesChange,
  onResearchEvidenceAppend,
  researchEvidenceAddedBy,
  onContentChange,
  appliedMods = {},
  onAppliedModsChange,
  documentPrivacyScan,
  onApplyDocumentPendingMatch,
  onRevertDocumentPlaceholder,
  onSetDocumentPlaceholderLabel,
  onRegisterPrivacyMappingsFromRows,
  onGoToDocumentPlaceholder,
  initialSubView,
}: DocumentEditorAgentProps) {
  const evidenceDocId = evidenceDocumentId ?? documentId

  const systemPrompt = useMemo(() => {
    const profile = agentProfileOverride || inferAgentProfile({ documentType: documentContext?.type })
    return agentSystemPromptForProfile(profile)
  }, [agentProfileOverride, documentContext?.type])

  const scoreDomain = useMemo<'legal' | 'academic' | 'creator'>(() => {
    const p = agentProfileOverride ?? inferAgentProfile({ documentType: documentContext?.type })
    if (p === 'legal_mx') return 'legal'
    if (p === 'creator_es') return 'creator'
    return 'academic'
  }, [agentProfileOverride, documentContext?.type])
  const scoreLabels = documentScoreUiLabels(scoreDomain)
  /** Texto plano actual del Quill en el momento de la llamada (evita desfase con el HTML en React). */
  const getLiveDocumentPlain = () => {
    const api = editorApiRef.current
    if (api?.getPlainText) {
      try {
        return api.getPlainText()
      } catch {
        /* */
      }
    }
    return documentContext.contentPlain
  }

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const initialMessagesRef = useRef(initialMessages)
  initialMessagesRef.current = initialMessages
  const lastChatHydrateRef = useRef<{ doc: string; key: number }>({ doc: '', key: -1 })
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Array<{ mimeType: string; data: string; fileName: string }>>([])
  /** Archivos del hilo reenviados en cada petición (evita tener que volver a subirlos). */
  const [referenceFiles, setReferenceFiles] = useState<ReferenceAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasLLM, setHasLLM] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendingRef = useRef(false) // Bloquea key repeat: Enter mantenido = 1 sola llamada
  /** Texto importado de PDF (ya sanitizado) pendiente de incluir en el próximo envío si no se insertó en el editor. */
  const pendingImportSanitizedRef = useRef<string | null>(null)
  /** Filas de sustitución del último PDF confirmado; se adjuntan al siguiente mensaje de usuario enviado. */
  const pendingPdfPrivacyRowsRef = useRef<PiiReviewRow[] | null>(null)

  const [pdfPiiOpen, setPdfPiiOpen] = useState(false)
  const [pdfPiiDraft, setPdfPiiDraft] = useState<{
    fileNames: string[]
    rawText: string
    sanitized: string
    rows: PiiReviewRow[]
    matches: PiiMatch[]
    insertInEditor: boolean
  } | null>(null)
  const [pdfExtracting, setPdfExtracting] = useState(false)

  const [sendPiiOpen, setSendPiiOpen] = useState(false)
  const [sendPiiDraft, setSendPiiDraft] = useState<{
    docPlain: string
    msgPlain: string
    docMatches: PiiMatch[]
    msgMatches: PiiMatch[]
    rows: PiiReviewRow[]
    docSan: string
    msgSan: string
  } | null>(null)
  const sendGateContextRef = useRef<{
    effectiveRef: ReferenceAttachment[]
    displayAttachments?: ChatMessage['attachments']
    hadPending: boolean
  } | null>(null)

  const [agentSubView, setAgentSubView] = useState<'chat' | 'privacy'>(() => initialSubView ?? 'chat')
  /** Incrementa al abrir cada revisión PII para reiniciar estado interno del panel. */
  const [privacyReviewSession, setPrivacyReviewSession] = useState(0)
  const [lastPrivacyTabRows, setLastPrivacyTabRows] = useState<PiiReviewRow[]>([])
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [mappingDialogRows, setMappingDialogRows] = useState<PiiReviewRow[]>([])
  const [labelDialogPh, setLabelDialogPh] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')

  const mergedDocPlaceholderRows = useMemo(() => {
    const plain = documentContext.contentPlain
    const reg = documentPlaceholderRegistry ?? []
    const embedded = documentPrivacyScan?.embeddedInDocument ?? []
    const seen = new Set<string>()
    const out: Array<{
      placeholder: string
      kind: PiiReviewRow['kind']
      original: string
      label?: string
      canRevert: boolean
    }> = []
    for (const e of reg) {
      if (!plain.includes(e.placeholder)) continue
      out.push({
        placeholder: e.placeholder,
        kind: e.kind ?? kindFromNelaiBracketToken(e.placeholder),
        original: e.original,
        label: e.label,
        canRevert: true,
      })
      seen.add(e.placeholder)
    }
    for (const er of embedded) {
      if (seen.has(er.placeholder)) continue
      out.push({
        placeholder: er.placeholder,
        kind: er.kind,
        original: '(sin registro de original en esta sesión)',
        canRevert: false,
      })
    }
    return out
  }, [documentContext.contentPlain, documentPlaceholderRegistry, documentPrivacyScan?.embeddedInDocument])

  const messagesRef = useRef(messages)
  const referenceFilesRef = useRef(referenceFiles)
  const attachmentsRef = useRef(attachments)
  const inputRef = useRef(input)
  const selectedModelRef = useRef(selectedModel)
  messagesRef.current = messages
  referenceFilesRef.current = referenceFiles
  attachmentsRef.current = attachments
  inputRef.current = input
  selectedModelRef.current = selectedModel

  useEffect(() => {
    if (open) {
      document.body.classList.add('agent-open')
    } else {
      document.body.classList.remove('agent-open')
    }
    return () => document.body.classList.remove('agent-open')
  }, [open])

  useEffect(() => {
    canUseLlmForAgent().then(setHasLLM)
  }, [open])

  useEffect(() => {
    if (pdfPiiOpen || sendPiiOpen) {
      setAgentSubView('privacy')
    }
  }, [pdfPiiOpen, sendPiiOpen])

  /**
   * Hidratar chat solo al cambiar `documentId` o `chatSessionKey` (carga desde IDB / sesión).
   * No depende de `initialMessages` en el array de deps: si no, cada re-render del padre puede
   * vaciar el hilo (p. ej. HMR o referencias nuevas de `chatHistory`).
   */
  useEffect(() => {
    const doc = documentId ?? ''
    if (lastChatHydrateRef.current.doc === doc && lastChatHydrateRef.current.key === chatSessionKey) {
      return
    }
    lastChatHydrateRef.current = { doc, key: chatSessionKey }
    const next = initialMessagesRef.current
    const list = Array.isArray(next) ? next : []
    setMessages(list)
    const merged = collectAttachmentsFromMessages(list)
    setReferenceFiles(merged.length > 0 ? merged : [])
    const lastUserWithSubs = [...list]
      .reverse()
      .find((m) => m.role === 'user' && m.privacySubstitutions && m.privacySubstitutions.length > 0)
    setLastPrivacyTabRows(lastUserWithSubs?.privacySubstitutions ?? [])
    setAgentSubView('chat')
  }, [documentId, chatSessionKey])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (onMessagesChange && messages.length > 0) {
      onMessagesChange(messages)
    }
  }, [messages])

  const buildContext = (threadRefFiles?: ReferenceAttachment[], contentPlainOverride?: string) => {
    const parts: string[] = []
    const ref = threadRefFiles ?? referenceFiles
    if (documentContext.title) parts.push(`Título: ${documentContext.title}`)
    if (documentContext.type) parts.push(`Tipo: ${documentContext.type}`)
    if (documentContext.description) parts.push(`Descripción: ${documentContext.description}`)
    if (ref.length) {
      parts.push(
        `Archivos adjuntos en contexto del chat (aplican a todo el hilo; no hace falta volver a subirlos): ${ref.map((f) => f.fileName).join(', ')}`
      )
    }
    const plainSource = contentPlainOverride ?? documentContext.contentPlain
    if (plainSource) {
      const plain = plainSource
      const preview = plain.slice(0, DOC_CONTEXT_MAX_CHARS)
      parts.push(
        `Contenido actual del documento:\n${preview}${plain.length > DOC_CONTEXT_MAX_CHARS ? '\n[... documento truncado en contexto por longitud ...]' : ''}`
      )
    }
    const reg = documentPlaceholderRegistry ?? []
    const activeRegs = reg.filter((e) => (plainSource || '').includes(e.placeholder))
    if (activeRegs.length > 0) {
      const lines = activeRegs.map((e) => {
        const kind = e.kind ?? kindFromNelaiBracketToken(e.placeholder)
        const lab = e.label?.trim()
        return lab
          ? `- ${e.placeholder} (tipo ${kind}; etiqueta en la app: ${lab})`
          : `- ${e.placeholder} (tipo ${kind})`
      })
      parts.push(
        `Placeholders CRITERIA activos en el documento (referencias opacas; no se incluyen aquí los textos originales):\n${lines.join('\n')}`
      )
    }
    return parts.length ? `\n\nContexto del documento:\n${parts.join('\n')}` : ''
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024
    const list = Array.from(files)
    e.target.value = ''

    const pdfs = list.filter((f) => f.type === 'application/pdf')
    const others = list.filter((f) => f.type !== 'application/pdf')

    for (const file of others) {
      if (file.size > maxBytes) {
        toast.error(`${file.name} supera ${MAX_FILE_SIZE_MB} MB`)
        continue
      }
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.includes(',') ? result.split(',')[1] : result
        setAttachments((prev) => [...prev, { mimeType: file.type, data: base64, fileName: file.name }])
      }
      reader.readAsDataURL(file)
    }

    if (!pdfs.length) return

    for (const file of pdfs) {
      if (file.size > maxBytes) {
        toast.error(`${file.name} supera ${MAX_FILE_SIZE_MB} MB`)
        continue
      }
    }
    const validPdfs = pdfs.filter((f) => f.size <= maxBytes)
    if (!validPdfs.length) return

    setPdfExtracting(true)
    try {
      const chunks: string[] = []
      const names: string[] = []
      for (const file of validPdfs) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.includes(',') ? result.split(',')[1] : result)
          }
          reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
          reader.readAsDataURL(file)
        })
        const text = await extractTextFromPdfBase64(base64)
        if (!text.trim()) {
          toast.error(`${file.name}: no se extrajo texto (¿PDF escaneado sin capa de texto?)`)
          continue
        }
        names.push(file.name)
        chunks.push(`--- ${file.name} ---\n\n${text}`)
      }
      if (!chunks.length) return

      const rawText = chunks.join('\n\n')
      const { sanitized, rows, matches } = anonymizePlainText(rawText)
      setPdfPiiDraft({
        fileNames: names,
        rawText,
        sanitized,
        rows,
        matches,
        insertInEditor: true,
      })
      setPrivacyReviewSession((s) => s + 1)
      setPdfPiiOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al extraer el PDF')
    } finally {
      setPdfExtracting(false)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const removeReferenceFile = (fileName: string) => {
    setReferenceFiles((prev) => prev.filter((f) => f.fileName !== fileName))
    toast.info('Archivo quitado del contexto del chat')
  }

  /** No enviar PDF binario al modelo: solo imágenes u otros tipos admitidos. */
  const withoutPdfBinaries = (refs: ReferenceAttachment[]) =>
    refs.filter((a) => a.mimeType !== 'application/pdf')

  const submitToLlm = async (opts: {
    userContentDisplay: string
    documentPlainForContext: string
    effectiveRef: ReferenceAttachment[]
    displayAttachments?: ChatMessage['attachments']
    privacySanitized: boolean
    /** Sustituciones del diálogo previo al envío (documento + mensaje). */
    privacySubstitutions?: PiiReviewRow[]
    hadPendingImport: boolean
  }) => {
    if (opts.hadPendingImport) pendingImportSanitizedRef.current = null

    const pendingPdfRows = pendingPdfPrivacyRowsRef.current
    pendingPdfPrivacyRowsRef.current = null

    const registryRows: PiiReviewRow[] = (documentPlaceholderRegistry ?? [])
      .filter((e) => opts.documentPlainForContext.includes(e.placeholder))
      .map((e) => ({
        kind: e.kind ?? kindFromNelaiBracketToken(e.placeholder),
        original: e.original,
        placeholder: e.placeholder,
        source: 'document' as const,
      }))

    const mergedSubs = dedupePiiRowsByPlaceholder([
      ...(pendingPdfRows ?? []),
      ...(opts.privacySubstitutions ?? []),
      ...registryRows,
    ])
    const privacySubstitutions = mergedSubs.length > 0 ? mergedSubs : undefined
    const privacySanitizedFlag = !!(privacySubstitutions?.length || opts.privacySanitized)

    if (privacySubstitutions?.length) {
      setLastPrivacyTabRows(privacySubstitutions)
    }
    setAgentSubView('chat')

    const apiRef = withoutPdfBinaries(opts.effectiveRef)
    const hasAttachmentsForApi = apiRef.length > 0
    const userContentForApiBase = opts.userContentDisplay
    const userContentForApi =
      shouldRequireLegalScore(
        userContentForApiBase,
        hasAttachmentsForApi,
        !!opts.documentPlainForContext.trim()
      )
        ? userContentForApiBase + SCORE_API_REMINDER
        : userContentForApiBase

    const priorMessages = messagesRef.current
    const userChatIndex = priorMessages.length

    if (evidenceDocId && onResearchEvidenceAppend) {
      const userUrls = extractHttpUrlsFromText(opts.userContentDisplay)
      if (userUrls.length) {
        const entries = buildResearchEvidenceEntries(evidenceDocId, userUrls, {
          origin: 'user_message',
          chatHistoryIndex: userChatIndex,
          addedBy: researchEvidenceAddedBy,
          indexedFromUserPrompt: opts.userContentDisplay,
        })
        void Promise.resolve(onResearchEvidenceAppend(entries)).catch((e) =>
          console.error('[DocumentEditorAgent] bitácora (mensaje usuario)', e)
        )
      }
    }

    setInput('')
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: opts.userContentDisplay,
        timestamp: Date.now(),
        attachments: opts.displayAttachments,
        privacySanitized: privacySanitizedFlag || undefined,
        privacySubstitutions,
      },
    ])
    setAttachments([])
    setReferenceFiles(opts.effectiveRef)
    setLoading(true)

    try {
      const llmOk = await canUseLlmForAgent()
      const config = await getActiveLLMConfig()
      if (!config || !llmOk) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'No hay API de IA disponible. Ve a Configuración > IA (LLM): clave propia o Gemini vía proxy con VITE_LLM_PROXY_USES_SERVER_KEY y sesión de organización.',
            timestamp: Date.now(),
          },
        ])
        return
      }

      const modelId = selectedModelRef.current
      const activeConfig = { ...config, model: modelId }

      const contextBlock = buildContext(apiRef, opts.documentPlainForContext)

      const recentThread = priorMessages.slice(-RECENT_MESSAGE_WINDOW).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        attachments: undefined,
      }))

      const chatMessages = [
        { role: 'system' as const, content: systemPrompt + contextBlock },
        ...recentThread,
        {
          role: 'user' as const,
          content: userContentForApi,
          attachments:
            apiRef.length > 0
              ? apiRef.map((a) => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName }))
              : undefined,
        },
      ]

      const hasFileAttachments = chatMessages.some((m) => m.attachments?.length)
      const res = await chatCompletion(activeConfig, chatMessages, {
        maxTokens: maxOutputTokensForAgentModel(modelId),
        temperature: 0.7,
        googleSearch: config.provider === 'gemini' && !hasFileAttachments,
      })

      if (res.error) {
        const is429 =
          res.error.includes('429') ||
          res.content?.includes('Demasiadas solicitudes') ||
          res.content?.includes('Cuota de IA')

        let msg = `Error: ${res.error}`
        if (is429) {
          msg =
            '⚠️ **Límite de solicitudes de la IA alcanzado (429).**\n\nEste modelo tiene límites estrictos en el nivel gratuito. Por favor:\n1. Espera **60 segundos**.\n2. Evita enviar archivos muy pesados repetidamente.\n3. Asegúrate de que el servidor proxy esté funcionando.'
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: msg, isError: true, timestamp: Date.now() }])

        if (is429) {
          toast.error('Límite excedido (Rate Limit)', {
            description: 'Google Cloud ha limitado temporalmente tus peticiones. Espera 1 minuto.',
            duration: 8000,
          })
        }
        return
      }

      if (res.truncated) {
        toast.warning('La respuesta se cortó por límite de tokens. Puedes pedir que continúe.')
      }
      const rawAssistant = res.content || ''
      const { score: documentScore, cleanText } = stripAndParseDocumentScore(rawAssistant)
      const assistantBody = (cleanText || rawAssistant).trim()
      const assistantChatIndex = userChatIndex + 1
      if (evidenceDocId && onResearchEvidenceAppend) {
        const mergedForSources = [rawAssistant, assistantBody].filter(Boolean).join('\n\n')
        const refs = collectAssistantSourceRefs(mergedForSources, res.citations)
        if (refs.length) {
          const entries = buildResearchEvidenceEntriesFromRefs(evidenceDocId, refs, {
            origin: 'assistant_message',
            chatHistoryIndex: assistantChatIndex,
            addedBy: researchEvidenceAddedBy,
            indexedFromUserPrompt: opts.userContentDisplay,
          })
          void Promise.resolve(onResearchEvidenceAppend(entries)).catch((e) =>
            console.error('[DocumentEditorAgent] bitácora (respuesta asistente)', e)
          )
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantBody,
          timestamp: Date.now(),
          documentScore: documentScore ?? undefined,
          truncated: !!res.truncated,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Error desconocido'}`,
          isError: true,
          timestamp: Date.now(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    const text = inputRef.current.trim()
    if ((!text && attachmentsRef.current.length === 0) || loading || sendingRef.current) return
    if (pdfPiiOpen || sendPiiOpen) return

    if (!hasLLM) {
      toast.error('Configura una API de IA en Configuración > IA (LLM)')
      return
    }

    sendingRef.current = true
    try {
      const userContent = text || 'Analiza este documento o archivo.'
      const hadPending = Boolean(pendingImportSanitizedRef.current)
      const composedUser = hadPending
        ? `${userContent}\n\n--- Texto importado de PDF (sanitizado) ---\n${pendingImportSanitizedRef.current!.trim()}`.trim()
        : userContent

      const atts = attachmentsRef.current
      const hasIncoming = atts.length > 0
      const incomingRef: ReferenceAttachment[] = hasIncoming
        ? atts.map((a) => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName }))
        : []
      const effectiveRef = mergeReferenceFiles(referenceFilesRef.current, incomingRef)
      const displayAttachments = hasIncoming
        ? atts.map((a) => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName }))
        : undefined

      const docPlainLive = getLiveDocumentPlain()
      const gate = anonymizeDocAndMessage(docPlainLive, composedUser)
      if (gate.hasPii) {
        sendGateContextRef.current = { effectiveRef, displayAttachments, hadPending }
        setSendPiiDraft({
          docPlain: docPlainLive,
          msgPlain: composedUser,
          docMatches: gate.docMatches,
          msgMatches: gate.msgMatches,
          rows: gate.rows,
          docSan: gate.docSan,
          msgSan: gate.msgSan,
        })
        setPrivacyReviewSession((s) => s + 1)
        setSendPiiOpen(true)
        sendingRef.current = false
        return
      }

      await submitToLlm({
        userContentDisplay: composedUser,
        documentPlainForContext: docPlainLive,
        effectiveRef,
        displayAttachments,
        privacySanitized: false,
        privacySubstitutions: undefined,
        hadPendingImport: hadPending,
      })
    } finally {
      sendingRef.current = false
    }
  }

  const handleInsert = (content: string) => {
    const api = editorApiRef?.current
    if (!api) {
      toast.error('El editor no está listo')
      return
    }
    // El foco suele estar en el panel del agente: insertAtCursor usaría un cursor antiguo.
    if (api.insertAtDocumentEnd) {
      api.insertAtDocumentEnd(content)
    } else {
      api.insertAtCursor(content)
    }
    toast.success('Texto insertado al final del documento')
    
    if (onContentChange) {
      onContentChange(api.getContent(), 'Texto insertado por IA')
    }
  }

  const handleReplace = (original: string, replacement: string, msgKey: string, modIdx: number) => {
    const api = editorApiRef?.current
    if (!api) {
      toast.error('El editor no está listo')
      return
    }
    const success = api.replaceText(original, replacement)
    if (success) {
      toast.success('Texto modificado correctamente')
      
      // Registrar que esta mod fue aplicada con timestamp
      if (onAppliedModsChange) {
        onAppliedModsChange({
          ...appliedMods,
          [`${msgKey}-${modIdx}`]: Date.now()
        })
      }

      if (onContentChange) {
        onContentChange(api.getContent(), 'Sugerencia de IA aplicada')
      }
    } else {
      toast.error('No se encontró el texto original en el documento')
    }
  }

  // Parsear la respuesta para extraer bloques de modificación, contenido insertable y score (mismo bloque en legal/académico)
  const parseResponse = (content: string) => {
    const { score: legalScore, cleanText: afterScore } = stripAndParseDocumentScore(content)
    const modifications: Array<{ original: string; replacement: string }> = []
    const modRegex = /\[MODIFICAR\]([\s\S]*?)\[\/MODIFICAR\]\s*\[POR\]([\s\S]*?)\[\/POR\]/g
    let match
    while ((match = modRegex.exec(afterScore)) !== null) {
      modifications.push({ original: match[1].trim(), replacement: match[2].trim() })
    }

    const insertableBlocks: string[] = []
    const contentRegex = /\[CONTENIDO\]([\s\S]*?)\[\/CONTENIDO\]/g
    while ((match = contentRegex.exec(afterScore)) !== null) {
      const block = match[1].trim()
      if (block) insertableBlocks.push(block)
    }

    const cleanText = afterScore
      .replace(/\[MODIFICAR\][\s\S]*?\[\/MODIFICAR\]\s*\[POR\][\s\S]*?\[\/POR\]/g, '')
      .replace(/\[CONTENIDO\][\s\S]*?\[\/CONTENIDO\]/g, '')
      .trim()
    return { modifications, insertableBlocks, legalScore, cleanText }
  }

  const handlePdfPiiCancel = () => {
    setPdfPiiOpen(false)
    setPdfPiiDraft(null)
    setAgentSubView('chat')
  }

  const handlePdfPiiConfirm = (payload: PiiReviewConfirmPayload) => {
    if (payload.scope !== 'pdf' || !pdfPiiDraft) return
    const insertInEditor = pdfPiiDraft.insertInEditor
    const rowsTagged = payload.rows.map((r) => ({
      ...r,
      source: 'pdf_import' as const,
    }))

    if (insertInEditor) {
      const api = editorApiRef?.current
      if (!api) {
        toast.error('El editor no está listo')
        return
      }
      api.insertAtCursor(`${payload.sanitized}\n\n`)
      onContentChange?.(api.getContent(), 'Texto importado de PDF (sanitizado)')
      if (rowsTagged.length) {
        onRegisterPrivacyMappingsFromRows?.(rowsTagged)
        toast.success('Texto insertado con sustituciones registradas')
      } else {
        toast.success('Texto del PDF insertado en el documento', {
          description:
            'No hubo coincidencias con patrones automáticos (email, CURP, IBAN…); el bloque es el extraído del PDF. En contratos en prosa es habitual.',
        })
      }
      pendingPdfPrivacyRowsRef.current = rowsTagged.length ? rowsTagged : null
    } else {
      pendingImportSanitizedRef.current = payload.sanitized
      if (rowsTagged.length) {
        toast.message('Texto listo para el próximo envío', {
          description: 'Se añadirá al mensaje a la IA (no se insertó en el editor). Hay sustituciones registradas.',
        })
      } else {
        toast.message('Texto del PDF listo para el próximo envío', {
          description:
            'Sin sustituciones automáticas (no coincidieron patrones). Se enviará el texto extraído tal cual en tu próximo mensaje.',
        })
      }
      pendingPdfPrivacyRowsRef.current = rowsTagged.length ? rowsTagged : null
    }
    setPdfPiiOpen(false)
    setPdfPiiDraft(null)
    setAgentSubView('chat')
  }

  const handleSendPiiCancel = () => {
    sendGateContextRef.current = null
    setSendPiiOpen(false)
    setSendPiiDraft(null)
    setAgentSubView('chat')
  }

  const handleSendPiiConfirm = (payload: PiiReviewConfirmPayload) => {
    if (payload.scope !== 'send') return
    const ctx = sendGateContextRef.current
    sendGateContextRef.current = null
    setSendPiiOpen(false)
    setSendPiiDraft(null)
    if (!ctx) return
    void (async () => {
      sendingRef.current = true
      try {
        await submitToLlm({
          userContentDisplay: payload.msgSan,
          documentPlainForContext: payload.docSan,
          effectiveRef: ctx.effectiveRef,
          displayAttachments: ctx.displayAttachments,
          privacySanitized: true,
          privacySubstitutions: payload.rows,
          hadPendingImport: ctx.hadPending,
        })
      } finally {
        sendingRef.current = false
      }
    })()
  }

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 w-full bg-background border-l relative animate-in slide-in-from-right duration-300 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b shrink-0 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <h2 className="font-bold text-sm tracking-tight text-foreground">Asistente IA</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="h-7 text-[10px] w-[130px] bg-muted/50 border-none transition-all hover:bg-muted">
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-[10px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{m.name}</span>
                    <span className="text-[9px] opacity-60 line-clamp-1">{m.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" 
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {referenceFiles.length > 0 && (
        <div className="shrink-0 border-b border-primary/15 bg-primary/5 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold text-foreground leading-tight">
                Documento en contexto (la IA lo usa en cada mensaje)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {referenceFiles.map((f) => (
                  <span
                    key={f.fileName}
                    className="inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-[10px] border border-border text-foreground"
                  >
                    <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="max-w-[min(100%,14rem)] truncate">{f.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removeReferenceFile(f.fileName)}
                      className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      title="Quitar del contexto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">
                No hace falta volver a adjuntar el mismo archivo en cada pregunta.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden relative">
        <div
          className="shrink-0 flex border-b bg-muted/40 px-2 py-1.5 gap-1"
          role="tablist"
          aria-label="Vista del asistente"
        >
          <button
            type="button"
            role="tab"
            aria-selected={agentSubView === 'chat'}
            className={cn(
              'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
              agentSubView === 'chat'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setAgentSubView('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={agentSubView === 'privacy'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
              agentSubView === 'privacy'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setAgentSubView('privacy')}
          >
            <Shield className="h-3 w-3 shrink-0" aria-hidden />
            Privacidad
            {(pdfPiiOpen || sendPiiOpen) && (
              <span
                className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_0_2px_var(--background)]"
                title="Revisión pendiente"
                aria-hidden
              />
            )}
          </button>
        </div>

        {agentSubView === 'privacy' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
            {pdfPiiOpen && pdfPiiDraft ? (
              <PiiReviewPanel
                key={`pdf-${privacyReviewSession}`}
                active
                variant="pdf"
                title="Privacidad: revisar texto extraído del PDF"
                description={`Se extrajo texto de ${pdfPiiDraft.fileNames.join(', ')}. Revisa las sustituciones antes de insertar o enviar a la IA. El PDF binario no se adjunta al modelo; solo el texto sanitizado sigue el flujo acordado.`}
                rows={pdfPiiDraft.rows}
                sanitizedPreview={pdfPiiDraft.sanitized}
                pdfSelection={{ rawText: pdfPiiDraft.rawText, matches: pdfPiiDraft.matches }}
                showInsertInEditor
                insertInEditor={pdfPiiDraft.insertInEditor}
                onInsertInEditorChange={(v) =>
                  setPdfPiiDraft((d) => (d ? { ...d, insertInEditor: v } : d))
                }
                onConfirm={handlePdfPiiConfirm}
                onDismiss={handlePdfPiiCancel}
                confirmLabel="Confirmar"
              />
            ) : sendPiiOpen && sendPiiDraft ? (
              <PiiReviewPanel
                key={`send-${privacyReviewSession}`}
                active
                variant="send"
                title="Privacidad: datos en el documento o en tu mensaje"
                description="Se detectaron patrones de datos personales (correo, teléfono, identificadores, etc.). Al confirmar, el modelo recibirá el texto con placeholders CRITERIA_* (o legacy NELAI_*) en el mensaje y en el contexto del documento."
                rows={sendPiiDraft.rows}
                sanitizedPreview={
                  [
                    sendPiiDraft.docSan && `Documento (sanitizado):\n${sendPiiDraft.docSan}`,
                    `Mensaje (sanitizado):\n${sendPiiDraft.msgSan}`,
                  ]
                    .filter(Boolean)
                    .join('\n\n---\n\n')
                }
                sendSelection={{
                  docPlain: sendPiiDraft.docPlain,
                  msgPlain: sendPiiDraft.msgPlain,
                  docMatches: sendPiiDraft.docMatches,
                  msgMatches: sendPiiDraft.msgMatches,
                }}
                showInsertInEditor={false}
                insertInEditor={false}
                onInsertInEditorChange={() => {}}
                onConfirm={handleSendPiiConfirm}
                onDismiss={handleSendPiiCancel}
                confirmLabel="Enviar a la IA con anonimización"
              />
            ) : (
              <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]">
                <div className="flex flex-col gap-5 p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Cuando importes un PDF o vayas a enviar un mensaje con datos detectables, aquí aparecerá la{' '}
                    <strong className="text-foreground">revisión guiada</strong>. En el editor puedes usar el botón{' '}
                    <strong className="text-foreground">Sustituir selección por placeholder</strong> para anonimizar
                    cualquier fragmento sin límite de vista previa.
                  </p>

                  {documentPrivacyScan ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Placeholders en el documento
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Tokens <code className="text-[10px] bg-muted px-0.5 rounded">CRITERIA_*</code> en el texto
                          actual. Con registro puedes <strong className="text-foreground">revertir</strong> al valor
                          original o <strong className="text-foreground">poner un nombre</strong> solo para identificarlo
                          aquí (el token enviado a la IA no cambia).
                        </p>
                        {mergedDocPlaceholderRows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No hay tokens CRITERIA en el documento todavía.
                          </p>
                        ) : (
                          <div
                            className={cn(
                              'max-h-[min(52vh,30rem)] min-h-0 space-y-2 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-muted/15 p-2',
                              '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25',
                              '[-webkit-overflow-scrolling:touch]'
                            )}
                          >
                            {mergedDocPlaceholderRows.map((row, i) => (
                              <div
                                key={`${row.placeholder}-${i}`}
                                className="rounded-lg border border-border/80 bg-card p-3 shadow-sm"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                        {row.kind}
                                      </span>
                                      {row.label ? (
                                        <span className="text-xs font-medium text-foreground">{row.label}</span>
                                      ) : (
                                        <span className="text-xs italic text-muted-foreground">Sin nombre</span>
                                      )}
                                    </div>
                                    <p
                                      className="select-all break-all font-mono text-xs font-semibold leading-snug text-primary"
                                      title={row.placeholder}
                                    >
                                      {row.placeholder}
                                    </p>
                                    <p
                                      className="line-clamp-4 break-words text-[11px] leading-snug text-destructive/90"
                                      title={row.original}
                                    >
                                      {row.original}
                                    </p>
                                    {!row.canRevert ? (
                                      <p className="text-[10px] leading-snug text-muted-foreground">
                                        Sin registro local del original (p. ej. pegado desde fuera). No se puede
                                        revertir desde aquí.
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-stretch">
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      className="h-8 flex-1 gap-1.5 text-[11px] sm:flex-none"
                                      disabled={!onGoToDocumentPlaceholder}
                                      onClick={() => onGoToDocumentPlaceholder?.(row.placeholder)}
                                    >
                                      <LocateFixed className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      Ver en editor
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8 shrink-0"
                                          aria-label="Más acciones del placeholder"
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        {row.canRevert ? (
                                          <>
                                            <DropdownMenuItem
                                              onClick={() => onRevertDocumentPlaceholder?.(row.placeholder)}
                                            >
                                              Revertir al original
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => {
                                                const reg = documentPlaceholderRegistry?.find(
                                                  (e) => e.placeholder === row.placeholder
                                                )
                                                setLabelDraft(reg?.label ?? '')
                                                setLabelDialogPh(row.placeholder)
                                              }}
                                            >
                                              Nombrar en la lista…
                                            </DropdownMenuItem>
                                          </>
                                        ) : (
                                          <DropdownMenuItem disabled>Sin revertir disponible</DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Patrones detectados (aún visibles)
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Coincidencias por reglas en el texto actual del documento, excluyendo lo que ya está dentro
                          de un bloque <code className="text-[10px] bg-muted px-0.5 rounded">[CRITERIA_…]</code>. Pulsa
                          sustituir para insertar el placeholder en el editor.
                        </p>
                        {documentPrivacyScan.pendingDocMatches.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nada pendiente por este criterio.</p>
                        ) : (
                          <div
                            className={cn(
                              'max-h-[min(48vh,26rem)] min-h-0 space-y-2 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-muted/15 p-2',
                              '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25',
                              '[-webkit-overflow-scrolling:touch]'
                            )}
                          >
                            {documentPrivacyScan.pendingDocMatches.map((m, i) => (
                              <div
                                key={`${m.kind}-${m.start}-${m.end}-${i}`}
                                className="flex flex-col gap-2 rounded-lg border border-border/80 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase text-muted-foreground">
                                    {m.kind}
                                  </span>
                                  <p
                                    className="break-words font-mono text-[11px] leading-snug text-destructive/90"
                                    title={m.text}
                                  >
                                    {m.text}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 shrink-0 self-stretch text-[11px] sm:self-auto sm:px-4"
                                  onClick={() => onApplyDocumentPendingMatch?.(m)}
                                >
                                  Sustituir por placeholder
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Último envío con sustituciones
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Mapeo del <strong className="text-foreground">último mensaje enviado</strong> que registró
                      sustituciones (valor detectado → placeholder). Para un turno concreto del hilo, usa «Ver mapeo» en
                      la burbuja.
                    </p>
                    <PrivacySubstitutionTable rows={lastPrivacyTabRows} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
          {/* Scroll nativo: evita Radix ScrollArea (viewport interno tipo tabla + líneas largas). */}
          <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto overscroll-y-contain px-3 py-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] [scrollbar-gutter:stable] sm:px-5 sm:py-6 sm:pr-6">
          <div className="flex w-full min-w-0 max-w-full flex-col gap-8">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4 px-6 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/10 rotate-3">
                  <Bot className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="font-bold text-foreground text-base tracking-tight">¿En qué puedo ayudarte?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
                  Prueba diciendo: "Mejora este párrafo", "Cambia el tono" o "Revisa la ortografía".
                </p>
              </div>
            )}
            
            {messages.map((msg, i) => {
              const parsed = parseResponse(msg.content)
              const legalScore = msg.documentScore ?? parsed.legalScore
              const { modifications, insertableBlocks, cleanText } = parsed
              const isUser = msg.role === 'user'
              const isErr = !isUser && (msg.isError || isAssistantErrorMessage(msg.content))
              if (!msg.content.trim() && modifications.length === 0) return null

              const visibleMarkdown = cleanText || (modifications.length > 0 ? '' : msg.content)
              const plainForInsert = stripMarkdown(visibleMarkdown || msg.content).trim()

              return (
                <div
                  key={i}
                  className="flex min-w-0 w-full max-w-full flex-col animate-in slide-in-from-bottom-4 duration-500"
                >
                  <div
                    className={cn(
                      'mb-2 flex w-full min-w-0 items-center gap-2 px-1',
                      isUser ? 'flex-row-reverse justify-end' : 'flex-row justify-start'
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shadow-md",
                      isUser ? "bg-indigo-600 shadow-indigo-600/20" : isErr
                        ? "bg-amber-950 border border-amber-500/40"
                        : "bg-zinc-800 border border-white/5"
                    )}>
                      {isUser ? (
                        <User className="h-4 w-4 text-white" />
                      ) : isErr ? (
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      ) : (
                        <Bot className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">
                      {isUser ? 'Tú' : isErr ? 'Aviso del sistema' : 'CriterIA AI'}
                    </span>
                  </div>

                  <div
                    className={cn(
                      'flex w-full min-w-0 shrink-0',
                      isUser ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'relative box-border min-w-0 border px-4 py-4 shadow-2xl transition-all duration-300 [overflow-wrap:anywhere] break-words sm:px-5 sm:py-4',
                        isUser
                          ? 'w-full max-w-[min(36rem,92%)] rounded-2xl rounded-tr-none border-indigo-500/50 bg-indigo-600 text-white shadow-indigo-600/20'
                          : isErr
                            ? 'w-full max-w-[min(100%,36rem)] rounded-2xl rounded-tl-none border-amber-500/35 bg-amber-950/50 text-amber-50 backdrop-blur-xl'
                            : 'w-full max-w-[min(100%,36rem)] rounded-2xl rounded-tl-none border-zinc-800 bg-zinc-900/95 text-zinc-100 backdrop-blur-xl'
                      )}
                    >
                    <div className="min-w-0 w-full max-w-full text-[13px] leading-relaxed">
                      {isUser &&
                        (msg.privacySanitized ||
                          (msg.privacySubstitutions && msg.privacySubstitutions.length > 0)) && (
                          <div className="mb-3 rounded-lg border border-amber-200/50 bg-amber-950/35 px-3 py-2.5 text-white shadow-inner">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-tight text-amber-100">
                                <Shield className="h-4 w-4 shrink-0 text-amber-200" aria-hidden />
                                Privacidad
                              </span>
                              {msg.privacySubstitutions && msg.privacySubstitutions.length > 0 ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 text-[10px] font-semibold bg-white/95 text-indigo-900 hover:bg-white border-0 shadow-sm"
                                  onClick={() => {
                                    setMappingDialogRows(msg.privacySubstitutions ?? [])
                                    setMappingDialogOpen(true)
                                  }}
                                >
                                  Ver mapeo ({msg.privacySubstitutions.length})
                                </Button>
                              ) : null}
                            </div>
                            <p className="mt-1.5 text-[10px] leading-snug text-amber-50/95">
                              {msg.privacySubstitutions && msg.privacySubstitutions.length > 0
                                ? `Transparencia de este envío: ${msg.privacySubstitutions.length} fila(s) en el mapeo (original → token enviado a la IA). Suele incluir todos los placeholders que siguen en el documento además de sustituciones nuevas de este turno; no indica que hayas añadido exactamente ese número de datos en este mensaje.`
                                : 'Este mensaje se marcó como revisado por privacidad; no hay tabla de sustituciones guardada para él.'}
                            </p>
                          </div>
                        )}

                      {!isUser && legalScore && !isErr && (
                        <div
                          className="mb-4 min-w-0 max-w-full rounded-xl border p-4 shadow-lg"
                          style={{
                            background:
                              legalScore.score >= 70
                                ? 'rgba(34,197,94,0.07)'
                                : legalScore.score >= 40
                                  ? 'rgba(234,179,8,0.07)'
                                  : 'rgba(239,68,68,0.07)',
                            borderColor:
                              legalScore.score >= 70
                                ? 'rgba(34,197,94,0.2)'
                                : legalScore.score >= 40
                                  ? 'rgba(234,179,8,0.2)'
                                  : 'rgba(239,68,68,0.2)',
                          }}
                        >
                          <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                            {scoreLabels.panelTitle}
                          </p>
                          <div className="mb-3 flex min-w-0 items-center gap-3">
                            <div className="relative w-14 h-14 shrink-0">
                              <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                                <path
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke="rgba(255,255,255,0.05)"
                                  strokeWidth="3"
                                />
                                <path
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke={legalScore.score >= 70 ? '#22c55e' : legalScore.score >= 40 ? '#eab308' : '#ef4444'}
                                  strokeWidth="3"
                                  strokeDasharray={`${legalScore.score}, 100`}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span
                                className="absolute inset-0 flex items-center justify-center text-sm font-black"
                                style={{
                                  color:
                                    legalScore.score >= 70 ? '#22c55e' : legalScore.score >= 40 ? '#eab308' : '#ef4444',
                                }}
                              >
                                {legalScore.score}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                                <Shield
                                  className="h-4 w-4"
                                  style={{
                                    color:
                                      legalScore.score >= 70 ? '#22c55e' : legalScore.score >= 40 ? '#eab308' : '#ef4444',
                                  }}
                                />
                                <span
                                  className="text-[11px] font-black uppercase tracking-widest"
                                  style={{
                                    color:
                                      legalScore.score >= 70 ? '#22c55e' : legalScore.score >= 40 ? '#eab308' : '#ef4444',
                                  }}
                                >
                                  {scoreLabels.confidence} {legalScore.level}
                                </span>
                              </div>
                              <p className="break-words text-[11px] leading-relaxed text-zinc-400">{legalScore.summary}</p>
                            </div>
                          </div>
                          {(legalScore.risks || []).length > 0 && (
                            <div className="space-y-1.5 mt-3 pt-3 border-t border-white/5">
                              <p className="text-[9px] uppercase tracking-widest font-black text-zinc-500">
                                {scoreLabels.risksTitle}
                              </p>
                              {(legalScore.risks || []).map((risk, ri) => (
                                <div key={ri} className="flex min-w-0 items-start gap-2 text-[11px] text-zinc-400">
                                  <span className="mt-0.5 shrink-0 text-red-400">⚠</span>
                                  <span className="min-w-0 break-words">{risk}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <MarkdownContent 
                        content={visibleMarkdown} 
                        size="sm" 
                        className={cn(
                          "select-text",
                          isUser ? "text-white [&_p]:text-white" : isErr ? "text-amber-50 [&_p]:text-amber-50 [&_strong]:text-amber-200" : "text-zinc-100"
                        )}
                      />

                      {isUser && msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
                          {msg.attachments.map((a, ai) => (
                            <span
                              key={`${a.fileName}-${ai}`}
                              className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[10px] font-medium text-white/95 border border-white/20"
                            >
                              <Paperclip className="h-3 w-3 shrink-0 opacity-90" />
                              <span className="max-w-[200px] truncate">{a.fileName}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {msg.role === 'assistant' && msg.truncated && !isErr && (
                        <div
                          role="status"
                          className="mt-3 rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-[11px] leading-snug text-amber-100/95"
                        >
                          <span className="font-semibold text-amber-300">Respuesta incompleta. </span>
                          El modelo alcanzó el límite de longitud. Escribe «continúa» o divide la pregunta para obtener el resto del análisis.
                        </div>
                      )}
                      
                      {modifications.length > 0 && (
                        <div className="mt-5 space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="h-[1px] flex-1 bg-white/5" />
                            <p className="text-[9px] uppercase tracking-widest font-black text-primary/80">Ediciones propuestas</p>
                            <div className="h-[1px] flex-1 bg-white/5" />
                          </div>
                          {modifications.map((mod, j) => {
                            const appliedTimestamp = appliedMods[`${i}-${j}`]
                            return (
                              <div 
                                key={j} 
                                className="p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] shadow-lg group/mod transition-all hover:border-primary/20"
                              >
                                <div className="mb-2 flex min-w-0 items-start gap-1.5 px-1 text-[10px] italic leading-snug text-zinc-500 line-through opacity-50">
                                  <span className="min-w-0 break-words">&quot;{mod.original}&quot;</span>
                                </div>
                                <div className="mb-4 min-w-0 break-words rounded-lg border-l-2 border-primary bg-zinc-800/50 px-4 py-3 font-medium leading-relaxed text-zinc-100 shadow-inner">
                                  {mod.replacement}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant={appliedTimestamp ? "outline" : "default"}
                                    size="sm"
                                    className={cn(
                                      "h-9 text-[11px] flex-1 font-bold transition-all shadow-md active:scale-95",
                                      appliedTimestamp
                                        ? "border-zinc-500/90 bg-zinc-800 text-zinc-50 hover:bg-zinc-700 hover:text-white"
                                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                                    )}
                                    onClick={() => handleReplace(mod.original, mod.replacement, i.toString(), j)}
                                  >
                                    <Bot className="h-4 w-4 mr-2 shrink-0 opacity-95" />
                                    {appliedTimestamp ? 'Re-aplicar' : 'Aplicar cambio'}
                                  </Button>
                                  {appliedTimestamp && (
                                    <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/20 shadow-lg shadow-green-500/5">
                                      <span className="text-[10px] text-green-500 font-black">✓</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Bloques de contenido insertable */}
                      {insertableBlocks.length > 0 && (
                        <div className="mt-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-[1px] flex-1 bg-white/5" />
                            <p className="text-[9px] uppercase tracking-widest font-black text-emerald-500/80">Contenido para insertar</p>
                            <div className="h-[1px] flex-1 bg-white/5" />
                          </div>
                          {insertableBlocks.map((block, bi) => (
                            <div
                              key={bi}
                              className="min-w-0 break-words rounded-xl border border-emerald-500/10 bg-emerald-950/20 p-3 text-[12px] leading-relaxed text-zinc-200"
                            >
                              <MarkdownContent content={block} size="sm" className="text-zinc-200 mb-3" />
                              <Button
                                variant="default"
                                size="sm"
                                className="h-9 text-[11px] w-full border border-emerald-500/40 bg-emerald-600 font-bold text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-500 hover:text-white active:scale-95"
                                onClick={() => handleInsert(stripMarkdown(block))}
                              >
                                <FileCheck className="h-3.5 w-3.5 mr-2 shrink-0 opacity-95" />
                                Insertar en documento
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Acciones secundarias: copiar siempre en respuestas útiles; insertar solo si hay texto sustancial */}
                      {msg.role === 'assistant' && !isErr && !modifications.length && insertableBlocks.length === 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[11px] text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                            onClick={() => {
                              void navigator.clipboard.writeText(plainForInsert || msg.content)
                              toast.success('Copiado al portapapeles')
                            }}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5 shrink-0 opacity-90" />
                            Copiar
                          </Button>
                          {plainForInsert.length >= MIN_CHARS_FOR_INSERT && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-[11px] border-zinc-500/90 bg-zinc-800/90 text-zinc-50 hover:bg-zinc-700 hover:text-white"
                              onClick={() => handleInsert(stripMarkdown(msg.content))}
                            >
                              <FileCheck className="h-3.5 w-3.5 mr-1.5 shrink-0 opacity-95" />
                              Insertar en documento
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              )
            })}
            
            {loading && (
              <div className="flex max-w-[min(100%,36rem)] min-w-0 flex-col gap-2 self-start animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-1 px-1">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/5">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">CriterIA AI</span>
                </div>
                <div className="max-w-[min(100%,36rem)] min-w-0 rounded-2xl rounded-tl-none border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Generando respuesta…</span>
                      <span className="text-[10px] text-muted-foreground/70 leading-snug">
                        Si acabas de subir un PDF o el texto es muy largo, puede tardar un poco.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} className="h-4 shrink-0" />
          </div>
          </div>
          </>
        )}

        <div className="p-3 border-t bg-background/80 backdrop-blur-md sticky bottom-0 z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
          <div className="space-y-3">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded bg-primary/5 px-2 py-1 text-[10px] border border-primary/10 text-primary-foreground font-medium">
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[100px] truncate">{a.fileName}</span>
                    <button onClick={() => removeAttachment(i)} className="ml-1 p-0.5 hover:text-destructive bg-background rounded-full">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 bg-muted/30 p-1 rounded-2xl border border-muted-foreground/10 focus-within:border-primary/30 transition-all shadow-inner">
              <input 
                ref={fileInputRef} 
                type="file" 
                multiple 
                className="hidden" 
                onChange={handleFileSelect} 
                accept={ACCEPTED_TYPES}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl hover:bg-primary/5 text-muted-foreground transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || pdfExtracting}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta algo sobre el documento..."
                className="resize-none min-h-[40px] max-h-[150px] bg-transparent border-none shadow-none focus-visible:ring-0 text-[13px] py-1.5 placeholder:text-muted-foreground/50 transition-all font-medium"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <Button 
                onClick={handleSend} 
                disabled={loading || pdfExtracting || pdfPiiOpen || sendPiiOpen || (!input.trim() && attachments.length === 0)} 
                size="icon" 
                className={`h-10 w-10 shrink-0 rounded-xl transition-all shadow-md ${
                  input.trim() || attachments.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                    : 'bg-muted'
                }`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[9px] text-center text-muted-foreground/40 font-medium">
              CriterIA AI puede cometer errores. Verifica el contenido generado.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={!!labelDialogPh} onOpenChange={(o) => !o && setLabelDialogPh(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nombre para el placeholder</DialogTitle>
            <DialogDescription>
              Solo se usa en esta pestaña para reconocer el token. El documento y la IA siguen usando el mismo{' '}
              <code className="text-xs bg-muted px-1 rounded">CRITERIA_*</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="ph-label">Etiqueta</Label>
            <Input
              id="ph-label"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="Ej. Cliente principal, domicilio fiscal…"
              maxLength={120}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setLabelDialogPh(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (labelDialogPh) {
                  onSetDocumentPlaceholderLabel?.(labelDialogPh, labelDraft)
                }
                setLabelDialogPh(null)
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrivacyMappingDialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen} rows={mappingDialogRows} />
    </div>
  )
}
