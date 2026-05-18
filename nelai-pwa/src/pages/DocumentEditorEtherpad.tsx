import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { MarkdownContent } from '@/components/ui/markdown-content'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  RefreshCw,
  Shield,
  Bot,
  Wand2,
  EyeOff,
  Send,
  Copy,
  Menu,
  Save,
  BookMarked,
  User,
  Loader2,
  ChevronDown,
  X,
  Upload,
} from 'lucide-react'

import { createDocument, updateDocumentContent } from '@/services/documents/DocumentService'
import {
  createOrGetPadSession,
  createRedaction,
  exportPadMarkdown,
  fetchPadText,
  listRedactions,
  restoreRedaction,
  setPadText,
  type RedactionRow,
} from '@/services/etherpad/padsApi'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useDocumentEditorLayout } from '@/contexts/DocumentEditorLayoutContext'
import { QuickIdentitySetupDialog } from '@/components/workspace/QuickIdentitySetupDialog'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { useSidebar } from '@/components/ui/sidebar'
import { anonymizeDocAndMessage, anonymizeWithMatches } from '@/services/privacy/piiAnonymize'
import { detectPiiOutsideCriteriaBrackets } from '@/services/privacy/criteriaPlaceholders'
import type { PiiReviewRow } from '@/services/privacy/piiTypes'
import { chatCompletion } from '@/services/criteria/llmClient'
import { getActiveLLMConfig } from '@/config/llmConfig'
import { ensureSaaSPlatformGeminiConfig } from '@/config/saasDefaultLlm'
import {
  type AgentProfile,
  SCORE_API_REMINDER,
  agentSystemPromptForProfile,
  inferAgentProfile,
  withAgentProfileTag,
} from '@/services/criteria/systemPrompts'
import { getDocument, updateDocument } from '@/utils/documentStorage'
import {
  appendResearchEvidenceEntries,
  buildAssistantResearchEvidenceBatch,
  buildPinnedSourcesContextBlock,
  buildResearchEvidenceEntries,
  collectAssistantSourceRefs,
  downloadResearchEvidenceCsv,
  downloadResearchEvidenceJson,
  extractHttpUrlsFromText,
  normalizeResearchEvidenceLog,
  parseResearchEvidenceLogImportJson,
  togglePinnedResearchEvidenceId,
} from '@/utils/researchEvidenceLog'
import type { ResearchEvidenceLogEntry } from '@/types/documents'
import { criteriaDomainFromAgentProfile, documentEditorPath } from '@/utils/documentListing'
import { documentScoreUiLabels, stripAndParseDocumentScore } from '@/utils/agentDocumentScore'
import { showEtherpadDevControls } from '@/config/etherpadUi'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SpotlightTour } from '@/components/help/SpotlightTour'
import { ResearchEvidenceLogTable } from '@/components/documents/ResearchEvidenceLogTable'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Tras abrir un documento, el aviso de acceso al pad se oculta solo (y se puede cerrar antes). */
const ETHERPAD_PAD_ACCESS_NOTICE_MS = 14_000

function mapEtherpadAgentMessagesToChatHistory(
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    createdAt: number
    documentScore?: { score: number; level: string; summary: string; risks: string[] } | null
  }>,
) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.createdAt,
    ...(m.documentScore ? { documentScore: m.documentScore } : {}),
  }))
}

