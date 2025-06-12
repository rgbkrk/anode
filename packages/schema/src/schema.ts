import { Events, makeSchema, Schema, SessionIdSymbol, State } from '@livestore/livestore'

// Core tables for collaborative notebooks
export const tables: Record<string, any> = {
  notebooks: State.SQLite.table({
    name: 'notebooks',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      title: State.SQLite.text({ default: 'Untitled Notebook' }),
      kernelType: State.SQLite.text({ default: 'python3' }),
      ownerId: State.SQLite.text(),
      createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
      lastModified: State.SQLite.integer({ schema: Schema.DateFromNumber }),
      isPublic: State.SQLite.boolean({ default: false }),
    },
  }),

  // Kernel management tables
  kernels: State.SQLite.table({
    name: 'kernels',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      notebookId: State.SQLite.text(),
      status: State.SQLite.text({ default: 'starting' }), // 'starting', 'active', 'shutting_down', 'dead'
      lastHeartbeat: State.SQLite.integer({ schema: Schema.DateFromNumber }),
      registeredAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
      capabilities: State.SQLite.json({ schema: Schema.Any, nullable: true }), // version, features, etc.
      metadata: State.SQLite.json({ schema: Schema.Any, nullable: true }), // process info, etc.
    },
  }),

  executions: State.SQLite.table({
    name: 'executions',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      cellId: State.SQLite.text(),
      executionCount: State.SQLite.integer(),
      status: State.SQLite.text({ default: 'queued' }), // 'queued', 'claimed', 'running', 'completed', 'failed', 'timeout'
      claimedBy: State.SQLite.text({ nullable: true }), // kernel ID
      claimedAt: State.SQLite.integer({ nullable: true, schema: Schema.DateFromNumber }),
      startedAt: State.SQLite.integer({ nullable: true, schema: Schema.DateFromNumber }),
      completedAt: State.SQLite.integer({ nullable: true, schema: Schema.DateFromNumber }),
      lastProgress: State.SQLite.integer({ nullable: true, schema: Schema.DateFromNumber }),
      timeoutAfter: State.SQLite.integer({ nullable: true, schema: Schema.DateFromNumber }),
      createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
      requestedBy: State.SQLite.text(),
    },
  }),

  cells: State.SQLite.table({
    name: 'cells',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      notebookId: State.SQLite.text(),
      cellType: State.SQLite.text(), // 'code', 'markdown', 'raw', 'sql', 'ai'
      source: State.SQLite.text({ default: '' }),
      position: State.SQLite.real(),
      executionCount: State.SQLite.integer({ nullable: true }),
      executionState: State.SQLite.text({ default: 'idle' }), // 'idle', 'pending', 'running', 'completed', 'error'

      // SQL-specific fields
      sqlConnectionId: State.SQLite.text({ nullable: true }),
      sqlResultData: State.SQLite.json({ nullable: true, schema: Schema.Any }),

      // AI-specific fields
      aiProvider: State.SQLite.text({ nullable: true }), // 'openai', 'anthropic', 'local'
      aiModel: State.SQLite.text({ nullable: true }),
      aiConversation: State.SQLite.json({ nullable: true, schema: Schema.Any }), // Array of messages
      aiSettings: State.SQLite.json({ nullable: true, schema: Schema.Any }), // temperature, max_tokens, etc.

      createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
      createdBy: State.SQLite.text(),
      deletedAt: State.SQLite.integer({ nullable: true, schema: Schema.DateFromNumber }),
    },
  }),

  outputs: State.SQLite.table({
    name: 'outputs',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      cellId: State.SQLite.text(),
      outputType: State.SQLite.text(), // 'display_data', 'execute_result', 'stream', 'error'
      data: State.SQLite.json({ schema: Schema.Any }),
      position: State.SQLite.real(),
      createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    },
  }),

  // Data connections for SQL cells
  dataConnections: State.SQLite.table({
    name: 'dataConnections',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      notebookId: State.SQLite.text(),
      name: State.SQLite.text(),
      type: State.SQLite.text(), // 'postgres', 'mysql', 'sqlite', 'clickhouse', 'bigquery', etc.
      connectionString: State.SQLite.text(), // encrypted connection details
      isDefault: State.SQLite.boolean({ default: false }),
      createdBy: State.SQLite.text(),
      createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    },
  }),

  // UI state for each user
  uiState: State.SQLite.clientDocument({
    name: 'uiState',
    schema: Schema.Struct({
      selectedCellId: Schema.optional(Schema.String),
      currentNotebookId: Schema.optional(Schema.String),
      editingCellId: Schema.optional(Schema.String),
    }),
    default: {
      id: SessionIdSymbol,
      value: {}
    },
  }),
}

