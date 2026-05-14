/**
 * Renderiza Markdown con enlaces clickeables (target="_blank").
 * Convierte URLs sueltas a links. Usado en chat del asistente, GuideModal, etc.
 */

import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { absoluteHttpUrlFromLooseTarget, normalizeUserFacingHref } from '@/utils/externalHref'
import { repairBracketLinksMissingOpen } from '@/utils/researchEvidenceLog'

function reactChildrenToPlainText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(reactChildrenToPlainText).join('')
  if (typeof node === 'object' && 'props' in node) {
    const ch = (node as { props?: { children?: ReactNode } }).props?.children
    return reactChildrenToPlainText(ch)
  }
  return ''
}

/** Linkify solo fuera de destinos `[...](...)` ya presentes (evita romper enlaces del modelo). */
function linkifyOutsideExistingMarkdown(text: string): string {
  const chunks: string[] = []
  let last = 0
  const re = /\[[^\]]*\]\([^)]+\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) {
      chunks.push(
        text.slice(last, m.index).replace(
          /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g,
          (url) => `[${url}](${url})`
        )
      )
    }
    chunks.push(m[0])
    last = m.index + m[0].length
  }
  chunks.push(
    text.slice(last).replace(
      /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g,
      (url) => `[${url}](${url})`
    )
  )
  return chunks.join('')
}

export interface MarkdownContentProps {
  content: string
  className?: string
  /** Tamaño del texto: 'sm' | 'base' | 'lg' */
  size?: 'sm' | 'base' | 'lg'
}

export function MarkdownContent({ content, className, size = 'sm' }: MarkdownContentProps) {
  const processed = linkifyOutsideExistingMarkdown(repairBracketLinksMissingOpen(content))
  return (
    <div
      className={cn(
        'markdown-content w-full max-w-full min-w-0 break-words [overflow-wrap:anywhere]',
        '[&_ul]:my-1 [&_ol]:my-1 [&_ul]:min-w-0 [&_ol]:min-w-0 [&_ul]:max-w-full [&_ol]:max-w-full',
        '[&_p]:my-0.5 [&_p]:min-w-0 [&_p]:max-w-full [&_p]:break-words',
        '[&_pre]:max-w-full [&_pre]:whitespace-pre-wrap [&_pre]:break-all',
        '[&_table]:my-2 [&_table]:block [&_table]:w-full [&_table]:max-w-full [&_table]:table-fixed [&_table]:text-[0.9em]',
        '[&_td]:break-words [&_td]:align-top [&_th]:break-words [&_th]:align-top',
        size === 'sm' && 'text-sm',
        size === 'base' && 'text-base',
        size === 'lg' && 'text-lg',
        className
      )}
    >
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            let safe = normalizeUserFacingHref(href)
            const looksRelative =
              safe === '#' ||
              (safe.startsWith('/') && !safe.startsWith('//') && !/^\/+https?:\/\//i.test(safe))
            if (looksRelative) {
              const plain = reactChildrenToPlainText(children).trim()
              const fromLabel = absoluteHttpUrlFromLooseTarget(plain) ?? plain.match(/https?:\/\/[^\s)]+/i)?.[0]
              if (fromLabel) {
                const fixed = normalizeUserFacingHref(fromLabel)
                if (fixed.startsWith('http')) safe = fixed
              }
            }
            return (
              <a
                href={safe}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary underline decoration-primary/60 underline-offset-2 hover:opacity-80 [overflow-wrap:anywhere]"
              >
                {children}
              </a>
            )
          },
          p: ({ children }) => (
            <p className="mb-2 min-w-0 max-w-full last:mb-0 break-words leading-relaxed [overflow-wrap:anywhere]">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 min-w-0 max-w-full list-outside list-disc space-y-1.5 break-words py-0.5 pl-5 pr-1 leading-relaxed [overflow-wrap:anywhere] sm:pr-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 min-w-0 max-w-full list-outside list-decimal space-y-1.5 break-words py-0.5 pl-6 pr-1 leading-relaxed [overflow-wrap:anywhere] marker:font-medium sm:pr-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="min-w-0 max-w-full py-0.5 break-words [overflow-wrap:anywhere]">{children}</li>
          ),
          strong: ({ children }) => <strong className="font-semibold break-words">{children}</strong>,
          code: ({ children }) => (
            <code className="max-w-full break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
