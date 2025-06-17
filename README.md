# Anode

A real-time collaborative notebook system built on LiveStore, focusing on seamless AI ↔ Python ↔ User interactions.

**Current Status: Working Prototype** - Core collaborative editing, Python execution, and basic AI integration functional. Rich outputs need verification.

## What Makes Anode Different

- **Real-time collaboration** built on event sourcing (LiveStore)
- **Local-first architecture** with offline capability and sync when connected
- **Event-sourced notebook state** enabling powerful undo/redo and audit trails
- **Reactive execution architecture** using subscriptions instead of polling
- **Modern TypeScript foundation** with full type safety across the stack
- **Extensible cell types** supporting code, markdown, AI, and SQL (planned)

## Quick Start

### 1. Install and Configure
```bash
pnpm install
cp .env.example .env
# Optional: Edit .env and uncomment OPENAI_API_KEY if you want real AI responses
pnpm dev  # Starts web client + sync backend
```

### 2. Create Your First Notebook
1. Open http://localhost:5173
2. URL automatically gets notebook ID: `?notebook=notebook-123-abc`
3. Start creating cells and editing

### 3. Enable Python Execution

#### Option A: Node.js Kernel (Default)
```bash
# In new terminal - start kernel for current notebook
# Get the exact command from the UI (see step 4)
pnpm dev:kernel
```

#### Option B: Pyodide on Deno Runtime (Better WASM Support)
```bash
# Start Pyodide kernel using Deno runtime from project root
NOTEBOOK_ID=your-notebook-id pnpm dev:kernel:deno
```

**Important**: Always use the kernel command suggested in the notebook UI for proper notebook ID matching.

### 4. Get Kernel Command from UI
- Open the notebook interface
- Click the **Kernel** button in the notebook header
- Copy the exact `NOTEBOOK_ID=xxx pnpm dev:kernel` command shown
- Run that command in your terminal

### 5. Execute Code
- Add a code cell in the web interface
- Write Python: `import numpy as np; np.random.random(5)`
- Press **Ctrl+Enter** or click **Run**
- See results appear instantly

### 6. Try AI Integration (Optional)
```bash
# Edit .env and uncomment/set your OpenAI API key:
# OPENAI_API_KEY=sk-your-key-here

# Restart kernel to pick up the API key (use UI command)
NOTEBOOK_ID=your-notebook-id pnpm dev:kernel
```
- Add an AI cell and ask questions about your data
- Falls back to mock responses if no API key is set

## Current Status

### What's Working ✅
- **Real-time collaborative editing** - Multiple users can edit notebooks simultaneously
- **LiveStore event-sourcing** - Robust data synchronization and state management
- **Python execution** - Code cells execute Python via Pyodide (manual kernel startup required)
- **AI integration** - Real OpenAI API responses when OPENAI_API_KEY is set, graceful fallback to mock
- **Cell management** - Create, edit, move, and delete code/markdown/AI cells
- **Basic output display** - Text output and error handling
- **Keyboard navigation** - Vim-like cell navigation and shortcuts
- **Offline-first operation** - Works without network, syncs when connected

### In Development 🚧
- **Rich output rendering** - HTML tables, SVG plots, matplotlib integration (needs verification)
- **Enhanced AI features** - Notebook context awareness, tools for modifying cells
- **Enhanced display system** - Full IPython.display compatibility (needs verification)
- **Automated kernel management** - One-click notebook startup

### Planned 📋
- **SQL cell execution** - Database connections and query results
- **Code completion** - LSP integration and intelligent suggestions
- **Interactive widgets** - Real-time collaborative UI components
- **Performance optimization** - Large notebook handling

### Known Limitations ⚠️
- Manual kernel startup required per notebook (`NOTEBOOK_ID=xyz pnpm dev:kernel`)
- Rich outputs (matplotlib, pandas) not fully verified in integration tests
- AI has no notebook context awareness or tools to modify notebook
- Limited error handling for kernel failures

## Development Commands

```bash
# Core development workflow
pnpm dev                 # Start web + sync

# Python execution kernels
NOTEBOOK_ID=notebook-id-from-ui pnpm dev:kernel        # Pyodide on Node.js runtime (default)
NOTEBOOK_ID=notebook-id-from-ui pnpm dev:kernel:deno   # Pyodide on Deno runtime (better WASM)

# Deno runtime utilities (can run from project root)
pnpm cache:deno:warm-up     # Pre-warm Pyodide package cache
pnpm cache:deno:stats       # Show cache statistics  
pnpm deno:migrate           # Migrate from Node.js to Deno runtime
pnpm deno:test              # Run Pyodide kernel (Deno runtime) tests
pnpm deno:check             # Type check Pyodide kernel code



# Utilities
pnpm reset-storage          # Clear all local data
```

## Development Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed development plans and milestones.

### Immediate Priorities
1. **Rich Output Verification** - Integration tests for matplotlib, pandas, and display system
2. **Kernel Management** - Automated startup and health monitoring
3. **Error Handling** - Better kernel failure recovery and user feedback

### Next Milestones
- Enhanced AI integration (notebook context awareness, tools for modifying cells)
- SQL cell implementation with database connections
- Interactive widget system for collaborative data exploration
- Production deployment and performance optimization

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Schema version mismatches | Ensure all services (web, kernel, sync) are restarted after schema changes |
| Type errors | TypeScript catches invalid queries at compile time - check column names |
| Execution not working | Use kernel command from notebook UI or check `.env` configuration |
| AI cells showing mock responses | Uncomment and set `OPENAI_API_KEY` in `.env`, restart kernel |
| Stale state | Run `pnpm reset-storage` |
| Slow execution | Should be instant - check kernel logs |
| Pyodide (Deno runtime) not starting | Check `NOTEBOOK_ID` is set and Deno is installed |
| Missing Deno | Install from https://deno.land/ |

## Architecture Highlights

**Event-Sourced State**: All notebook changes flow through LiveStore's event sourcing system, enabling real-time collaboration, undo/redo, and audit trails.

**Direct TypeScript Schema**: The `shared/schema.ts` file is imported directly across all packages with full type inference, eliminating build complexity.

**Reactive Architecture**: Kernels use LiveStore's reactive subscriptions instead of polling for instant work detection.

**Local-First Design**: Everything works offline first, syncs when connected. Your work is never lost.

**Modular Kernel System**: Python execution runs in separate processes that can be started per notebook as needed. Choose between Node.js or Deno runtime for the Pyodide kernel based on your needs.

**Deno Runtime Benefits**: Superior WebAssembly support for Pyodide, modern APIs, faster startup times, and better security model.

## Documentation

For comprehensive documentation, see the [docs](./docs/) directory:
- **[OpenAI Integration](./docs/OPENAI_INTEGRATION.md)** - AI setup and usage guide
- **[Display System Guide](./docs/DISPLAY_SYSTEM.md)** - Complete technical documentation
- **[Display Examples](./docs/display-examples.md)** - Practical usage examples
- **[UI Design Guidelines](./docs/UI_DESIGN.md)** - Interface design principles
- **[Testing Strategy](./docs/TESTING.md)** - Current testing approach and gaps

## Contributing

Anode is an open source project focused on developer experience. Key areas for contribution:
- **Integration testing** - Verify Python execution and rich output rendering
- **Kernel management** - Automated startup and health monitoring
- **Rich output system** - Complete matplotlib, pandas, and IPython.display integration
- **Error handling** - Better user feedback and recovery from failures
- **Performance testing** - Validate claims about execution speed and memory usage

## License

BSD 3-Clause