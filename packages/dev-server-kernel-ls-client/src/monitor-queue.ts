// Execution queue monitoring script
// Shows real-time status of kernels, executions, and system health

import { makeAdapter } from "@livestore/adapter-node";
import { createStorePromise } from "@livestore/livestore";
import { makeCfSync } from "@livestore/sync-cf";

// Import the same schema used by the web client
import { events, schema, tables } from "@anode/schema";

const NOTEBOOK_ID = process.env.NOTEBOOK_ID ?? "demo-notebook";
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "insecure-token-change-me";
const SYNC_URL = process.env.LIVESTORE_SYNC_URL ?? "ws://localhost:8787";
const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || "5000"); // 5 seconds

console.log(`📊 Monitoring execution queue for notebook '${NOTEBOOK_ID}'`);
console.log(`🔄 Refresh interval: ${REFRESH_INTERVAL}ms`);

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
  syncPayload: { authToken: AUTH_TOKEN, monitor: true },
});

console.log("✅ Store connected. Starting monitoring...\n");

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return colors.green;
    case 'queued': return colors.blue;
    case 'claimed': return colors.yellow;
    case 'running': return colors.magenta;
    case 'completed': return colors.green;
    case 'failed': case 'error': return colors.red;
    case 'timeout': return colors.red;
    case 'dead': return colors.red;
    default: return colors.white;
  }
}

function clearScreen() {
  console.clear();
}

