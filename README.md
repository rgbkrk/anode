# Anode

A real-time collaborative notebook system built with LiveStore event sourcing. Multiple users can edit notebooks simultaneously with instant synchronization across all connected clients.

## 🏗️ **Architecture Overview**

This workspace contains multiple packages:

```
packages/
├── 📋 schema/                          # Shared LiveStore schema & types
├── 🎨 web-client/                      # React frontend (port 5173)
├── ☁️ docworker/                       # CloudFlare Workers sync (port 8787)
└── 🐍 dev-server-kernel-ls-client/     # Python kernel process (connects to notebook store)
```

### **Event-Driven Execution Flow**

```
Web Client → cellExecutionRequested → LiveStore Sync → Kernel Service
     ↑                                                        ↓
Results display ← cellOutputAdded ← LiveStore Sync ← Python Execution
```

## 🚀 **Quick Start**

### **Prerequisites**
- **Node.js 23+**
- **pnpm**
- **Modern browser** with WebSocket support

### **Installation & Development**

```bash
# Install dependencies
pnpm install

# Start all services (recommended)
./start-dev.sh

# OR start services individually for debugging
pnpm build:schema                    # Required first
pnpm run dev:sync-only      # Sync server (port 8787)
pnpm run dev:web-only       # Web app (port 5173)

# Start kernel process for specific notebook (optional)
STORE_ID=test-store pnpm run dev:kernel
```

### **Access Points**
- **Web Application**: http://localhost:5173
- **Sync Server**: ws://localhost:8787
- **Kernel Health**: http://localhost:3001/health (when running)

## 🎯 **Key Features**

### ✅ **Real-time Collaboration**
- Multiple users can edit notebooks simultaneously
- Conflict-free synchronization via LiveStore events
- Sub-second update propagation
- Works across multiple browser tabs

### ✅ **Multi-Modal Cells**
- **Code cells**: Execution via Pyodide, Local, and Remote kernels
- **Markdown cells**: Rich text editing
- **SQL cells**: Query configured databases directly (planned)
- **AI cells**: Notebook context informted AI (planned)

### ✅ **Event-Sourced Architecture**
- Complete audit trail of all changes
- Deterministic state updates
- Offline-capable with sync when reconnected
- Hash-consistent materializer functions

### ✅ **Developer and User Experience Combined**
- Modern design with shadcn/ui components
- Responsive layout
- Keyboard shortcuts
- Respect Classic Notebook Origins

## 📦 **Package Details**

### **`@anode/schema`** - Shared Types & Schema
- **Purpose**: Single source of truth for LiveStore events and types
- **Exports**: `events`, `tables`, `schema`, TypeScript types
- **Dependencies**: `@livestore/livestore`, `@effect/schema`

### **`@anode/web-client`** - React Frontend
- **Purpose**: Collaborative notebook UI with real-time editing
- **Tech**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Port**: 5173
- **Features**: Multi-modal cells, real-time collaboration

### **`@anode/docworker`** - CloudFlare Workers Sync
- **Purpose**: Real-time synchronization and event storage
- **Tech**: CloudFlare Workers, WebSocket, D1 Database
- **Port**: 8787
- **Features**: Event broadcasting, auth validation, CORS handling

### **`@anode/dev-server-kernel-ls-client`** - Python Kernel Process
- **Purpose**: Python execution process that connects to a specific notebook store
- **Tech**: Node.js, Pyodide WebAssembly, LiveStore adapter
- **Usage**: Set `NOTEBOOK_ID` env var to specify which notebook to serve
- **Features**: Event-driven execution, isolated Python environment, health endpoint

## 🔄 **Development Workflow**

### **Making Changes**

```bash
# Work on schema (affects all packages)
pnpm --filter @anode/schema dev

# Work on frontend only
pnpm --filter @anode/web-client dev

# Work on kernel process
NOTEBOOK_ID=my-notebook pnpm --filter @anode/dev-server-kernel-ls-client dev

# Work on sync server
pnpm --filter @anode/docworker dev
```

### **Testing End-to-End Flow**

1. **Start basic services**: `./start-dev.sh` (web client + sync server)
2. **Open web client**: http://localhost:5173
3. **Create new notebook**: Click "Create New Notebook"
4. **Start kernel for that notebook**: `NOTEBOOK_ID=notebook-xyz pnpm --filter @anode/dev-server-kernel-ls-client dev`
5. **Add code cell**: Click "+ Code Cell"
6. **Write Python code**:
   ```python
   print("Hello, collaborative world!")
   import math
   math.sqrt(16)
   ```
7. **Execute**: Press Ctrl+Enter or click "Run"
8. **Test collaboration**: Open another browser tab - results sync instantly!

### **Health Checks**

```bash
# Check core services are running
curl http://localhost:5173          # Web client (should return HTML)
curl http://localhost:8787          # Sync server (WebSocket upgrade)

# Check kernel process (if running for a notebook)
curl http://localhost:3001/health   # Kernel health (JSON status)
```

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Schema Build Fails**
```bash
# Clean and rebuild
pnpm --filter @anode/schema clean
pnpm --filter @anode/schema build
```

#### **Kernel Process Won't Start**
- Ensure Node.js 23+ is installed
- Set `NOTEBOOK_ID` environment variable
- Check that port 3001 is available (if needed)
- Verify LiveStore sync URL is correct

#### **Web Client Can't Connect to Sync**
- Ensure docworker is running on port 8787
- Check browser console for WebSocket errors
- Verify CORS settings in docworker

#### **Python Code Won't Execute**
- Start kernel process for your notebook: `NOTEBOOK_ID=your-notebook-id pnpm --filter @anode/dev-server-kernel-ls-client dev`
- Verify LiveStore event flow in browser dev tools
- Look for execution events in kernel process logs

### **Debug Logs**

```bash
# Enable detailed logging for specific notebook
DEBUG=* NOTEBOOK_ID=your-notebook-id pnpm --filter @anode/dev-server-kernel-ls-client dev

# Check LiveStore events in browser console
# Look for: cellExecutionRequested, cellExecutionStarted, cellOutputAdded
```

## 🔮 **Roadmap**

### **Phase 1: Core System** ✅
- Real-time collaborative editing
- Python code execution (via manual kernel process)
- Basic UI/UX
- Event-sourced architecture

### **Phase 2: Enhanced Features** 🔄
- Automatic kernel management
- SQL database connections
- AI conversation cells
- Spawned Python environment
- User authentication

### **Phase 3: Production Ready** 🔮
- Multi-kernel support (R, JavaScript)
- Kernel service orchestration
- Deployed service

## 🤝 **Contributing**

### **Development Setup**
1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Build schema: `pnpm build:schema`
4. Start development: `./start-dev.sh`
5. Make changes and test end-to-end flow

### **Package Dependencies**
```
schema (base package)
├── web-client (depends: schema)
├── docworker (depends: schema)
└── dev-server-kernel-ls-client (depends: schema)
```

### **Coding Standards**
- TypeScript strict mode
- Event-driven architecture patterns
- Real-time collaboration considerations

## 📄 **License**

BSD-3 Clause
