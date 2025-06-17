import React, { useCallback } from 'react'
import { useStore } from '@livestore/react'
import { events, tables, CellData, KernelSessionData } from '../../../../../shared/schema.js'
import { queryDb } from '@livestore/livestore'
import { Cell } from './Cell.js'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Terminal, Circle, Plus, FileText, Database, Bot, Code } from 'lucide-react'
import { getCurrentNotebookId } from '../../util/store-id.js'



interface NotebookViewerProps {
  notebookId: string
  onNewNotebook?: () => void
}

export const NotebookViewer: React.FC<NotebookViewerProps> = ({ onNewNotebook }) => {
  const { store } = useStore()
  const cells = store.useQuery(queryDb(tables.cells.select().orderBy('position', 'asc'))) as CellData[]
  const notebooks = store.useQuery(queryDb(tables.notebook.select().limit(1))) as any[]
  const kernelSessions = store.useQuery(queryDb(tables.kernelSessions.select().where({ isActive: true }))) as KernelSessionData[]
  const notebook = notebooks[0]

  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [localTitle, setLocalTitle] = React.useState(notebook?.title || '')
  const [showKernelHelper, setShowKernelHelper] = React.useState(false)
  const [focusedCellId, setFocusedCellId] = React.useState<string | null>(null)

  const currentNotebookId = getCurrentNotebookId()
  const kernelCommand = `NOTEBOOK_ID=${currentNotebookId} pnpm dev:kernel:deno`

  // Check kernel status
  const activeKernel = kernelSessions.find((session: KernelSessionData) => session.status === 'ready')
  const hasActiveKernel = Boolean(activeKernel)
  const kernelStatus = activeKernel?.status || (kernelSessions.length > 0 ? kernelSessions[0].status : 'disconnected')

  const copyKernelCommand = useCallback(() => {
    navigator.clipboard.writeText(kernelCommand)
    // Could add a toast notification here
  }, [kernelCommand])

  React.useEffect(() => {
    if (notebook?.title) {
      setLocalTitle(notebook.title)
    }
  }, [notebook?.title])

  const updateTitle = useCallback(() => {
    if (notebook && localTitle !== notebook.title) {
      store.commit(events.notebookTitleChanged({
        title: localTitle,
      }))
    }
    setIsEditingTitle(false)
  }, [notebook, localTitle, store])

  const addCell = useCallback((afterCellId?: string, cellType: 'code' | 'markdown' | 'sql' | 'ai' = 'code') => {
    const cellId = `cell-${Date.now()}-${Math.random().toString(36).slice(2)}`

    let newPosition: number
    if (afterCellId) {
      // Find the current cell and insert after it
      const currentCell = cells.find((c: CellData) => c.id === afterCellId)
      if (currentCell) {
        newPosition = currentCell.position + 1
        // Shift all subsequent cells down by 1
        const cellsToShift = cells.filter((c: CellData) => c.position >= newPosition)
        cellsToShift.forEach((cell: CellData) => {
          store.commit(events.cellMoved({
            id: cell.id,
            newPosition: cell.position + 1,
          }))
        })
      } else {
        // Fallback: add at end
        newPosition = Math.max(...cells.map((c: CellData) => c.position), -1) + 1
      }
    } else {
      // Add at end
      newPosition = Math.max(...cells.map((c: CellData) => c.position), -1) + 1
    }

    store.commit(events.cellCreated({
      id: cellId,
      position: newPosition,
      cellType,
      createdBy: 'current-user',
    }))

    // Focus the new cell after creation
    setTimeout(() => setFocusedCellId(cellId), 0)
  }, [cells, store])

  const deleteCell = useCallback((cellId: string) => {
    store.commit(events.cellDeleted({
      id: cellId,
    }))
  }, [store])

  const moveCell = useCallback((cellId: string, direction: 'up' | 'down') => {
    const currentCell = cells.find((c: CellData) => c.id === cellId)
    if (!currentCell) return

    const sortedCells = cells.sort((a: CellData, b: CellData) => a.position - b.position)
    const currentIndex = sortedCells.findIndex((c: CellData) => c.id === cellId)

    if (direction === 'up' && currentIndex > 0) {
      const targetCell = sortedCells[currentIndex - 1]
      if (targetCell) {
        // Swap positions
        store.commit(events.cellMoved({
          id: cellId,
          newPosition: targetCell.position,
        }))
        store.commit(events.cellMoved({
          id: targetCell.id,
          newPosition: currentCell.position,
        }))
      }
    } else if (direction === 'down' && currentIndex < sortedCells.length - 1) {
      const targetCell = sortedCells[currentIndex + 1]
      if (targetCell) {
        // Swap positions
        store.commit(events.cellMoved({
          id: cellId,
          newPosition: targetCell.position,
        }))
        store.commit(events.cellMoved({
          id: targetCell.id,
          newPosition: currentCell.position,
        }))
      }
    }
  }, [cells, store])

  const focusCell = useCallback((cellId: string) => {
    setFocusedCellId(cellId)
  }, [])

  const focusNextCell = useCallback((currentCellId: string) => {
    const sortedCells = cells.sort((a: CellData, b: CellData) => a.position - b.position)
    const currentIndex = sortedCells.findIndex((c: CellData) => c.id === currentCellId)

    if (currentIndex < sortedCells.length - 1) {
      const nextCell = sortedCells[currentIndex + 1]
      setFocusedCellId(nextCell.id)
    } else {
      // At the last cell, create a new one with same cell type (but never raw)
      const currentCell = sortedCells[currentIndex]
      const newCellType = currentCell.cellType === 'raw' ? 'code' : currentCell.cellType
      addCell(currentCellId, newCellType)
    }
  }, [cells, addCell])

  const focusPreviousCell = useCallback((currentCellId: string) => {
    const sortedCells = cells.sort((a: CellData, b: CellData) => a.position - b.position)
    const currentIndex = sortedCells.findIndex((c: CellData) => c.id === currentCellId)

    if (currentIndex > 0) {
      const previousCell = sortedCells[currentIndex - 1]
      setFocusedCellId(previousCell.id)
    }
  }, [cells])

  // Reset focus when focused cell changes or is removed
  React.useEffect(() => {
    if (focusedCellId && !cells.find((c: CellData) => c.id === focusedCellId)) {
      setFocusedCellId(null)
    }
  }, [focusedCellId, cells])

  // Focus first cell when notebook loads and has cells
  React.useEffect(() => {
    if (!focusedCellId && cells.length > 0) {
      const sortedCells = cells.sort((a: CellData, b: CellData) => a.position - b.position)
      setFocusedCellId(sortedCells[0].id)
    }
  }, [focusedCellId, cells])

  if (!notebook) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading notebook...</div>
      </div>
    )
  }

  const sortedCells = cells.sort((a: CellData, b: CellData) => a.position - b.position)

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="border-b bg-card px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.svg"
                alt="Anode"
                className="h-8 w-auto"
              />
              <h1 className="text-xl font-bold text-primary">
                Anode
              </h1>
            </div>
            {onNewNotebook && (
              <Button onClick={onNewNotebook} variant="outline" size="sm">
                + New Notebook
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            {getCurrentNotebookId()}
          </div>
        </div>
      </nav>

      {/* Notebook Controls Bar */}
      <div className="border-b bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {isEditingTitle ? (
                <Input
                  value={localTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalTitle(e.target.value)}
                  onBlur={updateTitle}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') updateTitle()
                    if (e.key === 'Escape') {
                      setLocalTitle(notebook.title)
                      setIsEditingTitle(false)
                    }
                  }}
                  className="text-lg font-semibold border-none bg-transparent p-0 focus-visible:ring-0"
                  autoFocus
                />
              ) : (
                <h1
                  className="text-lg font-semibold cursor-pointer hover:text-muted-foreground transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {notebook.title}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowKernelHelper(!showKernelHelper)}
                className="flex items-center gap-2"
              >
                <Terminal className="h-4 w-4" />
                <span className="capitalize">{notebook.kernelType}</span>
                <Circle
                  className={`h-2 w-2 fill-current ${
                    hasActiveKernel ? 'text-green-500' :
                    kernelStatus === 'starting' ? 'text-amber-500' :
                    'text-red-500'
                  }`}
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 pointer-events-none"
              >
                <span>{sortedCells.length} cells</span>
              </Button>
            </div>
          </div>
        </div>

        {showKernelHelper && (
          <div className="border-t bg-card">
            <div className="max-w-6xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  Kernel Status
                  <Circle
                    className={`h-3 w-3 fill-current ${
                      hasActiveKernel ? 'text-green-500' :
                      kernelStatus === 'starting' ? 'text-amber-500' :
                      'text-red-500'
                    }`}
                  />
                  <span className={`text-xs font-normal ${
                    hasActiveKernel ? 'text-green-600' :
                    kernelStatus === 'starting' ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {hasActiveKernel ? 'Connected' :
                     kernelStatus === 'starting' ? 'Starting' :
                     'Disconnected'}
                  </span>
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKernelHelper(false)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>

              {!hasActiveKernel && (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Run this command in your terminal to start a kernel for notebook <code className="bg-muted px-1 rounded">{currentNotebookId}</code>:
                  </p>
                  <div className="flex items-center gap-2 bg-slate-900 text-slate-100 p-3 rounded font-mono text-sm">
                    <span className="flex-1">{kernelCommand}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyKernelCommand}
                      className="h-8 w-8 p-0 text-slate-300 hover:text-slate-100 hover:bg-slate-700"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Each notebook requires its own kernel instance. The kernel will connect automatically once started.
                  </p>
                </>
              )}

              {hasActiveKernel && activeKernel && (
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session ID:</span>
                    <code className="bg-muted px-1 rounded text-xs">{activeKernel.sessionId}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kernel Type:</span>
                    <span>{activeKernel.kernelType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started:</span>
                    {/* <span>{new Date(activeKernel.startedAt).toLocaleTimeString()}</span> */}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span>{activeKernel.status}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto p-4">

        {/* Keyboard Shortcuts Help - More subtle */}
        {sortedCells.length > 0 && (
          <div className="mb-6">
            <div className="px-4 py-2 bg-muted/30 rounded-md">
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs font-mono">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs font-mono">⇧↵</kbd>
                  <span>Run & next</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs font-mono">⌘↵</kbd>
                  <span>Run</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cells */}
        <div className="space-y-3">
        {sortedCells.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="text-muted-foreground mb-6">
                Welcome to your notebook! Choose a cell type to get started.
              </div>
              <div className="flex justify-center gap-2 flex-wrap mb-4">
                <Button onClick={() => addCell()} className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Code Cell
                </Button>
                <Button variant="outline" onClick={() => addCell(undefined, 'markdown')} className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Markdown
                </Button>
                <Button variant="outline" onClick={() => addCell(undefined, 'sql')} className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  SQL Query
                </Button>
                <Button variant="outline" onClick={() => addCell(undefined, 'ai')} className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Assistant
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                💡 Use ↑↓ arrow keys to navigate • Shift+Enter to run and move • Ctrl+Enter to run
              </div>
            </div>
          </div>
        ) : (
          sortedCells.map((cell: CellData) => (
            <Cell
              key={cell.id}
              cell={cell}
              onAddCell={() => addCell(cell.id, cell.cellType === 'raw' ? 'code' : cell.cellType)}
              onDeleteCell={() => deleteCell(cell.id)}
              onMoveUp={() => moveCell(cell.id, 'up')}
              onMoveDown={() => moveCell(cell.id, 'down')}
              onFocusNext={() => focusNextCell(cell.id)}
              onFocusPrevious={() => focusPreviousCell(cell.id)}
              onFocus={() => focusCell(cell.id)}
              autoFocus={focusedCellId === cell.id}
            />
          ))
        )}
        </div>

        {/* Add Cell Buttons */}
        {sortedCells.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border/30">
            <div className="text-center space-y-3">
              <div className="flex justify-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => addCell()} className="flex items-center gap-1.5">
                  <Plus className="h-3 w-3" />
                  <Code className="h-3 w-3" />
                  Code
                </Button>
                <Button variant="outline" size="sm" onClick={() => addCell(undefined, 'markdown')} className="flex items-center gap-1.5">
                  <Plus className="h-3 w-3" />
                  <FileText className="h-3 w-3" />
                  Markdown
                </Button>
                <Button variant="outline" size="sm" onClick={() => addCell(undefined, 'sql')} className="flex items-center gap-1.5">
                  <Plus className="h-3 w-3" />
                  <Database className="h-3 w-3" />
                  SQL
                </Button>
                <Button variant="outline" size="sm" onClick={() => addCell(undefined, 'ai')} className="flex items-center gap-1.5">
                  <Plus className="h-3 w-3" />
                  <Bot className="h-3 w-3" />
                  AI
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Add a new cell
              </div>
            </div>
          </div>
        )}

        {/* Notebook Info */}
        <div className="mt-12 pt-6 border-t border-border/30">
          <div className="text-xs text-muted-foreground text-center">
            Owner: {notebook.ownerId}
          </div>
        </div>
      </div>
    </div>
  )
}
