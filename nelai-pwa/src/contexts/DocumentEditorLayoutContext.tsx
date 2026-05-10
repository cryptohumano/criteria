import { createContext, useContext, useState, useCallback } from 'react'

interface DocumentEditorLayoutContextValue {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  headerCollapsed: boolean
  setHeaderCollapsed: (collapsed: boolean) => void
  toggleHeader: () => void
}

const DocumentEditorLayoutContext = createContext<DocumentEditorLayoutContextValue | null>(null)

export function DocumentEditorLayoutProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])
  const toggleHeader = useCallback(() => setHeaderCollapsed((v) => !v), [])

  return (
    <DocumentEditorLayoutContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        headerCollapsed,
        setHeaderCollapsed,
        toggleHeader,
      }}
    >
      {children}
    </DocumentEditorLayoutContext.Provider>
  )
}

export function useDocumentEditorLayout() {
  const ctx = useContext(DocumentEditorLayoutContext)
  return ctx
}
