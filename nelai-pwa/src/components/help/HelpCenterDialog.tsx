import { useEffect, useMemo, useState } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { Button } from '@/components/ui/button'

type TutorialItem = {
  id: string
  title: string
  order: number
  content: string
}

// Carga todos los tutoriales como texto (Vite: ?raw)
// Ojo con la ruta: este archivo vive en `src/components/help/`, así que hay que subir 3 niveles.
const tutorialModules = import.meta.glob('../../../docs/tutoriales/*.md', {
  query: '?raw',
  import: 'default',
})

function filenameToId(path: string) {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function filenameToOrder(name: string) {
  const m = /^(\d+)_/.exec(name)
  if (!m) return 999
  return parseInt(m[1], 10)
}

function firstHeading(md: string) {
  const m = /^#\s+(.+)$/m.exec(md || '')
  return (m?.[1] || '').trim()
}

export function HelpCenterDialog({
  open,
  onOpenChange,
  initialTutorialId,
  onReplaySpotlight,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTutorialId?: string | null
  onReplaySpotlight?: () => void
}) {
  const [tutorials, setTutorials] = useState<TutorialItem[]>([])
  const [selectedId, setSelectedId] = useState<string>('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const entries = await Promise.all(
        Object.entries(tutorialModules).map(async ([path, loader]) => {
          const content = (await loader()) as string
          const id = filenameToId(path)
          const title = firstHeading(content) || id
          const order = filenameToOrder(id)
          return { id, title, order, content } satisfies TutorialItem
        }),
      )
      entries.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      if (!mounted) return
      setTutorials(entries)
      setSelectedId((prev) => prev || initialTutorialId || entries[0]?.id || '')
    })()
    return () => {
      mounted = false
    }
  }, [initialTutorialId])

  const selected = useMemo(
    () => tutorials.find((t) => t.id === selectedId) || null,
    [tutorials, selectedId],
  )

  const idx = useMemo(
    () => tutorials.findIndex((t) => t.id === selectedId),
    [tutorials, selectedId],
  )

  const canPrev = idx > 0
  const canNext = idx >= 0 && idx < tutorials.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ayuda y tutoriales</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="tutoriales" className="w-full">
          <TabsList>
            <TabsTrigger value="tutoriales">Tutoriales</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
          </TabsList>

          <TabsContent value="tutoriales" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
              <div className="rounded-lg border">
                <ScrollArea className="h-[420px]">
                  <div className="p-2 space-y-1">
                    {tutorials.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full text-left rounded-md px-3 py-2 text-sm transition ${
                          t.id === selectedId ? 'bg-muted font-medium' : 'hover:bg-muted/60'
                        }`}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="rounded-lg border">
                <ScrollArea className="h-[420px]">
                  <div className="p-4">
                    {selected ? (
                      <MarkdownContent content={selected.content} />
                    ) : (
                      <div className="text-sm text-muted-foreground">Selecciona un tutorial.</div>
                    )}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onReplaySpotlight?.()}
                    title="Reproducir tutorial guiado"
                  >
                    Reproducir tutorial
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canPrev}
                    onClick={() => {
                      if (!canPrev) return
                      setSelectedId(tutorials[idx - 1]!.id)
                    }}
                  >
                    Anterior
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {idx >= 0 ? `${idx + 1} / ${tutorials.length}` : '—'}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canNext}
                    onClick={() => {
                      if (!canNext) return
                      setSelectedId(tutorials[idx + 1]!.id)
                    }}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="faq" className="mt-4">
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Por ahora, revisa el tutorial “Wallet local (Substrate) — por qué existe y por qué se bloquea”.
              Aquí podemos ir agregando preguntas frecuentes según soporte.
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

