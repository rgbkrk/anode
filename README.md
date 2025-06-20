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
pnpm install  # Automatically creates .env files with defaults
# hack on the web client
pnpm dev:web-only
# synchronize clients with a local doc worker
pnpm dev:sync-only
```

The install process creates `.env` files for:
- `packages/web-client/.env` - Web client configuration (VITE_* vars exposed to browser)
- `packages/pyodide-runtime-agent/.env` - Runtime server configuration (server-only vars)

### 2. Create Your First Notebook
1. Open http://localhost:5173
2. URL automatically gets notebook ID: `?notebook=notebook-123-abc`
3. Start creating cells and editing

### 3. Get Runtime Command from UI
- Open the notebook interface
- Click the **Runtime** button in the notebook header
- Copy the exact `NOTEBOOK_ID=xxx pnpm dev:runtime` command shown
- Run that command in your terminal

### 4. Execute Code
- Add a code cell in the web interface
- Write Python: `import numpy as np; np.random.random(5)`
- Press **Ctrl+Enter** or click **Run**
- See results appear instantly

### 5. Try AI Integration (Optional)
```bash
# Edit packages/pyodide-runtime-agent/.env and uncomment/set your OpenAI API key:
# OPENAI_API_KEY=sk-your-key-here

# Restart runtime to pick up the API key (use UI command)
NOTEBOOK_ID=your-notebook-id pnpm dev:runtime
```
- Add an AI cell and ask questions about your data
- Falls back to mock responses if no API key is set
- API keys are kept server-side for security

## Using Deployed Cloudflare Workers (Optional)

Instead of running everything locally, you can use a deployed Cloudflare Worker for sync while keeping the web client and runtime local. This enables testing real-time collaboration across devices.

### Quick Setup for Deployed Worker

1. **Get deployment details** from your team (worker URL and auth token)

2. **Update web client config** in `packages/web-client/.env`:
   ```env
   VITE_LIVESTORE_SYNC_URL=https://your-worker.workers.dev
   VITE_AUTH_TOKEN=your-secure-token
   ```

3. **Update runtime config** in `packages/pyodide-runtime-agent/.env`:
   ```env
   LIVESTORE_SYNC_URL=https://your-worker.workers.dev
   AUTH_TOKEN=your-secure-token
   ```

4. **Start services** (no local docworker needed):
   ```bash
   pnpm dev:web-only  # Web client connects to deployed worker
   NOTEBOOK_ID=test-notebook pnpm dev:runtime
   ```

5. **Test collaboration** by opening the web client on multiple devices/browsers

### Benefits
- Real-time sync through Cloudflare's global network
- Test collaboration across devices on your network
- No need to run local sync backend

**Note**: When using deployed workers, authentication happens via Cloudflare secrets configured in the dashboard.

## Current Status

### What's Working ✅
- **Real-time collaborative editing** - Multiple users can edit notebooks simultaneously
- **LiveStore event-sourcing** - Robust data synchronization and state management
- **Python execution** - Code cells execute Python via Pyodide (manual runtime startup required)
- **AI integration** - Real OpenAI API responses when OPENAI_API_KEY is set, graceful fallback to mock
- **Cell management** - Create, edit, move, and delete code/markdown/AI cells
- **Basic output display** - Text output and error handling
- **Keyboard navigation** - Vim-like cell navigation and shortcuts
- **Offline-first operation** - Works without network, syncs when connected

### In Development 🚧
- **Rich output rendering** - HTML tables, SVG plots, matplotlib integration (needs verification)
- **Enhanced AI features** - Notebook context awareness, tools for modifying cells
- **Enhanced display system** - Full IPython.display compatibility (needs verification)
- **Automated runtime management** - One-click notebook startup

### Planned 📋
- **SQL cell execution** - Database connections and query results
- **Code completion** - LSP integration and intelligent suggestions
- **Interactive widgets** - Real-time collaborative UI components
- **Performance optimization** - Large notebook handling

### Known Limitations ⚠️
- Manual runtime startup required per notebook (`NOTEBOOK_ID=xyz pnpm dev:runtime`)
- Rich outputs (matplotlib, pandas) not fully verified in integration tests
- AI has no notebook context awareness or tools to modify notebook
- Limited error handling for runtime failures

## Development Commands

```bash
# Setup (run manually if needed)
pnpm setup               # Create .env files with defaults

