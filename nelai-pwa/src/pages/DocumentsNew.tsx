import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileEdit, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useDocumentEditorLayout } from '@/contexts/DocumentEditorLayoutContext'

import { PageShell } from '@/components/layout/PageShell'

/**
 * Punto de entrada al crear documento: colaborativo (Etherpad + sesión de plataforma) vs editor local (Quill).
 */
export default function DocumentsNew() {
  const navigate = useNavigate()
  const { accounts } = useKeyringContext()
  const layoutCtx = useDocumentEditorLayout()
  const noWallet = accounts.length === 0

  return (
    <PageShell width="medium" className="space-y-6 pb-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/documents')} aria-label="Volver">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Nuevo documento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Elige cómo quieres trabajar. La política de PII ante la IA es la misma en ambos modos; el PDF y el chat
            del agente se guardan con el documento en este dispositivo.
          </p>
        </div>
      </div>

      {noWallet && (
        <Card className="border-muted bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identidad en el dispositivo</CardTitle>
            <CardDescription>
              El editor local te guiará a crear una llave la primera vez. Etherpad necesita ya una cuenta para asociar
              autoría al guardar en este dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/accounts')}>
              Ir a Cuentas
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:gap-6">
        <Card className="flex flex-col border-primary/20">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Colaborativo (Etherpad)</CardTitle>
            <CardDescription>
              Edición en tiempo real en el navegador; requiere sesión en la plataforma y Etherpad configurado en el
              servidor. La vista previa PDF usa el último «Guardar local» desde el editor.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Button
              className="w-full"
              disabled={noWallet}
              onClick={() => {
                layoutCtx?.setSidebarOpen?.(false)
                navigate('/documents/new-etherpad')
              }}
            >
              Continuar con Etherpad
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mb-2">
              <FileEdit className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Editor local (Quill)</CardTitle>
            <CardDescription>
              Procesador de texto en esta app: formato rico, mapa del documento y panel de agente integrado. El PDF se
              genera al guardar desde el mismo contenido.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                layoutCtx?.setSidebarOpen?.(false)
                navigate('/documents/new-local')
              }}
            >
              Continuar con editor local
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
