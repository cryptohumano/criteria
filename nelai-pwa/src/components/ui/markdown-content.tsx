/**
 * Renderiza Markdown con enlaces clickeables (target="_blank").
 * Convierte URLs sueltas a links. Usado en chat del asistente, GuideModal, etc.
 */

import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

/** Convierte URLs sueltas en formato markdown para que sean clickeables */
function linkify(text: string): string {
  return text.replace(
    /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g,
    (url) => `[${url}](${url})`
  )
}

/** Quita sintaxis markdown para insertar texto plano en el editor */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '')
    .trim()
}

export interface MarkdownContentProps {
  content: string
  className?: string
  /** Tamaño del texto: 'sm' | 'base' | 'lg' */
  size?: 'sm' | 'base' | 'lg'
}

export function MarkdownContent({ content, className, size = 'sm' }: MarkdownContentProps) {
  const processed = linkify(content)
  return (
    <div
      className={cn(
        'markdown-content max-w-full break-words [overflow-wrap:anywhere] [&_ul]:my-1 [&_ol]:my-1 [&_p]:my-0.5 [&_a]:break-all',
        size === 'sm' && 'text-sm',
        size === 'base' && 'text-base',
        size === 'lg' && 'text-lg',
        className
      )}
    >
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:opacity-80"
            >
              {children}
            </a>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{children}</code>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
