import { Store, queryDb } from '@livestore/livestore';
import { events, tables } from '@anode/schema';
import { PyodideKernel } from './pyodide-kernel.js';

export interface KernelManagerConfig {
  heartbeatInterval?: number; // ms, default 30s
  executionTimeout?: number; // ms, default 5 minutes
  claimBatchSize?: number; // max executions to claim at once, default 5
  notebookId?: string; // optional notebook ID
}

export class KernelManager {
  private readonly store: Store<any, any>;
  private readonly config: KernelManagerConfig;
  private readonly kernelId: string;
  private readonly kernel: PyodideKernel;

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private timeoutCheckTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private activeExecutions = new Map<string, {
    startedAt: Date;
    lastProgress: Date;
  }>();

  constructor(store: Store<any, any>, config: KernelManagerConfig) {
    this.store = store;
    this.config = {
      heartbeatInterval: 30_000, // 30 seconds
      executionTimeout: 5 * 60 * 1000, // 5 minutes
      claimBatchSize: 5,
      ...config,
    };
    this.kernelId = `kernel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.kernel = new PyodideKernel(config.notebookId || 'default');
  }

  async initialize(): Promise<void> {
    console.log(`🎯 Initializing KernelManager ${this.kernelId} for notebook ${this.config.notebookId || 'default'}`);

    // Initialize the Python kernel
    await this.kernel.initialize();

    // Register this kernel
    await this.registerKernel();

    // Start heartbeat
    this.startHeartbeat();

    // Start monitoring for executions to claim
    this.startExecutionMonitoring();

    // Start timeout checking
    this.startTimeoutMonitoring();

    console.log(`✅ KernelManager ${this.kernelId} ready`);
  }

  private async registerKernel(): Promise<void> {
    const now = new Date();

    this.store.commit(events.kernelRegistered({
      id: this.kernelId,
      notebookId: 'any', // This kernel can handle any notebook in the store
      registeredAt: now,
      capabilities: {
        language: 'python',
        version: '3.11',
        features: ['execute', 'interrupt'],
      },
      metadata: {
        nodeVersion: process.version,
      },
    }));
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        this.store.commit(events.kernelHeartbeat({
          kernelId: this.kernelId,
          timestamp: new Date(),
          status: 'active',
        }));
      }
    }, this.config.heartbeatInterval!);
  }

  private startExecutionMonitoring(): void {
    // Subscribe to queued executions for any notebook in this store
    const queuedExecutions$ = queryDb(
      tables.executions.where({
        status: 'queued',
      }).orderBy('createdAt', 'asc')
    );
    this.store.subscribe(queuedExecutions$, {
        onUpdate: async (executionsRaw: any) => {
          const executions = executionsRaw as typeof tables.executions.Type[];
          console.debug('[KernelManager] onUpdate for queuedExecutions$', executions);
          if (this.isShuttingDown || executions.length === 0) return;

          // Process all executions in this store
          const relevantExecutions = executions.filter((exec: typeof tables.executions.Type) => {
            const cellResults = this.store.query(tables.cells.where({ id: exec.cellId }).limit(1)) as any[];
            const cell = cellResults[0] as typeof tables.cells.Type | undefined;
            if (!cell) {
              console.debug(`[KernelManager] Skipping execution ${exec.id} - cell ${exec.cellId} not found`);
              return false;
            }
            console.debug(`[KernelManager] Found execution ${exec.id} for cell ${exec.cellId} in notebook ${cell.notebookId}`);
            return true;
          });

        if (relevantExecutions.length === 0) {
          console.debug('[KernelManager] No relevant executions to claim.');
          return;
        }

        // Claim executions up to our batch size
        const toClaim = relevantExecutions.slice(0, this.config.claimBatchSize!);
        console.debug(`[KernelManager] Claiming up to ${toClaim.length} executions:`, toClaim.map(e => e.id));

        for (const execution of toClaim) {
          await this.claimExecution(execution.id);
        }
      }
    });

    // Subscribe to executions claimed by this kernel
    const claimedExecutions$ = queryDb(
      tables.executions.where({
        claimedBy: this.kernelId,
        status: 'claimed',
      })
    );
    this.store.subscribe(claimedExecutions$, {
      onUpdate: async (executionsRaw: any) => {
        const executions = executionsRaw as typeof tables.executions.Type[];
        console.debug('[KernelManager] onUpdate for claimedExecutions$', executions);
        for (const execution of executions) {
          await this.executeCell(execution);
        }
      }
    });
  }

  private startTimeoutMonitoring(): void {
    this.timeoutCheckTimer = setInterval(() => {
      this.checkForTimeouts();
    }, 30_000); // Check every 30 seconds
  }

  private async claimExecution(executionId: string): Promise<void> {
    try {
      this.store.commit(events.executionClaimed({
        executionId,
        kernelId: this.kernelId,
        claimedAt: new Date(),
      }));

      console.log(`📋 Claimed execution ${executionId}`);
    } catch (error) {
      console.error(`❌ Failed to claim execution ${executionId}:`, error);
    }
  }

  private async executeCell(execution: any): Promise<void> {
    const { id: executionId, cellId } = execution;

    try {
      // Get the cell
      const cellResults = this.store.query(tables.cells.where({ id: cellId }).limit(1)) as any[];
      const cell = cellResults[0];
      if (!cell) {
        throw new Error(`Cell ${cellId} not found`);
      }

      console.log(`⚡ Starting execution ${executionId} for cell ${cellId}`);

      // Track this execution
      const now = new Date();
      this.activeExecutions.set(executionId, {
        startedAt: now,
        lastProgress: now,
      });

      // Mark as started
      this.store.commit(events.cellExecutionStarted({
        cellId,
        executionCount: execution.executionCount,
        startedAt: now,
      }));

      // Clear previous outputs
      this.store.commit(events.cellOutputsCleared({
        cellId,
        clearedBy: this.kernelId,
      }));

      // Execute the code
      const outputs = await this.kernel.execute(cell.source ?? "");

      // Emit outputs
      outputs.forEach((output, idx) => {
        this.store.commit(events.cellOutputAdded({
          id: crypto.randomUUID(),
          cellId,
          outputType: output.type as any,
          data: output.data,
          position: idx,
          createdAt: new Date(),
        }));
      });

      // Mark as completed
      const status = outputs.some((o) => o.type === "error") ? "error" : "success";
      const completedAt = new Date();

      this.store.commit(events.cellExecutionCompleted({
        cellId,
        executionCount: execution.executionCount,
        completedAt,
        status,
      }));

      // Clean up tracking
      this.activeExecutions.delete(executionId);

      console.log(`✅ Completed execution ${executionId} (${status}) - ${outputs.length} outputs`);

    } catch (error) {
      console.error(`❌ Error executing ${executionId}:`, error);

      // Mark as failed
      this.store.commit(events.cellExecutionCompleted({
        cellId,
        executionCount: execution.executionCount,
        completedAt: new Date(),
        status: "error",
      }));

      // Add error output
      this.store.commit(events.cellOutputAdded({
        id: crypto.randomUUID(),
        cellId,
        outputType: 'error',
        data: {
          ename: 'KernelError',
          evalue: error instanceof Error ? error.message : 'Unknown execution error',
          traceback: [error instanceof Error ? error.stack || '' : ''],
        },
        position: 0,
        createdAt: new Date(),
      }));

      // Clean up tracking
      this.activeExecutions.delete(executionId);
    }
  }

  private reportProgress(executionId: string): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    const now = new Date();
    execution.lastProgress = now;

    this.store.commit(events.executionProgress({
      executionId,
      kernelId: this.kernelId,
      progressAt: now,
    }));
  }

  private checkForTimeouts(): void {
    const now = new Date();
    const timeoutThreshold = this.config.executionTimeout!;

    for (const [executionId, execution] of this.activeExecutions) {
      const timeSinceStart = now.getTime() - execution.startedAt.getTime();

      if (timeSinceStart > timeoutThreshold) {
        console.warn(`⏰ Execution ${executionId} timed out after ${timeSinceStart}ms`);

        this.store.commit(events.executionTimeout({
          executionId,
          kernelId: this.kernelId,
          timeoutAt: now,
        }));

        this.activeExecutions.delete(executionId);
      } else {
        // Report progress for long-running executions
        const timeSinceProgress = now.getTime() - execution.lastProgress.getTime();
        if (timeSinceProgress > 30_000) { // 30 seconds
          this.reportProgress(executionId);
        }
      }
    }

    // Also check for dead kernels and release their executions
    this.checkForDeadKernels();
  }

  private checkForDeadKernels(): void {
    const now = new Date();
    const kernels = this.store.query(tables.kernels.where({
      status: 'active',
    })) as any[];

    for (const kernel of kernels) {
      const timeSinceHeartbeat = now.getTime() - kernel.lastHeartbeat.getTime();

      // Consider kernel dead after 2 minutes without heartbeat
      if (timeSinceHeartbeat > 2 * 60 * 1000) {
        console.warn(`💀 Kernel ${kernel.id} appears dead (last heartbeat: ${kernel.lastHeartbeat})`);

        this.store.commit(events.kernelTimeout({
          kernelId: kernel.id,
          timeoutAt: now,
          lastHeartbeat: kernel.lastHeartbeat,
        }));
      }
    }
  }

  async shutdown(): Promise<void> {
    console.log(`🛑 Shutting down KernelManager ${this.kernelId}`);
    this.isShuttingDown = true;

    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.timeoutCheckTimer) {
      clearInterval(this.timeoutCheckTimer);
      this.timeoutCheckTimer = null;
    }

    // Send final heartbeat with shutting_down status
    this.store.commit(events.kernelHeartbeat({
      kernelId: this.kernelId,
      timestamp: new Date(),
      status: 'shutting_down',
    }));

    // Release any claimed executions
    const claimedExecutions = this.store.query(
      tables.executions.where({
        claimedBy: this.kernelId,
        status: 'claimed',
      })
    ) as any[];

    for (const execution of claimedExecutions) {
      this.store.commit(events.executionReleased({
        executionId: execution.id,
        kernelId: this.kernelId,
        releasedAt: new Date(),
        reason: 'kernel_shutdown',
      }));
    }

    // Mark kernel as shut down
    this.store.commit(events.kernelShutdown({
      kernelId: this.kernelId,
      shutdownAt: new Date(),
      reason: 'graceful_shutdown',
    }));

    // Terminate the Python kernel
    await this.kernel.terminate();

    console.log(`✅ KernelManager ${this.kernelId} shutdown complete`);
  }

  // Public API for monitoring
  getKernelId(): string {
    return this.kernelId;
  }

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  isActive(): boolean {
    return !this.isShuttingDown;
  }
}