function printStatus() {
  const now = new Date();

  // Clear screen and show header
  clearScreen();
  console.log(`${colors.bright}${colors.cyan}📊 Execution Queue Monitor${colors.reset}`);
  console.log(`${colors.dim}Last updated: ${formatTime(now)} | Notebook: ${NOTEBOOK_ID}${colors.reset}\n`);

  // Get current data
  const kernels = store.query(tables.kernels.where({ notebookId: NOTEBOOK_ID }));
  const executions = store.query(tables.executions);
  const cells = store.query(tables.cells.where({ notebookId: NOTEBOOK_ID }));

  // Calculate relevant executions (for this notebook)
  const relevantExecutions = executions.filter(exec => {
    const cell = cells.find(c => c.id === exec.cellId);
    return cell?.notebookId === NOTEBOOK_ID;
  });

  // Kernel status
  console.log(`${colors.bright}🔧 Kernels (${kernels.length})${colors.reset}`);
  if (kernels.length === 0) {
    console.log(`${colors.dim}   No kernels registered${colors.reset}`);
  } else {
    kernels.forEach(kernel => {
      const timeSinceHeartbeat = now.getTime() - kernel.lastHeartbeat.getTime();
      const statusColor = getStatusColor(kernel.status);
      const isStale = timeSinceHeartbeat > 60000; // 1 minute

      console.log(`   ${statusColor}●${colors.reset} ${kernel.id}`);
      console.log(`     Status: ${statusColor}${kernel.status}${colors.reset}`);
      console.log(`     Last heartbeat: ${formatTime(kernel.lastHeartbeat)} ${isStale ? colors.red + '(STALE)' + colors.reset : ''}`);
      console.log(`     Registered: ${formatTime(kernel.registeredAt)}`);

      if (kernel.capabilities) {
        console.log(`     Capabilities: ${JSON.stringify(kernel.capabilities)}`);
      }
    });
  }

  console.log();

  // Execution queue status
  const queuedExecutions = relevantExecutions.filter(e => e.status === 'queued');
  const claimedExecutions = relevantExecutions.filter(e => e.status === 'claimed');
  const runningExecutions = relevantExecutions.filter(e => e.status === 'running');
  const recentCompletedExecutions = relevantExecutions.filter(e =>
    (e.status === 'completed' || e.status === 'failed') &&
    e.completedAt &&
    (now.getTime() - e.completedAt.getTime()) < 30000 // Last 30 seconds
  );

  console.log(`${colors.bright}⚡ Execution Queue${colors.reset}`);
  console.log(`   ${colors.blue}Queued: ${queuedExecutions.length}${colors.reset}`);
  console.log(`   ${colors.yellow}Claimed: ${claimedExecutions.length}${colors.reset}`);
  console.log(`   ${colors.magenta}Running: ${runningExecutions.length}${colors.reset}`);
  console.log(`   ${colors.green}Recently completed: ${recentCompletedExecutions.length}${colors.reset}`);

  console.log();

  // Active executions detail
  if (runningExecutions.length > 0) {
    console.log(`${colors.bright}🔄 Running Executions${colors.reset}`);
    runningExecutions.forEach(exec => {
      const runtime = exec.startedAt ? now.getTime() - exec.startedAt.getTime() : 0;
      const lastProgress = exec.lastProgress ? now.getTime() - exec.lastProgress.getTime() : runtime;

      console.log(`   ${colors.magenta}●${colors.reset} ${exec.id}`);
      console.log(`     Cell: ${exec.cellId}`);
      console.log(`     Kernel: ${exec.claimedBy}`);
      console.log(`     Runtime: ${formatDuration(runtime)}`);
      console.log(`     Last progress: ${formatDuration(lastProgress)} ago`);

      if (exec.timeoutAfter && now > exec.timeoutAfter) {
        console.log(`     ${colors.red}⚠️ TIMEOUT EXCEEDED${colors.reset}`);
      }
    });
    console.log();
  }

  // Queued executions
  if (queuedExecutions.length > 0) {
    console.log(`${colors.bright}📋 Queued Executions${colors.reset}`);
    queuedExecutions.slice(0, 5).forEach(exec => { // Show first 5
      const waitTime = now.getTime() - exec.createdAt.getTime();
      console.log(`   ${colors.blue}●${colors.reset} ${exec.id}`);
      console.log(`     Cell: ${exec.cellId}`);
      console.log(`     Waiting: ${formatDuration(waitTime)}`);
      console.log(`     Requested by: ${exec.requestedBy}`);
    });

    if (queuedExecutions.length > 5) {
      console.log(`   ${colors.dim}... and ${queuedExecutions.length - 5} more${colors.reset}`);
    }
    console.log();
  }

  // Recent activity
  if (recentCompletedExecutions.length > 0) {
    console.log(`${colors.bright}✅ Recently Completed${colors.reset}`);
    recentCompletedExecutions.slice(0, 3).forEach(exec => {
      const completedAgo = exec.completedAt ? now.getTime() - exec.completedAt.getTime() : 0;
      const statusColor = getStatusColor(exec.status);
      const runtime = exec.startedAt && exec.completedAt ?
        exec.completedAt.getTime() - exec.startedAt.getTime() : 0;

      console.log(`   ${statusColor}●${colors.reset} ${exec.id}`);
      console.log(`     Status: ${statusColor}${exec.status}${colors.reset}`);
      console.log(`     Runtime: ${formatDuration(runtime)}`);
      console.log(`     Completed: ${formatDuration(completedAgo)} ago`);
    });
    console.log();
  }

  // System health warnings
  const warnings = [];

  // Check for dead kernels
  const deadKernels = kernels.filter(k => {
    const timeSinceHeartbeat = now.getTime() - k.lastHeartbeat.getTime();
    return k.status === 'active' && timeSinceHeartbeat > 2 * 60 * 1000; // 2 minutes
  });

  if (deadKernels.length > 0) {
    warnings.push(`${deadKernels.length} kernel(s) appear dead`);
  }

  // Check for stuck executions
  const stuckExecutions = runningExecutions.filter(exec => {
    const runtime = exec.startedAt ? now.getTime() - exec.startedAt.getTime() : 0;
    return runtime > 5 * 60 * 1000; // 5 minutes
  });

  if (stuckExecutions.length > 0) {
    warnings.push(`${stuckExecutions.length} execution(s) running > 5 minutes`);
  }

  // Check for old queued executions
  const oldQueuedExecutions = queuedExecutions.filter(exec => {
    const waitTime = now.getTime() - exec.createdAt.getTime();
    return waitTime > 2 * 60 * 1000; // 2 minutes
  });

  if (oldQueuedExecutions.length > 0) {
    warnings.push(`${oldQueuedExecutions.length} execution(s) queued > 2 minutes`);
  }

  if (warnings.length > 0) {
    console.log(`${colors.bright}${colors.red}⚠️ Health Warnings${colors.reset}`);
    warnings.forEach(warning => {
      console.log(`   ${colors.red}• ${warning}${colors.reset}`);
    });
    console.log();
  }

  // Footer
  console.log(`${colors.dim}Press Ctrl+C to stop monitoring${colors.reset}`);
}

// Initial display
printStatus();

// Set up refresh timer
const refreshTimer = setInterval(printStatus, REFRESH_INTERVAL);

// Graceful shutdown
let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n🛑 Shutting down monitor...");
  clearInterval(refreshTimer);
  await store.shutdown?.();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep process alive
while (!isShuttingDown) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
