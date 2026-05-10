/**
 * Página para editar documentos antes de generar PDF
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import RichTextEditor, { type EditorApi } from '@/components/documents/RichTextEditor'
import {
  DOCUMENT_EDITOR_QUILL_TOOLBAR_GROUPS,
  DOCUMENT_EDITOR_QUILL_TOOLBAR_ID,
} from '@/components/documents/documentEditorQuill'
// @ts-expect-error Subpath export (tipos del paquete no siempre lo incluyen)
import { addControls } from 'quill/modules/toolbar.js'
import { DocumentEditorAgent } from '@/components/documents/DocumentEditorAgent'
import DiffViewer from '@/components/documents/DiffViewer'
import { DocumentHeadingOutline } from '@/components/documents/DocumentHeadingOutline'
import { DocumentEditorPdfPreview } from '@/components/documents/DocumentEditorPdfPreview'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { createDocument, updateDocumentContent } from '@/services/documents/DocumentService'
import { getDocument, updateDocument } from '@/utils/documentStorage'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Save,
  Bot,
  Info,
  Menu,
  PanelTopClose,
  PanelTop,
  History,
  RotateCcw,
  Eye,
  GitCompare,
  Shield,
  ListTree,
  PanelLeftClose,
} from 'lucide-react'
import type { DocumentType, PrivacyPlaceholderEntry } from '@/types/documents'
import type { PiiReviewRow } from '@/services/privacy/piiTypes'
import { encryptDocument } from '@/services/documents/DocumentEncryptor'
import Identicon from '@polkadot/react-identicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useDocumentEditorLayout } from '@/contexts/DocumentEditorLayoutContext'
import { cn } from '@/lib/utils'
import { quillRichTextDebug } from '@/lib/quillRichTextDebug'
import type { PiiMatch } from '@/services/privacy/piiTypes'
import {
  buildCriteriaPlaceholder,
  detectPiiOutsideCriteriaBrackets,
  embeddedCriteriaRowsFromPlain,
} from '@/services/privacy/criteriaPlaceholders'
import {
  type AgentProfile,
  inferAgentProfile,
  withAgentProfileTag,
} from '@/services/criteria/systemPrompts'
import {
  DEFAULT_PAPER_FORMAT,
  PAPER_SPECS,
  normalizePaperFormat,
  type PaperFormatId,
} from '@/constants/paperFormat'
import {
  criteriaDomainFromAgentProfile,
  formatUserTagsInput,
  parseUserTagsInput,
} from '@/utils/documentListing'

/** Texto plano alineado con el estado React del editor (Quill puede ir un tick detrás). */
function plainTextFromHtml(html: string): string {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || div.innerText || '').trim()
}

/** Huella barata para omitir autoguardados sin cambios (no sustituye a guardado manual). */
function autosaveFingerprint(title: string, html: string) {
  const s = html || ''
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return `${(title || '').trim()}|${s.length}|${h}`
}

const AUTOSAVE_INTERVAL_MS = 45_000