// Events describe notebook and cell changes
export const events = {
  // Notebook events
  notebookCreated: Events.synced({
    name: 'v1.NotebookCreated',
    schema: Schema.Struct({
      id: Schema.String,
      title: Schema.String,
      ownerId: Schema.String,
      createdAt: Schema.Date,
    }),
  }),

  // Kernel management events
  kernelRegistered: Events.synced({
    name: 'v1.KernelRegistered',
    schema: Schema.Struct({
      id: Schema.String,
      notebookId: Schema.String,
      capabilities: Schema.optional(Schema.Any),
      metadata: Schema.optional(Schema.Any),
      registeredAt: Schema.Date,
    }),
  }),

  kernelHeartbeat: Events.synced({
    name: 'v1.KernelHeartbeat',
    schema: Schema.Struct({
      kernelId: Schema.String,
      timestamp: Schema.Date,
      status: Schema.Literal('active', 'shutting_down'),
    }),
  }),

  kernelShutdown: Events.synced({
    name: 'v1.KernelShutdown',
    schema: Schema.Struct({
      kernelId: Schema.String,
      shutdownAt: Schema.Date,
      reason: Schema.optional(Schema.String),
    }),
  }),

  kernelTimeout: Events.synced({
    name: 'v1.KernelTimeout',
    schema: Schema.Struct({
      kernelId: Schema.String,
      timeoutAt: Schema.Date,
      lastHeartbeat: Schema.Date,
    }),
  }),

  // Execution queue events
  executionQueued: Events.synced({
    name: 'v1.ExecutionQueued',
    schema: Schema.Struct({
      id: Schema.String,
      cellId: Schema.String,
      executionCount: Schema.Number,
      requestedBy: Schema.String,
      queuedAt: Schema.Date,
      timeoutAfter: Schema.optional(Schema.Date),
    }),
  }),

  executionClaimed: Events.synced({
    name: 'v1.ExecutionClaimed',
    schema: Schema.Struct({
      executionId: Schema.String,
      kernelId: Schema.String,
      claimedAt: Schema.Date,
    }),
  }),

  executionProgress: Events.synced({
    name: 'v1.ExecutionProgress',
    schema: Schema.Struct({
      executionId: Schema.String,
      kernelId: Schema.String,
      progressAt: Schema.Date,
      details: Schema.optional(Schema.Any),
    }),
  }),

  executionTimeout: Events.synced({
    name: 'v1.ExecutionTimeout',
    schema: Schema.Struct({
      executionId: Schema.String,
      kernelId: Schema.String,
      timeoutAt: Schema.Date,
    }),
  }),

  executionReleased: Events.synced({
    name: 'v1.ExecutionReleased',
    schema: Schema.Struct({
      executionId: Schema.String,
      kernelId: Schema.String,
      releasedAt: Schema.Date,
      reason: Schema.String,
    }),
  }),

  notebookTitleChanged: Events.synced({
    name: 'v1.NotebookTitleChanged',
    schema: Schema.Struct({
      id: Schema.String,
      title: Schema.String,
      lastModified: Schema.Date,
    }),
  }),

  // Cell events
  cellCreated: Events.synced({
    name: 'v1.CellCreated',
    schema: Schema.Struct({
      id: Schema.String,
      notebookId: Schema.String,
      cellType: Schema.Literal('code', 'markdown', 'raw', 'sql', 'ai'),
      position: Schema.Number,
      createdBy: Schema.String,
      createdAt: Schema.Date,
    }),
  }),

  cellSourceChanged: Events.synced({
    name: 'v1.CellSourceChanged',
    schema: Schema.Struct({
      id: Schema.String,
      source: Schema.String,
      modifiedBy: Schema.String,
    }),
  }),

  cellTypeChanged: Events.synced({
    name: 'v1.CellTypeChanged',
    schema: Schema.Struct({
      id: Schema.String,
      cellType: Schema.Literal('code', 'markdown', 'raw', 'sql', 'ai'),
    }),
  }),

  cellDeleted: Events.synced({
    name: 'v1.CellDeleted',
    schema: Schema.Struct({
      id: Schema.String,
      deletedAt: Schema.Date,
      deletedBy: Schema.String,
    }),
  }),

  cellMoved: Events.synced({
    name: 'v1.CellMoved',
    schema: Schema.Struct({
      id: Schema.String,
      newPosition: Schema.Number,
    }),
  }),

  // Execution events (for kernel integration) - DEPRECATED: Use execution queue events instead
  cellExecutionRequested: Events.synced({
    name: 'v1.CellExecutionRequested',
    schema: Schema.Struct({
      cellId: Schema.String,
      notebookId: Schema.String,
      requestedBy: Schema.String,
      executionCount: Schema.Number,
    }),
  }),

  cellExecutionStarted: Events.synced({
    name: 'v1.CellExecutionStarted',
    schema: Schema.Struct({
      cellId: Schema.String,
      executionCount: Schema.Number,
      startedAt: Schema.Date,
    }),
  }),

  cellExecutionCompleted: Events.synced({
    name: 'v1.CellExecutionCompleted',
    schema: Schema.Struct({
      cellId: Schema.String,
      executionCount: Schema.Number,
      completedAt: Schema.Date,
      status: Schema.Literal('success', 'error'),
    }),
  }),

  // SQL events
  sqlConnectionCreated: Events.synced({
    name: 'v1.SqlConnectionCreated',
    schema: Schema.Struct({
      id: Schema.String,
      notebookId: Schema.String,
      name: Schema.String,
      type: Schema.String,
      connectionString: Schema.String,
      isDefault: Schema.Boolean,
      createdBy: Schema.String,
      createdAt: Schema.Date,
    }),
  }),

  sqlQueryExecuted: Events.synced({
    name: 'v1.SqlQueryExecuted',
    schema: Schema.Struct({
      cellId: Schema.String,
      connectionId: Schema.String,
      query: Schema.String,
      resultData: Schema.Any,
      executedBy: Schema.String,
    }),
  }),

  // AI events
  aiConversationUpdated: Events.synced({
    name: 'v1.AiConversationUpdated',
    schema: Schema.Struct({
      cellId: Schema.String,
      conversation: Schema.Array(Schema.Struct({
        role: Schema.Literal('user', 'assistant', 'system'),
        content: Schema.String,
        timestamp: Schema.Date,
      })),
      updatedBy: Schema.String,
    }),
  }),

  aiSettingsChanged: Events.synced({
    name: 'v1.AiSettingsChanged',
    schema: Schema.Struct({
      cellId: Schema.String,
      provider: Schema.String, // 'openai', 'anthropic', 'local'
      model: Schema.String,
      settings: Schema.Struct({
        temperature: Schema.optional(Schema.Number),
        maxTokens: Schema.optional(Schema.Number),
        systemPrompt: Schema.optional(Schema.String),
      }),
    }),
  }),

  // Output events (from kernel responses)
  cellOutputAdded: Events.synced({
    name: 'v1.CellOutputAdded',
    schema: Schema.Struct({
      id: Schema.String,
      cellId: Schema.String,
      outputType: Schema.Literal('display_data', 'execute_result', 'stream', 'error'),
      data: Schema.Any,
      position: Schema.Number,
      createdAt: Schema.Date,
    }),
  }),

  cellOutputsCleared: Events.synced({
    name: 'v1.CellOutputsCleared',
    schema: Schema.Struct({
      cellId: Schema.String,
      clearedBy: Schema.String,
    }),
  }),

  // UI state
  uiStateSet: tables.uiState.set,
}

