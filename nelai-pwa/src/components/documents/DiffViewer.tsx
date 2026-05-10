import { diffWordsWithSpace } from 'diff'
import { cn } from '@/lib/utils'

interface DiffViewerProps {
  oldValue: string
  newValue: string
  className?: string
}

/**
 * Compara dos cadenas de texto (pueden contener HTML) y muestra las diferencias.
 * Nota: Quita las etiquetas HTML para comparar solo el contenido textual por seguridad y claridad.
 */
export default function DiffViewer({ oldValue, newValue, className }: DiffViewerProps) {
  // Función simple para limpiar HTML para la comparación (evita ruidos de tags)
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  const cleanOld = stripHtml(oldValue)
  const cleanNew = stripHtml(newValue)

  const diff = diffWordsWithSpace(cleanOld, cleanNew)

  return (
    <div className={cn("whitespace-pre-wrap font-sans text-sm leading-relaxed", className)}>
      {diff.map((part, index) => {
        const color = part.added 
          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' 
          : part.removed 
            ? 'bg-red-100 text-red-800 line-through dark:bg-red-900/40 dark:text-red-300' 
            : ''
        
        return (
          <span 
            key={index} 
            className={cn(
              "rounded-sm", 
              color,
              part.added && "animate-in fade-in zoom-in-95 duration-300"
            )}
          >
            {part.value}
          </span>
        )
      })}
    </div>
  )
}
