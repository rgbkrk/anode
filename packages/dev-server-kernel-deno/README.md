# Anode Kernel Service (Deno)

A high-performance Python execution kernel for Anode notebooks, built with Deno for superior WebAssembly support and modern JavaScript APIs.

## Why Deno?

This is a migration from the Node.js-based kernel to Deno, providing:
- **Better WASM Support**: Native WebAssembly optimization for Pyodide
- **Modern APIs**: Built-in crypto and file system APIs
- **Zero Config**: No build step required, direct TypeScript execution
- **Security**: Explicit permissions model
- **Performance**: V8 optimizations and faster startup times

## Features

- **Reactive Architecture**: Uses LiveStore queries instead of polling
- **Python Execution**: Pyodide-based Python 3.11 runtime
- **AI Integration**: OpenAI API with function calling for notebook tools
- **Rich Outputs**: IPython display system with matplotlib, pandas support
- **Package Caching**: Intelligent caching for faster subsequent loads
- **Real-time Collaboration**: Event-sourced state synchronization

## Quick Start

### Prerequisites

- [Deno](https://deno.land/) 1.40+
- LiveStore sync server running (typically via `pnpm dev` in project root)

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Optional: Add OpenAI API key for real AI responses
echo "OPENAI_API_KEY=sk-your-key-here" >> .env
```

### Running the Kernel

```bash
# Start the kernel server
deno task start

# Or with custom notebook ID
NOTEBOOK_ID=my-notebook deno task start

# Development mode with file watching
deno task dev
```

### Running Cache CLI

```bash
# Warm up cache with essential packages
deno task cache:warm-up

# Check cache statistics
deno task cache:stats

# List cached packages
deno task cache:list

# Clear cache
deno task cache:clear
```

## Architecture

### Event-Driven Execution

The kernel operates on LiveStore events rather than HTTP requests:

1. **Cell Execution Request**: Web client emits `cellExecutionRequested`
2. **Work Assignment**: Kernel claims pending executions via `executionAssigned`
3. **Execution**: Python code runs via Pyodide or AI calls OpenAI API
4. **Output Streaming**: Results sent via `cellOutputAdded` events
5. **Real-time Updates**: All connected clients see results immediately

### Components

- **`index.ts`**: HTTP server for health checks (execution is event-driven)
- **`kernel-adapter.ts`**: LiveStore integration and reactive queries
- **`pyodide-kernel.ts`**: Python execution engine with IPython integration
- **`openai-client.ts`**: AI integration with function calling
- **`cache-utils.ts`**: Package caching system
- **`cache-cli.ts`**: CLI tool for cache management

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTEBOOK_ID` | `demo-notebook` | Notebook to serve |
| `KERNEL_ID` | `kernel-{pid}` | Unique kernel identifier |
| `LIVESTORE_SYNC_URL` | `ws://localhost:8787` | LiveStore sync server |
| `AUTH_TOKEN` | `insecure-token-change-me` | Authentication token |
| `OPENAI_API_KEY` | _(unset)_ | OpenAI API key for real AI responses |
| `INITIAL_SYNC_DELAY` | `229` | Delay before first event (ms) |

### Deno Permissions

The kernel requires the following permissions:
- `--allow-net`: Network access for LiveStore sync and OpenAI API
- `--allow-read`: Read cache files and configuration
- `--allow-write`: Write cache files and temporary data
- `--allow-env`: Access environment variables
- `--allow-run`: Execute subprocesses (if needed)

## Architecture

The kernel is purely reactive and communicates only via LiveStore events. There are no HTTP endpoints - all execution happens through event-driven subscriptions.

## Package Caching

The kernel includes an intelligent package caching system for faster Pyodide startup:

### Cache Management

```bash
# Essential packages (numpy, pandas, matplotlib, etc.)
deno task cache:warm-up

# Common packages (includes scipy, sympy, bokeh, plotly)
deno task cache:warm-up:common

# Custom packages
deno run --allow-all src/cache-cli.ts warm-up numpy scipy matplotlib

# Cache statistics
deno task cache:stats

# Clean up old packages (30+ days)
deno task cache:cleanup
```

### Cache Location

Default: `~/.anode/pyodide-cache/`

Custom: Set via `--cache-dir` flag or constructor parameter

## AI Integration

### OpenAI Function Calling

The kernel supports AI function calls that can modify the notebook:

```javascript
// AI can create new cells
{
  "name": "create_cell",
  "arguments": {
    "cellType": "code",
    "content": "import pandas as pd\ndf = pd.read_csv('data.csv')",
    "position": "after_current"
  }
}
```

### Context Awareness

AI cells receive context from previous cells in the notebook, enabling:
- Variable reference and continuation
- Code debugging and optimization
- Context-aware suggestions

## Development

### Type Checking

```bash
deno task type-check
```

### Testing

```bash
# Unit tests
deno task test:unit

# Integration tests (requires real Pyodide)
deno task test:integration

# All tests
deno test --allow-all
```

### Debugging

Enable verbose logging:

```bash
# Verbose cache operations
deno run --allow-all src/cache-cli.ts warm-up --verbose

# Debug kernel startup
DEBUG=1 deno task start
```

## Performance Optimization

### WASM Performance

Deno's superior WASM support provides:
- Faster Pyodide initialization
- Better memory management
- Reduced startup latency

### Cache Optimization

- Pre-warm cache with essential packages
- Shared cache across kernel instances
- Automatic cleanup of old packages

### Memory Management

- Explicit cleanup on kernel shutdown
- IPython shell reset between sessions
- Garbage collection hints for large computations

## Troubleshooting

### Common Issues

**Pyodide fails to load**
```bash
# Clear cache and retry
deno task cache:clear
deno task cache:warm-up
```

**Permission denied**
```bash
# Ensure proper Deno permissions
deno run --allow-all src/index.ts
```

**Sync connection issues**
```bash
# Check LiveStore sync server is running
pnpm dev
```

**OpenAI API errors**
```bash
# Verify API key
echo $OPENAI_API_KEY
# Check API quota and billing
```

### Logs

The kernel provides structured logging:
- `🐍` Python execution
- `🤖` AI processing
- `🔗` LiveStore events
- `📦` Package management
- `⚡` Reactive queries

## Migration from Node.js

Key differences from the Node.js version:

1. **Direct TypeScript**: No build step required
2. **Built-in APIs**: Native HTTP, crypto, file system
3. **Better WASM**: Improved Pyodide performance
4. **Modern Syntax**: ES modules, top-level await
5. **Security**: Explicit permission model

### Migration Steps

1. Update import paths (`.ts` extensions)
2. Replace Node.js APIs with Deno equivalents
3. Update permissions in run commands
4. Test package caching and Pyodide loading

## Contributing

1. Use `deno fmt` for code formatting
2. Run `deno lint` before committing
3. Add tests for new features
4. Update documentation for API changes

## License

MIT - See project root for details
