# Troubleshooting Guide

Common issues, solutions, and debugging techniques for Anode development and deployment.

## Quick Diagnostics

### System Health Check
```bash
# Check all services are running
pnpm monitor-queue

# Verify sync backend
curl http://localhost:8787/health

# Check kernel health
curl http://localhost:3001/health

# Test web client
curl http://localhost:5173
```

### Emergency Reset
```bash
# Nuclear option - reset everything
pnpm clean-store
pnpm install
pnpm dev
```

## Kernel Issues

### Kernel Won't Start

**Symptoms:**
- Kernel process exits immediately
- "Failed to initialize Pyodide" errors
- No kernels visible in `pnpm monitor-queue`

**Solutions:**
```bash
# 1. Check Node.js version
node --version  # Should be 23+

# 2. Clean and rebuild
pnpm clean-store
pnpm build:schema

# 3. Check environment variables
echo $NOTEBOOK_ID
echo $AUTH_TOKEN

# 4. Start with debug logging
DEBUG=* NOTEBOOK_ID=debug pnpm dev:kernel
```

**Common Causes:**
- Outdated Node.js version
- Missing environment variables
- Schema package not built
- Port conflicts

### Kernel Dies Randomly

**Symptoms:**
- Kernel stops responding
- "Dead kernel" warnings in monitor
- Executions stuck in "claimed" state

**Solutions:**
```bash
# 1. Check memory usage
pnpm monitor-queue  # Look for memory stats

# 2. Restart with memory limit
node --max-old-space-size=4096 packages/dev-server-kernel-ls-client/src/index.ts

# 3. Check for memory leaks
# Look for growing activeExecutions in logs

# 4. Reduce concurrent executions
# Edit KernelManager config: claimBatchSize: 1
```

**Common Causes:**
- Memory leaks in Pyodide
- Too many concurrent executions
- Long-running processes
- System resource limits

### Python Code Won't Execute

**Symptoms:**
- Cells stuck in "pending" state
- No output from code cells
- Timeout errors

**Solutions:**
```bash
# 1. Check execution queue
pnpm monitor-queue

# 2. Check for stuck executions
pnpm cleanup-queue

# 3. Test simple code
print("Hello World")

# 4. Check kernel logs for Python errors
```

**Debugging Python Issues:**
```python
# Test Pyodide installation
import sys
print(sys.version)

# Test package imports
try:
    import numpy as np
    print("NumPy works!")
except ImportError as e:
    print(f"NumPy error: {e}")

# Check available packages
import pkg_resources
[p.project_name for p in pkg_resources.working_set]
```

## Sync Backend Issues

### Sync Backend Won't Start

**Symptoms:**
- "Connection refused" errors
- Web client can't connect
- Wrangler dev fails

**Solutions:**
```bash
# 1. Check port availability
lsof -i :8787

# 2. Kill conflicting processes
kill $(lsof -t -i:8787)

# 3. Start sync backend manually
cd packages/docworker
pnpm dev

# 4. Check Wrangler installation
npx wrangler --version
```

### WebSocket Connection Issues

**Symptoms:**
- "WebSocket failed" in browser console
- Constant reconnection attempts
- Sync never completes

**Solutions:**
```bash
# 1. Test WebSocket directly
npx wscat -c ws://localhost:8787/websocket

# 2. Check CORS settings
# Look for CORS errors in browser console

# 3. Verify auth token
# Check AUTH_TOKEN in kernel and sync backend

# 4. Reset sync state
pnpm clean-store
```

**WebSocket Debugging:**
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:8787/websocket');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.onerror = (e) => console.error('Error:', e);
ws.onclose = (e) => console.log('Closed:', e.code, e.reason);
```

### Database/Storage Issues

**Symptoms:**
- "D1 database error" messages
- Data not persisting
- Sync conflicts

**Solutions:**
```bash
# 1. Check D1 database
cd packages/docworker
npx wrangler d1 list

# 2. Reset database
pnpm clean-store

# 3. Check database file permissions
ls -la packages/docworker/.wrangler/state/

