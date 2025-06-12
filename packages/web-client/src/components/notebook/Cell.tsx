import React, { useState, useCallback } from 'react'
import { useStore } from '@livestore/react'
import { events, tables } from '@anode/schema'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { SqlCell } from './SqlCell.js'
import { AiCell } from './AiCell.js'
import { queryDb } from '@livestore/livestore'

interface CellProps {
  cell: typeof tables.cells.Type
  onAddCell: () => void
  onDeleteCell: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export const Cell: React.FC<CellProps> = ({
  cell,
  onAddCell,
  onDeleteCell,
  onMoveUp,
  onMoveDown
}) => {
  // Route to specialized cell components
  if (cell.cellType === 'sql') {
    return <SqlCell cell={cell} onAddCell={onAddCell} onDeleteCell={onDeleteCell} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
  }

  if (cell.cellType === 'ai') {
    return <AiCell cell={cell} onAddCell={onAddCell} onDeleteCell={onDeleteCell} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
  }

  // Default cell component for code, markdown, raw
  const { store } = useStore()
  const [isEditing, setIsEditing] = useState(false)
  const [localSource, setLocalSource] = useState(cell.source)

  // Create stable query using useMemo to prevent React Hook issues
  const outputsQuery = React.useMemo(() =>
    queryDb((get) => tables.outputs.where({ cellId: cell.id })),
    [cell.id]
  )
  const outputs = store.useQuery(outputsQuery)

  const updateSource = useCallback(() => {
    if (localSource !== cell.source) {
      store.commit(events.cellSourceChanged({
        id: cell.id,
        source: localSource,
        modifiedBy: 'current-user', // TODO: get from auth
      }))
    }
    setIsEditing(false)
  }, [localSource, cell.source, cell.id, store])

  const changeCellType = useCallback((newType: 'code' | 'markdown' | 'raw' | 'sql' | 'ai') => {
    store.commit(events.cellTypeChanged({
      id: cell.id,
      cellType: newType,
    }))
  }, [cell.id, store])

  const executeCell = useCallback(async () => {
    if (!cell.source?.trim()) {
      console.log('No code to execute')
      return
    }

    console.log('🚀 Executing cell via execution queue:', cell.id, 'in notebook:', cell.notebookId)

    try {
      const executionCount = (cell.executionCount || 0) + 1;
      const executionId = `exec-${cell.id}-${executionCount}`;
      const now = new Date();

      // Clear previous outputs first
      store.commit(events.cellOutputsCleared({
        cellId: cell.id,
        clearedBy: 'current-user',
      }))

      // Queue execution using new execution queue system
      store.commit(events.executionQueued({
        id: executionId,
        cellId: cell.id,
        executionCount: executionCount,
        requestedBy: 'current-user',
        queuedAt: now,
        timeoutAfter: new Date(now.getTime() + 5 * 60 * 1000), // 5 minute timeout
      }))

      // Also emit legacy event for backward compatibility
      store.commit(events.cellExecutionRequested({
        cellId: cell.id,
        notebookId: cell.notebookId,
        requestedBy: 'current-user',
        executionCount: executionCount,
      }))

      console.log('✅ Execution queued via execution queue system')

      // The kernel service will now:
      // 1. See the execution in the queue
      // 2. Claim the execution
      // 3. Execute the code with proper timeout handling
      // 4. Emit progress updates and completion events
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
        createdAt: new Date(),
      }))

      store.commit(events.cellExecutionCompleted({
        cellId: cell.id,
        executionCount: (cell.executionCount || 0) + 1,
        completedAt: new Date(),
        status: 'error',
      }))
    }
  }, [cell.id, cell.notebookId, cell.source, cell.executionCount, store])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter: Run cell and move to next (create new cell)
      e.preventDefault()
      updateSource()
      if (cell.cellType === 'code') {
        executeCell()
      }
      onAddCell() // Move to next cell
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Ctrl/Cmd+Enter: Run cell but stay in current cell
      e.preventDefault()
      updateSource()
      if (cell.cellType === 'code') {
        executeCell()
      }
      // Don't call onAddCell() - stay in current cell
    } else if (e.key === 'Escape') {
      setLocalSource(cell.source)
      setIsEditing(false)
    }
  }, [updateSource, executeCell, cell.source, cell.cellType, onAddCell])

  const getBadgeVariant = () => {
    switch (cell.cellType) {
      case 'code': return 'default'
      case 'markdown': return 'secondary'
      case 'sql': return 'default'
      case 'ai': return 'default'
      case 'raw': return 'outline'
      default: return 'default'
    }
  }

  const getExecutionStatus = () => {
    switch (cell.executionState) {
      case 'idle': return null
      case 'executing': return <Badge variant="destructive">Running...</Badge>
      case 'completed': return <Badge variant="default">✓</Badge>
      case 'error': return <Badge variant="destructive">Error</Badge>
      default: return null
    }
  }

  return (
    <Card className="mb-4 relative group">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge
                  variant={getBadgeVariant()}
                  className="cursor-pointer hover:opacity-80"
                >
                  {cell.cellType}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => changeCellType('code')}>
                  Code
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeCellType('markdown')}>
                  Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeCellType('sql')}>
                  🗄️ SQL Query
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeCellType('ai')}>
                  🤖 AI Assistant
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeCellType('raw')}>
                  Raw
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {getExecutionStatus()}
          </div>

          {/* Cell Controls - visible on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveUp}
              className="h-8 w-8 p-0"
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveDown}
              className="h-8 w-8 p-0"
            >
              ↓
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddCell}
              className="h-8 w-8 p-0"
            >
              +
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteCell}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              ×
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div
          onClick={() => setIsEditing(true)}
          className="min-h-[40px] cursor-text"
        >
          {isEditing ? (
            <Textarea
              value={localSource}
              onChange={(e) => setLocalSource(e.target.value)}
              onBlur={updateSource}
              onKeyDown={handleKeyDown}
              placeholder={
                cell.cellType === 'code'
                  ? 'Enter your code here...'
                  : cell.cellType === 'markdown'
                  ? 'Enter markdown...'
                  : 'Enter raw text...'
              }
              className="min-h-[60px] resize-none border-0 p-2 focus-visible:ring-0 font-mono"
              autoFocus
            />
          ) : (
            <div
              className={`whitespace-pre-wrap font-mono text-sm min-h-[40px] p-2 rounded border-2 border-transparent hover:border-muted-foreground/20 transition-colors ${
                cell.source ? '' : 'text-muted-foreground italic'
              }`}
            >
              {cell.source || 'Click to edit...'}
            </div>
          )}
        </div>

        {/* Execution Controls for Code Cells */}
        {cell.cellType === 'code' && !isEditing && (
          <>
            <Separator className="my-3" />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={executeCell}
                disabled={cell.executionState === 'executing'}
              >
                {cell.executionState === 'executing' ? 'Running...' : 'Run'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Shift+Enter to run and move • Ctrl+Enter to run
              </span>
            </div>
          </>
        )}



        {/* Output Area for Code Cells */}
        {cell.cellType === 'code' && (outputs.length > 0 || cell.executionState === 'running') && (
          <div className="mt-4">
            <Separator className="mb-3" />
            <div className="space-y-2">
              {cell.executionState === 'running' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-blue-700">Executing...</span>
                  </div>
                </div>
              )}

              {[...outputs]
                .sort((a: any, b: any) => a.position - b.position)
                .map((output: any) => (
                  <div key={output.id} className="border rounded-md">
                    {output.outputType === 'stream' && (
                      <div className="p-3 bg-gray-50 font-mono text-sm whitespace-pre-wrap">
                        {output.data['text/plain']}
                      </div>
                    )}

                    {output.outputType === 'execute_result' && (
                      <div className="p-3 bg-green-50 border-green-200">
                        <div className="text-xs text-green-600 mb-1">Result:</div>
                        <div className="font-mono text-sm whitespace-pre-wrap">
                          {output.data['text/plain']}
                        </div>
                      </div>
                    )}

                    {output.outputType === 'error' && (
                      <div className="p-3 bg-red-50 border-red-200">
                        <div className="text-xs text-red-600 mb-1">Error:</div>
                        <div className="font-mono text-sm">
                          <div className="font-semibold text-red-700">
                            {output.data.ename}: {output.data.evalue}
                          </div>
                          {output.data.traceback && (
                            <div className="mt-2 text-red-600 text-xs whitespace-pre-wrap">
                              {Array.isArray(output.data.traceback)
                                ? output.data.traceback.join('\n')
                                : output.data.traceback}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {output.outputType === 'display_data' && (
                      <div className="p-3 bg-blue-50 border-blue-200">
                        <div className="text-xs text-blue-600 mb-1">Display:</div>
                        <div className="font-mono text-sm whitespace-pre-wrap">
                          {output.data['text/plain'] || JSON.stringify(output.data, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
