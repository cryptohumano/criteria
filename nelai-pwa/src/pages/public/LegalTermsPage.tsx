import { PublicPageShell } from '@/components/public/PublicPageShell'
import { MarkdownContent } from '@/components/ui/markdown-content'
import terminosMd from '@/content/legal/terminos.md?raw'

export default function LegalTermsPage() {
  return (
    <PublicPageShell pageTitle="Términos y condiciones">
      <article className="max-w-none">
        <MarkdownContent content={terminosMd} size="base" className="[&_h1]:text-2xl [&_h1]:mb-4 [&_h2]:mt-8 [&_h2]:text-lg" />
      </article>
    </PublicPageShell>
  )
}
