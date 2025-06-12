// LiveStore <-> Pyodide kernel adapter using proper execution queue management.
// Runs as a standalone process and uses KernelManager to handle execution ownership,
// timeouts, and graceful handover between multiple kernel instances.

import { makeAdapter } from "@livestore/adapter-node";
import { createStorePromise } from "@livestore/livestore";
import { makeCfSync } from "@livestore/sync-cf";

// Import the same schema used by the web client so we share events/tables.
import { events, schema, tables } from "@anode/schema";
import { KernelManager } from "./kernel-manager.js";

const STORE_ID = process.env.STORE_ID ?? "test-store";
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "insecure-token-change-me";
const SYNC_URL = process.env.LIVESTORE_SYNC_URL ?? "ws://localhost:8787";

console.log(
  `🔗 Starting kernel adapter for store '${STORE_ID}' (sync: ${SYNC_URL})`,
);
console.log(`📝 Store ID will be: ${STORE_ID}`);
console.log(`🔑 Auth token: ${AUTH_TOKEN}`);

const adapter = makeAdapter({
  storage: { type: "fs", baseDirectory: "./tmp" },
  sync: {
    backend: makeCfSync({ url: SYNC_URL }),
    onSyncError: "shutdown",
  },
});

console.log(`🏪 Creating store with storeId: ${STORE_ID}...`);
const store = await createStorePromise({
  adapter,
  schema,
  storeId: STORE_ID,
  syncPayload: { authToken: AUTH_TOKEN },
});
console.log(`✅ Store created successfully`);

// Initialize the new kernel manager
const kernelManager = new KernelManager(store, {
  heartbeatInterval: 30_000, // 30 seconds
  executionTimeout: 5 * 60 * 1000, // 5 minutes
  claimBatchSize: 3, // Process up to 3 executions concurrently
});

await kernelManager.initialize();

console.log("✅ Kernel manager ready.");

// Debug: Check what's in the store initially
const allNotebooks = store.query(tables.notebooks) as typeof tables.notebooks.Type[];
const allCells = store.query(tables.cells) as typeof tables.cells.Type[];
const allKernels = store.query(tables.kernels) as typeof tables.kernels.Type[];
const allExecutions = store.query(tables.executions) as typeof tables.executions.Type[];

console.log(`📊 Initial store state:`);
console.log(`   - Notebooks: ${allNotebooks.length}`);
console.log(`   - Cells: ${allCells.length}`);
console.log(`   - Kernels: ${allKernels.length}`);
console.log(`   - Executions: ${allExecutions.length}`);

const activeKernels = allKernels.filter(k => k.status === 'active').length;
console.log(`   - Active kernels: ${activeKernels}`);

console.log(`📚 Found ${allNotebooks.length} notebooks in store. Kernel will process executions for any notebook.`);
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
