# Anode

A real-time collaborative notebook system built on LiveStore, focusing on seamless AI ↔ Python ↔ User interactions.

**Current Status: Early Prototype** - Core collaborative editing and Python execution working, with rich outputs and AI integration in active development.

## What Makes Anode Different

- **Real-time collaboration** built on event sourcing (LiveStore)
- **Local-first architecture** with offline capability and sync when connected
- **Event-sourced notebook state** enabling powerful undo/redo and audit trails
- **Reactive execution architecture** using subscriptions instead of polling
- **Modern TypeScript foundation** with full type safety across the stack
- **Extensible cell types** supporting code, markdown, AI, and SQL (planned)

## Quick Start

### 1. Install and Start Core Services
```bash
pnpm install
echo "VITE_LIVESTORE_SYNC_URL=ws://localhost:8787" > packages/web-client/.env
pnpm dev  # Starts web client + sync backend
```

### 2. Create Your First Notebook
1. Open http://localhost:5173
2. URL automatically gets notebook ID: `?notebook=notebook-123-abc`
3. Start creating cells and editing

### 3. Enable Python Execution
```bash
# In new terminal - use your actual notebook ID from the URL
NOTEBOOK_ID=notebook-123-abc pnpm dev:kernel
```

**Pro tip**: Click the **Kernel** button in the notebook header to copy the exact command for your notebook!

### 4. Execute Code
- Add a code cell in the web interface
- Write Python: `import numpy as np; np.random.random(5)`
- Press **Ctrl+Enter** or click **Run**
- See results appear instantly

## Current Status

### What's Working ✅
- **Real-time collaborative editing** - Multiple users can edit notebooks simultaneously
- **LiveStore event-sourcing** - Robust data synchronization and state management
- **Python execution** - Code cells execute Python via Pyodide (manual kernel startup required)
- **Cell management** - Create, edit, move, and delete code/markdown/AI cells
- **Basic output display** - Text output and error handling
- **Keyboard navigation** - Vim-like cell navigation and shortcuts
- **Offline-first operation** - Works without network, syncs when connected

### In Development 🚧
- **Rich output rendering** - HTML tables, SVG plots, matplotlib integration
- **AI integration** - Real API connections (currently mock responses)
- **Enhanced display system** - Full IPython.display compatibility
- **Automated kernel management** - One-click notebook startup

### Planned 📋
- **SQL cell execution** - Database connections and query results
- **Code completion** - LSP integration and intelligent suggestions
- **Interactive widgets** - Real-time collaborative UI components
- **Performance optimization** - Large notebook handling

### Known Limitations ⚠️
- Manual kernel startup required per notebook (`NOTEBOOK_ID=xyz pnpm dev:kernel`)
- Rich outputs (matplotlib, pandas) not fully verified in integration tests
- AI cells return mock responses only
- Limited error handling for kernel failures

## Development Commands

```bash
# Core development workflow
pnpm dev                                  # Start web + sync
NOTEBOOK_ID=your-notebook-id pnpm dev:kernel  # Start kernel for specific notebook

# Utilities
pnpm reset-storage                        # Clear all local data
```

## Development Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed development plans and milestones.

### Immediate Priorities
1. **Rich Output Verification** - Integration tests for matplotlib, pandas, and display system
2. **Kernel Management** - Automated startup and health monitoring
3. **Error Handling** - Better kernel failure recovery and user feedback

### Next Milestones
- Real AI API integration (in progress on separate branch)
- SQL cell implementation with database connections
- Interactive widget system for collaborative data exploration
- Production deployment and performance optimization

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Schema version mismatches | Ensure all services (web, kernel, sync) are restarted after schema changes |
| Type errors | TypeScript catches invalid queries at compile time - check column names |
| Execution not working | Start kernel with correct `NOTEBOOK_ID` (use copy button in UI) |
| Stale state | Run `pnpm reset-storage` |
| Slow execution | Should be instant - check kernel logs |

## Architecture Highlights

**Event-Sourced State**: All notebook changes flow through LiveStore's event sourcing system, enabling real-time collaboration, undo/redo, and audit trails.

**Direct TypeScript Schema**: The `shared/schema.ts` file is imported directly across all packages with full type inference, eliminating build complexity.

**Reactive Architecture**: Kernels use LiveStore's reactive subscriptions instead of polling for instant work detection.

**Local-First Design**: Everything works offline first, syncs when connected. Your work is never lost.

**Modular Kernel System**: Python execution runs in separate processes that can be started per notebook as needed.

## Documentation

For comprehensive documentation, see the [docs](./docs/) directory:
- **[Display System Guide](./docs/DISPLAY_SYSTEM.md)** - Complete technical documentation
- **[Display Examples](./docs/display-examples.md)** - Practical usage examples
- **[UI Design Guidelines](./docs/UI_DESIGN.md)** - Interface design principles

## Contributing

Anode is an open source project focused on developer experience. Key areas for contribution:
- **Integration testing** - Verify Python execution and rich output rendering
- **Kernel management** - Automated startup and health monitoring
- **Rich output system** - Complete matplotlib, pandas, and IPython.display integration
- **Error handling** - Better user feedback and recovery from failures
- **Performance testing** - Validate claims about execution speed and memory usage

## License

BSD 3-Clause