# 4. Manually inspect database
sqlite3 packages/docworker/.wrangler/state/v3/d1/*/database.sqlite
.tables
.schema
```

## Web Client Issues

### Web Client Won't Load

**Symptoms:**
- Blank page in browser
- "Cannot connect to server" errors
- Build failures

**Solutions:**
```bash
# 1. Check Vite dev server
cd packages/web-client
pnpm dev

# 2. Clear browser cache
# Open DevTools > Application > Storage > Clear storage

# 3. Check for build errors
pnpm build:schema
pnpm --filter @anode/web-client build

# 4. Test in incognito mode
```

### LiveStore Connection Issues

**Symptoms:**
- "LiveStore failed to initialize"
- UI doesn't update in real-time
- "Store not available" errors

**Solutions:**
```bash
# 1. Check LiveStore adapter
# Open browser console and look for adapter errors

# 2. Verify schema package
pnpm build:schema

# 3. Reset LiveStore state
# In browser console:
# localStorage.clear()
# sessionStorage.clear()

# 4. Check for version mismatches
pnpm list @livestore/livestore
```

**LiveStore Debugging:**
```javascript
// In browser console
const store = window.__debugLiveStore?.default;
if (store) {
    console.log('Store available');
    console.log('Sync state:', store._dev.syncStates());
    
    // Download databases for inspection
    store._dev.downloadDb();
    store._dev.downloadEventlogDb();
} else {
    console.error('Store not available');
}
```

### React/UI Issues

**Symptoms:**
- Components not updating
- Rendering performance issues
- Memory leaks in browser

**Solutions:**
```bash
# 1. Check React DevTools
# Install React Developer Tools extension

# 2. Enable React strict mode
# Check for double-renders and effects

# 3. Monitor component re-renders
# Use React DevTools Profiler

# 4. Check for memory leaks
# DevTools > Memory > Take heap snapshot
```

## Execution Queue Issues

### Executions Stuck in Queue

**Symptoms:**
- Cells remain in "pending" state
- No kernels claiming executions
- Queue growing but not processing

**Solutions:**
```bash
# 1. Check kernel status
pnpm monitor-queue

# 2. Verify kernels are registered
# Look for "Active kernels" in monitor

# 3. Check notebook ID matching
echo $NOTEBOOK_ID  # Should match web client

# 4. Clean stuck executions
pnpm cleanup-queue
```

### Multiple Kernels Conflicting

**Symptoms:**
- Race conditions in execution
- Duplicate outputs
- Inconsistent results

**Solutions:**
```bash
# 1. Check kernel IDs
pnpm monitor-queue  # Each kernel should have unique ID

# 2. Ensure proper cleanup
# Stop all kernels gracefully with Ctrl+C

# 3. Reset execution state
pnpm cleanup-queue

# 4. Start one kernel at a time
NOTEBOOK_ID=test pnpm dev:kernel
```

### Execution Timeouts

**Symptoms:**
- Executions marked as "timeout"
- Long-running code interrupted
- Kernel appears dead but is working

**Solutions:**
```bash
# 1. Increase timeout values
# Edit packages/dev-server-kernel-ls-client/src/kernel-manager.ts
# executionTimeout: 10 * 60 * 1000, // 10 minutes

# 2. Add progress reporting
# Kernel should report progress for long operations

# 3. Optimize Python code
# Break large operations into smaller chunks

# 4. Monitor resource usage
top -p $(pgrep -f "dev-server-kernel")
```

## Performance Issues

### Slow Execution

**Symptoms:**
- Code takes long time to run
- UI becomes unresponsive
- High CPU/memory usage

**Solutions:**
```bash
# 1. Profile execution
pnpm monitor-queue  # Check execution times

# 2. Optimize Python code
# Use vectorized operations
# Avoid large loops
# Cache expensive computations

# 3. Increase kernel resources
node --max-old-space-size=8192 packages/dev-server-kernel-ls-client/src/index.ts

# 4. Run multiple kernels
# Start additional kernel instances for load balancing
```

### Memory Leaks

**Symptoms:**
- Memory usage grows over time
- System becomes sluggish
- Out of memory errors

**Solutions:**
```bash
# 1. Monitor memory usage
pnpm monitor-queue

# 2. Check for large objects in Python
import sys
import gc
gc.collect()
print(f"Memory: {sys.getsizeof(gc.get_objects())}")

# 3. Restart kernels periodically
# Implement kernel rotation for long-running systems

# 4. Profile memory usage
# Use browser DevTools Memory tab
```

### Network Latency

**Symptoms:**
- Slow sync between clients
- Delayed UI updates
- Large event payloads

**Solutions:**
```bash
# 1. Check network conditions
ping localhost

# 2. Optimize event payloads
# Keep event data small
# Avoid large strings in events

# 3. Batch operations
# Group related changes together

# 4. Use local sync backend
# Avoid remote sync during development
```

## Environment Issues

### Port Conflicts

**Symptoms:**
- "Port already in use" errors
- Services fail to start
- Cannot connect to expected ports

**Solutions:**
```bash
# 1. Find processes using ports
lsof -i :5173  # Web client
lsof -i :8787  # Sync backend  
lsof -i :3001  # Kernel

# 2. Kill conflicting processes
kill $(lsof -t -i:5173)

# 3. Use different ports
PORT=5174 pnpm dev:web-only

# 4. Check for Docker containers
docker ps
```

### Node.js Version Issues

**Symptoms:**
- Syntax errors in modern JavaScript
- Package compatibility issues
- Build failures

**Solutions:**
```bash
# 1. Check Node.js version
node --version  # Should be 23+

# 2. Update Node.js
nvm install 23
nvm use 23

# 3. Clear npm cache
npm cache clean --force

# 4. Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Permission Issues

**Symptoms:**
- "Permission denied" errors
- Cannot write to directories
- Database access failures

**Solutions:**
```bash
# 1. Check file permissions
ls -la packages/*/tmp/
ls -la packages/*/.wrangler/

# 2. Fix permissions
chmod -R 755 packages/dev-server-kernel-ls-client/tmp/

# 3. Check disk space
df -h

# 4. Run with proper user
# Avoid running as root
```

## Debugging Techniques

### Enable Debug Logging

```bash
# Kernel debug logging
DEBUG=anode:* NOTEBOOK_ID=debug pnpm dev:kernel

# Sync backend debug
# Check browser console for sync messages

# Web client debug  
VITE_DEBUG=true pnpm dev:web-only
```

### Browser DevTools

```javascript
// LiveStore debugging
window.__debugLiveStore?.default._dev.syncStates()

// Check event history
window.__debugLiveStore?.default._dev.downloadEventlogDb()

// Monitor store queries
window.__debugLiveStore?.default.query(tables.cells)
```

### Network Debugging

```bash
# Test WebSocket connection
npx wscat -c ws://localhost:8787/websocket

# Monitor network traffic
# Browser DevTools > Network tab

# Check HTTP endpoints
curl -v http://localhost:8787/health
curl -v http://localhost:3001/health
```

### Database Inspection

```bash
# SQLite database inspection
sqlite3 packages/dev-server-kernel-ls-client/tmp/*/state*.db
.tables
.schema cells
SELECT * FROM cells WHERE executionState != 'completed';

