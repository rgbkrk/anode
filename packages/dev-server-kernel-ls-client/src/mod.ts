// LiveStore <-> Pyodide kernel adapter using proper execution queue management.
// Runs as a standalone process and uses KernelManager to handle execution ownership,
// timeouts, and graceful handover between multiple kernel instances.

import { makeAdapter } from "@livestore/adapter-node";
import { createStorePromise } from "@livestore/livestore";
import { makeCfSync } from "@livestore/sync-cf";

// Import the same schema used by the web client so we share events/tables.
import { events, schema, tables } from "@anode/schema";
import { KernelManager } from "./kernel-manager.js";

const NOTEBOOK_ID = process.env.NOTEBOOK_ID ?? "demo-notebook";
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "insecure-token-change-me";
const SYNC_URL = process.env.LIVESTORE_SYNC_URL ?? "ws://localhost:8787";

console.log(
  `🔗 Starting kernel adapter for notebook '${NOTEBOOK_ID}' (sync: ${SYNC_URL})`,
);
console.log(`📝 Store ID will be: ${NOTEBOOK_ID}`);
console.log(`🔑 Auth token: ${AUTH_TOKEN}`);

const adapter = makeAdapter({
  storage: { type: "fs", baseDirectory: "./tmp" },
  sync: {
    backend: makeCfSync({ url: SYNC_URL }),
    onSyncError: "shutdown",
  },
});

console.log(`🏪 Creating store with storeId: ${NOTEBOOK_ID}...`);
const store = await createStorePromise({
  adapter,
  schema,
  storeId: NOTEBOOK_ID,
  syncPayload: { authToken: AUTH_TOKEN, kernel: true },
});
console.log(`✅ Store created successfully`);

// Initialize the new kernel manager
const kernelManager = new KernelManager(store, {
  notebookId: NOTEBOOK_ID,
  heartbeatInterval: 30_000, // 30 seconds
  executionTimeout: 5 * 60 * 1000, // 5 minutes
  claimBatchSize: 3, // Process up to 3 executions concurrently
});

await kernelManager.initialize();

console.log("✅ Kernel manager ready. Setting up legacy event compatibility...");

// For backward compatibility, still listen to legacy cellExecutionRequested events
// and convert them to the new execution queue system
const legacyExecutionRequests$ = store.query(
  tables.cells.where({
    executionState: 'pending'
  }).orderBy('executionCount', 'desc')
);

store.subscribe(legacyExecutionRequests$, {
  onUpdate: async (cells) => {
    if (cells.length === 0) return;

    console.log(`🔄 Processing ${cells.length} legacy execution requests`);

    for (const cell of cells) {
      if (!cell.executionCount) continue;

      // Check if we already have an execution queue entry for this
      const existingExecution = store.query(
        tables.executions.where({
          cellId: cell.id,
          executionCount: cell.executionCount,
        }).limit(1)
      )[0];

      if (existingExecution) {
        console.log(`⏭️ Execution already queued: ${cell.id}#${cell.executionCount}`);
        continue;
      }

      // Create execution queue entry
      const executionId = `exec-${cell.id}-${cell.executionCount}`;
      const now = new Date();

      console.log(`📥 Queueing legacy execution: ${executionId}`);

      store.commit(events.executionQueued({
        id: executionId,
        cellId: cell.id,
        executionCount: cell.executionCount,
        requestedBy: 'legacy-system',
        queuedAt: now,
        timeoutAfter: new Date(now.getTime() + 5 * 60 * 1000), // 5 minute timeout
      }));
    }
  }
});

// Debug: Check what's in the store initially
const allNotebooks = store.query(tables.notebooks);
const allCells = store.query(tables.cells);
const allKernels = store.query(tables.kernels);
const allExecutions = store.query(tables.executions);

console.log(`📊 Initial store state:`);
console.log(`   - Notebooks: ${allNotebooks.length}`);
console.log(`   - Cells: ${allCells.length}`);
console.log(`   - Kernels: ${allKernels.length}`);
console.log(`   - Executions: ${allExecutions.length}`);

if (allNotebooks.length > 0) {
  console.log(`   - Notebook IDs: ${allNotebooks.map(n => n.id).join(', ')}`);
}
if (allCells.length > 0) {
  console.log(`   - Cell IDs: ${allCells.map(c => c.id).join(', ')}`);
  console.log(`   - Cell notebook IDs: ${allCells.map(c => c.notebookId).join(', ')}`);
}
if (allKernels.length > 0) {
  console.log(`   - Active kernels: ${allKernels.filter(k => k.status === 'active').length}`);
}
if (allExecutions.length > 0) {
  console.log(`   - Queued executions: ${allExecutions.filter(e => e.status === 'queued').length}`);
  console.log(`   - Running executions: ${allExecutions.filter(e => e.status === 'running').length}`);
}

// Graceful shutdown
let running = true;
const shutdown = async () => {
  if (!running) return;
  running = false;
  console.log("🛑 Shutting down kernel adapter…");

  // Shutdown kernel manager first (this will release claimed executions)
  await kernelManager.shutdown();

  // Then shutdown store
  await store.shutdown?.();

  process.exit(0);
};

// Add signal listeners for graceful shutdown
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Monitor kernel health
setInterval(() => {
  if (kernelManager.isActive()) {
    const activeExecutions = kernelManager.getActiveExecutions();
    if (activeExecutions.length > 0) {
      console.log(`🔄 Kernel ${kernelManager.getKernelId()} processing ${activeExecutions.length} executions`);
    }
  }
}, 60_000); // Log status every minute

console.log("🎉 Kernel adapter operational with execution queue management.");
console.log(`🔧 Kernel ID: ${kernelManager.getKernelId()}`);
console.log("📡 Waiting for execution requests...");
console.log("🔌 Press Ctrl+C to stop");

// Keep process alive
while (running) {
  await new Promise((res) => setTimeout(res, 1000));
}
