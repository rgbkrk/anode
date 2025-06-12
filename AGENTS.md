# Anode: Real-Time Collaborative Notebook System

Anode is a notebook system built on [LiveStore](https://livestore.dev) - an event-sourcing framework for real-time synchronization. This is an active development project exploring collaborative notebook computing.

## Current State

This project is **in active development**. Core functionality exists but many features are experimental or incomplete.

### What Works
- **Basic notebook interface** - Create cells, edit content
- **Python code execution** - Via Pyodide in browser-compatible runtime
- **Real-time sync** - Multiple users can collaborate via LiveStore
- **Execution queue system** - Robust kernel management with fault tolerance
- **Cell types** - Code, Markdown (SQL and AI cells are UI mockups)

### What's Experimental/Incomplete
- SQL cell execution (UI exists, backend integration needed)
- AI assistant cells (UI exists, AI integration needed)
- Authentication and authorization
- Production deployment setup
- Performance optimization
- Mobile responsiveness

## Architecture

### Core Components
- **Web Client** (`packages/web-client/`) - React-based notebook interface
- **Sync Backend** (`packages/docworker/`) - Cloudflare Workers-based LiveStore sync
- **Kernel Service** (`packages/dev-server-kernel-ls-client/`) - Python execution with queue management
- **Schema** (`packages/schema/`) - Shared event definitions and data models

### Key Technologies
- **LiveStore** - Event-sourcing framework for sync
- **Pyodide** - Python runtime in browser/Node.js
- **React** - Web interface
- **Cloudflare Workers** - Sync backend
- **SQLite** - Local reactive database

## Getting Started

### Prerequisites
- Node.js 23+
- pnpm (recommended)

### Quick Start
```bash
# Clean start
pnpm clean-store

# Install dependencies
pnpm install

# Start core services
pnpm dev

# Start Python kernel (separate terminal)
NOTEBOOK_ID=my-notebook pnpm dev:kernel

# Monitor system health (separate terminal)
pnpm monitor-queue
```

Open http://localhost:5173

## Key Commands

```bash
# Development
pnpm dev                # Start web client + sync backend
pnpm dev:kernel         # Start Python execution kernel
pnpm dev:web-only       # Web client only
pnpm dev:sync-only      # Sync backend only

# Monitoring & Maintenance
pnpm monitor-queue      # Real-time execution queue dashboard
pnpm cleanup-queue      # Fix stuck executions
pnpm clean-store        # Complete storage reset
```

## Execution Queue System

One of the main innovations is a robust execution queue that replaces traditional Jupyter-style kernel architectures:

- **Kernel registration** - Multiple kernels can serve the same notebook
- **Atomic execution claiming** - Prevents race conditions
- **Heartbeat monitoring** - Detects dead kernels
- **Automatic failover** - Other kernels take over abandoned work
- **Timeout handling** - Stuck executions are detected and cleaned up

See [docs/execution-queue.md](docs/execution-queue.md) for details.

## Event-Sourcing Architecture

All changes are captured as immutable events via LiveStore:

```typescript
// User creates a cell
events.cellCreated({
  id: 'cell-123',
  notebookId: 'notebook-456',
  cellType: 'code',
  position: 1.0
})

// User executes code
events.executionQueued({
  id: 'exec-cell-123-1',
  cellId: 'cell-123',
  executionCount: 1
})
```

This provides:
- Real-time collaboration
- Offline support
- Audit trail
- Conflict resolution

## Project Structure

```
anode/
├── packages/
│   ├── schema/                     # Event definitions, shared types
│   ├── web-client/                 # React notebook interface
│   ├── docworker/                  # Cloudflare Workers sync backend
│   └── dev-server-kernel-ls-client/   # Python execution kernel
├── docs/                           # Documentation
├── scripts/                        # Utility scripts
└── ROADMAP.md                      # Future plans and known issues
```

## Development Notes

### Current Limitations
- **Single notebook focus** - Multi-notebook support needs work
- **Development-only auth** - Uses hardcoded tokens
- **Limited Python packages** - Pyodide package ecosystem constraints
- **No persistence guarantees** - Data can be lost during development
- **Performance not optimized** - No benchmarking or optimization yet

### Known Issues
- Memory leaks in long-running kernels
- Occasional sync conflicts during rapid editing
- Cell execution order not guaranteed under high concurrency
- No graceful handling of network disconnections

## Documentation

- [Quick Start](docs/quick-start.md) - Get running quickly
- [Development Setup](docs/development-setup.md) - Complete dev environment
- [Execution Queue](docs/execution-queue.md) - Code execution system
- [Troubleshooting](docs/troubleshooting.md) - Common issues
- [ROADMAP.md](ROADMAP.md) - Future plans and known gaps

## Contributing

This is an experimental project. Contributions welcome but expect:
- Frequent breaking changes
- Incomplete features
- Shifting priorities
- Documentation that may lag behind code

For current development priorities, see [ROADMAP.md](ROADMAP.md).

Please use GitHub Issues for bug reports, feature requests, and questions.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Status**: Active development | **Stability**: Experimental | **Production Ready**: No