// Materializers map events to state changes
const materializers = State.SQLite.materializers(events, {
  // Notebook materializers
  'v1.NotebookCreated': ({ id, title, ownerId, createdAt }) =>
    tables.notebooks.insert({
      id,
      title,
      ownerId,
      createdAt,
      lastModified: createdAt
    }),

  // Kernel management materializers
  'v1.KernelRegistered': ({ id, notebookId, capabilities, metadata, registeredAt }) =>
    tables.kernels.insert({
      id,
      notebookId,
      status: 'active',
      lastHeartbeat: registeredAt,
      registeredAt,
      capabilities,
      metadata,
    }),

  'v1.KernelHeartbeat': ({ kernelId, timestamp, status }) =>
    tables.kernels.update({
      lastHeartbeat: timestamp,
      status,
    }).where({ id: kernelId }),

  'v1.KernelShutdown': ({ kernelId }) =>
    tables.kernels.update({
      status: 'dead',
    }).where({ id: kernelId }),

  'v1.KernelTimeout': ({ kernelId }) => [
    tables.kernels.update({
      status: 'dead',
    }).where({ id: kernelId }),
    // Release any executions claimed by this kernel
    tables.executions.update({
      status: 'queued',
      claimedBy: null,
      claimedAt: null,
    }).where({ claimedBy: kernelId, status: 'claimed' }),
    tables.executions.update({
      status: 'timeout',
    }).where({ claimedBy: kernelId, status: 'running' }),
  ],

  // Execution queue materializers
  'v1.ExecutionQueued': ({ id, cellId, executionCount, requestedBy, queuedAt, timeoutAfter }) =>
    tables.executions.insert({
      id,
      cellId,
      executionCount,
      status: 'queued',
      requestedBy,
      createdAt: queuedAt,
      timeoutAfter,
    }),

  'v1.ExecutionClaimed': ({ executionId, kernelId, claimedAt }) =>
    tables.executions.update({
      status: 'claimed',
      claimedBy: kernelId,
      claimedAt,
    }).where({ id: executionId }),

  'v1.ExecutionProgress': ({ executionId, progressAt }) =>
    tables.executions.update({
      lastProgress: progressAt,
    }).where({ id: executionId }),

  'v1.ExecutionTimeout': ({ executionId }) =>
    tables.executions.update({
      status: 'timeout',
    }).where({ id: executionId }),

  'v1.ExecutionReleased': ({ executionId, releasedAt, reason }) =>
    tables.executions.update({
      status: reason === 'timeout' ? 'timeout' : 'queued',
      claimedBy: null,
      claimedAt: null,
    }).where({ id: executionId }),

  'v1.NotebookTitleChanged': ({ id, title, lastModified }) => [
    tables.notebooks.update({ title, lastModified }).where({ id }),
  ],

  // Cell materializers
  'v1.CellCreated': ({ id, notebookId, cellType, position, createdBy, createdAt }) => [
    tables.cells.insert({
      id,
      notebookId,
      cellType,
      position,
      createdBy,
      createdAt
    }),
    // Update notebook's last modified time
    tables.notebooks.update({ lastModified: createdAt }).where({ id: notebookId }),
  ],

  'v1.CellSourceChanged': ({ id, source, modifiedBy }) =>
    tables.cells.update({ source }).where({ id }),

  'v1.CellTypeChanged': ({ id, cellType }) =>
    tables.cells.update({ cellType }).where({ id }),

  'v1.CellDeleted': ({ id, deletedAt, deletedBy }) =>
    tables.cells.update({ deletedAt }).where({ id }),

  'v1.CellMoved': ({ id, newPosition }) =>
    tables.cells.update({ position: newPosition }).where({ id }),

  // Execution materializers - DEPRECATED: Use execution queue events instead
  'v1.CellExecutionRequested': ({ cellId, executionCount }) => [
    tables.cells.update({
      executionState: 'pending',
      executionCount
    }).where({ id: cellId }),
    // Also create execution queue entry for new queue system
    tables.executions.insert({
      id: `exec-${cellId}-${executionCount}`,
      cellId,
      executionCount,
      status: 'queued',
      requestedBy: 'legacy-system',
      createdAt: new Date(),
      timeoutAfter: new Date(Date.now() + 5 * 60 * 1000), // 5 minute timeout
    }),
  ],

  'v1.CellExecutionStarted': ({ cellId, executionCount }) => [
    tables.cells.update({ executionState: 'running' }).where({ id: cellId }),
    // Update execution queue
    tables.executions.update({
      status: 'running',
      startedAt: new Date(),
    }).where({ cellId, executionCount }),
  ],

  'v1.CellExecutionCompleted': ({ cellId, executionCount, status, completedAt }) => [
    tables.cells.update({
      executionState: status === 'success' ? 'completed' : 'error'
    }).where({ id: cellId }),
    // Update execution queue
    tables.executions.update({
      status: status === 'success' ? 'completed' : 'failed',
      completedAt,
    }).where({ cellId, executionCount }),
  ],

  // Output materializers
  'v1.CellOutputAdded': ({ id, cellId, outputType, data, position, createdAt }) =>
    tables.outputs.insert({
      id,
      cellId,
      outputType,
      data,
      position,
      createdAt
    }),

  'v1.CellOutputsCleared': ({ cellId }) =>
    tables.outputs.delete().where({ cellId }),

  // SQL materializers
  'v1.SqlConnectionCreated': ({ id, notebookId, name, type, connectionString, isDefault, createdBy, createdAt }) =>
    tables.dataConnections.insert({
      id,
      notebookId,
      name,
      type,
      connectionString,
      isDefault,
      createdBy,
      createdAt,
    }),

  'v1.SqlQueryExecuted': ({ cellId, connectionId, query, resultData }) =>
    tables.cells.update({
      source: query,
      sqlConnectionId: connectionId,
      sqlResultData: resultData,
      executionState: 'completed',
    }).where({ id: cellId }),

  // AI materializers
  'v1.AiConversationUpdated': ({ cellId, conversation }) =>
    tables.cells.update({
      aiConversation: conversation,
    }).where({ id: cellId }),

  'v1.AiSettingsChanged': ({ cellId, provider, model, settings }) =>
    tables.cells.update({
      aiProvider: provider,
      aiModel: model,
      aiSettings: settings,
    }).where({ id: cellId }),
})

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })
