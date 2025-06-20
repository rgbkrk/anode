import React, { useState, useCallback } from 'react'
import { useStore } from '@livestore/react'
import { events, tables, OutputData, isErrorOutput } from '../../../../../shared/schema.js'
import { queryDb } from '@livestore/livestore'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { SqlCell } from './SqlCell.js'
import { AiCell } from './AiCell.js'
import { RichOutput } from './RichOutput'
import { AnsiErrorOutput } from './AnsiOutput.js'

import { Play, ChevronUp, ChevronDown, Plus, X, Code, FileText, Database, Bot, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react'

type CellType = typeof tables.cells.Type



interface CellProps {
  cell: CellType
  onAddCell: () => void
  onDeleteCell: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onFocusNext?: () => void
  onFocusPrevious?: () => void
  autoFocus?: boolean
  onFocus?: () => void
  contextSelectionMode?: boolean
}

export const Cell: React.FC<CellProps> = ({
  cell,
  onAddCell,
  onDeleteCell,
  onMoveUp,
  onMoveDown,
  onFocusNext,
  onFocusPrevious,
  autoFocus = false,
  onFocus,
  contextSelectionMode = false
}) => {
  // Route to specialized cell components
  if (cell.cellType === 'sql') {
    return <SqlCell
      cell={cell}
      onAddCell={onAddCell}
      onDeleteCell={onDeleteCell}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onFocusNext={onFocusNext}
      onFocusPrevious={onFocusPrevious}
      autoFocus={autoFocus}
      onFocus={onFocus}
      contextSelectionMode={contextSelectionMode}
    />
  }

  if (cell.cellType === 'ai') {
    return <AiCell
      cell={cell}
      onAddCell={onAddCell}
      onDeleteCell={onDeleteCell}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onFocusNext={onFocusNext}
      onFocusPrevious={onFocusPrevious}
      autoFocus={autoFocus}
      onFocus={onFocus}
      contextSelectionMode={contextSelectionMode}
    />
  }

  // Default cell component for code, markdown, raw
  const { store } = useStore()
  const [localSource, setLocalSource] = useState(cell.source)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Create stable query using useMemo to prevent React Hook issues
  const outputsQuery = React.useMemo(() =>
    queryDb(tables.outputs.select().where({ cellId: cell.id })),
    [cell.id]
  )
  const outputs = store.useQuery(outputsQuery) as OutputData[]

  // Auto-focus when requested
  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // Sync local source with cell source
  React.useEffect(() => {
    setLocalSource(cell.source)
  }, [cell.source])

  const updateSource = useCallback(() => {
    if (localSource !== cell.source) {
      store.commit(events.cellSourceChanged({
        id: cell.id,
        source: localSource,
        modifiedBy: 'current-user', // TODO: get from auth
      }))
    }
  }, [localSource, cell.source, cell.id, store])

  const changeCellType = useCallback((newType: 'code' | 'markdown' | 'sql' | 'ai') => {
    store.commit(events.cellTypeChanged({
      id: cell.id,
      cellType: newType,
    }))
  }, [cell.id, store])

  const toggleSourceVisibility = useCallback(() => {
    store.commit(events.cellSourceVisibilityToggled({
      id: cell.id,
      sourceVisible: !cell.sourceVisible,
    }))
  }, [cell.id, cell.sourceVisible, store])

  const toggleOutputVisibility = useCallback(() => {
    store.commit(events.cellOutputVisibilityToggled({
      id: cell.id,
      outputVisible: !cell.outputVisible,
    }))
  }, [cell.id, cell.outputVisible, store])

  const toggleAiContextVisibility = useCallback(() => {
    store.commit(events.cellAiContextVisibilityToggled({
      id: cell.id,
      aiContextVisible: !cell.aiContextVisible,
    }))
  }, [cell.id, cell.aiContextVisible, store])

  const executeCell = useCallback(async () => {
    // Use localSource instead of cell.source to get the current typed content
    const sourceToExecute = localSource || cell.source
    if (!sourceToExecute?.trim()) {
      console.log('No code to execute')
      return
    }

    console.log('🚀 Executing cell via execution queue:', cell.id)

    try {
      // Clear previous outputs first
      store.commit(events.cellOutputsCleared({
        cellId: cell.id,
        clearedBy: 'current-user',
      }))

      // Generate unique queue ID
      const queueId = `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const executionCount = (cell.executionCount || 0) + 1

      // Add to execution queue - kernels will pick this up
      store.commit(events.executionRequested({
        queueId,
        cellId: cell.id,
        executionCount,
        requestedBy: 'current-user',
        priority: 1,
      }))

      console.log('✅ Execution queued with ID:', queueId)

      // The kernel service will now:
      // 1. See the pending execution in the queue
      // 2. Assign itself to the execution
      // 3. Execute the code
      // 4. Emit execution events and cell outputs
      // 5. All clients will see the results in real-time!

    } catch (error) {
      console.error('❌ LiveStore execution error:', error)

      // Store error information directly
      store.commit(events.cellOutputAdded({
        id: `error-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        cellId: cell.id,
        outputType: 'error',
        data: {
          ename: 'LiveStoreError',
          evalue: error instanceof Error ? error.message : 'Failed to queue execution request',
          traceback: ['Error occurred while emitting LiveStore event'],
        },
        position: 0,
      }))
    }
  }, [cell.id, localSource, cell.executionCount, store])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget
    const { selectionStart, selectionEnd, value } = textarea

    // Handle arrow key navigation between cells
    if (e.key === 'ArrowUp' && selectionStart === selectionEnd) {
      // For empty cells or cursor at beginning of first line
      const beforeCursor = value.substring(0, selectionStart)
      const isAtTop = selectionStart === 0 || !beforeCursor.includes('\n')

      if (isAtTop && onFocusPrevious) {
        e.preventDefault()
        updateSource()
        onFocusPrevious()
        return
      }
    } else if (e.key === 'ArrowDown' && selectionStart === selectionEnd) {
      // For empty cells or cursor at end of last line
      const afterCursor = value.substring(selectionEnd)
      const isAtBottom = selectionEnd === value.length || !afterCursor.includes('\n')

      if (isAtBottom && onFocusNext) {
        e.preventDefault()
        updateSource()
        onFocusNext()
        return
      }
    }

    // Handle execution shortcuts
    if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter: Run cell and move to next (or create new cell if at end)
      e.preventDefault()
      updateSource()
      if (cell.cellType === 'code') {
        executeCell()
      }
      if (onFocusNext) {
        onFocusNext() // Move to next cell (or create new if at end)
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Ctrl/Cmd+Enter: Run cell but stay in current cell
      e.preventDefault()
      updateSource()
      if (cell.cellType === 'code') {
        executeCell()
      }
      // Don't call onAddCell() - stay in current cell
    }
  }, [updateSource, executeCell, cell.cellType, onAddCell, onFocusNext, onFocusPrevious])

  const handleFocus = useCallback(() => {
    if (onFocus) {
      onFocus()
    }
  }, [onFocus])

  const getCellTypeIcon = () => {
    switch (cell.cellType) {
      case 'code': return <Code className="h-3 w-3" />
      case 'markdown': return <FileText className="h-3 w-3" />
      case 'sql': return <Database className="h-3 w-3" />
      case 'ai': return <Bot className="h-3 w-3" />
      default: return <Code className="h-3 w-3" />
    }
  }

  const getExecutionStatus = () => {
    switch (cell.executionState) {
      case 'idle': return null
      case 'queued': return <Badge variant="secondary" className="h-5 text-xs">Queued</Badge>
      case 'running': return (
        <Badge variant="outline" className="h-5 text-xs border-blue-200 text-blue-700 bg-blue-50">
          <div className="animate-spin w-2 h-2 border border-blue-600 border-t-transparent rounded-full mr-1"></div>
          Running
        </Badge>
      )
      case 'error': return <Badge variant="outline" className="h-5 text-xs border-red-200 text-red-700 bg-red-50">Error</Badge>
      default: return null
    }
  }

  return (
    <div className={`cell-container mb-2 sm:mb-3 relative group transition-all duration-200 pt-2 -mx-3 sm:mx-0 px-3 sm:px-0 ${
      autoFocus && !contextSelectionMode ? 'bg-primary/5' : 'hover:bg-muted/10'
    } ${contextSelectionMode && !cell.aiContextVisible ? 'opacity-60' : ''} ${
      contextSelectionMode ? (cell.aiContextVisible ? 'ring-2 ring-purple-300 bg-purple-50/30' : 'ring-2 ring-gray-300 bg-gray-50/30') : ''
    }`} style={{
      position: 'relative',
    }}>
      {/* Custom left border with controlled height */}
      <div
        className={`cell-border absolute left-3 sm:left-0 top-0 w-0.5 transition-all duration-200 ${
          autoFocus && !contextSelectionMode ? 'bg-primary/60' : 'bg-border/30'
        }`}
        style={{
          height: outputs.length > 0 || cell.executionState === 'running' || cell.executionState === 'queued'
            ? '100%'
            : '4rem'
        }}
      />
      {/* Cell Header */}
      <div className="cell-header flex items-center justify-between mb-2 pl-6 pr-1 sm:pr-4">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 sm:h-6 px-2 gap-1.5 text-xs font-medium hover:bg-muted/50"
              >
                {getCellTypeIcon()}
                <span className="cell-type-label capitalize hidden sm:inline">{cell.cellType}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onClick={() => changeCellType('code')} className="gap-2">
                <Code className="h-4 w-4" />
                Code
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeCellType('markdown')} className="gap-2">
                <FileText className="h-4 w-4" />
                Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeCellType('sql')} className="gap-2">
                <Database className="h-4 w-4" />
                SQL Query
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeCellType('ai')} className="gap-2">
                <Bot className="h-4 w-4" />
                AI Assistant
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {getExecutionStatus()}
        </div>

        {/* Cell Controls - visible on hover or always on mobile */}
        <div className="cell-controls flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {/* Mobile Play Button - Code cells only */}
            {cell.cellType === 'code' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={executeCell}
                disabled={cell.executionState === 'running' || cell.executionState === 'queued'}
                className="mobile-play-btn block sm:hidden h-8 w-8 p-0 hover:bg-muted/80"
                title="Run cell"
              >
                {cell.executionState === 'running' ? (
                  <div className="animate-spin w-4 h-4 border border-current border-t-transparent rounded-full"></div>
                ) : cell.executionState === 'queued' ? (
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            )}



            <div className="flex-1" />

            {/* Add Cell Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddCell}
              className="h-8 w-8 sm:h-7 sm:w-7 p-0 hover:bg-muted/80"
              title="Add cell below"
            >
              <Plus className="h-4 w-4 sm:h-3 sm:w-3" />
            </Button>

            {/* Source Visibility Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSourceVisibility}
              className={`h-8 w-8 sm:h-7 sm:w-7 p-0 hover:bg-muted/80 ${cell.sourceVisible ? '' : 'text-muted-foreground/60'}`}
              title={cell.sourceVisible ? 'Hide source' : 'Show source'}
            >
              {cell.sourceVisible ? <ChevronUp className="h-4 w-4 sm:h-3 sm:w-3" /> : <ChevronDown className="h-4 w-4 sm:h-3 sm:w-3" />}
            </Button>

            {/* Context Selection Mode Button */}
            {contextSelectionMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAiContextVisibility}
                className={`h-8 w-8 sm:h-7 sm:w-7 p-0 hover:bg-muted/80 ${cell.aiContextVisible ? 'text-purple-600' : 'text-gray-500'}`}
                title={cell.aiContextVisible ? 'Hide from AI context' : 'Show in AI context'}
              >
                {cell.aiContextVisible ? <Eye className="h-4 w-4 sm:h-3 sm:w-3" /> : <EyeOff className="h-4 w-4 sm:h-3 sm:w-3" />}
              </Button>
            )}

            {/* Desktop-only controls */}
            <div className="desktop-controls hidden sm:flex items-center gap-0.5">
              {/* Separator */}
              <div className="w-px h-4 bg-border/50 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onMoveUp}
                className="h-7 w-7 p-0 hover:bg-muted/80"
                title="Move cell up"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onMoveDown}
                className="h-7 w-7 p-0 hover:bg-muted/80"
                title="Move cell down"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeleteCell}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Delete cell"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
        </div>
      </div>

      {/* Cell Content with Left Gutter Play Button - Desktop Only */}
      <div className="relative">
        {/* Play Button Breaking Through Left Border - Desktop Only */}
        {cell.cellType === 'code' && (
          <div className="desktop-play-btn hidden sm:block absolute -left-3 z-10" style={{ top: cell.sourceVisible ? '0.375rem' : '-1.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={executeCell}
              disabled={cell.executionState === 'running' || cell.executionState === 'queued'}
              className={`h-6 w-6 p-0 rounded-sm bg-white border-0 hover:bg-white transition-colors ${
                autoFocus
                  ? 'text-foreground'
                  : 'text-muted-foreground/40 hover:text-foreground group-hover:text-foreground'
              }`}
            >
              {cell.executionState === 'running' ? (
                <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full bg-white"></div>
              ) : cell.executionState === 'queued' ? (
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}

        {/* Text Content Area */}
        {cell.sourceVisible && (
          <div className={`cell-content transition-colors py-1 pl-4 pr-1 sm:pr-4 ${
            autoFocus
              ? 'bg-white'
              : 'bg-white'
          }`}>
            <div className="min-h-[1.5rem]">
              <Textarea
                ref={textareaRef}
                value={localSource}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLocalSource(e.target.value)}
                onBlur={updateSource}
                onKeyDown={handleKeyDown}
                placeholder={
                  cell.cellType === 'code'
                    ? 'Enter your code here...'
                    : cell.cellType === 'markdown'
                    ? 'Enter markdown...'
                    : 'Enter raw text...'
                }
                className="min-h-[2rem] sm:min-h-[1.5rem] resize-none border-0 px-2 py-2 sm:py-1 focus-visible:ring-0 font-mono bg-white w-full placeholder:text-muted-foreground/60 shadow-none text-base sm:text-sm"
                onFocus={handleFocus}
              />
            </div>
          </div>
        )}
      </div>

      {/* Execution Summary - appears after input */}
      {cell.cellType === 'code' && (cell.executionCount || cell.executionState === 'running' || cell.executionState === 'queued') && (
        <div className="cell-content mt-1 pl-6 pr-1 sm:pr-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
            <span>
              {cell.executionState === 'running' ? (
                'Running...'
              ) : cell.executionState === 'queued' ? (
                'Queued'
              ) : cell.executionCount ? (
                cell.lastExecutionDurationMs
                  ? `${cell.lastExecutionDurationMs < 1000
                      ? `${cell.lastExecutionDurationMs}ms`
                      : `${(cell.lastExecutionDurationMs / 1000).toFixed(1)}s`}`
                  : 'Completed'
              ) : null}
            </span>
            {(outputs.length > 0 || cell.executionState === 'running') && (
              <div className="flex items-center gap-2">
                {!cell.outputVisible && outputs.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {outputs.length === 1 ? '1 output hidden' : `${outputs.length} outputs hidden`}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleOutputVisibility}
                  className={`h-6 w-6 sm:h-5 sm:w-5 p-0 hover:bg-muted/80 transition-opacity ${
                    autoFocus
                      ? 'opacity-100'
                      : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                  } ${cell.outputVisible ? '' : 'text-muted-foreground/60'}`}
                  title={cell.outputVisible ? 'Hide output' : 'Show output'}
                >
                  {cell.outputVisible ? <ChevronUp className="h-4 w-4 sm:h-3 sm:w-3" /> : <ChevronDown className="h-4 w-4 sm:h-3 sm:w-3" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Output Area for Code Cells */}
      {cell.cellType === 'code' && cell.outputVisible && (outputs.length > 0 || cell.executionState === 'running') && (
        <div className="cell-content mt-1 pl-6 pr-1 sm:pr-4 bg-background overflow-hidden max-w-full">
            {cell.executionState === 'running' && outputs.length === 0 && (
              <div className="py-3 border-l-2 border-blue-200 pl-1">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm text-blue-700">Executing...</span>
                </div>
              </div>
            )}

            {outputs
              .sort((a: OutputData, b: OutputData) => a.position - b.position)
              .map((output: OutputData, index: number) => (
                <div key={output.id} className={index > 0 ? "border-t border-border/30 mt-2 pt-2" : ""}>
                  {output.outputType === 'error' ? (
                    // Use AnsiErrorOutput for colored error rendering
                    <AnsiErrorOutput
                      ename={isErrorOutput(output.data) ? output.data.ename : undefined}
                      evalue={isErrorOutput(output.data) ? output.data.evalue : undefined}
                      traceback={isErrorOutput(output.data) ? output.data.traceback : undefined}
                    />
                  ) : (
                    // Use RichOutput for all other output types
                    <div className="py-2 overflow-hidden max-w-full">
                      <RichOutput
                        data={output.data as Record<string, unknown>}
                        metadata={output.metadata as Record<string, unknown> | undefined}
                        outputType={output.outputType}
                      />
                    </div>
                  )}
                </div>
              ))}
        </div>
      )}


    </div>
  )
}
