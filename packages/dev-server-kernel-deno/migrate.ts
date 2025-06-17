#!/usr/bin/env -S deno run --allow-all

/**
 * Migration helper script for switching from Node.js kernel to Deno kernel
 *
 * This script helps users:
 * 1. Check Deno installation and version
 * 2. Migrate cache from Node.js version
 * 3. Update environment variables
 * 4. Test basic functionality
 */

import { join } from "@std/path";
import { exists, ensureDir, copy } from "@std/fs";
import { parseArgs } from "@std/cli/parse-args";

interface MigrationOptions {
  nodeCacheDir?: string;
  denoCacheDir?: string;
  force?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

class MigrationHelper {
  constructor(private options: MigrationOptions = {}) {}

  private log(message: string): void {
    console.log(`📝 ${message}`);
  }

  private logVerbose(message: string): void {
    if (this.options.verbose) {
      console.log(`🔍 ${message}`);
    }
  }

  private logSuccess(message: string): void {
    console.log(`✅ ${message}`);
  }

  private logWarning(message: string): void {
    console.log(`⚠️ ${message}`);
  }

  private logError(message: string): void {
    console.error(`❌ ${message}`);
  }

  async checkDenoInstallation(): Promise<boolean> {
    this.log("Checking Deno installation...");

    try {
      const version = Deno.version;
      this.logSuccess(`Deno ${version.deno} detected`);

      // Check minimum version (1.40+)
      const [major, minor] = version.deno.split('.').map(Number);
      if (major < 1 || (major === 1 && minor < 40)) {
        this.logWarning(`Deno ${version.deno} detected. Recommended: 1.40+`);
        return false;
      }

      this.logVerbose(`V8: ${version.v8}, TypeScript: ${version.typescript}`);
      return true;
    } catch (error) {
      this.logError("Deno not found. Please install Deno first:");
      console.log("  curl -fsSL https://deno.land/install.sh | sh");
      return false;
    }
  }

  async findNodeCacheDir(): Promise<string | null> {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "/tmp";
    const possiblePaths = [
      this.options.nodeCacheDir,
      join(homeDir, ".anode", "pyodide-cache"),
      join(homeDir, ".cache", "anode", "pyodide-cache"),
      "./node_modules/.cache/pyodide",
    ].filter(Boolean) as string[];

    this.logVerbose("Searching for Node.js cache directories...");

    for (const path of possiblePaths) {
      try {
        if (await exists(path)) {
          this.logVerbose(`Found potential cache at: ${path}`);

          // Check if it contains Pyodide files
          const files: string[] = [];
          for await (const entry of Deno.readDir(path)) {
            if (entry.isFile && (entry.name.endsWith('.whl') || entry.name.endsWith('.zip'))) {
              files.push(entry.name);
            }
          }

          if (files.length > 0) {
            this.logSuccess(`Found Node.js cache with ${files.length} packages: ${path}`);
            return path;
          }
        }
      } catch (error) {
        this.logVerbose(`Cannot access ${path}: ${error.message}`);
      }
    }

    return null;
  }

  async migrateCache(): Promise<boolean> {
    this.log("Migrating package cache...");

    const nodeCache = await this.findNodeCacheDir();
    if (!nodeCache) {
      this.logWarning("No Node.js cache found. Will create fresh cache.");
      return true;
    }

    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "/tmp";
    const denoCacheDir = this.options.denoCacheDir || join(homeDir, ".anode", "pyodide-cache");

    this.logVerbose(`Source: ${nodeCache}`);
    this.logVerbose(`Target: ${denoCacheDir}`);

    if (this.options.dryRun) {
      this.log("DRY RUN: Would copy cache files");
      return true;
    }

    try {
      // Ensure target directory exists
      await ensureDir(denoCacheDir);

      // Check if target already has files
      let targetFiles = 0;
      try {
        for await (const entry of Deno.readDir(denoCacheDir)) {
          if (entry.isFile && (entry.name.endsWith('.whl') || entry.name.endsWith('.zip'))) {
            targetFiles++;
          }
        }
      } catch {
        // Directory doesn't exist or is empty
      }

      if (targetFiles > 0 && !this.options.force) {
        this.logWarning(`Target cache directory already has ${targetFiles} files.`);
        this.logWarning("Use --force to overwrite, or --dry-run to simulate.");
        return false;
      }

      // Copy cache files
      let copiedFiles = 0;
      for await (const entry of Deno.readDir(nodeCache)) {
        if (entry.isFile && (entry.name.endsWith('.whl') || entry.name.endsWith('.zip'))) {
          const sourcePath = join(nodeCache, entry.name);
          const targetPath = join(denoCacheDir, entry.name);

          this.logVerbose(`Copying: ${entry.name}`);
          await copy(sourcePath, targetPath, { overwrite: this.options.force });
          copiedFiles++;
        }
      }

      this.logSuccess(`Migrated ${copiedFiles} package files to Deno cache`);
      return true;

    } catch (error) {
      this.logError(`Cache migration failed: ${error.message}`);
      return false;
    }
  }

  async checkEnvironmentVariables(): Promise<void> {
    this.log("Checking environment variables...");

    const requiredVars = ['NOTEBOOK_ID'];
    const optionalVars = ['OPENAI_API_KEY', 'LIVESTORE_SYNC_URL', 'AUTH_TOKEN'];

    for (const varName of requiredVars) {
      const value = Deno.env.get(varName);
      if (!value) {
        this.logWarning(`${varName} not set. Consider setting it for proper operation.`);
      } else {
        this.logSuccess(`${varName} is set`);
      }
    }

    for (const varName of optionalVars) {
      const value = Deno.env.get(varName);
      if (value) {
        if (varName === 'OPENAI_API_KEY') {
          this.logSuccess(`${varName} is configured (${value.slice(0, 8)}...)`);
        } else {
          this.logSuccess(`${varName} is set: ${value}`);
        }
      } else {
        this.logVerbose(`${varName} not set (optional)`);
      }
    }
  }

