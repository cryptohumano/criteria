import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Copy, Check, Search } from 'lucide-react'
import Identicon from '@polkadot/react-identicon'
import { Avatar } from '@/components/ui/avatar'
import { CRITERIA_STORAGE, LEGACY_NELAI_STORAGE } from '@/constants/storageKeys'

interface Contact {
  id: string
  name: string
  address: string
  chain?: string
  tags?: string[]
  notes?: string
  createdAt: number
  updatedAt: number
}

// Simulación de almacenamiento en IndexedDB (temporal, hasta que se implemente la DB completa)
const CONTACTS_STORAGE_KEY = CRITERIA_STORAGE.contacts
const LEGACY_CONTACTS_STORAGE_KEY = LEGACY_NELAI_STORAGE.contacts

function useContactsStorage() {
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    // Cargar contactos del localStorage (temporal)
    const stored = localStorage.getItem(CONTACTS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_CONTACTS_STORAGE_KEY)
    if (stored) {
      try {
        setContacts(JSON.parse(stored))
        localStorage.setItem(CONTACTS_STORAGE_KEY, stored)
        localStorage.removeItem(LEGACY_CONTACTS_STORAGE_KEY)
      } catch (e) {
        console.error('Error loading contacts:', e)
      }
    }
  }, [])

  const saveContacts = (newContacts: Contact[]) => {
    setContacts(newContacts)
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(newContacts))
  }

  const addContact = (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newContact: Contact = {
      ...contact,
      id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [...contacts, newContact]
    saveContacts(updated)
    return newContact
  }

  const updateContact = (id: string, updates: Partial<Contact>) => {
    const updated = contacts.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    )
    saveContacts(updated)
  }

  const deleteContact = (id: string) => {
    const updated = contacts.filter(c => c.id !== id)
    saveContacts(updated)
  }

  return {
    contacts,
    addContact,
    updateContact,
    deleteContact,
  }
}

export default function Contacts() {
  const { contacts, addContact, updateContact, deleteContact } = useContactsStorage()
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    chain: '',
    tags: '',
    notes: '',
  })
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.chain?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleOpenDialog = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact)
      setFormData({
        name: contact.name,
        address: contact.address,
        chain: contact.chain || '',
        tags: contact.tags?.join(', ') || '',
        notes: contact.notes || '',
      })
    } else {
      setEditingContact(null)
      setFormData({
        name: '',
        address: '',
        chain: '',
        tags: '',
        notes: '',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingContact(null)
    setFormData({
      name: '',
      address: '',
      chain: '',
      tags: '',
      notes: '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.address.trim()) {
      return
    }

    const tags = formData.tags
      ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

    if (editingContact) {
      updateContact(editingContact.id, {
        name: formData.name.trim(),
        address: formData.address.trim(),
        chain: formData.chain.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: formData.notes.trim() || undefined,
      })
    } else {
      addContact({
        name: formData.name.trim(),
        address: formData.address.trim(),
        chain: formData.chain.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: formData.notes.trim() || undefined,
      })
    }

    handleCloseDialog()
  }

  const handleCopyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contactos</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus contactos y direcciones frecuentes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Contacto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto mx-4 sm:mx-0">
            <DialogHeader>
              <DialogTitle>
                {editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
              </DialogTitle>
              <DialogDescription>
                {editingContact
                  ? 'Modifica la información del contacto'
                  : 'Agrega un nuevo contacto a tu lista'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre del contacto"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chain">Red (Opcional)</Label>
                <Input
                  id="chain"
                  value={formData.chain}
                  onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                  placeholder="Polkadot, Kusama, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (Opcional)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="amigo, trabajo, familia (separados por comas)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (Opcional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionales sobre el contacto"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingContact ? 'Guardar Cambios' : 'Agregar Contacto'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contactos por nombre, dirección o red..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de contactos */}
      <Card>
        <CardHeader>
          <CardTitle>Tus Contactos</CardTitle>
          <CardDescription>
            {filteredContacts.length > 0
              ? `${filteredContacts.length} contacto${filteredContacts.length > 1 ? 's' : ''}`
              : 'No hay contactos aún'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">
                {searchQuery ? 'No se encontraron contactos' : 'No hay contactos configurados aún'}
              </p>
              {!searchQuery && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Primer Contacto
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <Identicon
                        value={contact.address}
                        size={40}
                        theme="polkadot"
                      />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{contact.name}</h3>
                        {contact.chain && (
                          <Badge variant="outline" className="text-xs">
                            {contact.chain}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground font-mono">
                          {formatAddress(contact.address)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopyAddress(contact.address)}
                          title="Copiar dirección"
                        >
                          {copiedAddress === contact.address ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {contact.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {contact.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {contact.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(contact)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('¿Estás seguro de eliminar este contacto?')) {
                          deleteContact(contact.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
