import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAllDocuments, getDocumentsByAccount, type Document } from '@/utils/documentStorage'
import { FileText, Plus, Search, Trash2, Users, Laptop, ChevronDown, Lock } from 'lucide-react'
import { deleteDocument } from '@/utils/documentStorage'
import { Input } from '@/components/ui/input'
import { createDocument } from '@/services/documents/DocumentService'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { downloadPDF, openPDFInNewTab } from '@/utils/pdfUtils'
import { Download, Eye } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import Identicon from '@polkadot/react-identicon'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  criteriaDomainLabel,
  inferCriteriaDomain,
  type CriteriaDomain,
} from '@/utils/documentListing'

type ListScope = 'all' | 'collaborative' | 'local'
type DomainFilter = 'all' | CriteriaDomain

export default function Documents() {
  const { accounts, isUnlocked, storedAccountsStatus } = useKeyringContext()
  const { activeAccount } = useActiveAccount()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [listScope, setListScope] = useState<ListScope>('all')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title?: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  /** Origen + tipo: colapsado por defecto para dar protagonismo al listado. */
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)

  // Usar cuenta activa como default
  useEffect(() => {
    if (activeAccount) {
      setSelectedAccount(activeAccount)
    } else if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0].address)
    }
  }, [activeAccount, accounts])

  /** Hay vault en el dispositivo pero el keyring sigue bloqueado: no listar PDFs locales. */
  const walletLockedWithVault = storedAccountsStatus !== 'none' && !isUnlocked

  const loadDocuments = async () => {
    try {
      setLoading(true)
      if (walletLockedWithVault) {
        setDocuments([])
        return
      }

      let docs: Document[]
      if (activeAccount) {
        docs = await getDocumentsByAccount(activeAccount)
      } else {
        docs = await getAllDocuments()
      }

      docs.sort((a, b) => b.createdAt - a.createdAt)

      if (listScope === 'collaborative') {
        docs = docs.filter((d) => d.category === 'etherpad')
      } else if (listScope === 'local') {
        docs = docs.filter((d) => d.category !== 'etherpad')
      }

      setDocuments(docs)
    } catch (error) {
      console.error('Error al cargar documentos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listScope, isUnlocked, storedAccountsStatus, activeAccount])

  const getAccountDisplayName = (address: string) => {
    const account = accounts.find(acc => acc.address === address)
    return account?.meta?.name || address.slice(0, 8) + '...' + address.slice(-6)
  }

  const handleCreateTestDocument = async () => {
    if (accounts.length === 0) {
      toast.error('Necesitas tener al menos una cuenta para crear documentos')
      return
    }

    if (!selectedAccount) {
      toast.error('Por favor selecciona una cuenta como autor')
      return
    }

    const account = accounts.find(acc => acc.address === selectedAccount)
    const authorName = account?.meta?.name 
      ? `${account.meta.name} (${selectedAccount})`
      : selectedAccount

    try {
      setCreating(true)
      const testDoc = await createDocument({
        type: 'generic',
        category: 'test',
        metadata: {
          title: `Documento de Prueba ${new Date().toLocaleString('es-ES')}`,
          description: 'Este es un documento de prueba generado automáticamente',
          author: authorName, // Incluir nombre de cuenta si está disponible
          subject: 'Prueba',
          keywords: ['test', 'prueba'],
          criteriaDomain: 'academic',
          userTags: ['demo', 'ejemplo'],
          language: 'es',
          creator: 'CriterIA',
          producer: 'CriterIA PDF',
          createdAt: new Date().toISOString(),
        },
        pdfContent: {
          title: 'Documento de Prueba',
          subtitle: `Autor: ${authorName}`,
          sections: [
            {
              title: 'Información',
              content:
                'Este es un documento PDF de prueba generado por CriterIA. El sistema de documentos está funcionando correctamente.',
            },
            {
              title: 'Detalles del Autor',
              content: [
                ['Campo', 'Valor'],
                ['Dirección', selectedAccount],
                ['Nombre', account?.meta?.name || 'Sin nombre'],
                ['Tipo', account?.type || 'N/A'],
              ],
              isTable: true,
            },
            {
              title: 'Detalles del Documento',
              content: [
                ['Campo', 'Valor'],
                ['Tipo', 'Documento Genérico'],
                ['Fecha', new Date().toLocaleString('es-ES')],
                ['Estado', 'Activo'],
              ],
              isTable: true,
            },
          ],
          footer: `Generado el ${new Date().toLocaleDateString('es-ES')} por ${authorName} con CriterIA`,
        },
        relatedAccount: selectedAccount,
      })

      toast.success('Documento creado exitosamente')
      setDialogOpen(false)
      await loadDocuments()
    } catch (error) {
      console.error('Error al crear documento:', error)
      toast.error('Error al crear documento')
    } finally {
      setCreating(false)
    }
  }

  const availableUserTags = useMemo(() => {
    const s = new Set<string>()
    for (const d of documents) {
      for (const t of d.metadata.userTags ?? []) {
        if (t) s.add(t)
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'))
  }, [documents])

  useEffect(() => {
    if (tagFilter !== 'all' && !availableUserTags.includes(tagFilter)) {
      setTagFilter('all')
    }
  }, [availableUserTags, tagFilter])

  const filteredDocuments = useMemo(() => {
    let list = documents
    if (domainFilter !== 'all') {
      list = list.filter((d) => inferCriteriaDomain(d) === domainFilter)
    }
    if (tagFilter !== 'all') {
      list = list.filter((d) => (d.metadata.userTags ?? []).includes(tagFilter))
    }
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter((doc) => {
      const keywords = doc.metadata.keywords ?? []
      const keywordHit = keywords.some((k) => String(k).toLowerCase().includes(q))
      const userTagHit = (doc.metadata.userTags ?? []).some((t) => t.includes(q))
      const domainLabel = criteriaDomainLabel(inferCriteriaDomain(doc)).toLowerCase()
      return (
        doc.metadata.title?.toLowerCase().includes(q) ||
        doc.metadata.description?.toLowerCase().includes(q) ||
        doc.documentId.toLowerCase().includes(q) ||
        doc.category?.toLowerCase().includes(q) ||
        doc.metadata.subject?.toLowerCase().includes(q) ||
        keywordHit ||
        userTagHit ||
        domainLabel.includes(q) ||
        doc.type.toLowerCase().includes(q)
      )
    })
  }, [documents, domainFilter, tagFilter, searchQuery])

  const advancedFilterSummary = useMemo(() => {
    const parts: string[] = []
    if (listScope === 'collaborative') parts.push('Colaborativos')
    if (listScope === 'local') parts.push('Solo locales')
    if (domainFilter !== 'all') parts.push(criteriaDomainLabel(domainFilter))
    if (tagFilter !== 'all') parts.push(`#${tagFilter}`)
    return parts
  }, [listScope, domainFilter, tagFilter])

  const domainBadgeVariant = (domain: CriteriaDomain) =>
    domain === 'legal' ? ('default' as const) : ('secondary' as const)

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleViewDocument = (doc: Document) => {
    if (!doc.pdf) {
      toast.error('El PDF no está disponible')
      return
    }
    try {
      openPDFInNewTab(doc.pdf)
    } catch (error) {
      console.error('Error al abrir PDF:', error)
      toast.error('Error al abrir el PDF')
    }
  }

  const handleDownloadDocument = (doc: Document) => {
    if (!doc.pdf) {
      toast.error('El PDF no está disponible')
      return
    }
    try {
      const filename = doc.metadata.title || `documento-${doc.documentId.slice(0, 8)}`
      downloadPDF(doc.pdf, filename)
      toast.success('PDF descargado')
    } catch (error) {
      console.error('Error al descargar PDF:', error)
      toast.error('Error al descargar el PDF')
    }
  }

  const handleViewDetails = (documentId: string) => {
    navigate(`/documents/${documentId}`)
  }

  const confirmDeleteDocument = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await deleteDocument(deleteTarget.id)
      toast.success('Documento eliminado')
      setDeleteTarget(null)
      await loadDocuments()
    } catch (error) {
      console.error('Error al eliminar documento:', error)
      toast.error('Error al eliminar el documento')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Documentos</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            PDF en este dispositivo; colaboración con Etherpad si tu organización lo tiene activo. Una cuenta en la
            plataforma y la wallet local cubren lo necesario para editar y firmar.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
          <Button onClick={() => navigate('/documents/new')} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Crear documento</span>
            <span className="sm:hidden">Crear</span>
          </Button>
          {accounts.length > 0 && (
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
              Ejemplo PDF (local)
            </Button>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[500px] mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Documento PDF de ejemplo</DialogTitle>
              <DialogDescription className="text-sm">
                Genera un PDF de prueba en este dispositivo (editor local). Útil para validar firma o descarga sin
                abrir Etherpad.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              <div className="space-y-2">
                <Label htmlFor="account-select">Cuenta Autor</Label>
                <Select
                  value={selectedAccount}
                  onValueChange={setSelectedAccount}
                >
                  <SelectTrigger id="account-select">
                    <SelectValue placeholder="Selecciona una cuenta">
                      {selectedAccount && (
                        <div className="flex items-center gap-2">
                          <Identicon
                            value={selectedAccount}
                            size={16}
                            theme="polkadot"
                          />
                          <span>{getAccountDisplayName(selectedAccount)}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.address} value={account.address}>
                        <div className="flex items-center gap-2">
                          <Identicon
                            value={account.address}
                            size={16}
                            theme="polkadot"
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {account.meta?.name || 'Sin nombre'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {account.address.slice(0, 8)}...{account.address.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAccount && (
                  <p className="text-sm text-muted-foreground">
                    El autor del PDF será: {getAccountDisplayName(selectedAccount)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateTestDocument}
                disabled={creating || !selectedAccount}
                className="w-full sm:w-auto"
              >
                {creating ? 'Creando...' : 'Generar ejemplo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros: búsqueda siempre visible; origen y tipo colapsables */}
      <Card>
        <Collapsible open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
          <CardHeader className="pb-3 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  La búsqueda incluye título, descripción, asunto, palabras clave y tipo.
                  {!advancedFiltersOpen && advancedFilterSummary.length === 0 ? (
                    <>
                      {' '}
                      <span>Origen y tipo: botón «Más filtros».</span>
                    </>
                  ) : null}
                </CardDescription>
              </div>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  aria-expanded={advancedFiltersOpen}
                >
                  {advancedFiltersOpen ? 'Ocultar filtros' : 'Más filtros'}
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform duration-200', advancedFiltersOpen && 'rotate-180')}
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            {advancedFilterSummary.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" aria-live="polite">
                {advancedFilterSummary.map((label) => (
                  <Badge key={label} variant="secondary" className="font-normal">
                    {label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="documents-search" className="text-sm font-medium">
                Buscar
              </Label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                  aria-hidden
                />
                <Input
                  id="documents-search"
                  placeholder="Título, descripción, asunto, etiquetas, ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-sm sm:text-base"
                  autoComplete="off"
                />
              </div>
            </div>

            <CollapsibleContent className="space-y-4 data-[state=closed]:hidden">
              <div className="space-y-2">
                <Label
                  id="documents-filter-origin-label"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Origen del documento
                </Label>
                <div
                  role="group"
                  aria-labelledby="documents-filter-origin-label"
                  className="flex gap-2 flex-wrap"
                >
                  <Button
                    type="button"
                    variant={listScope === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setListScope('all')}
                    className="text-xs sm:text-sm"
                  >
                    Todos
                  </Button>
                  <Button
                    type="button"
                    variant={listScope === 'collaborative' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setListScope('collaborative')}
                    className="text-xs sm:text-sm gap-1"
                  >
                    <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Colaborativos
                  </Button>
                  <Button
                    type="button"
                    variant={listScope === 'local' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setListScope('local')}
                    className="text-xs sm:text-sm gap-1"
                  >
                    <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Solo locales
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  id="documents-filter-domain-label"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Ámbito CriterIA
                </Label>
                <div
                  role="group"
                  aria-labelledby="documents-filter-domain-label"
                  className="flex gap-2 flex-wrap"
                >
                  <Button
                    type="button"
                    variant={domainFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDomainFilter('all')}
                    className="text-xs sm:text-sm"
                  >
                    Todos
                  </Button>
                  <Button
                    type="button"
                    variant={domainFilter === 'legal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDomainFilter('legal')}
                    className="text-xs sm:text-sm"
                  >
                    Legal
                  </Button>
                  <Button
                    type="button"
                    variant={domainFilter === 'academic' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDomainFilter('academic')}
                    className="text-xs sm:text-sm"
                  >
                    Académico
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documents-filter-tag" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Etiqueta
                </Label>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger id="documents-filter-tag" className="w-full max-w-xs h-9 text-sm">
                    <SelectValue placeholder="Todas las etiquetas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las etiquetas</SelectItem>
                    {availableUserTags.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Las etiquetas las defines en el editor (metadata). Si no hay ninguna en tus documentos, el selector solo
                  muestra «Todas».
                </p>
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      </Card>

      {/* Lista de documentos */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              Cargando documentos...
            </div>
          </CardContent>
        </Card>
      ) : walletLockedWithVault ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4 max-w-md mx-auto">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Monedero bloqueado</h3>
                <p className="text-muted-foreground mt-1">
                  Para ver los documentos guardados en este dispositivo, desbloquea la wallet (icono de candado en la
                  barra superior o pantalla de cuentas). Así evitamos mostrar tu biblioteca local sin verificación.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No hay documentos</h3>
                <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                  {searchQuery || domainFilter !== 'all' || tagFilter !== 'all' || listScope !== 'all'
                    ? 'Prueba a quitar filtros o ajustar la búsqueda.'
                    : accounts.length === 0
                      ? 'Crea o importa una cuenta en el monedero para asociar autoría y guardar PDFs en este dispositivo.'
                      : 'Crea un documento colaborativo (Etherpad) o uno local (Quill), o genera un PDF de ejemplo.'}
                </p>
              </div>
              {!searchQuery && domainFilter === 'all' && tagFilter === 'all' && listScope === 'all' && (
                <div className="flex flex-col sm:flex-row gap-2 justify-center flex-wrap">
                  {accounts.length === 0 ? (
                    <Button onClick={() => navigate('/accounts')}>Ir a Cuentas</Button>
                  ) : (
                    <>
                      <Button onClick={() => navigate('/documents/new')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear documento
                      </Button>
                      <Button variant="outline" onClick={() => setDialogOpen(true)}>
                        Ejemplo PDF (local)
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 border-b bg-muted/20">
            <CardTitle className="text-base sm:text-lg">Listado</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Desplaza horizontalmente en pantallas estrechas. Pasa el cursor sobre el título para ver el nombre
              completo.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="min-w-[720px] table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[32%] min-w-0 pl-3 sm:pl-4">Documento</TableHead>
                  <TableHead className="w-[12%] hidden sm:table-cell">Ámbito</TableHead>
                  <TableHead className="w-[26%] min-w-0 hidden md:table-cell">Estado</TableHead>
                  <TableHead className="w-[11%] whitespace-nowrap">Fecha</TableHead>
                  <TableHead className="w-[11%] whitespace-nowrap hidden lg:table-cell">PDF</TableHead>
                  <TableHead className="w-[8%] text-right pr-3 sm:pr-4">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => {
                  const title = doc.metadata.title || 'Documento sin título'
                  const desc = doc.metadata.description?.trim()
                  const docDomain = inferCriteriaDomain(doc)
                  const tags = doc.metadata.userTags ?? []
                  return (
                    <TableRow key={doc.documentId}>
                      <TableCell className="min-w-0 pl-3 sm:pl-4 align-top">
                        <div className="min-w-0 space-y-0.5 py-0.5">
                          <div className="font-medium truncate" title={title}>
                            {title}
                          </div>
                          {desc ? (
                            <div className="text-xs text-muted-foreground line-clamp-2 break-words" title={desc}>
                              {desc}
                            </div>
                          ) : null}
                          {tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1 pt-1 max-w-full">
                              {tags.slice(0, 6).map((t) => (
                                <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 font-normal truncate max-w-[120px]">
                                  {t}
                                </Badge>
                              ))}
                              {tags.length > 6 ? (
                                <span className="text-[10px] text-muted-foreground">+{tags.length - 6}</span>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-1.5 sm:hidden pt-1">
                            <Badge variant={domainBadgeVariant(docDomain)} className="text-[10px] px-1.5 py-0">
                              {criteriaDomainLabel(docDomain)}
                            </Badge>
                            {doc.signatureStatus && (
                              <Badge
                                variant={
                                  doc.signatureStatus === 'fully_signed'
                                    ? 'default'
                                    : doc.signatureStatus === 'pending'
                                      ? 'secondary'
                                      : 'destructive'
                                }
                                className="text-[10px] px-1.5 py-0"
                              >
                                {doc.signatureStatus === 'fully_signed'
                                  ? 'Firmado'
                                  : doc.signatureStatus === 'pending'
                                    ? 'Pendiente'
                                    : doc.signatureStatus === 'partially_signed'
                                      ? 'Parcial'
                                      : doc.signatureStatus === 'expired'
                                        ? 'Expirado'
                                        : 'Rechazado'}
                              </Badge>
                            )}
                            {doc.encrypted && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Encriptado
                              </Badge>
                            )}
                            {doc.category === 'etherpad' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 gap-0.5 border-primary/40 text-primary"
                              >
                                <Users className="h-3 w-3" />
                                Colab.
                              </Badge>
                            )}
                          </div>
                          <div className="hidden sm:flex md:hidden flex-wrap gap-1.5 pt-1">
                            {doc.signatureStatus && (
                              <Badge
                                variant={
                                  doc.signatureStatus === 'fully_signed'
                                    ? 'default'
                                    : doc.signatureStatus === 'pending'
                                      ? 'secondary'
                                      : 'destructive'
                                }
                                className="text-[10px] px-1.5 py-0"
                              >
                                {doc.signatureStatus === 'fully_signed'
                                  ? 'Firmado'
                                  : doc.signatureStatus === 'pending'
                                    ? 'Pendiente'
                                    : doc.signatureStatus === 'partially_signed'
                                      ? 'Parcial'
                                      : doc.signatureStatus === 'expired'
                                        ? 'Expirado'
                                        : 'Rechazado'}
                              </Badge>
                            )}
                            {doc.encrypted && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Encriptado
                              </Badge>
                            )}
                            {doc.category === 'etherpad' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 gap-0.5 border-primary/40 text-primary"
                              >
                                <Users className="h-3 w-3" />
                                Colaborativo
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top hidden sm:table-cell">
                        <Badge variant={domainBadgeVariant(docDomain)}>{criteriaDomainLabel(docDomain)}</Badge>
                      </TableCell>
                      <TableCell className="min-w-0 align-top hidden md:table-cell">
                        <div className="flex flex-wrap gap-1.5 py-0.5">
                          {doc.signatureStatus && (
                            <Badge
                              variant={
                                doc.signatureStatus === 'fully_signed'
                                  ? 'default'
                                  : doc.signatureStatus === 'pending'
                                    ? 'secondary'
                                    : 'destructive'
                              }
                            >
                              {doc.signatureStatus === 'fully_signed'
                                ? 'Firmado'
                                : doc.signatureStatus === 'pending'
                                  ? 'Pendiente'
                                  : doc.signatureStatus === 'partially_signed'
                                    ? 'Parcial'
                                    : doc.signatureStatus === 'expired'
                                      ? 'Expirado'
                                      : 'Rechazado'}
                            </Badge>
                          )}
                          {doc.encrypted && (
                            <Badge variant="outline">Encriptado</Badge>
                          )}
                          {doc.category === 'etherpad' && (
                            <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                              <Users className="h-3 w-3 shrink-0" />
                              Colaborativo
                            </Badge>
                          )}
                          {!doc.signatureStatus && !doc.encrypted && doc.category !== 'etherpad' && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground hidden lg:table-cell">
                        <div className="space-y-0.5 py-0.5">
                          <div>{formatFileSize(doc.pdfSize)}</div>
                          <div>
                            {doc.signatures.length} firma{doc.signatures.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top pr-3 sm:pr-4">
                        <div className="inline-flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            title="Ver detalles"
                            aria-label="Ver detalles"
                            onClick={() => handleViewDetails(doc.documentId)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            title="Descargar PDF"
                            aria-label="Descargar PDF"
                            disabled={!doc.pdf}
                            onClick={() => handleDownloadDocument(doc)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                            title="Eliminar"
                            aria-label="Eliminar documento"
                            onClick={() => setDeleteTarget({ id: doc.documentId, title: doc.metadata.title })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará del almacenamiento de este dispositivo
              {deleteTarget?.title ? ` «${deleteTarget.title}»` : ''}. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void confirmDeleteDocument()
              }}
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
