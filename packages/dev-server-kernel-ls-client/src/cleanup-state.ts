// Utility script to clean up stuck execution states in the LiveStore
// Handles both legacy cell states and new execution queue system
// Run this when cells are stuck in "running" or "pending" state

import { makeAdapter } from "@livestore/adapter-node";
import { createStorePromise, queryDb } from "@livestore/livestore";
import { makeCfSync } from "@livestore/sync-cf";

// Import the same schema used by the web client
import { events, schema, tables } from "@anode/schema";

const NOTEBOOK_ID = process.env.NOTEBOOK_ID ?? "my-notebook";
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "insecure-token-change-me";
const SYNC_URL = process.env.LIVESTORE_SYNC_URL ?? "ws://localhost:8787";

console.log(`🧹 Cleaning up execution states for notebook store '${NOTEBOOK_ID}'`);
console.log(`🔧 This includes both legacy cell states and execution queue system`);

const adapter = makeAdapter({
  storage: { type: "fs", baseDirectory: "./tmp" },
  sync: {
    backend: makeCfSync({ url: SYNC_URL }),
    onSyncError: "shutdown",
  },
});

const store = await createStorePromise({
  adapter,
  schema,
  storeId: NOTEBOOK_ID,
  syncPayload: { authToken: AUTH_TOKEN, cleanup: true },
});

console.log("✅ Store connected. Analyzing current state...");

// Check current cell state (legacy system)
const allCells = store.query(tables.cells);
const stuckCells = allCells.filter(cell =>
  cell.executionState === 'running' ||
  cell.executionState === 'pending'
);

// Check execution queue state
const allExecutions = store.query(tables.executions);
const stuckExecutions = allExecutions.filter(execution =>
  execution.status === 'claimed' ||
  execution.status === 'running'
);

// Check kernel states
const allKernels = store.query(tables.kernels);
const deadKernels = allKernels.filter(kernel => {
  const now = new Date();
  const timeSinceHeartbeat = now.getTime() - kernel.lastHeartbeat.getTime();
  return kernel.status === 'active' && timeSinceHeartbeat > 2 * 60 * 1000; // 2 minutes
});

console.log(`📊 Current state analysis:`);
console.log(`   - Total cells: ${allCells.length}`);
console.log(`   - Stuck cells: ${stuckCells.length}`);
console.log(`   - Total executions: ${allExecutions.length}`);
console.log(`   - Stuck executions: ${stuckExecutions.length}`);
console.log(`   - Total kernels: ${allKernels.length}`);
console.log(`   - Dead kernels: ${deadKernels.length}`);

let totalFixed = 0;

// 1. Clean up dead kernels first
if (deadKernels.length > 0) {
  console.log("\n🔧 Fixing dead kernels:");

  for (const kernel of deadKernels) {
    console.log(`   - Kernel ${kernel.id}: marking as dead`);

    try {
      store.commit(events.kernelTimeout({
        kernelId: kernel.id,
        timeoutAt: new Date(),
        lastHeartbeat: kernel.lastHeartbeat,
      }));

      totalFixed++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Failed to mark kernel ${kernel.id} as dead:`, error);
    }
  }
}

// 2. Clean up stuck executions
if (stuckExecutions.length > 0) {
  console.log("\n🔧 Fixing stuck executions:");

  for (const execution of stuckExecutions) {
    console.log(`   - Execution ${execution.id}: ${execution.status} -> timeout`);

    try {
      store.commit(events.executionTimeout({
        executionId: execution.id,
        kernelId: execution.claimedBy || 'unknown',
        timeoutAt: new Date(),
      }));

      totalFixed++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Failed to timeout execution ${execution.id}:`, error);
    }
  }
}

// 3. Clean up stuck cells (legacy system)
if (stuckCells.length > 0) {
  console.log("\n🔧 Fixing stuck cells (legacy):");

  for (const cell of stuckCells) {
    console.log(`   - Cell ${cell.id}: ${cell.executionState} -> completed`);

    try {
      // Reset to completed state and mark as error since execution was interrupted
      store.commit(events.cellExecutionCompleted({
        cellId: cell.id,
        executionCount: cell.executionCount || 0,
        completedAt: new Date(),
        status: "error", // Mark as error since execution was interrupted
      }));

      totalFixed++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Failed to reset cell ${cell.id}:`, error);
    }
  }
}

if (totalFixed === 0) {
  console.log("🎉 No stuck states found! Everything is clean.");
} else {
  console.log(`✅ Fixed ${totalFixed} stuck states`);
}

// Give more time for sync and verify cleanup worked
await new Promise(resolve => setTimeout(resolve, 3000));

console.log("\n🔍 Verification:");

// Verify cells
const remainingStuckCells = store.query(tables.cells).filter(cell =>
  cell.executionState === 'running' ||
  cell.executionState === 'pending'
);

// Verify executions
const remainingStuckExecutions = store.query(tables.executions).filter(execution =>
  execution.status === 'claimed' ||
  execution.status === 'running'
);

// Verify kernels
const remainingDeadKernels = store.query(tables.kernels).filter(kernel => {
  const now = new Date();
  const timeSinceHeartbeat = now.getTime() - kernel.lastHeartbeat.getTime();
  return kernel.status === 'active' && timeSinceHeartbeat > 2 * 60 * 1000;
});

const totalRemaining = remainingStuckCells.length + remainingStuckExecutions.length + remainingDeadKernels.length;

if (totalRemaining > 0) {
  console.log(`⚠️ Warning: ${totalRemaining} items still stuck after cleanup:`);
  if (remainingStuckCells.length > 0) {
    console.log(`   - ${remainingStuckCells.length} stuck cells`);
  }
  if (remainingStuckExecutions.length > 0) {
    console.log(`   - ${remainingStuckExecutions.length} stuck executions`);
  }
  if (remainingDeadKernels.length > 0) {
    console.log(`   - ${remainingDeadKernels.length} dead kernels`);
  }
  console.log("💡 You may need to run this script again or check for sync issues.");
} else {
  console.log("✅ Verification passed: All states are clean!");
}

console.log("🧹 Cleanup complete!");
await store.shutdown();
process.exit(0);
