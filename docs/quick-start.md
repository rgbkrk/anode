# Quick Start Guide

Get Anode running locally for development and experimentation.

## Prerequisites

- Node.js 23+
- pnpm (recommended over npm)

## Installation

```bash
git clone <repository-url>
cd anode
pnpm install
```

## Start Development

1. **Clean start** (recommended):
   ```bash
   pnpm clean-store
   ```

2. **Start core services**:
   ```bash
   # Terminal 1: Sync backend and web client
   pnpm dev

   # Terminal 2: Python execution kernel
   NOTEBOOK_ID=my-notebook pnpm dev:kernel
   ```

3. **Open browser**: http://localhost:5173

## Basic Usage

1. **Create cells**: Click "+" to add new cells
2. **Write Python code**:
   ```python
   print("Hello from Anode!")
   import matplotlib.pyplot as plt
   plt.plot([1, 2, 3], [1, 4, 2])
   plt.show()
   ```
3. **Execute**: Press `Shift+Enter` to run and move to next cell

## Monitor System Health

```bash
# In a third terminal
pnpm monitor-queue
```

This shows:
- Active kernels
- Execution queue status  
- System warnings

## Common Issues

**No Python output?**
- Check `pnpm monitor-queue` for kernel status
- Verify `NOTEBOOK_ID` matches between web and kernel
- Restart kernel if needed

**Sync issues?**
- Try `pnpm clean-store` to reset everything
- Check that sync backend is running on port 8787

## What Works Now

- Basic notebook interface
- Python code execution
- Real-time collaboration
- Execution queue with fault tolerance

## What Doesn't Work Yet

- SQL cells (UI only, no backend)
- AI assistant cells (UI only)
- Authentication (uses hardcoded tokens)
- Mobile interface
- Production deployment

See [ROADMAP.md](../ROADMAP.md) for current development status and known issues.