function normalizeTextForPii(input: string): string {
  // Etherpad / copy-paste puede introducir NBSP o zero-width.
  return (input || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Intenta encontrar `needle` en `haystack` permitiendo variaciones de whitespace (espacios, NBSP, \n).
 * Devuelve { index, length } del match o null si no encontró.
 */
function findLoose(haystack: string, needle: string): { index: number; length: number } | null {
  const n = normalizeTextForPii(needle).replace(/\r\n/g, '\n').trim()
  if (!n) return null
  const h = normalizeTextForPii(haystack).replace(/\r\n/g, '\n')

  // 1) Match exacto (rápido)
  const exactIdx = h.indexOf(n)
  if (exactIdx >= 0) return { index: exactIdx, length: n.length }

  // 2) Match tolerante: tokens separados por whitespace
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const pattern = parts.map(escapeRegExp).join('[\\s\\u00A0]+')
  const re = new RegExp(pattern)
  const m = re.exec(h)
  if (!m || typeof m.index !== 'number') return null
  return { index: m.index, length: m[0].length }
}

export default function DocumentEditorEtherpad() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { accounts, isReady, hasStoredAccounts, isUnlocked } = useKeyringContext()
  const layoutCtx = useDocumentEditorLayout()
  const { toggleSidebar } = useSidebar()
  const { activeAccount } = useActiveAccount()

  const [title, setTitle] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [agentProfile, setAgentProfile] = useState<AgentProfile>('academic_es')
  const [updatingAgentProfile, setUpdatingAgentProfile] = useState(false)

  const [padUrl, setPadUrl] = useState<string | null>(null)
  const [padId, setPadId] = useState<string | null>(null)
  const [padIdFromContent, setPadIdFromContent] = useState<string | null>(null)
  const [loadingPad, setLoadingPad] = useState(false)
  const [exportingMarkdown, setExportingMarkdown] = useState(false)
  const [savingLocal, setSavingLocal] = useState(false)
  const [iframeNonce, setIframeNonce] = useState(0)
  const padIframeRef = useRef<HTMLIFrameElement | null>(null)

  // PII / Agente (flujo A)
  const [padText, setPadTextState] = useState<string>('')
  const [loadingText, setLoadingText] = useState(false)
  const [piiScanned, setPiiScanned] = useState(false)
  const [piiRows, setPiiRows] = useState<PiiReviewRow[]>([])
  const [sanitizedPreview, setSanitizedPreview] = useState<string>('')
  const [applyingSanitized, setApplyingSanitized] = useState(false)
  const [manualRedacting, setManualRedacting] = useState(false)
  const [manualRedactions, setManualRedactions] = useState<RedactionRow[]>([])
  const [agentPrompt, setAgentPrompt] = useState('')
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentDraft, setAgentDraft] = useState('')
  const [agentMessages, setAgentMessages] = useState<
    Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      truncated?: boolean
      citations?: Array<{ url: string; title?: string }>
      mods?: Array<{ id: string; from: string; to: string }>
      documentScore?: { score: number; level: string; summary: string; risks: string[] } | null
      webSearchRequested?: boolean
      createdAt: number
    }>
  >([])
  const [showDebugSnippet, setShowDebugSnippet] = useState(false)
  /** Panel derecho PII / Agente (controlado para poder enfocar PII si bloquea el envío). */
  const [collabPanelTab, setCollabPanelTab] = useState<'pii' | 'agent'>('pii')
  const [padAccessNoticeVisible, setPadAccessNoticeVisible] = useState(false)
  const [editorTourOpen, setEditorTourOpen] = useState(false)
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false)
  const [researchEvidenceLog, setResearchEvidenceLog] = useState<ResearchEvidenceLogEntry[]>([])
  const [pinnedResearchEvidenceIds, setPinnedResearchEvidenceIds] = useState<string[]>([])
  const importResearchEvidenceInputRef = useRef<HTMLInputElement>(null)

  const agentScoreLabels = useMemo(
    () => documentScoreUiLabels(criteriaDomainFromAgentProfile(agentProfile)),
    [agentProfile],
  )

  const lastDocumentScore = useMemo(() => {
    for (let i = agentMessages.length - 1; i >= 0; i--) {
      const m = agentMessages[i]
      if (m?.role === 'assistant' && m.documentScore) {
        return { score: m.documentScore, at: m.createdAt }
      }
    }
    return null
  }, [agentMessages])

  // Guards para hidratar estado desde localStorage sin sobreescribirlo con valores vacíos.
  const agentHydratedRef = useRef(false)
  const piiHydratedRef = useRef(false)
  const agentScrollRef = useRef<HTMLDivElement | null>(null)

  // Default author: cuenta activa o primera disponible
  useEffect(() => {
    if (activeAccount) setSelectedAccount(activeAccount)
    else if (!selectedAccount && accounts.length > 0) setSelectedAccount(accounts[0].address)
  }, [activeAccount, accounts, selectedAccount])

  const authorLabel = useMemo(() => {
    const acc = accounts.find((a) => a.address === selectedAccount)
    if (!acc) return selectedAccount || ''
    const name = acc.meta?.name
    return name ? `${name} (${acc.address})` : acc.address
  }, [accounts, selectedAccount])

  const editorTourSteps = useMemo(() => {
    type Step = { id: string; title: string; body: string; selector: string }
    const steps: Step[] = [
      {
        id: 'ed-menu',
        title: 'Menú lateral',
        body:
          'Abre el menú de la app (sidebar) sin salir del documento: mismo acceso a Documentos, Inicio y Ajustes que en el resto de CriterIA.',
        selector: '[data-tour-id="tour-editor-menu"]',
      },
      {
        id: 'ed-back',
        title: 'Volver',
        body: 'Regresa al listado de documentos cuando termines o quieras abrir otro archivo.',
        selector: '[data-tour-id="tour-editor-back"]',
      },
      {
        id: 'ed-profile',
        title: 'Perfil del agente',
        body:
          'Legal MX o Académico: define el estilo del asistente (contratos frente a investigación). Se guarda en los metadatos del documento.',
        selector: '[data-tour-id="tour-editor-agent-profile"]',
      },
      {
        id: 'ed-save',
        title: 'Guardar local (PDF)',
        body:
          'Copia el texto actual del pad al PDF en este dispositivo y crea una versión nueva para previsualizarla en Documentos.',
        selector: '[data-tour-id="tour-editor-save-local"]',
      },
    ]
    if (showEtherpadDevControls) {
      steps.push({
        id: 'ed-export-md',
        title: 'Exportar Markdown',
        body:
          'Control opcional (desarrollo o build con controles Etherpad): descarga el contenido del pad como archivo .md.',
        selector: '[data-tour-id="tour-editor-export-md"]',
      })
    }
    steps.push(
      {
        id: 'ed-pad-info',
        title: 'Información del pad',
        body:
          'Este aviso resume quién puede editar el documento colaborativo. Puedes cerrarlo cuando ya lo hayas leído.',
        selector: '[data-tour-id="tour-editor-pad-info"]',
      },
      {
        id: 'ed-iframe',
        title: 'Área Etherpad',
        body:
          'Aquí escribes en tiempo real. El historial de revisiones (timeslider / línea de tiempo) lo gestiona Etherpad: suele estar en la barra superior del iframe.',
        selector: '[data-tour-id="tour-editor-iframe-wrap"]',
      },
      {
        id: 'ed-panel',
        title: 'PII y chat del agente',
        body:
          '«PII» revisa datos personales antes de enviar a la IA. «Agente» es el chat con el asistente; puede quedar deshabilitado hasta resolver hallazgos de PII.',
        selector: '[data-tour-id="tour-editor-collab-panel"]',
      },
    )
    return steps
  }, [showEtherpadDevControls])

  const loadPad = useCallback(async () => {
    if (!documentId) return
    try {
      setLoadingPad(true)
      const s = await createOrGetPadSession(documentId)
      setPadUrl(s.padUrl)
      setPadId(s.padId)
    } catch (e: unknown) {
      console.error('[Etherpad] session', e)
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir Etherpad')
    } finally {
      setLoadingPad(false)
    }
  }, [documentId])

  const loadPadText = useCallback(async () => {
    if (!documentId) return
    try {
      setLoadingText(true)
      const r = await fetchPadText(documentId)
      setPadTextState(r.content || '')
      setPadIdFromContent(r.padId || null)
      // El gate PII puede restaurarse desde storage (si el contenido coincide).
    } catch (e: unknown) {
      console.error('[Etherpad] content', e)
      toast.error(e instanceof Error ? e.message : 'No se pudo leer el pad')
    } finally {
      setLoadingText(false)
    }
  }, [documentId])

  useEffect(() => {
    setPadUrl(null)
    setPadId(null)
    setPadIdFromContent(null)
    setPadTextState('')
    setPiiScanned(false)
    setPiiRows([])
    setSanitizedPreview('')
    setAgentPrompt('')
    setAgentDraft('')
    setAgentMessages([])
    setManualRedactions([])
    setCollabPanelTab('pii')
    if (documentId) loadPad()
  }, [documentId, loadPad])

  useEffect(() => {
    if (documentId) loadPadText()
  }, [documentId, loadPadText])

  useEffect(() => {
    if (!documentId) {
      setPadAccessNoticeVisible(false)
      return
    }
    setPadAccessNoticeVisible(true)
    const id = window.setTimeout(() => setPadAccessNoticeVisible(false), ETHERPAD_PAD_ACCESS_NOTICE_MS)
    return () => window.clearTimeout(id)
  }, [documentId])

  /** Primera vez en el editor Etherpad: tour guiado de la barra y el panel lateral. */
  useEffect(() => {
    if (!documentId || !padUrl) return
    let cancelled = false
    try {
      const seen =
        localStorage.getItem('criteria.help.tour.editorEtherpad.v1.seen') === '1' ||
        localStorage.getItem('nelai.help.tour.editorEtherpad.v1.seen') === '1'
      if (seen) return
    } catch {
      return
    }
    const t = window.setTimeout(() => {
      if (!cancelled) setEditorTourOpen(true)
    }, 550)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [documentId, padUrl])

  /** Reproducir spotlight desde Ayuda (tutorial 07). */
  useEffect(() => {
    const onReplay = () => {
      if (!documentId || !padUrl) return
      setEditorTourOpen(true)
    }
    window.addEventListener('criteria-replay-editor-spotlight', onReplay)
    return () => window.removeEventListener('criteria-replay-editor-spotlight', onReplay)
  }, [documentId, padUrl])

  // Persistencia del estado del agente (conversación) por documento.
  const agentStorageKey = useMemo(
    () => (documentId ? `criteria-etherpad-agent:${documentId}` : ''),
    [documentId],
  )

  /** Misma fuente de verdad que el editor Quill: `Document.chatHistory` en IndexedDB; localStorage como respaldo. */
  useEffect(() => {
    if (!documentId) return
    agentHydratedRef.current = false
    ;(async () => {
      try {
        const doc = await getDocument(documentId)
        if (!doc) {
          queueMicrotask(() => {
            agentHydratedRef.current = true
          })
          return
        }
        setResearchEvidenceLog(normalizeResearchEvidenceLog(doc.researchEvidenceLog))
        setPinnedResearchEvidenceIds(doc.pinnedResearchEvidenceIds ?? [])
        setAgentProfile(
          inferAgentProfile({
            documentType: doc.type,
            keywords: doc.metadata?.keywords,
            category: doc.category,
            criteriaDomain: doc.metadata?.criteriaDomain,
          }),
        )

        type EtherpadMsg = {
          id: string
          role: 'user' | 'assistant'
          content: string
          truncated?: boolean
          citations?: Array<{ url: string; title?: string }>
          mods?: Array<{ id: string; from: string; to: string }>
          documentScore?: { score: number; level: string; summary: string; risks: string[] } | null
          webSearchRequested?: boolean
          createdAt: number
        }
        const normalizeAssistantContent = (
          role: 'user' | 'assistant',
          content: string,
          existingScore: EtherpadMsg['documentScore'],
        ): { content: string; documentScore: EtherpadMsg['documentScore'] } => {
          if (role !== 'assistant') return { content, documentScore: existingScore }
          if (existingScore) return { content, documentScore: existingScore }
          const { score, cleanText } = stripAndParseDocumentScore(content)
          if (score) return { content: cleanText, documentScore: score }
          return { content, documentScore: null }
        }
        let messages: EtherpadMsg[] = []
        const fromDb = doc.chatHistory
        if (fromDb?.length) {
          messages = fromDb.map((m, i) => {
            const { content, documentScore } = normalizeAssistantContent(m.role, m.content, m.documentScore ?? null)
            return {
              id: `db_${m.timestamp}_${i}`,
              role: m.role,
              content,
              createdAt: m.timestamp,
              documentScore: documentScore ?? undefined,
            }
          })
        }

        try {
          const raw = documentId ? localStorage.getItem(`criteria-etherpad-agent:${documentId}`) : null
          const parsed = raw
            ? (JSON.parse(raw) as {
                agentPrompt?: string
                agentDraft?: string
                agentMessages?: Array<
                  EtherpadMsg & { legalScore?: EtherpadMsg['documentScore'] }
                >
              })
            : {}
          if (messages.length === 0 && Array.isArray(parsed.agentMessages) && parsed.agentMessages.length > 0) {
            messages = parsed.agentMessages.map((row, i) => {
              const mergedScore = row.documentScore ?? row.legalScore ?? null
              const { content, documentScore } = normalizeAssistantContent(row.role, row.content, mergedScore)
              return {
                ...row,
                id: row.id || `ls_${i}`,
                content,
                documentScore: documentScore ?? undefined,
              }
            })
          }
          if (typeof parsed.agentPrompt === 'string') setAgentPrompt(parsed.agentPrompt)
          if (typeof parsed.agentDraft === 'string') setAgentDraft(parsed.agentDraft)
        } catch {
          // ignore
        }
        setAgentMessages(messages)
      } catch {
        // ignore
      } finally {
        queueMicrotask(() => {
          agentHydratedRef.current = true
        })
      }
    })()
  }, [documentId])

  useEffect(() => {
    if (!agentStorageKey) return
    if (!agentHydratedRef.current) return
    const payload = {
      agentPrompt,
      agentDraft,
      agentMessages,
    }
    try {
      localStorage.setItem(agentStorageKey, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }, [
    agentStorageKey,
    agentPrompt,
    agentDraft,
    agentMessages,
  ])

  const chatToIdbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!documentId || !agentHydratedRef.current) return
    if (chatToIdbTimerRef.current) clearTimeout(chatToIdbTimerRef.current)
    chatToIdbTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const chatHistory = agentMessages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.createdAt,
            ...(m.documentScore ? { documentScore: m.documentScore } : {}),
          }))
          await updateDocument(documentId, { chatHistory })
        } catch (e) {
          console.warn('[Etherpad] persistir chat en documento', e)
        }
      })()
    }, 300)
    return () => {
      if (chatToIdbTimerRef.current) clearTimeout(chatToIdbTimerRef.current)
    }
  }, [documentId, agentMessages])

  useEffect(() => {
    if (!sourcesModalOpen || !documentId) return
    void getDocument(documentId).then((d) => {
      if (d) setResearchEvidenceLog(normalizeResearchEvidenceLog(d.researchEvidenceLog))
    })
  }, [sourcesModalOpen, documentId])

  const persistResearchEvidenceAppend = useCallback(
    async (entries: ResearchEvidenceLogEntry[]) => {
      if (!documentId || entries.length === 0) return
      try {
        const doc = await getDocument(documentId)
        if (!doc) return
        const merged = appendResearchEvidenceEntries(doc.researchEvidenceLog, entries)
        await updateDocument(documentId, { researchEvidenceLog: merged })
        setResearchEvidenceLog(merged)
      } catch (e) {
        console.warn('[Etherpad] bitácora de fuentes', e)
      }
    },
    [documentId],
  )

  const persistEvidenceUserComment = useCallback(
    async (entryId: string, userComment: string) => {
      if (!documentId) return
      try {
        const doc = await getDocument(documentId)
        if (!doc) return
        const merged = normalizeResearchEvidenceLog(doc.researchEvidenceLog).map((e) =>
          e.id === entryId ? { ...e, userComment } : e
        )
        await updateDocument(documentId, { researchEvidenceLog: merged })
        setResearchEvidenceLog(merged)
      } catch (e) {
        console.warn('[Etherpad] nota en bitácora', e)
        toast.error('No se pudo guardar la nota')
      }
    },
    [documentId],
  )

  const toggleEvidencePin = useCallback(
    async (entryId: string) => {
      const next = togglePinnedResearchEvidenceId(pinnedResearchEvidenceIds, entryId)
      setPinnedResearchEvidenceIds(next)
      if (!documentId) return
      try {
        await updateDocument(documentId, { pinnedResearchEvidenceIds: next })
      } catch (e) {
        console.warn('[Etherpad] anclar fuente', e)
        toast.error('No se pudo guardar la fuente anclada')
      }
    },
    [documentId, pinnedResearchEvidenceIds],
  )

  const handlePickImportResearchEvidenceJson = useCallback(() => {
    if (!documentId) {
      toast.error('Abre un documento guardado para importar fuentes')
      return
    }
    importResearchEvidenceInputRef.current?.click()
  }, [documentId])

  const handleImportResearchEvidenceJsonChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !documentId) return
      try {
        const text = await file.text()
        const { entries, skipped } = parseResearchEvidenceLogImportJson(text, documentId)
        if (!entries.length) {
          toast.message('El archivo no contiene entradas válidas para importar')
          return
        }
        const doc = await getDocument(documentId)
        if (!doc) {
          toast.error('Documento no encontrado')
          return
        }
        const prevLen = normalizeResearchEvidenceLog(doc.researchEvidenceLog).length
        const merged = appendResearchEvidenceEntries(doc.researchEvidenceLog, entries)
        await updateDocument(documentId, { researchEvidenceLog: merged })
        setResearchEvidenceLog(merged)
        const added = merged.length - prevLen
        if (added === 0) {
          toast.message('Ninguna fila nueva: los ids del JSON ya existen en esta bitácora.')
        } else {
          toast.success(`Se añadieron ${added} fuente(s) a la bitácora`)
        }
        if (skipped > 0) {
          toast.message(`Se omitieron ${skipped} fila(s) inválida(s) en el JSON`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al importar JSON')
      }
    },
    [documentId],
  )

  // Persistencia del gate PII por documento + hash de contenido.
  const piiStorageKey = useMemo(
    () => (documentId ? `criteria-etherpad-pii:${documentId}` : ''),
    [documentId],
  )

  function hashFNV1a(input: string): string {
    let h = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return (h >>> 0).toString(16)
  }

  useEffect(() => {
    if (!piiStorageKey) return
    try {
      const raw = localStorage.getItem(piiStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        textHash?: string
        piiScanned?: boolean
        piiRows?: PiiReviewRow[]
        sanitizedPreview?: string
      }
      const currentHash = hashFNV1a(normalizeTextForPii(padText || ''))
      if (parsed.textHash && parsed.textHash === currentHash) {
        if (typeof parsed.piiScanned === 'boolean') setPiiScanned(parsed.piiScanned)
        if (Array.isArray(parsed.piiRows)) setPiiRows(parsed.piiRows)
        if (typeof parsed.sanitizedPreview === 'string') setSanitizedPreview(parsed.sanitizedPreview)
      } else {
        // Si el contenido cambió, se invalida el gate.
        setPiiScanned(false)
        setPiiRows([])
        setSanitizedPreview('')
      }
    } catch {
      // ignore
    } finally {
      piiHydratedRef.current = true
    }
  }, [padText, piiStorageKey])

  useEffect(() => {
    if (!piiStorageKey) return
    if (!piiHydratedRef.current) return
    const payload = {
      textHash: hashFNV1a(normalizeTextForPii(padText || '')),
      piiScanned,
      piiRows,
      sanitizedPreview,
    }
    try {
      localStorage.setItem(piiStorageKey, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }, [padText, piiScanned, piiRows, sanitizedPreview, piiStorageKey])

  function maxOutputTokensForModel(modelId: string | undefined): number {
    const id = (modelId || '').toLowerCase()
    // Mantener consistente con DocumentEditorAgent: flash suele soportar más salida.
    if (id.includes('flash')) return 8192
    return 4096
  }

  const AGENT_SYSTEM_PROMPT = agentSystemPromptForProfile(agentProfile)

  function parseAgentMods(raw: string): Array<{ id: string; from: string; to: string }> {
    const out: Array<{ id: string; from: string; to: string }> = []
    if (!raw) return out
    const re = /\[MODIFICAR\]([\s\S]*?)\[\/MODIFICAR\]\s*\[POR\]([\s\S]*?)\[\/POR\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw))) {
      const from = (m[1] || '').trim()
      const to = (m[2] || '').trim()
      if (!from && !to) continue
      const id = `${out.length}_${from.slice(0, 24)}`
      out.push({ id, from, to })
      if (out.length >= 20) break
    }
    return out
  }

  const applyAgentMod = useCallback(
    async (mod: { id: string; from: string; to: string }) => {
      if (!documentId) return
      try {
        setAgentRunning(true)
        const r = await fetchPadText(documentId)
        const live = r.content || ''
        const match = findLoose(live, mod.from)
        if (!match) {
          toast.error('No encontré el texto exacto a modificar en el pad (quizá cambió).')
          return
        }
        const normalizedLive = normalizeTextForPii(live).replace(/\r\n/g, '\n')
        const after =
          normalizedLive.slice(0, match.index) +
          (mod.to || '') +
          normalizedLive.slice(match.index + match.length)
        await setPadText(documentId, after)
        toast.success('Cambio aplicado al pad')
        await loadPadText()
        setIframeNonce((n) => n + 1)
      } catch (e) {
        console.error('[Agent] apply mod', e)
        toast.error(e instanceof Error ? e.message : 'No se pudo aplicar el cambio')
      } finally {
        setAgentRunning(false)
      }
    },
    [documentId, loadPadText],
  )

  const scrollChatToBottom = useCallback(() => {
    const el = agentScrollRef.current
    if (!el) return
    el.scrollIntoView({ block: 'end' })
  }, [])

  useEffect(() => {
    scrollChatToBottom()
  }, [agentMessages.length, scrollChatToBottom])

  const sendToAgent = useCallback(
    async (userText: string, mode: 'new' | 'continue'): Promise<boolean> => {
      if (!documentId) return false
      const trimmed = (userText || '').trim()
      if (!trimmed) return false

      if (!piiScanned || piiRows.length > 0) {
        setCollabPanelTab('pii')
        toast.error('Primero ejecuta PII y aplica la redacción si hay coincidencias.', {
          description: 'Pestaña PII abierta: escanea de nuevo si cambió el pad y aplica redacción si hay coincidencias.',
        })
        return false
      }

      await ensureSaaSPlatformGeminiConfig()
      const cfg = await getActiveLLMConfig()
      if (!cfg) {
        toast.error('Configura un modelo/LLM en Ajustes.')
        return false
      }

      let live = padText || ''
      try {
        const r = await fetchPadText(documentId)
        live = r.content || ''
        setPadTextState(live)
      } catch (e: unknown) {
        console.warn('[Agent] No se pudo leer el pad en vivo; se usa último texto cargado.', e)
      }

      const llmGate = anonymizeDocAndMessage(live, trimmed)
      if (llmGate.hasPii) {
        setCollabPanelTab('pii')
        const docHits = llmGate.docMatches.length
        const msgHits = llmGate.msgMatches.length
        toast.error('Hay datos sensibles fuera de placeholders antes de enviar a la IA.', {
          description:
            docHits && msgHits
              ? `Revisa el pad (${docHits} en documento) y tu mensaje (${msgHits}). Vuelve a «Escanear PII» si editaste el pad.`
              : docHits
                ? `Detectados en el pad (${docHits}). Pulsa «Escanear PII» y aplica redacción, o edita el texto.`
                : `Detectados en tu mensaje (${msgHits}). Generaliza el texto (sin correos, teléfonos, etc.).`,
        })
        return false
      }

      const doc = live
      const now = Date.now()
      const priorLen = agentMessages.length
      const userMsg = {
        id: `u_${now}`,
        role: 'user' as const,
        content: trimmed,
        createdAt: now,
      }
      if (documentId) {
        const userUrls = extractHttpUrlsFromText(trimmed)
        if (userUrls.length) {
          void persistResearchEvidenceAppend(
            buildResearchEvidenceEntries(documentId, userUrls, {
              origin: 'user_message',
              chatHistoryIndex: priorLen,
              addedBy: selectedAccount || undefined,
              indexedFromUserPrompt: trimmed,
            }),
          )
        }
      }
      setAgentMessages((prev) => [...prev, userMsg])

      try {
        setAgentRunning(true)
        const webSearchRequested = cfg.provider === 'gemini'
        const lastScoredAssistant = [...agentMessages]
          .reverse()
          .find(
            (m) => m.role === 'assistant' && m.documentScore && typeof m.documentScore.score === 'number',
          )
        const pinnedBlock = buildPinnedSourcesContextBlock(
          researchEvidenceLog,
          pinnedResearchEvidenceIds,
        )
        const prevScoreContext =
          mode === 'continue' || !lastScoredAssistant
            ? ''
            : `\n---\nHISTÓRICO PREVIO (para reevaluación):\n` +
              `Score previo: ${lastScoredAssistant.documentScore!.score} (${lastScoredAssistant.documentScore!.level}).\n` +
              (lastScoredAssistant.documentScore!.summary
                ? `Resumen previo: ${lastScoredAssistant.documentScore!.summary}\n`
                : '') +
              (lastScoredAssistant.documentScore!.risks?.length
                ? `Riesgos previos: ${lastScoredAssistant.documentScore!.risks.join(' | ')}\n`
                : '') +
              (lastScoredAssistant.content
                ? `Anotaciones previas del agente (extracto):\n${lastScoredAssistant.content.slice(0, 1800)}\n`
                : '') +
              `\nRegla: si el usuario pide “analizar nuevamente” o reevaluar, compara con el score previo y explica qué cambió y por qué.\n`
        const res = await chatCompletion(
          cfg,
          [
            { role: 'system', content: AGENT_SYSTEM_PROMPT },
            {
              role: 'user',
              content:
                `Documento (texto plano):\n\n${doc}\n\n---\nInstrucción:\n${trimmed}\n${SCORE_API_REMINDER}\n` +
                pinnedBlock +
                prevScoreContext +
                `\nSi tienes búsqueda web disponible, úsala y entrega una sección FUENTES con 3–8 URLs.\n` +
                (mode === 'continue'
                  ? '\n---\nTu respuesta anterior fue truncada. Continúa EXACTAMENTE donde te quedaste.\n'
                  : ''),
            },
          ],
          { maxTokens: maxOutputTokensForModel(cfg.model), temperature: 0.7, googleSearch: webSearchRequested },
        )
        if (res.error) throw new Error(res.error)
        const assistantContent = res.content || ''
        const { score: documentScore, cleanText } = stripAndParseDocumentScore(assistantContent)
        const clean = cleanText || assistantContent.trim()
        const mergedForSources = [assistantContent, clean].filter(Boolean).join('\n\n')
        const assistantRefs = collectAssistantSourceRefs(mergedForSources, res.citations)
        if (documentId) {
          const batch = buildAssistantResearchEvidenceBatch(
            documentId,
            assistantRefs,
            res.webSearchQueries,
            {
              chatHistoryIndex: priorLen + 1,
              addedBy: selectedAccount || undefined,
              indexedFromUserPrompt: trimmed,
            },
          )
          if (batch.length) void persistResearchEvidenceAppend(batch)
        }
        const assistantMsg = {
          id: `a_${Date.now()}`,
          role: 'assistant' as const,
          content: clean,
          truncated: !!res.truncated,
          citations: res.citations || [],
          mods: parseAgentMods(clean),
          documentScore: documentScore ?? null,
          webSearchRequested,
          createdAt: Date.now(),
        }
        setAgentMessages((prev) => [...prev, assistantMsg])
        if (assistantMsg.truncated) {
          toast.warning('La respuesta se cortó por límite de tokens. Puedes pedir que continúe.')
        }
        if (webSearchRequested && (assistantMsg.citations?.length || 0) === 0) {
          toast.message('Se solicitó búsqueda web, pero esta respuesta no devolvió fuentes.')
        }
      } catch (e) {
        console.error('[Agent] send error', e)
        setAgentMessages((prev) => [
          ...prev,
          {
            id: `a_err_${Date.now()}`,
            role: 'assistant' as const,
            content: `Error: ${e instanceof Error ? e.message : 'Falló el agente'}`,
            truncated: false,
            citations: [],
            mods: [],
            createdAt: Date.now(),
          },
        ])
      } finally {
        setAgentRunning(false)
      }
      return true
    },
    [
      AGENT_SYSTEM_PROMPT,
      agentMessages,
      documentId,
      padText,
      piiRows.length,
      piiScanned,
      parseAgentMods,
      persistResearchEvidenceAppend,
      pinnedResearchEvidenceIds,
      researchEvidenceLog,
      selectedAccount,
    ],
  )

  useEffect(() => {
    if (!documentId) return
    ;(async () => {
      try {
        const r = await listRedactions(documentId)
        setManualRedactions(r.redactions || [])
      } catch (e) {
        console.warn('[Etherpad] no se pudieron cargar redacciones persistidas', e)
      }
    })()
  }, [documentId])

  const handleCreate = useCallback(async () => {
    if (accounts.length === 0) {
      toast.error('Necesitas tener al menos una cuenta para crear documentos')
      return
    }
    if (!selectedAccount) {
      toast.error('Selecciona una cuenta como autor')
      return
    }
    if (!title.trim()) {
      toast.error('Indica un título')
      return
    }

    try {
      setCreating(true)
      const doc = await createDocument({
        type: 'generic',
        category: 'etherpad',
        metadata: {
          title: title.trim(),
          description: 'Documento colaborativo (Etherpad)',
          author: authorLabel,
          subject: 'Documento',
          keywords: withAgentProfileTag(['etherpad', 'colaborativo'], agentProfile),
          criteriaDomain: criteriaDomainFromAgentProfile(agentProfile),
          language: 'es',
          creator: 'CriterIA',
          producer: 'CriterIA PDF',
          createdAt: new Date().toISOString(),
        },
        relatedAccount: selectedAccount,
      })

      // Abrir editor (ruta de edición) para cargar el pad por docId.
      navigate(documentEditorPath(doc.documentId, doc), { replace: true })
    } catch (e: unknown) {
      console.error('[Etherpad] create doc', e)
      toast.error(e instanceof Error ? e.message : 'Error al crear documento')
    } finally {
      setCreating(false)
    }
  }, [accounts.length, agentProfile, authorLabel, navigate, selectedAccount, title])

  const getEtherpadSelectionText = useCallback(async (): Promise<string> => {
    const iframe = padIframeRef.current
    const w = iframe?.contentWindow
    if (!w) return ''

    // Etherpad está embebido; si el iframe es cross-origin, esto lanza SecurityError.
    let d: Document | null = null
    try {
      d = w.document
    } catch {
      return ''
    }
    if (!d) return ''

    // En Etherpad, el editor suele vivir dentro de `ace_outer` (y dentro de éste `ace_inner`).
    const aceOuter = d.querySelector('iframe[name="ace_outer"], iframe#ace_outer') as HTMLIFrameElement | null
    const aceOuterWin = aceOuter?.contentWindow || null
    let aceOuterDoc: Document | null = null
    try {
      aceOuterDoc = aceOuterWin?.document || null
    } catch {
      aceOuterDoc = null
    }

    // 1) Fallback DOM primero: a veces es lo único disponible.
    try {
      const searchDoc = aceOuterDoc || d
      const inner = searchDoc.querySelector('iframe[name="ace_inner"], iframe#ace_inner') as HTMLIFrameElement | null
      const innerWin = inner?.contentWindow
      const domSel =
        innerWin?.getSelection?.()?.toString() ||
        aceOuterWin?.getSelection?.()?.toString() ||
        w.getSelection?.()?.toString() ||
        ''
      if (domSel && domSel.trim()) return domSel.trim()
    } catch {
      // ignore
    }

    // 2) Intento Ace API: Etherpad expone funciones ace_* dentro de callWithAce.
    // Importante: en muchas versiones `padeditor` está en `ace_outer` (no en el window raíz).
    const hostWin = aceOuterWin || w
    const padeditor = (hostWin as unknown as { padeditor?: any }).padeditor
    const callWithAce: unknown = padeditor?.ace?.callWithAce
    if (typeof callWithAce === 'function') {
      const selected = await new Promise<string>((resolve) => {
        try {
          padeditor.ace.callWithAce(
            (ace: any) => {
              try {
                const candidates: string[] = []
                if (typeof ace?.ace_getSelectedText === 'function') candidates.push(String(ace.ace_getSelectedText() || ''))
                if (typeof ace?.ace_getSelection === 'function') candidates.push(String(ace.ace_getSelection() || ''))
                // Algunos builds exponen esto:
                if (typeof ace?.ace_getSelectionText === 'function') candidates.push(String(ace.ace_getSelectionText() || ''))
                const best = candidates.find((s) => s && s.trim()) || ''
                resolve(best)
              } catch {
                resolve('')
              }
            },
            'criteria-redact-selection',
            true,
          )
        } catch {
          resolve('')
        }
      })
      if (selected && selected.trim()) return selected.trim()
    }

    return ''
  }, [])

  const redactSelectionReversible = useCallback(async () => {
    if (!documentId) return
    const selected = await getEtherpadSelectionText()
    if (!selected) {
      toast.message('Selecciona texto en el pad para ocultarlo.')
      return
    }
    if (selected.length < 2) {
      toast.message('Selecciona al menos 2 caracteres.')
      return
    }

    // Nomenclatura reversible: placeholder con id estable.
    // Importante: usar ASCII para evitar bugs de conteo/normalización en el cliente de Etherpad.
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const placeholder = `[[CRITERIA_REDACT_${id}]]`

    try {
      setManualRedacting(true)
      const r = await fetchPadText(documentId)
      const live = r.content || ''
      const match = findLoose(live, selected)
      if (!match) {
        console.warn('[Etherpad] selección no encontrada en texto exportado', { selected })
        toast.error('Detecté la selección, pero no la pude ubicar en el texto del pad (whitespace/format).')
        return
      }
      const normalizedLive = normalizeTextForPii(live).replace(/\r\n/g, '\n')
      const original = normalizeTextForPii(selected).replace(/\r\n/g, '\n').trim()
      const after =
        normalizedLive.slice(0, match.index) +
        placeholder +
        normalizedLive.slice(match.index + match.length)
      await setPadText(documentId, after)

      // Persistir el mapeo placeholder -> original en backend (cifrado).
      try {
        const created = await createRedaction(documentId, { placeholder, original })
        setManualRedactions((prev) => [created.redaction, ...prev])
      } catch (e) {
        console.warn('[Etherpad] no se pudo persistir redacción; quedará solo en el pad', e)
      }

      toast.success('Selección ocultada (reversible)')
      await loadPadText()
      setIframeNonce((n) => n + 1)
    } catch (e: unknown) {
      console.error('[Etherpad] redact selection reversible', e)
      toast.error(e instanceof Error ? e.message : 'No se pudo ocultar la selección')
    } finally {
      setManualRedacting(false)
    }
  }, [documentId, fetchPadText, getEtherpadSelectionText, loadPadText])

  const restoreManualRedaction = useCallback(
    async (id: string) => {
      if (!documentId) return
      try {
        setManualRedacting(true)
        const restored = await restoreRedaction(documentId, id)
        const placeholder = restored.restored.placeholder
        const original = restored.restored.original

        const r = await fetchPadText(documentId)
        const live = (r.content || '').replace(/\r\n/g, '\n')
        const idx = live.indexOf(placeholder)
        if (idx < 0) {
          toast.error('No encontré el marcador en el pad (¿ya se restauró o se editó?).')
          return
        }
        const after = live.slice(0, idx) + original + live.slice(idx + placeholder.length)
        await setPadText(documentId, after)
        setManualRedactions((prev) => prev.filter((r2) => r2.id !== id))
        toast.success('Dato restaurado')
        await loadPadText()
        setIframeNonce((n) => n + 1)
      } catch (e: unknown) {
        console.error('[Etherpad] restore redaction', e)
        toast.error(e instanceof Error ? e.message : 'No se pudo restaurar')
      } finally {
        setManualRedacting(false)
      }
    },
    [documentId, fetchPadText, loadPadText],
  )

  const persistEtherpadAgentProfile = useCallback(
    async (next: AgentProfile) => {
      setAgentProfile(next)
      if (!documentId) return
      try {
        setUpdatingAgentProfile(true)
        const doc = await getDocument(documentId)
        if (!doc) throw new Error('Documento no encontrado')
        const nextKeywords = withAgentProfileTag(doc.metadata?.keywords, next)
        await updateDocument(documentId, {
          metadata: {
            ...doc.metadata,
            keywords: nextKeywords,
            criteriaDomain: criteriaDomainFromAgentProfile(next),
          },
        })
        toast.success('Perfil del agente actualizado')
      } catch (e: unknown) {
        console.error('[Etherpad] set agent profile', e)
        toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el perfil del agente')
      } finally {
        setUpdatingAgentProfile(false)
      }
    },
    [documentId],
  )

  const handleSaveLocal = useCallback(async () => {
    if (!documentId) return
    try {
      setSavingLocal(true)
      const doc = await getDocument(documentId)
      if (!doc) {
        toast.error('Documento no encontrado')
        return
      }
      if (doc.encrypted) {
        toast.error('Desencripta el documento en su ficha antes de guardar el PDF local.')
        return
      }
      const hadSignatures = (doc.signatures?.length ?? 0) > 0
      const r = await fetchPadText(documentId)
      const text = r.content || ''
      setPadTextState(text)
      const chatHistory = mapEtherpadAgentMessagesToChatHistory(agentMessages)
      await updateDocumentContent(documentId, {
        content: text,
        metadata: {
          ...doc.metadata,
          modifiedAt: new Date().toISOString(),
        },
        chatHistory,
        saveVersion: true,
        changeDescription: 'Sincronización desde Etherpad (guardar local)',
      })
      toast.success('PDF guardado en este dispositivo', {
        description: hadSignatures
          ? 'El contenido cambió: las firmas anteriores ya no aplican.'
          : 'La vista previa en Documentos usará este PDF.',
      })
    } catch (e: unknown) {
      console.error('[Etherpad] guardar local', e)
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el PDF local')
    } finally {
      setSavingLocal(false)
    }
  }, [documentId, agentMessages])

  const needsIdentityGate =
    !documentId && isReady && (accounts.length === 0 || (hasStoredAccounts && !isUnlocked))

  if (!documentId && !isReady) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Preparando entorno seguro…
      </div>
    )
  }

  return (
    <>
      <QuickIdentitySetupDialog open={needsIdentityGate} />
    <div className="h-full w-full p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleSidebar()}
            className="flex-shrink-0"
            aria-label="Menú de navegación"
            title="Menú"
            data-tour-id="tour-editor-menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/documents')}
            aria-label="Volver"
            data-tour-id="tour-editor-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="font-semibold truncate">
              {documentId ? `Editor colaborativo (Etherpad)` : 'Nuevo documento (Etherpad)'}
            </div>
            {documentId && padId && showEtherpadDevControls && (
              <div className="text-xs text-muted-foreground truncate font-mono" title="ID interno del pad (solo dev)">
                {padId}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {documentId && (
            <div className="min-w-0 max-w-[280px]" data-tour-id="tour-editor-agent-profile">
              <Select
                value={agentProfile}
                onValueChange={(v) => void persistEtherpadAgentProfile(v as AgentProfile)}
                disabled={updatingAgentProfile}
              >
                <SelectTrigger
                  className="h-9 w-full min-w-[140px] max-w-[280px] text-xs sm:text-sm"
                  aria-label="Perfil del agente"
                >
                  <SelectValue placeholder="Perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic_es">Académico (ensayos e investigación)</SelectItem>
                  <SelectItem value="legal_mx">Legal MX (contratos y revisión legal)</SelectItem>
                  <SelectItem value="creator_es">Creador de contenido (redes, guiones, newsletters)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {documentId && showEtherpadDevControls && (
            <Button variant="outline" size="sm" onClick={loadPad} disabled={loadingPad} title="Recrear sesión e iframe">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recargar
            </Button>
          )}
          {documentId && showEtherpadDevControls && (
            <Button variant="outline" size="sm" onClick={loadPadText} disabled={loadingText} title="Sincronizar panel lateral">
              <RefreshCw className="h-4 w-4 mr-2" />
              Leer texto
            </Button>
          )}
          {documentId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSourcesModalOpen(true)}
              title="Bitácora de fuentes (URLs del agente)"
            >
              <BookMarked className="h-4 w-4 mr-2" />
              Fuentes
            </Button>
          )}
          {documentId && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveLocal}
              disabled={savingLocal || loadingText}
              title="Regenera el PDF en este dispositivo con el texto actual del pad"
              data-tour-id="tour-editor-save-local"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingLocal ? 'Guardando…' : 'Guardar local'}
            </Button>
          )}
          {documentId && showEtherpadDevControls && (
            <Button
              variant="outline"
              size="sm"
              disabled={exportingMarkdown}
              data-tour-id="tour-editor-export-md"
              onClick={async () => {
                if (!documentId) return
                try {
                  setExportingMarkdown(true)
                  const blob = await exportPadMarkdown(documentId)
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `documento-${documentId}.md`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                  toast.success('Markdown exportado')
                } catch (e: unknown) {
                  console.error('[Etherpad] export markdown', e)
                  toast.error(e instanceof Error ? e.message : 'No se pudo exportar Markdown')
                } finally {
                  setExportingMarkdown(false)
                }
              }}
            >
              {exportingMarkdown ? 'Exportando…' : 'Exportar Markdown'}
            </Button>
          )}
        </div>
      </div>

      {documentId && padAccessNoticeVisible && (
        <Alert
          className="relative mb-3 border-muted-foreground/20 bg-muted/30 pr-10"
          data-tour-id="tour-editor-pad-info"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setPadAccessNoticeVisible(false)}
            aria-label="Cerrar aviso de acceso al pad"
          >
            <X className="h-4 w-4" />
          </Button>
          <AlertTitle className="text-sm pr-2">Quién puede editar este pad</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
            Solo personas con <strong className="text-foreground">sesión en CriterIA</strong> y pertenecientes a la{' '}
            <strong className="text-foreground">misma organización</strong> que tú pueden abrir este documento: el
            servidor crea una sesión Etherpad vinculada a ese usuario. No compartas un enlace directo a Etherpad: fuera
            de esta app no hay acceso con invitación «externa» en esta versión. La edición colaborativa es siempre dentro
            del iframe, con la misma política de acceso.
          </AlertDescription>
        </Alert>
      )}

      {!documentId ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Crear documento colaborativo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Título</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Contrato de prestación de servicios"
              />
            </div>

            <div className="space-y-2">
              <Label>Perfil del agente</Label>
              <Select
                value={agentProfile}
                onValueChange={(v) => setAgentProfile(v as AgentProfile)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic_es">Académico (ensayos e investigación)</SelectItem>
                  <SelectItem value="legal_mx">Legal MX (contratos y revisión legal)</SelectItem>
                  <SelectItem value="creator_es">Creador de contenido (redes, guiones, newsletters)</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Esto define cómo se comporta el Agente en este documento (por tags en metadata).
              </div>
            </div>

            <div className="space-y-2">
              <Label>Autor (cuenta)</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.address} value={acc.address}>
                      {acc.meta?.name ? `${acc.meta.name} — ${acc.address.slice(0, 10)}…` : acc.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creando…' : 'Crear y abrir Etherpad'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-3 h-[calc(100vh-140px)]">
          <div
            className="w-full rounded-lg border overflow-hidden bg-background"
            data-tour-id="tour-editor-iframe-wrap"
          >
            {padUrl ? (
              <iframe
                key={`${padUrl}|${iframeNonce}`}
                title="Etherpad"
                src={padUrl}
                className="h-full w-full"
                allow="clipboard-read; clipboard-write"
                ref={padIframeRef}
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-sm text-muted-foreground">
                {loadingPad ? 'Conectando con Etherpad…' : 'No se pudo cargar el pad.'}
              </div>
            )}
          </div>

          <div
            className="w-full rounded-lg border bg-background p-3 overflow-auto"
            data-tour-id="tour-editor-collab-panel"
          >
            <Tabs value={collabPanelTab} onValueChange={(v) => setCollabPanelTab(v as 'pii' | 'agent')}>
              <TabsList className="w-full">
                <TabsTrigger value="pii" className="flex-1">
                  <Shield className="h-4 w-4 mr-2" />
                  PII
                </TabsTrigger>
                <TabsTrigger value="agent" className="flex-1" disabled={!piiScanned || piiRows.length > 0}>
                  <Bot className="h-4 w-4 mr-2" />
                  Agente
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pii" className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Misma política que el editor local (Quill): la IA no recibe PII fuera de placeholders{' '}
                  <code className="text-xs">[CRITERIA_*]</code>. Tras editar el pad, vuelve a escanear. Tu mensaje al
                  agente también se valida al enviar.
                </div>

                {showEtherpadDevControls && (
                  <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Texto en memoria: <span className="font-mono text-foreground">{(padText || '').length}</span>{' '}
                    caracteres. Patrones: email, teléfono, IBAN, DNI/NIE, RFC/CURP, montos/slots MX (sin NER de nombres).
                  </div>
                )}

                {showEtherpadDevControls && (
                  <Collapsible>
                    <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted/50">
                      <span>Detalles técnicos (depuración)</span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      <div className="text-xs text-muted-foreground">
                        padId (iframe/session): <span className="font-mono">{padId || '—'}</span>
                        {' '}· padId (lectura): <span className="font-mono">{padIdFromContent || '—'}</span>
                        {padId && padIdFromContent && padId !== padIdFromContent ? (
                          <span className="text-destructive"> · No coinciden</span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <button
                          type="button"
                          className="text-muted-foreground underline underline-offset-4"
                          onClick={() => setShowDebugSnippet((v) => !v)}
                        >
                          {showDebugSnippet ? 'Ocultar' : 'Ver'} snippet leído (600 chars)
                        </button>
                        <span className="font-mono text-muted-foreground">
                          {'@'}: {((padText || '').match(/@/g) || []).length}
                        </span>
                      </div>
                      {showDebugSnippet && (
                        <Textarea
                          value={(padText || '').slice(0, 600)}
                          readOnly
                          className="min-h-[120px] font-mono text-xs"
                        />
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    onClick={async () => {
                      if (!documentId) return
                      // Leer en vivo antes de escanear para no depender del último "Leer texto".
                      let live = padText || ''
                      try {
                        const r = await fetchPadText(documentId)
                        live = r.content || ''
                        setPadTextState(live)
                      } catch (e: unknown) {
                        console.warn('[PII] No se pudo refrescar texto; usando último texto cargado.', e)
                      }

                      const normalized = normalizeTextForPii(live)
                      const matches = detectPiiOutsideCriteriaBrackets(normalized)
                      const out = anonymizeWithMatches(normalized, matches)
                      setPiiScanned(true)
                      setPiiRows(out.rows || [])
                      setSanitizedPreview(out.sanitized || '')
                      if ((out.rows || []).length === 0) toast.success('Sin PII detectada')
                      else toast.message(`PII detectada: ${(out.rows || []).length} coincidencias`)
                    }}
                    disabled={loadingText}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Escanear PII
                  </Button>
                  {showEtherpadDevControls && (
                    <Button variant="outline" onClick={loadPadText} disabled={loadingText}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refrescar
                    </Button>
                  )}
                </div>

                <div className="rounded-md border p-2 space-y-2">
                  <div className="text-sm font-medium">Redacción manual</div>
                  <div className="text-xs text-muted-foreground">
                    Selecciona texto directamente en el pad y luego aplícalo aquí.
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={redactSelectionReversible}
                      disabled={!padUrl || manualRedacting}
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      {manualRedacting ? 'Ocultando…' : 'Ocultar'}
                    </Button>
                  </div>

                  {manualRedactions.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-xs text-muted-foreground">
                        Redacciones ({manualRedactions.length}): puedes restaurar cuando lo necesites.
                      </div>
                      <div className="space-y-1">
                        {manualRedactions.slice(0, 10).map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0 font-mono truncate">{r.placeholder}</div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => restoreManualRedaction(r.id)}
                              disabled={manualRedacting}
                            >
                              Restaurar
                            </Button>
                          </div>
                        ))}
                        {manualRedactions.length > 10 && (
                          <div className="text-xs text-muted-foreground">
                            Mostrando 10 de {manualRedactions.length}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {piiScanned && piiRows.length > 0 && (
                  <div className="rounded-md border p-2">
                    <div className="font-medium mb-2">Coincidencias</div>
                    <div className="space-y-2 text-sm">
                      {piiRows.slice(0, 50).map((r, idx) => (
                        <div key={`${r.placeholder}-${idx}`} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-muted-foreground">{r.kind}</div>
                            <div className="truncate">{r.original}</div>
                          </div>
                          <div className="font-mono text-xs">{r.placeholder}</div>
                        </div>
                      ))}
                      {piiRows.length > 50 && (
                        <div className="text-xs text-muted-foreground">Mostrando 50 de {piiRows.length}</div>
                      )}
                    </div>
                  </div>
                )}

                {piiScanned && piiRows.length === 0 && (
                  <div className="rounded-md border p-2 text-sm text-muted-foreground">
                    Sin coincidencias por patrones. Si esperabas detectar <b>nombres</b> o entidades, esa capa no está activada (por diseño).
                    Prueba pegando un email o teléfono para validar.
                  </div>
                )}

                {piiScanned && (
                  <div className="space-y-2">
                    <div className="font-medium">Vista previa (redactado)</div>
                    <Textarea value={sanitizedPreview} readOnly className="min-h-[220px]" />
                    <Button
                      onClick={async () => {
                        if (!documentId) return
                        if (!piiScanned) return
                        if (piiRows.length === 0) {
                          toast.message('No hay PII que aplicar.')
                          return
                        }
                        try {
                          setApplyingSanitized(true)
                          await setPadText(documentId, sanitizedPreview)
                          toast.success('PII aplicada al pad')
                          await loadPadText()
                          setIframeNonce((n) => n + 1)
                        } catch (e: unknown) {
                          console.error('[Etherpad] apply pii', e)
                          toast.error(e instanceof Error ? e.message : 'No se pudo aplicar PII al pad')
                        } finally {
                          setApplyingSanitized(false)
                        }
                      }}
                      disabled={applyingSanitized || !piiScanned || piiRows.length === 0}
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      {applyingSanitized ? 'Aplicando…' : 'Aplicar redacción al pad'}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="agent" className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  El agente lee el pad en vivo al enviar; la política de PII coincide con el panel del editor Quill. El
                  perfil (académico / legal MX) se elige en la <strong className="text-foreground">barra superior</strong>{' '}
                  del editor.
                </div>

                {lastDocumentScore && (
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between gap-2">
                        <span>Última evaluación del agente</span>
                        <Badge variant="secondary">
                          {new Date(lastDocumentScore.at).toLocaleString('es-ES', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
                            {agentScoreLabels.panelTitle}
                          </div>
                          <div className="text-3xl font-bold tabular-nums">{lastDocumentScore.score.score}</div>
                          <div className="text-xs text-muted-foreground">
                            {agentScoreLabels.confidence} {lastDocumentScore.score.level}
                          </div>
                        </div>
                        <div className="w-16 h-16">
                          <svg viewBox="0 0 36 36" className="w-16 h-16">
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="rgba(255,255,255,0.08)"
                              strokeWidth="3"
                            />
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke={
                                lastDocumentScore.score.score >= 70
                                  ? '#22c55e'
                                  : lastDocumentScore.score.score >= 40
                                    ? '#eab308'
                                    : '#ef4444'
                              }
                              strokeWidth="3"
                              strokeDasharray={`${lastDocumentScore.score.score}, 100`}
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      </div>
                      {lastDocumentScore.score.summary ? (
                        <div className="text-sm text-muted-foreground">{lastDocumentScore.score.summary}</div>
                      ) : null}
                      {(lastDocumentScore.score.risks || []).length > 0 && (
                        <div className="pt-2 border-t space-y-1">
                          <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                            {agentScoreLabels.risksTitle}
                          </div>
                          {lastDocumentScore.score.risks.slice(0, 6).map((r, i) => (
                            <div key={i} className="text-sm text-muted-foreground">
                              - {r}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  <div className="border-b bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold tracking-tight">Asistente</div>
                        <div className="text-[11px] text-muted-foreground leading-snug">
                          El análisis puede incluir el bloque técnico <code className="text-[10px]">[SCORE_LEGAL]</code>{' '}
                          (calidad académica o confianza legal según el perfil). Cambios con{' '}
                          <code className="text-[10px]">[MODIFICAR]/[POR]</code>.
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => {
                          setAgentMessages([])
                          setAgentDraft('')
                          toast.success('Conversación limpiada')
                        }}
                      >
                        Limpiar
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[min(420px,50vh)] sm:h-[420px]">
                    <div className="space-y-4 p-3">
                      {agentMessages.length === 0 && !agentRunning && (
                        <p className="text-sm text-muted-foreground text-center py-6 px-2">
                          Escribe una instrucción abajo. El hilo se guarda con el documento en este dispositivo.
                        </p>
                      )}

                      {agentMessages.map((m) => (
                        <div key={m.id} className="flex gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                              m.role === 'user'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary/10 text-primary border-primary/20'
                            }`}
                          >
                            {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </div>
                          <div
                            className={`min-w-0 flex-1 rounded-2xl border px-3 py-2.5 shadow-sm ${
                              m.role === 'user' ? 'bg-muted/40 rounded-tl-sm' : 'bg-background rounded-tl-sm'
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {m.role === 'user' ? 'Tú' : 'CriterIA'}
                                </span>
                                {m.truncated ? (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    Truncado
                                  </Badge>
                                ) : null}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                aria-label="Copiar mensaje"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(m.content)
                                    toast.success('Copiado')
                                  } catch {
                                    toast.error('No se pudo copiar')
                                  }
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                          {m.role === 'assistant' && m.documentScore && (
                            <div
                              className="mb-3 p-3 rounded-xl border"
                              style={{
                                background:
                                  m.documentScore.score >= 70
                                    ? 'rgba(34,197,94,0.07)'
                                    : m.documentScore.score >= 40
                                      ? 'rgba(234,179,8,0.07)'
                                      : 'rgba(239,68,68,0.07)',
                                borderColor:
                                  m.documentScore.score >= 70
                                    ? 'rgba(34,197,94,0.2)'
                                    : m.documentScore.score >= 40
                                      ? 'rgba(234,179,8,0.2)'
                                      : 'rgba(239,68,68,0.2)',
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
                                    {agentScoreLabels.panelTitle}
                                  </div>
                                  <div className="text-2xl font-bold">{m.documentScore.score}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {agentScoreLabels.confidence} {m.documentScore.level}
                                  </div>
                                </div>
                                <div className="w-16 h-16">
                                  <svg viewBox="0 0 36 36" className="w-16 h-16">
                                    <path
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                      fill="none"
                                      stroke="rgba(255,255,255,0.08)"
                                      strokeWidth="3"
                                    />
                                    <path
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                      fill="none"
                                      stroke={
                                        m.documentScore.score >= 70
                                          ? '#22c55e'
                                          : m.documentScore.score >= 40
                                            ? '#eab308'
                                            : '#ef4444'
                                      }
                                      strokeWidth="3"
                                      strokeDasharray={`${m.documentScore.score}, 100`}
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                </div>
                              </div>
                              {m.documentScore.summary ? (
                                <div className="mt-2 text-xs text-muted-foreground">{m.documentScore.summary}</div>
                              ) : null}
                              {(m.documentScore.risks || []).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                                    {agentScoreLabels.risksTitle}
                                  </div>
                                  {m.documentScore.risks.slice(0, 6).map((r, i) => (
                                    <div key={i} className="text-xs text-muted-foreground">
                                      - {r}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {m.role === 'assistant' ? (
                            <MarkdownContent content={m.content} />
                          ) : (
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                          )}

                          {m.role === 'assistant' && (m.citations?.length || 0) > 0 && (
                            <div className="mt-3 rounded-md border p-2">
                              <div className="text-sm font-medium mb-1">Fuentes</div>
                              <div className="space-y-1 text-xs">
                                {(m.citations || []).map((c) => (
                                  <div key={c.url} className="truncate">
                                    <a
                                      className="underline underline-offset-4"
                                      href={c.url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {c.title || c.url}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {m.role === 'assistant' && (m.mods?.length || 0) > 0 && (
                            <div className="mt-3 rounded-md border p-2 space-y-2">
                              <div className="text-sm font-medium">Cambios sugeridos</div>
                              <div className="space-y-2">
                                {(m.mods || []).map((chg) => (
                                  <div key={chg.id} className="rounded border p-2 space-y-2">
                                    <div className="text-xs text-muted-foreground">[MODIFICAR]</div>
                                    <Textarea value={chg.from} readOnly className="min-h-[80px] font-mono text-xs" />
                                    <div className="text-xs text-muted-foreground">[POR]</div>
                                    <Textarea value={chg.to} readOnly className="min-h-[80px] font-mono text-xs" />
                                    <div className="flex justify-end">
                                      <Button
                                        size="sm"
                                        onClick={() => applyAgentMod(chg)}
                                        disabled={agentRunning}
                                      >
                                        Aplicar al pad
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {m.role === 'assistant' &&
                            m.truncated &&
                            m.id === agentMessages[agentMessages.length - 1]?.id && (
                              <div className="mt-3 flex justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => sendToAgent(agentPrompt || 'Continúa.', 'continue')}
                                  disabled={agentRunning}
                                >
                                  Continuar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {agentRunning && (
                        <div className="flex gap-3 animate-in fade-in duration-300">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                          <div className="flex-1 rounded-2xl rounded-tl-sm border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                            Generando respuesta…
                          </div>
                        </div>
                      )}
                      <div ref={agentScrollRef} />
                    </div>
                  </ScrollArea>

                  <div className="border-t bg-background/90 p-3 backdrop-blur-sm">
                    <p className="mb-2 text-[11px] text-muted-foreground leading-snug">
                      Si cambiaste el pad, vuelve a <strong className="text-foreground">PII</strong> → Escanear → Aplicar
                      si hay coincidencias. El borrador no se pierde si el envío se bloquea.
                    </p>
                    <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/15 p-2 shadow-inner focus-within:border-primary/25">
                      <Input
                        value={agentPrompt}
                        onChange={(e) => setAgentPrompt(e.target.value)}
                        placeholder="Contexto breve (opcional)"
                        className="h-8 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0"
                      />
                      <Textarea
                        value={agentDraft}
                        onChange={(e) => setAgentDraft(e.target.value)}
                        placeholder="Instrucción para el agente… (p. ej. analiza y devuelve [SCORE_LEGAL])"
                        className="min-h-[88px] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void (async () => {
                              const msg = agentDraft.trim()
                              if (!msg || agentRunning) return
                              const sent = await sendToAgent(msg, 'new')
                              if (sent) setAgentDraft('')
                            })()
                          }
                        }}
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          className="rounded-xl"
                          onClick={async () => {
                            const msg = agentDraft.trim()
                            if (!msg) return
                            const sent = await sendToAgent(msg, 'new')
                            if (sent) setAgentDraft('')
                          }}
                          disabled={agentRunning}
                        >
                          {agentRunning ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          {agentRunning ? 'Enviando…' : 'Enviar'}
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
                      CriterIA puede equivocarse; revisa siempre el texto antes de firmar o publicar.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>

      <Dialog open={sourcesModalOpen} onOpenChange={setSourcesModalOpen}>
        <DialogContent className="flex min-h-0 max-h-[88vh] max-w-[min(100vw-1rem,1180px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-1rem,1180px)]">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BookMarked className="h-5 w-5 text-primary" />
              Bitácora de fuentes
            </DialogTitle>
            <DialogDescription>
              URLs y consultas web registradas desde el agente. Ancla fuentes con el pin para priorizarlas. Importa o
              exporta JSON/CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2">
            <input
              ref={importResearchEvidenceInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={handleImportResearchEvidenceJsonChange}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => downloadResearchEvidenceJson(researchEvidenceLog, documentId || 'documento')}
            >
              Exportar JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePickImportResearchEvidenceJson}
              disabled={!documentId}
              title={!documentId ? 'Requiere documento guardado' : undefined}
            >
              <Upload className="h-4 w-4 mr-1.5" aria-hidden />
              Importar JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => downloadResearchEvidenceCsv(researchEvidenceLog, documentId || 'documento')}
            >
              Exportar CSV
            </Button>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {researchEvidenceLog.length} entrada{researchEvidenceLog.length === 1 ? '' : 's'}
              {pinnedResearchEvidenceIds.length > 0
                ? ` · ${pinnedResearchEvidenceIds.length} anclada${pinnedResearchEvidenceIds.length === 1 ? '' : 's'}`
                : ''}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-muted/15">
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent">
              {researchEvidenceLog.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aún no hay fuentes. Tras enviar mensajes con enlaces o citas web, usa «Guardar local» para asegurar el
                  PDF y el chat en el documento.
                </p>
              ) : (
                <ResearchEvidenceLogTable
                  entries={[...researchEvidenceLog].reverse()}
                  onPersistUserComment={persistEvidenceUserComment}
                  pinnedIds={pinnedResearchEvidenceIds}
                  onTogglePin={(id) => void toggleEvidencePin(id)}
                />
              )}
            </div>
            <div className="flex shrink-0 justify-end border-t border-border/60 px-4 py-3">
              <Button variant="ghost" size="sm" onClick={() => setSourcesModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SpotlightTour
        open={editorTourOpen}
        onOpenChange={(v) => {
          setEditorTourOpen(v)
          if (!v) {
            try {
              localStorage.setItem('criteria.help.tour.editorEtherpad.v1.seen', '1')
              localStorage.setItem('nelai.help.tour.editorEtherpad.v1.seen', '1')
            } catch {
              /* ignore */
            }
          }
        }}
        initialStepId={editorTourSteps[0]?.id}
        steps={editorTourSteps}
      />
    </>
  )
}

