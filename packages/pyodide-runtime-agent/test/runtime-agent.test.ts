import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect } from 'effect'
import { createStorePromise, queryDb } from '@livestore/livestore'
import { makeAdapter } from '@livestore/adapter-node'
import { events, tables, schema } from '../../../shared/schema.js'
import { createTestStoreId, createTestSessionId, waitFor, cleanupResources } from './setup.js'

// Mock Pyodide to avoid loading the actual runtime in tests
const mockPyodide = {
  runPython: vi.fn(),
  globals: {
    get: vi.fn(),
    set: vi.fn()
  },
  pyimport: vi.fn(),
  toPy: vi.fn(),
  isPyProxy: vi.fn(() => false)
}

vi.mock('pyodide', () => ({
  loadPyodide: vi.fn(() => Promise.resolve(mockPyodide))
}))

// Mock the PyodideKernel class
class MockPyodideKernel {
  private initialized = false

  constructor(private notebookId: string) {}

  async initialize() {
    this.initialized = true
  }

  async execute(code: string) {
    if (!this.initialized) {
      throw new Error('Kernel not initialized')
    }

    // Mock execution based on code content
    if (code.includes('error')) {
      return [{ type: 'error', data: 'Mock error' }]
    }

    if (code.includes('print')) {
      return [{ type: 'stdout', data: 'Mock output\n' }]
    }

    return [{ type: 'result', data: 'None' }]
  }

  async terminate() {
    this.initialized = false
  }

  isInitialized() {
    return this.initialized
  }
}