# Event log inspection  
sqlite3 packages/dev-server-kernel-ls-client/tmp/*/eventlog*.db
.tables
SELECT * FROM events ORDER BY seqNum DESC LIMIT 10;
```

## Prevention Tips

### Development Best Practices

1. **Always start clean**: Use `pnpm clean-store` between feature work
2. **Monitor health**: Keep `pnpm monitor-queue` running during development
3. **Test incrementally**: Don't make large changes without testing
4. **Check logs**: Review console output for warnings and errors
5. **Use version control**: Commit working states before major changes

### System Maintenance

```bash
# Daily development routine
pnpm clean-store          # Start fresh
pnpm install              # Update dependencies
pnpm build:schema         # Ensure schema is current
pnpm dev                  # Start services
pnpm monitor-queue        # Monitor health
```

### Resource Management

```bash
# Monitor system resources
top                       # CPU and memory usage
df -h                     # Disk space
lsof -i                   # Network connections
ps aux | grep node       # Node.js processes
```

## Getting Help

### Self-Service Resources

1. **System health**: `pnpm monitor-queue`
2. **Clean state**: `pnpm clean-store`
3. **Fix stuck state**: `pnpm cleanup-queue`
4. **Documentation**: `docs/` directory
5. **Browser console**: Check for error messages

### Community Support

1. **GitHub Issues**: [github.com/anode/anode/issues](https://github.com/anode/anode/issues)
2. **GitHub Discussions**: [github.com/anode/anode/discussions](https://github.com/anode/anode/discussions)
3. **Discord**: [discord.gg/anode](https://discord.gg/anode)

### Reporting Issues

When reporting issues, include:

1. **System info**: OS, Node.js version, browser
2. **Steps to reproduce**: Exact commands and actions
3. **Error messages**: Console output and error logs
4. **System state**: Output from `pnpm monitor-queue`
5. **Environment**: Development vs production setup

### Emergency Contacts

For critical or security issues, please use GitHub Issues with appropriate labels.

---

**Remember**: Most issues can be resolved with `pnpm clean-store` and a fresh restart. When in doubt, start clean!