  async testBasicFunctionality(): Promise<boolean> {
    this.log("Testing basic functionality...");

    try {
      // Test cache utilities
      const { PyodideCacheManager } = await import("./src/cache-utils.ts");
      const cacheManager = new PyodideCacheManager();

      await cacheManager.ensureCacheDir();
      const stats = await cacheManager.getCacheStats();

      this.logSuccess(`Cache system working: ${stats.packageCount} packages, ${stats.totalSizeMB} MB`);

      // Test OpenAI client (configuration only)
      const { openaiClient } = await import("./src/openai-client.ts");
      const isReady = openaiClient.isReady();

      if (isReady) {
        this.logSuccess("OpenAI client configured and ready");
      } else {
        this.logVerbose("OpenAI client not configured (set OPENAI_API_KEY for AI features)");
      }

      return true;

    } catch (error) {
      this.logError(`Functionality test failed: ${error.message}`);
      return false;
    }
  }

  async generateStartScript(): Promise<void> {
    this.log("Generating start script...");

    const startScript = `#!/bin/bash
# Anode Deno Kernel Start Script
# Generated by migration helper

# Set default environment variables
export NOTEBOOK_ID=\${NOTEBOOK_ID:-"demo-notebook"}
export PORT=\${PORT:-3001}
export LIVESTORE_SYNC_URL=\${LIVESTORE_SYNC_URL:-"ws://localhost:8787"}

# Optional: Uncomment and set your OpenAI API key
# export OPENAI_API_KEY="sk-your-key-here"

# Start the Deno kernel
echo "🚀 Starting Anode Deno Kernel..."
echo "📓 Notebook: $NOTEBOOK_ID"
echo "🔗 Sync URL: $LIVESTORE_SYNC_URL"

# Pre-warm cache if empty
if [ ! -d "$HOME/.anode/pyodide-cache" ] || [ -z "$(ls -A $HOME/.anode/pyodide-cache 2>/dev/null)" ]; then
  echo "📦 Pre-warming package cache..."
  deno task cache:warm-up
fi

# Start the kernel
deno task start
`;

    const scriptPath = "./start-deno-kernel.sh";

    if (this.options.dryRun) {
      this.log("DRY RUN: Would create start script");
      return;
    }

    await Deno.writeTextFile(scriptPath, startScript);

    // Make executable on Unix systems
    try {
      await Deno.chmod(scriptPath, 0o755);
    } catch {
      // chmod might not be available on all systems
    }

    this.logSuccess(`Created start script: ${scriptPath}`);
    this.log("Run './start-deno-kernel.sh' to start the kernel");
  }

  async run(): Promise<void> {
    console.log("🔄 Anode Kernel Migration Helper");
    console.log("================================\n");

    const denoOk = await this.checkDenoInstallation();
    if (!denoOk) {
      this.logError("Deno installation check failed. Please install/upgrade Deno.");
      Deno.exit(1);
    }

    const cacheOk = await this.migrateCache();
    if (!cacheOk) {
      this.logError("Cache migration failed. You may need to use --force or clear target directory.");
      Deno.exit(1);
    }

    await this.checkEnvironmentVariables();

    const testOk = await this.testBasicFunctionality();
    if (!testOk) {
      this.logWarning("Basic functionality test failed. Check for missing dependencies.");
    }

    await this.generateStartScript();

    console.log("\n🎉 Migration completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Review environment variables in .env file");
    console.log("2. Run 'deno task cache:warm-up' to pre-load packages");
    console.log("3. Start kernel with 'deno task start' or './start-deno-kernel.sh'");
    console.log("4. Connect from your notebook web client");
  }
}

function printHelp(): void {
  console.log(`
🔄 Anode Kernel Migration Helper
================================

Migrates from Node.js kernel to Deno kernel with better WASM support.

Usage:
  deno run --allow-all migrate.ts [options]

Options:
  --node-cache-dir <path>   Source Node.js cache directory
  --deno-cache-dir <path>   Target Deno cache directory
  --force                   Overwrite existing files
  --verbose, -v             Verbose output
  --dry-run                 Show what would be done without making changes
  --help, -h                Show this help

Examples:
  # Basic migration
  deno run --allow-all migrate.ts

  # Verbose mode with custom cache directory
  deno run --allow-all migrate.ts --verbose --node-cache-dir ./old-cache

  # Dry run to see what would happen
  deno run --allow-all migrate.ts --dry-run --verbose

Environment Variables:
  NOTEBOOK_ID              Notebook to serve (default: demo-notebook)
  OPENAI_API_KEY          OpenAI API key for AI features
  LIVESTORE_SYNC_URL      LiveStore sync URL (default: ws://localhost:8787)
  AUTH_TOKEN              Authentication token
`);
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["node-cache-dir", "deno-cache-dir"],
    boolean: ["force", "verbose", "dry-run", "help"],
    alias: { v: "verbose", h: "help" },
  });

  if (args.help) {
    printHelp();
    return;
  }

  const options: MigrationOptions = {
    nodeCacheDir: args["node-cache-dir"],
    denoCacheDir: args["deno-cache-dir"],
    force: args.force,
    verbose: args.verbose,
    dryRun: args["dry-run"],
  };

  const migrationHelper = new MigrationHelper(options);
  await migrationHelper.run();
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("💥 Migration failed:", error);
    Deno.exit(1);
  });
}