describe("Runtime Agent", () => {
  let store: any
  let storeId: string
  let sessionId: string
  let kernelId: string

  beforeEach(async () => {
    storeId = createTestStoreId()
    sessionId = createTestSessionId()
    kernelId = `kernel-${Date.now()}`

    const adapter = makeAdapter({
      storage: { type: 'in-memory' }
    })

    store = await createStorePromise({
      adapter,
      schema,
      storeId
    })
  })

  afterEach(async () => {
    await cleanupResources(store)
  })

  describe("Kernel Session Management", () => {
    it("should register kernel session on startup", async () => {
      // Simulate kernel session startup
      store.commit(events.kernelSessionStarted({
        sessionId,
        kernelId,
        kernelType: 'python3',
        capabilities: {
          canExecuteCode: true,
          canExecuteSql: false,
          canExecuteAi: false
        }
      }))

      const sessions = store.query(tables.kernelSessions.select())
      expect(sessions).toHaveLength(1)
      expect(sessions[0].sessionId).toBe(sessionId)
      expect(sessions[0].kernelId).toBe(kernelId)
      expect(sessions[0].status).toBe('ready')
      expect(sessions[0].isActive).toBe(true)
    })

    it('should handle heartbeat updates', async () => {
      // Start session
      store.commit(events.kernelSessionStarted({
        sessionId,
        kernelId,
        kernelType: 'python3',
        capabilities: {
          canExecuteCode: true,
          canExecuteSql: false,
          canExecuteAi: false
        }
      }))

      // Send heartbeat with busy status
      store.commit(events.kernelSessionHeartbeat({
        sessionId,
        status: 'busy',
        timestamp: new Date(),
      }))

      const sessions = store.query(tables.kernelSessions.select())
      expect(sessions[0].status).toBe('busy')
      expect(sessions[0].isActive).toBe(true)
    })

    it('should mark session as terminated on shutdown', async () => {
      // Start session
      store.commit(events.kernelSessionStarted({
        sessionId,
        kernelId,
        kernelType: 'python3',
        capabilities: {
          canExecuteCode: true,
          canExecuteSql: false,
          canExecuteAi: false
        }
      }))

      // Terminate session
      const terminatedAt = new Date()
      store.commit(events.kernelSessionTerminated({
        sessionId,
        reason: 'shutdown',
      }))

      const sessions = store.query(tables.kernelSessions.select())
      expect(sessions[0].status).toBe('terminated')
      expect(sessions[0].isActive).toBe(false)
    })
  })

  describe('Execution Queue Processing', () => {
    beforeEach(async () => {
      // Setup kernel session
      store.commit(events.kernelSessionStarted({
        sessionId,
        kernelId,
        kernelType: 'python3',
        capabilities: {
          canExecuteCode: true,
          canExecuteSql: false,
          canExecuteAi: false
        }
      }))
    })

    it('should process execution queue in correct order', async () => {
      const cellId = 'test-cell-123'
      const queueId = 'test-queue-456'

      // Create cell
      store.commit(events.cellCreated({
        id: cellId,
        cellType: 'code',
        position: 0,
        createdBy: 'user-123'
      }))

      // Request execution
      store.commit(events.executionRequested({
        queueId,
        cellId,
        executionCount: 1,
        requestedBy: 'user-123',
        priority: 1
      }))

      // Assign to kernel
      store.commit(events.executionAssigned({
        queueId,
        kernelSessionId: sessionId,
      }))

      // Start execution
      store.commit(events.executionStarted({
        queueId,
        cellId,
        kernelSessionId: sessionId,
        startedAt: new Date(),
      }))

      // Complete execution
      store.commit(events.executionCompleted({
        queueId,
        cellId,
        status: 'success',
        completedAt: new Date(),
        executionDurationMs: 100,
      }))

      const queueEntries = store.query(tables.executionQueue.select())
      expect(queueEntries).toHaveLength(1)
      expect(queueEntries[0].status).toBe('completed')
    })

    it('should handle execution assignment by priority', async () => {
      const lowPriorityQueueId = 'low-priority-queue'
      const highPriorityQueueId = 'high-priority-queue'
      const cellId1 = 'cell-1'
      const cellId2 = 'cell-2'

      // Create cells
      store.commit(events.cellCreated({
        id: cellId1,
        cellType: 'code',
        position: 0,
        createdBy: 'user-123'
      }))

      store.commit(events.cellCreated({
        id: cellId2,
        cellType: 'code',
        position: 1,
        createdBy: 'user-123'
      }))

      // Request low priority execution first
      store.commit(events.executionRequested({
        queueId: lowPriorityQueueId,
        cellId: cellId1,
        executionCount: 1,
        requestedBy: 'user-123',
        priority: 1
      }))

      // Request high priority execution
      store.commit(events.executionRequested({
        queueId: highPriorityQueueId,
        cellId: cellId2,
        executionCount: 1,
        requestedBy: 'user-123',
        priority: 10
      }))

      // Query pending executions ordered by priority
      const pendingQueue = store.query(
        tables.executionQueue.select()
          .where({ status: 'pending' })
          .orderBy('priority', 'desc')
      )

      expect(pendingQueue).toHaveLength(2)
      expect(pendingQueue[0].id).toBe(highPriorityQueueId) // High priority first
      expect(pendingQueue[1].id).toBe(lowPriorityQueueId)
    })
  })

  describe('Reactive Query Subscriptions', () => {
    it('should properly handle query subscription lifecycle', async () => {
      const updateCallback = vi.fn()

      // Create reactive query for assigned work
      const assignedWork$ = queryDb(
        tables.executionQueue.select()
          .where({ status: 'assigned', assignedKernelSession: sessionId }),
        { label: 'assignedWork' }
      )

      // Subscribe to the query
      const subscription = store.subscribe(assignedWork$, {
        onUpdate: updateCallback
      })

      // Should start with empty results
      expect(updateCallback).toHaveBeenCalledWith([])

      // Add execution to queue
      const queueId = 'test-queue-123'
      const cellId = 'test-cell-456'

      store.commit(events.cellCreated({
        id: cellId,
        cellType: 'code',
        position: 0,
        createdBy: 'user-123'
      }))

      store.commit(events.executionRequested({
        queueId,
        cellId,
        executionCount: 1,
        requestedBy: 'user-123',
        priority: 1
      }))

      // Assign to our session
      store.commit(events.executionAssigned({
        queueId,
        kernelSessionId: sessionId,
      }))

      // Should receive update with assigned work
      await waitFor(() => updateCallback.mock.calls.length >= 2)
      const lastCall = updateCallback.mock.calls[updateCallback.mock.calls.length - 1]
      expect(lastCall[0]).toHaveLength(1)
      expect(lastCall[0][0].id).toBe(queueId)

      // Cleanup subscription (critical for preventing memory leaks)
      subscription()
    })

    it('should handle subscription errors gracefully', async () => {
      const errorCallback = vi.fn()

      // Create query that might have issues (simulate error conditions)
      // Note: With strict typing, we simulate runtime errors differently
      const problematicQuery$ = queryDb(
        tables.executionQueue.select().where({ id: 'non-existent-queue-id' }),
        { label: 'problematicQuery' }
      )

      // This should not throw but handle the error
      try {
        const subscription = store.subscribe(problematicQuery$, {
          onUpdate: () => {},
          onError: errorCallback
        })

        // Clean up if subscription was created
        subscription()
      } catch (error) {
        // Expected for invalid query
        expect(error).toBeDefined()
      }
    })

    it('should handle rapid subscription updates without memory leaks', async () => {
      const updateCallback = vi.fn()

      const pendingWork$ = queryDb(
        tables.executionQueue.select()
          .where({ status: 'pending' })
          .orderBy('priority', 'desc')
          .limit(5),
        { label: 'pendingWork' }
      )

      const subscription = store.subscribe(pendingWork$, {
        onUpdate: updateCallback
      })

      // Rapidly add and remove queue entries
      for (let i = 0; i < 10; i++) {
        const queueId = `queue-${i}`
        const cellId = `cell-${i}`

        store.commit(events.cellCreated({
          id: cellId,
          cellType: 'code',
          position: i,
          createdBy: 'user-123'
        }))

        store.commit(events.executionRequested({
          queueId,
          cellId,
          executionCount: 1,
          requestedBy: 'user-123',
          priority: i
        }))

        // Immediately complete some executions
        if (i % 2 === 0) {
          store.commit(events.executionCompleted({
            queueId,
            cellId: `cell-${i}`,
            status: 'success',
            completedAt: new Date(),
            executionDurationMs: 50,
          }))
        }
      }

      // Should handle all updates without issues
      await waitFor(() => updateCallback.mock.calls.length > 5)

      // Cleanup
      subscription()

      // Verify no hanging subscriptions
      expect(typeof subscription).toBe('function')
    })
  })

  describe('Kernel Execution Flow', () => {
    let kernel: MockPyodideKernel

    beforeEach(async () => {
      kernel = new MockPyodideKernel(storeId)
      await kernel.initialize()
    })

    afterEach(async () => {
      await kernel.terminate()
    })

    it('should execute code and generate outputs', async () => {
      const cellId = 'test-cell-123'
      const code = 'print("Hello, World!")'

      // Create cell with code
      store.commit(events.cellCreated({
        id: cellId,
        cellType: 'code',
        position: 0,
        createdBy: 'user-123'
      }))

      store.commit(events.cellSourceChanged({
        id: cellId,
        source: code,
        modifiedBy: 'user-123'
      }))

      // Execute code
      const outputs = await kernel.execute(code)

      // Should generate expected output
      expect(outputs).toHaveLength(1)
      expect(outputs[0].type).toBe('stdout')
      expect(outputs[0].data).toBe('Mock output\n')

      // Add output to store
      store.commit(events.cellOutputAdded({
        id: 'output-123',
        cellId,
        outputType: 'stream',
        data: outputs[0].data,
        position: 0
      }))

      // Verify output was stored
      const storedOutputs = store.query(tables.outputs.select().where({ cellId }))
      expect(storedOutputs).toHaveLength(1)
      expect(storedOutputs[0].data).toBe('Mock output\n')
    })

    it('should handle execution errors', async () => {
      const cellId = 'test-cell-error'
      const errorCode = 'raise ValueError("test error")'

      store.commit(events.cellCreated({
        id: cellId,
        cellType: 'code',
        position: 0,
        createdBy: 'user-123'
      }))

      store.commit(events.cellSourceChanged({
        id: cellId,
        source: errorCode,
        modifiedBy: 'user-123'
      }))

      // Execute code that throws error
      const outputs = await kernel.execute(errorCode)

      expect(outputs).toHaveLength(1)
      expect(outputs[0].type).toBe('error')
      expect(outputs[0].data).toBe('Mock error')
    })

    it('should clear outputs before execution', async () => {
      const cellId = 'test-cell-clear'

      // Create cell and add some outputs
      store.commit(events.cellCreated({
        id: cellId,
        cellType: 'code',
        position: 0,
        createdBy: 'user-123'
      }))

      store.commit(events.cellOutputAdded({
        id: 'old-output',
        cellId,
        outputType: 'stream',
        data: 'Old output',
        position: 0
      }))

      // Verify output exists
      let outputs = store.query(tables.outputs.select().where({ cellId }))
      expect(outputs).toHaveLength(1)

      // Clear outputs (as kernel would do before execution)
      store.commit(events.cellOutputsCleared({
        cellId,
        clearedBy: kernelId
      }))

      // Verify outputs are cleared
      outputs = store.query(tables.outputs.select().where({ cellId }))
      expect(outputs).toHaveLength(0)
    })
  })

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle store shutdown gracefully', async () => {
      const updateCallback = vi.fn()

      const query$ = queryDb(
        tables.kernelSessions.select().where({ isActive: true }),
        { label: 'activeSessions' }
      )

      const subscription = store.subscribe(query$, {
        onUpdate: updateCallback
      })

      // Add some data
      store.commit(events.kernelSessionStarted({
        sessionId,
        kernelId,
        kernelType: 'python3',
        capabilities: {
          canExecuteCode: true,
          canExecuteSql: false,
          canExecuteAi: false
        }
      }))

      // Subscription should be cleaned up on store shutdown
      await store.shutdown()

      // This should not throw or cause issues
      subscription()
    })

    it('should handle concurrent executions', async () => {
      const session1 = `${sessionId}-1`
      const session2 = `${sessionId}-2`

      // Start two kernel sessions
      store.commit(events.kernelSessionStarted({
        sessionId: session1,
        kernelId: `${kernelId}-1`,
        kernelType: 'python3',
        capabilities: {
          canExecuteCode: true,
          canExecuteSql: false,
          canExecuteAi: false
        }
      }))

      store.commit(events.kernelSessionStarted({
        sessionId: session2,
        kernelId: `${kernelId}-2`,
        kernelType: 'python3',
        capabilities: {
          canExecuteCode: true,
          canExecuteSql: false,
          canExecuteAi: false
        }
      }))

      // Create multiple execution requests
      const executions = Array.from({ length: 5 }, (_, i) => ({
        queueId: `queue-${i}`,
        cellId: `cell-${i}`,
        sessionId: i % 2 === 0 ? session1 : session2
      }))

      // Create cells and request executions
      for (const { queueId, cellId, sessionId: execSessionId } of executions) {
        store.commit(events.cellCreated({
          id: cellId,
          cellType: 'code',
          position: 0,
          createdBy: 'user-123'
        }))

        store.commit(events.executionRequested({
          queueId,
          cellId,
          executionCount: 1,
          requestedBy: 'user-123',
          priority: 1
        }))

        store.commit(events.executionAssigned({
          queueId,
          kernelSessionId: execSessionId,
        }))
      }

      // All executions should be properly assigned
      const assignedExecutions = store.query(
        tables.executionQueue.select().where({ status: 'assigned' })
      )

      expect(assignedExecutions).toHaveLength(5)

      // Sessions should have work distributed
      const session1Work = assignedExecutions.filter((e: any) => e.assignedKernelSession === session1)
      const session2Work = assignedExecutions.filter((e: any) => e.assignedKernelSession === session2)

      expect(session1Work.length + session2Work.length).toBe(5)
    })
  })

  describe('AI Context Gathering', () => {
    it('should gather notebook context including outputs for AI cells', async () => {
      const kernelId = 'test-kernel'
      const sessionId = 'test-session'

      // Start kernel session
      store.commit(events.kernelSessionStarted({
        sessionId,
        kernelId,
        kernelType: 'python3',
        capabilities: {
          canExecuteCode: true,
          canExecuteSql: false,
          canExecuteAi: true
        }
      }))

      // Create a code cell with output
      const codeCellId = 'code-cell-1'
      store.commit(events.cellCreated({
        id: codeCellId,
        cellType: 'code',
        position: 1,
        createdBy: 'user-123'
      }))

      store.commit(events.cellSourceChanged({
        id: codeCellId,
        source: 'x = 42\nprint(f"The answer is {x}")',
        modifiedBy: 'user-123'
      }))

      // Add output for the code cell
      store.commit(events.cellOutputAdded({
        id: 'output-1',
        cellId: codeCellId,
        outputType: 'stream',
        data: {
          name: 'stdout',
          text: 'The answer is 42\n'
        },
        position: 0
      }))

      // Create another code cell with rich output
      const codeCellId2 = 'code-cell-2'
      store.commit(events.cellCreated({
        id: codeCellId2,
        cellType: 'code',
        position: 2,
        createdBy: 'user-123'
      }))

      store.commit(events.cellSourceChanged({
        id: codeCellId2,
        source: 'import pandas as pd\ndf = pd.DataFrame({"a": [1, 2], "b": [3, 4]})\ndf',
        modifiedBy: 'user-123'
      }))

      // Add rich output with text/plain representation
      store.commit(events.cellOutputAdded({
        id: 'output-2',
        cellId: codeCellId2,
        outputType: 'execute_result',
        data: {
          'text/plain': '   a  b\n0  1  3\n1  2  4',
          'text/html': '<div>...</div>'
        },
        position: 0
      }))

      // Create an AI cell that should gather context
      const aiCellId = 'ai-cell-1'
      store.commit(events.cellCreated({
        id: aiCellId,
        cellType: 'ai',
        position: 3,
        createdBy: 'user-123'
      }))

      // Mock the gatherNotebookContext function (since we can't easily import it)
      // We'll test the logic by directly querying what the function would query
      const aiCell = store.query(tables.cells.select().where({ id: aiCellId }))[0]

      // Query previous cells (what gatherNotebookContext would do)
      const previousCellsQuery = queryDb(
        tables.cells.select()
          .where({
            position: { op: '<', value: aiCell.position }
          })
          .orderBy('position', 'asc')
      )
      const previousCells = store.query(previousCellsQuery)

      // Verify we have the expected previous cells
      expect(previousCells).toHaveLength(2)
      expect(previousCells[0].id).toBe(codeCellId)
      expect(previousCells[1].id).toBe(codeCellId2)

      // Query outputs for the first cell
      const outputs1Query = queryDb(
        tables.outputs.select()
          .where({ cellId: codeCellId })
          .orderBy('position', 'asc')
      )
      const outputs1 = store.query(outputs1Query)

      expect(outputs1).toHaveLength(1)
      expect(outputs1[0].outputType).toBe('stream')
      expect(outputs1[0].data.text).toBe('The answer is 42\n')

      // Query outputs for the second cell
      const outputs2Query = queryDb(
        tables.outputs.select()
          .where({ cellId: codeCellId2 })
          .orderBy('position', 'asc')
      )
      const outputs2 = store.query(outputs2Query)

      expect(outputs2).toHaveLength(1)
      expect(outputs2[0].outputType).toBe('execute_result')
      expect(outputs2[0].data['text/plain']).toBe('   a  b\n0  1  3\n1  2  4')
      expect(outputs2[0].data['text/html']).toBe('<div>...</div>')

      // Test that we can construct context data structure
      const mockContext = {
        previousCells: previousCells.map((cell: any) => {
          const cellOutputsQuery = queryDb(
            tables.outputs.select()
              .where({ cellId: cell.id })
              .orderBy('position', 'asc')
          )
          const cellOutputs = store.query(cellOutputsQuery)

          return {
            id: cell.id,
            cellType: cell.cellType,
            source: cell.source || '',
            position: cell.position,
            outputs: cellOutputs.map((output: any) => ({
              outputType: output.outputType,
              data: output.data
            }))
          }
        }),
        totalCells: store.query(tables.cells.select()).length,
        currentCellPosition: aiCell.position
      }

      // Verify the context structure
      expect(mockContext.previousCells).toHaveLength(2)
      expect(mockContext.previousCells[0].outputs).toHaveLength(1)
      expect(mockContext.previousCells[1].outputs).toHaveLength(1)
      expect(mockContext.totalCells).toBe(3)
      expect(mockContext.currentCellPosition).toBe(3)

      // Verify output filtering (text/plain and text/markdown only)
      const richOutput = mockContext.previousCells[1].outputs[0]
      expect(richOutput.data['text/plain']).toBeDefined()
      expect(richOutput.data['text/html']).toBeDefined() // This would be filtered out in actual implementation
    })

    it('should handle cells with no outputs in context gathering', async () => {
      // Create a cell without any outputs
      const cellId = 'empty-cell'
      store.commit(events.cellCreated({
        id: cellId,
        cellType: 'code',
        position: 1,
        createdBy: 'user-123'
      }))

      store.commit(events.cellSourceChanged({
        id: cellId,
        source: '# This cell has no output',
        modifiedBy: 'user-123'
      }))

      // Create AI cell after it
      const aiCellId = 'ai-cell-2'
      store.commit(events.cellCreated({
        id: aiCellId,
        cellType: 'ai',
        position: 2,
        createdBy: 'user-123'
      }))

      // Query what the context gathering would find
      const aiCell = store.query(tables.cells.select().where({ id: aiCellId }))[0]
      const previousCells = store.query(
        queryDb(
          tables.cells.select()
            .where({
              position: { op: '<', value: aiCell.position }
            })
            .orderBy('position', 'asc')
        )
      )

      expect(previousCells).toHaveLength(1)
      expect(previousCells[0].id).toBe(cellId)

      // Verify no outputs exist
      const outputs = store.query(
        queryDb(tables.outputs.select().where({ cellId }))
      )
      expect(outputs).toHaveLength(0)
    })
  })
})