# Core development workflow
pnpm dev                 # Start web + sync
# Get runtime command from notebook UI, then:
NOTEBOOK_ID=notebook-id-from-ui pnpm dev:runtime

# Utilities
pnpm reset-storage       # Clear all local data
```

### Environment Files Created

The setup process creates these `.env` files:
- `packages/web-client/.env` - Client configuration (sync URL, auth token, Google OAuth)
- `packages/pyodide-runtime-agent/.env` - Runtime configuration (sync URL, auth token, OpenAI API key)

**Note**: The docworker doesn't use `.env` files - it gets environment variables from wrangler.toml and Cloudflare secrets.

## Development Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed development plans and milestones.

### Immediate Priorities
1. **Rich Output Verification** - Integration tests for matplotlib, pandas, and display system
2. **Runtime Management** - Automated startup and health monitoring
3. **Error Handling** - Better runtime failure recovery and user feedback

### Next Milestones
- Enhanced AI integration (notebook context awareness, tools for modifying cells)
- SQL cell implementation with database connections
- Interactive widget system for collaborative data exploration
- Production deployment and performance optimization

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Missing .env files | Run `pnpm setup` to auto-create with defaults |
| Schema version mismatches | Ensure all services (web, runtime, sync) are restarted after schema changes |
| Type errors | TypeScript catches invalid queries at compile time - check column names |
| Execution not working | Use runtime command from notebook UI or check `.env` configuration |
| AI cells showing mock responses | Set `OPENAI_API_KEY` in `packages/pyodide-runtime-agent/.env`, restart runtime |
| Stale state | Run `pnpm reset-storage` |
| Slow execution | Should be instant - check runtime logs |

## Architecture Highlights

**Event-Sourced State**: All notebook changes flow through LiveStore's event sourcing system, enabling real-time collaboration, undo/redo, and audit trails.

**Direct TypeScript Schema**: The `shared/schema.ts` file is imported directly across all packages with full type inference, eliminating build complexity.

**Reactive Architecture**: Runtimes use LiveStore's reactive subscriptions instead of polling for instant work detection.

**Local-First Design**: Everything works offline first, syncs when connected. Your work is never lost.

**Modular Runtime System**: Python execution runs in separate processes that can be started per notebook as needed.

## Documentation

For comprehensive documentation, see the [docs](./docs/) directory:
- **[OpenAI Integration](./docs/ai-features.md)** - AI setup and usage guide
- **[Display System Guide](./docs/display-system.md)** - Complete technical documentation
- **[Display Examples](./docs/display-examples.md)** - Practical usage examples
- **[UI Design Guidelines](./docs/ui-design.md)** - Interface design principles
- **[Testing Strategy](./docs/TESTING.md)** - Current testing approach and gaps

## Deployment

Deploy to Cloudflare Pages and Workers with a single command:

```bash
pnpm deploy:production
```

This deploys both the web client (Pages) and sync backend (Workers) concurrently. Individual services can be deployed with:

```bash
pnpm deploy:web        # Deploy web client to Cloudflare Pages
pnpm deploy:docworker  # Deploy sync backend to Cloudflare Workers
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions, environment configuration, and CI/CD setup.

## Contributing

Anode is an open source project focused on developer experience. Key areas for contribution:
- **Integration testing** - Verify Python execution and rich output rendering
- **Runtime management** - Automated startup and health monitoring
- **Rich output system** - Complete matplotlib, pandas, and IPython.display integration
- **Error handling** - Better user feedback and recovery from failures
- **Performance testing** - Validate claims about execution speed and memory usage

## License

BSD 3-Clause