export default function DocumentEditor() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { accounts } = useKeyringContext()
  const { activeAccount } = useActiveAccount()
  const layoutCtx = useDocumentEditorLayout()

  const [isEditing] = useState(!!documentId)
  const [loading, setLoading] = useState(!!documentId)
  const [saving, setSaving] = useState(false)

  // Formulario
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocumentType>('generic')
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  /** Tamaño de hoja (editor + PDF); se guarda en metadata.paperFormat. */
  const [paperFormat, setPaperFormat] = useState<PaperFormatId>(DEFAULT_PAPER_FORMAT)
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [encrypt, setEncrypt] = useState(false)
  const [encryptPassword, setEncryptPassword] = useState('')
  const [encryptDialogOpen, setEncryptDialogOpen] = useState(false)
  const [metadataModalOpen, setMetadataModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentProfile, setAgentProfile] = useState<AgentProfile>('academic_es')
  const [updatingAgentProfile, setUpdatingAgentProfile] = useState(false)
  const [userTagsLine, setUserTagsLine] = useState('')
  const [chatHistory, setChatHistory] = useState<any[]>([])
  /** Se incrementa al cargar el documento para hidratar el chat del agente desde IndexedDB */
  const [chatSessionKey, setChatSessionKey] = useState(0)
  const chatHistoryRef = useRef<any[]>([])

  useEffect(() => {
    chatHistoryRef.current = chatHistory
  }, [chatHistory])
  const [versions, setVersions] = useState<any[]>([])
  const [appliedMods, setAppliedMods] = useState<Record<string, number>>({})
  const [previewVersion, setPreviewVersion] = useState<any | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [liveDiffEnabled, setLiveDiffEnabled] = useState(false)
  /** Índice / mapa del documento (sidebar ≥lg, sheet en pantallas pequeñas). */
  const [docMapOpen, setDocMapOpen] = useState(false)
  const [isLgUp, setIsLgUp] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsLgUp(mq.matches)
    mq.addEventListener('change', onChange)
    setIsLgUp(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const [savedContent, setSavedContent] = useState('')
  const editorApiRef = useRef<EditorApi | null>(null)
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null)
  /** Última huella persistida por autoguardado (independiente del botón Guardar). */
  const lastAutoSavedFingerprintRef = useRef<string | null>(null)
  const autoSavingRef = useRef(false)
  /** Valores actuales para el tick de autoguardado (intervalo sin deps obsoletas). */
  const editorPersistRef = useRef({
    documentId: undefined as string | undefined,
    loading: true,
    saving: false,
    title: '',
    content: '',
    selectedAccount: '',
    description: '',
    chatHistory: [] as any[],
    appliedMods: {} as Record<string, number>,
    placeholderRegistry: [] as PrivacyPlaceholderEntry[],
    paperFormat: DEFAULT_PAPER_FORMAT as PaperFormatId,
    agentProfile: 'academic_es' as AgentProfile,
    userTagsLine: '',
  })
  /** Fuerza recálculo del texto plano cuando Quill expone la API. */
  const [editorPlainTick, setEditorPlainTick] = useState(0)
  const [placeholderRegistry, setPlaceholderRegistry] = useState<PrivacyPlaceholderEntry[]>([])
  const placeholderRegistryRef = useRef<PrivacyPlaceholderEntry[]>([])
  /** Evita persistir [] antes de terminar loadDocument (IndexedDB). */
  const privacyRegistryHydratedRef = useRef(false)
  useEffect(() => {
    placeholderRegistryRef.current = placeholderRegistry
  }, [placeholderRegistry])

  editorPersistRef.current = {
    documentId,
    loading,
    saving,
    title,
    content,
    selectedAccount,
    description,
    chatHistory,
    appliedMods,
    placeholderRegistry,
    paperFormat,
    agentProfile,
    userTagsLine,
  }

  const onEditorPlainReady = useCallback(() => {
    setEditorPlainTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!documentId || !privacyRegistryHydratedRef.current) return
    let cancelled = false
    const id = window.setTimeout(() => {
      void (async () => {
        const doc = await getDocument(documentId)
        if (cancelled || !doc) return
        await updateDocument(documentId, { ...doc, privacyPlaceholderRegistry: placeholderRegistry })
      })()
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [placeholderRegistry, documentId])

  /**
   * Texto plano alineado con Quill cuando la API existe (evita desfase HTML→texto al enviar a la IA);
   * si no hay editor montado, se deriva del HTML en estado React.
   */
  const documentPlainForPrivacy = useMemo(() => {
    try {
      const api = editorApiRef.current
      if (api?.getPlainText) {
        return api.getPlainText()
      }
    } catch {
      /* usar HTML */
    }
    return plainTextFromHtml(content)
  }, [content, editorPlainTick])

  const documentPrivacyEmbedded = useMemo(
    () => embeddedCriteriaRowsFromPlain(documentPlainForPrivacy),
    [documentPlainForPrivacy]
  )

  /** Índices coherentes con `replacePlainRange`: preferir delta de Quill si ya está sincronizado. */
  const documentPrivacyPending = useMemo(() => {
    try {
      const api = editorApiRef.current
      if (api?.getPlainText) {
        const q = api.getPlainText()
        return detectPiiOutsideCriteriaBrackets(q)
      }
    } catch {
      /* usar HTML */
    }
    return detectPiiOutsideCriteriaBrackets(documentPlainForPrivacy)
  }, [documentPlainForPrivacy, editorPlainTick, content])

  /** Misma base que `documentPlainForPrivacy` / pestaña PII: el HTML puede no contener el substring literal `[CRITERIA_*]` (o legacy `[NELAI_*]`). */
  useEffect(() => {
    const plain = plainTextFromHtml(content || '')
    setPlaceholderRegistry((prev) => prev.filter((e) => plain.includes(e.placeholder)))
  }, [content])

  const handleMapEditorSelectionToPlaceholder = useCallback(() => {
    const api = editorApiRef.current
    if (!api?.getPlainText || !api.replaceSelectionWithText) {
      toast.error('Editor no listo')
      return
    }
    const sel = api.getSelectionPlain()
    if (!sel || !sel.text.trim()) {
      toast.message('Selecciona texto en el documento', {
        description: 'Marca un fragmento en el editor de la izquierda y vuelve a pulsar.',
      })
      return
    }
    if (sel.text.length > 6000) {
      toast.error('La selección supera 6000 caracteres')
      return
    }
    const plain = api.getPlainText()
    const registryPhChunk = placeholderRegistryRef.current.map((e) => e.placeholder).join('\n')
    const ph = buildCriteriaPlaceholder(plain, 'MANUAL', registryPhChunk)
    if (!api.replaceSelectionWithText(ph)) {
      toast.error('No se pudo sustituir la selección')
      return
    }
    setContent(api.getContent())
    setEditorPlainTick((t) => t + 1)
    setPlaceholderRegistry((prev) =>
      prev.some((p) => p.placeholder === ph)
        ? prev
        : [...prev, { placeholder: ph, original: sel.text, kind: 'MANUAL' }]
    )
    toast.success('Placeholder insertado en el documento', { description: ph })
  }, [])

  const handleApplyDocumentPendingMatch = useCallback((m: PiiMatch) => {
    const api = editorApiRef.current
    if (!api?.getPlainText || !api.replacePlainRange) {
      toast.error('Editor no listo')
      return
    }
    const plain = api.getPlainText()
    if (plain.slice(m.start, m.end) !== m.text) {
      toast.error('El fragmento ya no coincide', {
        description: 'El documento cambió; vuelve a revisar la lista en Privacidad.',
      })
      return
    }
    const registryPhChunk = placeholderRegistryRef.current.map((e) => e.placeholder).join('\n')
    const ph = buildCriteriaPlaceholder(plain, m.kind, registryPhChunk)
    if (!api.replacePlainRange(m.start, m.end, ph)) {
      toast.error('No se pudo aplicar la sustitución')
      return
    }
    setContent(api.getContent())
    setEditorPlainTick((t) => t + 1)
    setPlaceholderRegistry((prev) =>
      prev.some((p) => p.placeholder === ph)
        ? prev
        : [...prev, { placeholder: ph, original: m.text, kind: m.kind }]
    )
    toast.success('Sustituido en el documento', { description: ph })
  }, [])

  const handleRevertDocumentPlaceholder = useCallback((placeholder: string) => {
    const api = editorApiRef.current
    if (!api?.replaceText) {
      toast.error('Editor no listo')
      return
    }
    const entry = placeholderRegistryRef.current.find((e) => e.placeholder === placeholder)
    if (!entry) {
      toast.error('No hay texto original registrado para este token')
      return
    }
    if (!api.replaceText(placeholder, entry.original)) {
      toast.error('No se encontró el token en el documento')
      return
    }
    setContent(api.getContent())
    setEditorPlainTick((t) => t + 1)
    setPlaceholderRegistry((prev) => prev.filter((e) => e.placeholder !== placeholder))
    toast.success('Texto original restaurado')
  }, [])

  const handleSetDocumentPlaceholderLabel = useCallback((placeholder: string, label: string) => {
    const trimmed = label.trim()
    setPlaceholderRegistry((prev) =>
      prev.map((e) => (e.placeholder === placeholder ? { ...e, label: trimmed || undefined } : e))
    )
    toast.success('Etiqueta guardada')
  }, [])

  const handleRegisterPrivacyMappingsFromRows = useCallback((rows: PiiReviewRow[]) => {
    setPlaceholderRegistry((prev) => {
      const next = [...prev]
      for (const r of rows) {
        if (!r.placeholder || next.some((e) => e.placeholder === r.placeholder)) continue
        next.push({ placeholder: r.placeholder, original: r.original, kind: r.kind })
      }
      return next
    })
  }, [])

  const handleGoToDocumentPlaceholder = useCallback((token: string) => {
    const run = () => {
      const api = editorApiRef.current
      if (!api?.focusPlaceholderInDocument) {
        toast.error('Editor no listo')
        return
      }
      if (!api.focusPlaceholderInDocument(token)) {
        toast.message('No se encontró en el editor', {
          description: 'El token podría haberse eliminado o el contenido aún no está sincronizado.',
        })
        return
      }
      // El scroll fino va dentro de Quill (.ql-container); scrollIntoView de la “hoja” centraba toda la página.
    }
    requestAnimationFrame(() => requestAnimationFrame(run))
  }, [])

  useEffect(() => {
    if (!documentId) return
    // Persistir historial del chat (incluso vacío) en IndexedDB
    getDocument(documentId).then((doc) => {
      if (doc) {
        updateDocument(documentId, { ...doc, chatHistory, updatedAt: Date.now() })
      }
    })
  }, [chatHistory, documentId])

  const flushChatToStorage = useCallback(() => {
    if (!documentId) return
    const latest = chatHistoryRef.current
    getDocument(documentId).then((doc) => {
      if (doc) {
        updateDocument(documentId, { ...doc, chatHistory: latest, updatedAt: Date.now() })
      }
    })
  }, [documentId])

  const handleAgentOpenChange = useCallback(
    (open: boolean) => {
      setAgentOpen(open)
      if (!open) flushChatToStorage()
    },
    [flushChatToStorage]
  )

  const persistAgentProfile = useCallback(
    async (next: AgentProfile) => {
      setAgentProfile(next)
      if (!documentId) return
      try {
        setUpdatingAgentProfile(true)
        const doc = await getDocument(documentId)
        if (!doc) return
        const nextKeywords = withAgentProfileTag(doc.metadata?.keywords, next)
        await updateDocument(documentId, {
          metadata: {
            ...doc.metadata,
            keywords: nextKeywords,
            criteriaDomain: criteriaDomainFromAgentProfile(next),
          },
        })
        toast.success('Perfil del agente actualizado')
      } catch (e) {
        console.error('[Document Editor] set agent profile', e)
        toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el perfil del agente')
      } finally {
        setUpdatingAgentProfile(false)
      }
    },
    [documentId],
  )

  useEffect(() => {
    if (documentId) {
      loadDocument()
    } else {
      if (accounts.length > 0) {
        setSelectedAccount(accounts[0].address)
      } else if (activeAccount) {
        setSelectedAccount(activeAccount)
      }
    }
  }, [documentId, accounts, activeAccount])

  const loadDocument = async () => {
    if (!documentId) return

    try {
      privacyRegistryHydratedRef.current = false
      setPlaceholderRegistry([])
      setLoading(true)
      const doc = await getDocument(documentId)

      if (!doc) {
        toast.error('Documento no encontrado')
        navigate('/documents')
        return
      }

      setTitle(doc.metadata.title || '')
      setType(doc.type)
      setDescription(doc.metadata.description || '')
      setPaperFormat(normalizePaperFormat(doc.metadata.paperFormat))
      setSelectedAccount(doc.relatedAccount || accounts[0]?.address || '')
      setAgentProfile(
        inferAgentProfile({
          documentType: doc.type,
          keywords: doc.metadata?.keywords,
          category: doc.category,
        }),
      )
      const initialContent = (doc.metadata.contentHtml as string) || ''
      setContent(initialContent)
      setSavedContent(initialContent)
      setEncrypt(doc.encrypted || false)
      setChatHistory(doc.chatHistory || [])
      setChatSessionKey((k) => k + 1)
      setAppliedMods(doc.appliedMods || {})
      setVersions(doc.versions || [])
      setPlaceholderRegistry(doc.privacyPlaceholderRegistry ?? [])
      setUserTagsLine(formatUserTagsInput(doc.metadata.userTags))
      lastAutoSavedFingerprintRef.current = autosaveFingerprint(
        doc.metadata.title || '',
        initialContent
      )
    } catch (error) {
      console.error('[Document Editor] Error al cargar documento:', error)
      toast.error('Error al cargar el documento')
    } finally {
      setLoading(false)
      if (documentId) privacyRegistryHydratedRef.current = true
    }
  }

  useEffect(() => {
    if (!documentId) {
      privacyRegistryHydratedRef.current = true
      setPlaceholderRegistry([])
    }
  }, [documentId])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Por favor ingresa un título')
      return
    }

    if (!selectedAccount) {
      toast.error('Por favor selecciona una cuenta como autor')
      return
    }

    const rawHtmlForSave = (() => {
      try {
        const live = editorApiRef.current?.getContent?.()
        if (typeof live === 'string' && live.length > 0) return live
      } catch {
        /* usar estado React */
      }
      return content
    })()

    if (!rawHtmlForSave.trim()) {
      toast.error('Por favor ingresa contenido para el documento')
      return
    }

    try {
      setSaving(true)

      const metadata = {
        title,
        description,
        author: selectedAccount,
        createdAt: new Date().toISOString(),
        paperFormat,
        keywords: withAgentProfileTag(undefined, agentProfile),
        criteriaDomain: criteriaDomainFromAgentProfile(agentProfile),
        userTags: parseUserTagsInput(userTagsLine),
      }
      const pdfContent = rawHtmlForSave || '<p>Sin contenido</p>'

      let finalDocument
      if (documentId) {
        finalDocument = await updateDocumentContent(documentId, {
          content: pdfContent,
          metadata: { ...metadata, modifiedAt: new Date().toISOString() },
          relatedAccount: selectedAccount,
          chatHistory,
          appliedMods,
          privacyPlaceholderRegistry: placeholderRegistry,
          saveVersion: true,
          changeDescription: 'Guardado manual'
        })
        setContent(pdfContent)
        setSavedContent(pdfContent)
        setVersions(finalDocument.versions || [])
      } else {
        finalDocument = await createDocument({
          type,
          metadata,
          pdfContent: {
            title,
            subtitle: description,
            sections: [
              { title: 'Contenido', content: pdfContent, isTable: false },
            ],
          },
          relatedAccount: selectedAccount,
        })
        // Añadir versión inicial
        finalDocument = await updateDocumentContent(finalDocument.documentId, {
          content: pdfContent,
          metadata: finalDocument.metadata,
          privacyPlaceholderRegistry: placeholderRegistry,
          saveVersion: true,
          changeDescription: 'Versión inicial'
        })
        setContent(pdfContent)
        setSavedContent(pdfContent)
        setVersions(finalDocument.versions || [])
      }

      // Encriptar si se solicita
      if (encrypt) {
        if (!encryptPassword.trim()) {
          setEncryptDialogOpen(true)
          return
        }

        finalDocument = await encryptDocument(finalDocument, encryptPassword)
        toast.success('Documento encriptado y guardado')
      } else {
        toast.success('Documento guardado exitosamente')
      }

      // Navegar al detalle del documento
      navigate(`/documents/${finalDocument.documentId}`)
    } catch (error) {
      console.error('[Document Editor] Error al guardar:', error)
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar el documento'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEncryptConfirm = async () => {
    if (!encryptPassword.trim()) {
      toast.error('Por favor ingresa una contraseña')
      return
    }

    setEncryptDialogOpen(false)
    await handleSave()
  }

  /** Autoguardado periódico y al ocultar la pestaña (sin nueva versión en historial). */
  useEffect(() => {
    const tick = () => {
      void (async () => {
        if (autoSavingRef.current) return
        const s = editorPersistRef.current
        if (!s.documentId || s.loading || s.saving) return
        if (!s.title.trim() || !s.selectedAccount) return
        const html = (() => {
          try {
            const live = editorApiRef.current?.getContent?.()
            if (typeof live === 'string' && live.length > 0) return live
          } catch {
            /* */
          }
          return s.content
        })()
        if (!html.trim()) return
        const fp = autosaveFingerprint(s.title, html)
        if (fp === lastAutoSavedFingerprintRef.current) return
        autoSavingRef.current = true
        try {
          await updateDocumentContent(s.documentId, {
            content: html,
            metadata: {
              title: s.title,
              description: s.description,
              author: s.selectedAccount,
              modifiedAt: new Date().toISOString(),
              paperFormat: s.paperFormat,
              criteriaDomain: criteriaDomainFromAgentProfile(s.agentProfile),
              userTags: parseUserTagsInput(s.userTagsLine),
            },
            relatedAccount: s.selectedAccount,
            chatHistory: s.chatHistory,
            appliedMods: s.appliedMods,
            privacyPlaceholderRegistry: s.placeholderRegistry,
            saveVersion: false,
            changeDescription: 'Autoguardado',
          })
          lastAutoSavedFingerprintRef.current = fp
          setSavedContent(html)
        } catch (err) {
          console.error('[Document Editor] Autoguardado:', err)
          toast.error('Autoguardado fallido', {
            description:
              err instanceof Error ? err.message : 'Vuelve a intentar o usa el botón Guardar.',
          })
        } finally {
          autoSavingRef.current = false
        }
      })()
    }
    const id = window.setInterval(tick, AUTOSAVE_INTERVAL_MS)
    const onVis = () => {
      if (document.visibilityState === 'hidden') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const [docStats, setDocStats] = useState({ chars: 0, pages: 1 })
  const [toolbarHostEl, setToolbarHostEl] = useState<HTMLDivElement | null>(null)
  /** Incrementar al desmontar Quill para forzar DOM nuevo de la toolbar (Quill no quita listeners del host externo). */
  const [toolbarHostCycle, setToolbarHostCycle] = useState(0)
  const toolbarHostLiveRef = useRef<HTMLDivElement | null>(null)
  const requestFreshToolbarHost = useCallback(() => {
    setToolbarHostCycle((n) => n + 1)
  }, [])

  const toolbarHostRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      const prev = toolbarHostLiveRef.current
      toolbarHostLiveRef.current = null
      prev?.replaceChildren()
      setToolbarHostEl(null)
      return
    }
    toolbarHostLiveRef.current = el
    if (!el.querySelector('button.ql-bold')) {
      addControls(el, DOCUMENT_EDITOR_QUILL_TOOLBAR_GROUPS as never)
      quillRichTextDebug('DocumentEditor: addControls en host (DOM nuevo o vacío)', {
        id: el.id,
        buttons: el.querySelectorAll('button').length,
        selects: el.querySelectorAll('select').length,
      })
    } else {
      quillRichTextDebug('DocumentEditor: host ya tenía controles Quill (addControls omitido)', {
        id: el.id,
        hint: 'Si el editor se reinició sin recrear este nodo, pueden acumularse listeners duplicados; el host usa key por documento para evitarlo.',
      })
    }
    setToolbarHostEl(el)
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Cargando documento...</p>
        </div>
      </div>
    )
  }

  const headerCollapsed = layoutCtx?.headerCollapsed ?? false
  const sidebarOpen = layoutCtx?.sidebarOpen ?? false

  return (
    <>
    <div
      className={cn(
        'fixed top-0 bottom-0 z-10 flex flex-col bg-background left-0 right-0',
        sidebarOpen && 'md:left-64'
      )}
    >
      {/* Barra de opciones del documento */}
      <div
        className={`flex items-center gap-1 sm:gap-2 border-b shrink-0 transition-all ${
          headerCollapsed ? 'px-2 py-1' : 'px-3 sm:px-4 py-2'
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => layoutCtx?.toggleSidebar()}
          className="flex-shrink-0 h-8 w-8"
          title="Mostrar menú"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/documents')}
          className="flex-shrink-0 h-8 w-8"
          title="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {!headerCollapsed && (
          <>
            <div className="flex-1 min-w-0 px-2 lg:px-4">
              <input
                className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-semibold truncate hover:bg-muted/30 rounded px-1 transition-colors outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del documento"
              />
              <p className="text-[10px] text-muted-foreground truncate px-1">
                {isEditing ? 'Editar' : 'Nuevo documento'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 max-w-[min(100%,220px)] sm:max-w-[260px]">
              <Select
                value={agentProfile}
                onValueChange={(v) => void persistAgentProfile(v as AgentProfile)}
                disabled={updatingAgentProfile}
              >
                <SelectTrigger
                  className="h-8 text-[11px] sm:text-xs w-full"
                  title="Modo del agente (académico o legal)"
                  aria-label="Perfil del agente"
                >
                  <SelectValue placeholder="Perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic_es">Académico</SelectItem>
                  <SelectItem value="legal_mx">Legal MX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAgentOpen(true)}
              className="flex-shrink-0 h-8 w-8"
              title="Asistente IA"
            >
              <Bot className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMetadataModalOpen(true)}
              className="flex-shrink-0 h-8 w-8"
              title="Información"
            >
              <Info className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoryModalOpen(true)}
              className="flex-shrink-0 h-8 w-8"
              title="Historial de cambios"
            >
              <History className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button
          variant={liveDiffEnabled ? "secondary" : "ghost"}
          size="icon"
          onClick={() => setLiveDiffEnabled(!liveDiffEnabled)}
          className={`flex-shrink-0 h-8 w-8 ${liveDiffEnabled ? 'text-primary' : ''}`}
          title={liveDiffEnabled ? "Ocultar cambios en vivo" : "Ver cambios en vivo (Diff)"}
        >
          <GitCompare className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => layoutCtx?.toggleHeader()}
          className="flex-shrink-0 h-8 w-8"
          title={headerCollapsed ? 'Mostrar barra' : 'Ocultar barra'}
        >
          {headerCollapsed ? (
            <PanelTop className="h-4 w-4" />
          ) : (
            <PanelTopClose className="h-4 w-4" />
          )}
        </Button>
        {!headerCollapsed && (
          <div className="flex gap-2 ml-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? '...' : 'Guardar'}
            </Button>
          </div>
        )}
      </div>

      {/* Editor + panel agente */}
      <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 min-w-0 flex-col bg-muted/40 transition-all duration-300 ease-in-out">
          {/* Barra de formato: sin overflow-hidden aquí para que los pickers de Quill no se recorten */}
          {!liveDiffEnabled && (
            <div className="relative z-30 flex shrink-0 items-stretch gap-0 border-b border-border bg-background">
              <div
                id={DOCUMENT_EDITOR_QUILL_TOOLBAR_ID}
                key={`toolbar-${documentId ?? 'new'}-${toolbarHostCycle}`}
                ref={toolbarHostRef}
                className="document-editor-quill-toolbar-host min-h-[44px] min-w-0 flex-1 overflow-visible"
                aria-label="Formato de texto"
              />
              <div className="flex shrink-0 items-center gap-1.5 border-l border-border bg-background px-2 py-1 sm:px-3">
                <Button
                  type="button"
                  variant={docMapOpen ? 'secondary' : 'outline'}
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  title={docMapOpen ? 'Ocultar mapa del documento' : 'Mostrar mapa del documento'}
                  aria-expanded={docMapOpen}
                  onClick={() => setDocMapOpen((v) => !v)}
                >
                  <ListTree className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title="Sustituir la selección en el editor por un placeholder CRITERIA (privacidad)"
                  className="h-8 gap-1 px-2 text-[10px] whitespace-nowrap sm:gap-1.5 sm:px-3 sm:text-[11px]"
                  onClick={handleMapEditorSelectionToPlaceholder}
                >
                  <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Placeholder</span>
                  <span className="sm:hidden">PII</span>
                </Button>
              </div>
            </div>
          )}
          {!isLgUp && !liveDiffEnabled && (
            <Sheet open={docMapOpen} onOpenChange={setDocMapOpen}>
              <SheetContent
                side="left"
                className="flex w-[min(320px,90vw)] max-w-sm flex-col gap-0 border-r p-0 pt-12"
              >
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                  <DocumentHeadingOutline
                    html={content}
                    editorSurfaceRef={editorSurfaceRef}
                    onNavigate={() => setDocMapOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
            {!liveDiffEnabled && (
              <aside
                id="criteria-doc-heading-map"
                aria-hidden={!docMapOpen}
                className={cn(
                  'hidden shrink-0 flex-col overflow-hidden border-border bg-muted/20 transition-[width] duration-200 ease-out lg:flex',
                  docMapOpen ? 'w-[280px] border-r' : 'w-0 border-0 pointer-events-none'
                )}
              >
                <div className="flex h-full min-h-0 w-[280px] flex-col">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background/80 px-2 py-2">
                    <span className="truncate pl-1 text-xs font-semibold text-foreground">Mapa del documento</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Ocultar mapa"
                      aria-label="Ocultar mapa del documento"
                      onClick={() => setDocMapOpen(false)}
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <DocumentHeadingOutline
                      html={content}
                      editorSurfaceRef={editorSurfaceRef}
                      showHeading={false}
                    />
                  </div>
                </div>
              </aside>
            )}
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
              <div className="mx-auto flex min-h-full w-full max-w-full flex-col p-4 sm:p-6 lg:p-8">
                <div className="mx-auto mb-8 flex min-h-[min(1056px,100%)] w-full max-w-[850px] flex-1 flex-col rounded-sm border bg-background p-4 shadow-xl sm:p-12">
                {liveDiffEnabled ? (
                  <div className="min-h-[300px]">
                    <div className="mb-4 flex items-center justify-between border-b pb-2">
                      <h3 className="flex items-center gap-2 text-sm font-bold">
                        <GitCompare className="h-4 w-4" />
                        Cambios sin guardar
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLiveDiffEnabled(false)}
                        className="h-7 text-[10px]"
                      >
                        <Eye className="mr-1 h-3 w-3" /> Volver al editor
                      </Button>
                    </div>
                    <DiffViewer oldValue={savedContent} newValue={content} />
                  </div>
                ) : (
                  <>
                    <RichTextEditor
                      key={documentId ?? 'new'}
                      value={content}
                      onChange={setContent}
                      placeholder="Escribe el contenido del documento aquí..."
                      editorApiRef={editorApiRef}
                      onEditorReady={onEditorPlainReady}
                      viewportEditorChrome
                      toolbarContainerEl={toolbarHostEl}
                      onExternalToolbarHostCycle={requestFreshToolbarHost}
                      onDocStatsChange={setDocStats}
                      surfaceRef={editorSurfaceRef}
                      paperFormat={paperFormat}
                      className="flex min-h-0 flex-1 flex-col border-0"
                    />
                    <DocumentEditorPdfPreview
                      html={content}
                      title={title}
                      subtitle={description}
                      author={selectedAccount}
                      paperFormat={paperFormat}
                    />
                  </>
                )}
                </div>
              </div>
            </div>
          </div>
          {headerCollapsed && (
            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background px-4 py-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="mr-1 h-4 w-4" />
                {saving ? '...' : 'Guardar'}
              </Button>
            </div>
          )}
          {!liveDiffEnabled && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-background/95 px-3 py-2 text-[11px] text-muted-foreground supports-[backdrop-filter]:bg-background/80">
              <span className="leading-snug">
                <strong className="text-foreground">{PAPER_SPECS[paperFormat].label}</strong> · márgenes ~25 / 20 /
                25 mm · interlineado <strong className="text-foreground">1,5</strong> · vista previa PDF abajo (misma
                composición que al guardar)
              </span>
              <span className="shrink-0 font-medium tabular-nums text-foreground/90">
                {docStats.chars.toLocaleString('es-MX')} caracteres · ≈ {docStats.pages} página
                {docStats.pages === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>

        {/* Agente: siempre montado para conservar el hilo al cerrar el panel; oculto cuando no está abierto */}
        <aside
          className={cn(
            'w-full lg:w-[500px] border-l bg-background flex-col shadow-2xl z-40 shrink-0',
            agentOpen ? 'flex animate-in slide-in-from-right duration-300' : 'hidden'
          )}
        >
            <DocumentEditorAgent
              open={agentOpen}
              onOpenChange={handleAgentOpenChange}
              documentId={documentId}
              chatSessionKey={chatSessionKey}
              initialMessages={chatHistory}
              appliedMods={appliedMods}
              onAppliedModsChange={setAppliedMods}
              onMessagesChange={(msgs) => {
                setChatHistory(
                  msgs.map((m) => ({
                    role: m.role,
                    content: m.content,
                    timestamp: typeof m.timestamp === 'number' && m.timestamp > 0 ? m.timestamp : 0,
                    ...(m.attachments?.length ? { attachments: m.attachments } : {}),
                    ...(m.documentScore != null ? { documentScore: m.documentScore } : {}),
                  })),
                )
              }}
              documentContext={{
                title,
                type,
                description,
                contentPlain: documentPlainForPrivacy,
              }}
              agentProfileOverride={agentProfile}
              documentPrivacyScan={{
                embeddedInDocument: documentPrivacyEmbedded,
                pendingDocMatches: documentPrivacyPending,
              }}
              onApplyDocumentPendingMatch={handleApplyDocumentPendingMatch}
              documentPlaceholderRegistry={placeholderRegistry}
              onRevertDocumentPlaceholder={handleRevertDocumentPlaceholder}
              onSetDocumentPlaceholderLabel={handleSetDocumentPlaceholderLabel}
              onRegisterPrivacyMappingsFromRows={handleRegisterPrivacyMappingsFromRows}
              onGoToDocumentPlaceholder={handleGoToDocumentPlaceholder}
              editorApiRef={editorApiRef}
              onContentChange={async (newContent, desc) => {
                setContent(newContent)
                if (documentId) {
                  try {
                    const metadata = {
                      title,
                      description,
                      author: selectedAccount,
                      paperFormat,
                      keywords: withAgentProfileTag(undefined, agentProfile),
                      criteriaDomain: criteriaDomainFromAgentProfile(agentProfile),
                      userTags: parseUserTagsInput(userTagsLine),
                    }
                    const updated = await updateDocumentContent(documentId, {
                      content: newContent,
                      metadata,
                      chatHistory,
                      appliedMods,
                      privacyPlaceholderRegistry: placeholderRegistry,
                      saveVersion: true,
                      changeDescription: desc
                    })
                    setVersions(updated.versions || [])
                  } catch (err) {
                    console.error('[Document Editor] Error auto-saving AI change:', err)
                  }
                }
              }}
            />
        </aside>
      </div>
    </div>

      {/* Modal de metadata */}
      <Dialog open={metadataModalOpen} onOpenChange={setMetadataModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Información del Documento</DialogTitle>
            <DialogDescription>
              Título, ámbito (perfil del agente), etiquetas propias, descripción y autor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-title">Título *</Label>
              <Input
                id="modal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del documento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-user-tags">Etiquetas (opcional)</Label>
              <Input
                id="modal-user-tags"
                value={userTagsLine}
                onChange={(e) => setUserTagsLine(e.target.value)}
                placeholder="ej. tesis, nda-revisión, cliente-xyz"
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Separa con comas; se guardan en minúsculas para filtrar en Documentos.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Perfil del agente</Label>
              <Select
                value={agentProfile}
                onValueChange={(v) => void persistAgentProfile(v as AgentProfile)}
                disabled={updatingAgentProfile}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic_es">Académico (ensayos e investigación)</SelectItem>
                  <SelectItem value="legal_mx">Legal MX (contratos y revisión legal)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Mismo control que en la barra superior. Define el modo de trabajo del agente para este documento.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-description">Descripción</Label>
              <Textarea
                id="modal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del documento"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-paper">Tamaño de hoja (editor y PDF)</Label>
              <Select
                value={paperFormat}
                onValueChange={(v) => setPaperFormat(v as PaperFormatId)}
              >
                <SelectTrigger id="modal-paper">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAPER_SPECS) as PaperFormatId[]).map((id) => (
                    <SelectItem key={id} value={id}>
                      {PAPER_SPECS[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground leading-snug">
                El editor ajusta el ancho y alto de la “hoja”; al guardar o exportar, el PDF usa el mismo
                formato (márgenes del cuerpo ~20 mm a cada lado).
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="modal-encrypt"
                checked={encrypt}
                onChange={(e) => setEncrypt(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="modal-encrypt" className="cursor-pointer text-sm">
                Encriptar documento con contraseña
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-account">Autor *</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger id="modal-account">
                  <SelectValue placeholder="Selecciona una cuenta">
                    {selectedAccount && (
                      <div className="flex items-center gap-2">
                        <Identicon value={selectedAccount} size={16} theme="polkadot" />
                        <span>
                          {accounts.find(a => a.address === selectedAccount)?.meta?.name ||
                            `${selectedAccount.slice(0, 8)}...${selectedAccount.slice(-6)}`}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.address} value={account.address}>
                      <div className="flex items-center gap-2">
                        <Identicon value={account.address} size={16} theme="polkadot" />
                        <div className="flex flex-col">
                          <span className="font-medium">{account.meta?.name || 'Sin nombre'}</span>
                          <span className="text-xs text-muted-foreground">
                            {account.address.slice(0, 8)}...{account.address.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para contraseña de encriptación */}
      <Dialog open={encryptDialogOpen} onOpenChange={setEncryptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encriptar Documento</DialogTitle>
            <DialogDescription>
              Ingresa una contraseña para encriptar el documento. Esta contraseña será necesaria para desencriptarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="encrypt-password">Contraseña *</Label>
              <Input
                id="encrypt-password"
                type="password"
                value={encryptPassword}
                onChange={(e) => setEncryptPassword(e.target.value)}
                placeholder="Contraseña de encriptación"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEncryptDialogOpen(false)
                  setEncryptPassword('')
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleEncryptConfirm}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Historial */}
      <Dialog open={historyModalOpen} onOpenChange={(open) => {
        setHistoryModalOpen(open)
        if (!open) setPreviewVersion(null)
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <History className="h-6 w-6 text-primary" />
              Historial de versiones
            </DialogTitle>
            <DialogDescription>
              Compara y restaura estados anteriores de tu documento
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x border-t">
            {/* Lista de versiones */}
            <div className="w-full md:w-72 overflow-y-auto p-4 space-y-3 bg-muted/20">
              {versions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 italic text-sm">
                  No hay versiones guardadas todavía.
                </p>
              ) : (
                [...versions].reverse().map((v) => (
                  <button
                    key={v.version}
                    onClick={() => setPreviewVersion(v)}
                    className={`w-full flex flex-col text-left p-3 rounded-xl border transition-all ${
                      previewVersion?.version === v.version 
                        ? 'bg-primary/10 border-primary ring-1 ring-primary/20' 
                        : 'bg-background hover:bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary opacity-80">
                        V{v.version}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold truncate leading-tight mb-0.5">
                      {v.changes || 'Cambio sin título'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Panel de previsualización */}
            <div className="flex-1 flex flex-col min-h-0 bg-background">
              {previewVersion ? (
                <>
                  <div className="p-3 border-b bg-muted/5 flex items-center justify-between shrink-0">
                    <div className="min-w-0 pr-4">
                      <h3 className="text-sm font-bold truncate">{previewVersion.title || 'Sin título'}</h3>
                      <p className="text-[10px] text-muted-foreground">Previsualizando versión {previewVersion.version}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={showDiff ? "secondary" : "outline"}
                        className="h-8"
                        onClick={() => setShowDiff(!showDiff)}
                      >
                        <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                        {showDiff ? 'Vista limpia' : 'Comparar'}
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-8 shadow-sm"
                        onClick={async () => {
                          if (window.confirm('¿Restaurar esta versión? Se perderán los cambios actuales.')) {
                            setContent(previewVersion.contentHtml || '')
                            setTitle(previewVersion.title || title)
                            setSavedContent(previewVersion.contentHtml || '')
                            setHistoryModalOpen(false)
                            setPreviewVersion(null)
                            toast.success(`Versión ${previewVersion.version} restaurada`)
                          }
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Restaurar
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 bg-background custom-preview-container">
                    {/* Renderizado del HTML de la versión o Diff */}
                    {showDiff ? (
                      <DiffViewer oldValue={content} newValue={previewVersion.contentHtml || ''} />
                    ) : (
                      <div 
                        className="text-foreground text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ 
                          __html: previewVersion.contentHtml || 
                          `<div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <p class="italic">Esta versión no contiene datos de texto editable.</p>
                            <p class="text-[10px] mt-2">Probablemente fue creada antes de activar el historial de contenido.</p>
                           </div>` 
                        }} 
                      />
                    )}
                    <style>{`
                      .custom-preview-container h1 { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; }
                      .custom-preview-container h2 { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem; }
                      .custom-preview-container p { margin-bottom: 0.5rem; }
                      .custom-preview-container ul { list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem; }
                      .custom-preview-container ol { list-style-type: decimal; margin-left: 1.5rem; margin-bottom: 0.5rem; }
                      .custom-preview-container img { max-width: 100%; height: auto; border-radius: 0.25rem; }
                    `}</style>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground opacity-60">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <History className="h-8 w-8" />
                  </div>
                  <p className="max-w-[200px] text-sm font-medium">
                    Selecciona una versión de la lista para ver su contenido
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 border-t flex justify-end bg-muted/10 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setHistoryModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

