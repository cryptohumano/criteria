import { PublicPageShell } from '@/components/public/PublicPageShell'
import { MarkdownContent } from '@/components/ui/markdown-content'
import privacidadMd from '@/content/legal/privacidad.md?raw'

export default function LegalPrivacyPage() {
  return (
    <PublicPageShell pageTitle="Aviso de privacidad">
      <article className="max-w-none">
        <MarkdownContent
          content={privacidadMd}
          size="base"
          className="[&_h1]:text-2xl [&_h1]:mb-4 [&_h2]:mt-8 [&_h2]:text-lg"
        />
      </article>
    </PublicPageShell>
  )
}
