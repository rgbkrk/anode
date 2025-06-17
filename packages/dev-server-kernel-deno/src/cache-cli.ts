#!/usr/bin/env -S deno run --allow-all

import { PyodideCacheManager, getCommonPackages, getEssentialPackages } from "./cache-utils.ts";
import { loadPyodide } from "pyodide";
import { parseArgs } from "@std/cli/parse-args";

interface CliOptions {
  command: string;
  packages?: string[];
  cacheDir?: string;
  maxAge?: number;
  verbose?: boolean;
}

class CacheCLI {
  private cacheManager: PyodideCacheManager;
  private verbose: boolean;

  constructor(cacheDir?: string, verbose = false) {
    this.cacheManager = new PyodideCacheManager(cacheDir);
    this.verbose = verbose;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  async warmUp(packages: string[]): Promise<void> {
    console.log(`🔥 Warming up cache with ${packages.length} packages...`);

    await this.cacheManager.ensureCacheDir();
    const cacheDir = this.cacheManager.getCacheDir();

    this.log(`📁 Cache directory: ${cacheDir}`);
    this.log(`📦 Packages: ${packages.join(', ')}`);

    try {
      // Load Pyodide with the cache directory
      console.log("🐍 Loading Pyodide...");
      const pyodide = await loadPyodide({
        packageCacheDir: cacheDir,
        stdout: this.verbose ? console.log : () => {},
        stderr: this.verbose ? console.error : () => {},
      });

      // Load packages after initialization to avoid Node.js stack issues
      console.log(`📦 Loading ${packages.length} packages...`);
      await pyodide.loadPackage(packages);

      console.log("✅ Cache warm-up completed successfully!");

      const stats = await this.cacheManager.getCacheStats();
      console.log(`📊 Cache now contains ${stats.packageCount} packages (${stats.totalSizeMB}MB)`);

    } catch (error) {
      console.error("❌ Failed to warm up cache:", error);
      Deno.exit(1);
    }
  }

  async stats(): Promise<void> {
    const stats = await this.cacheManager.getCacheStats();

    console.log("\n📊 Pyodide Package Cache Statistics");
    console.log("=====================================");
    console.log(`Cache Directory: ${stats.cacheDir}`);
    console.log(`Total Packages:  ${stats.packageCount}`);
    console.log(`Total Size:      ${stats.totalSizeMB} MB`);
    console.log("");

    if (stats.packages.length > 0) {
      console.log("Cached Packages:");
      console.log("---------------");
      stats.packages.sort().forEach(pkg => {
        console.log(`  • ${pkg}`);
      });
    } else {
      console.log("No packages cached yet.");
      console.log("Run 'deno task cache:warm-up' to populate the cache.");
    }
    console.log("");
  }

  async clear(): Promise<void> {
    console.log("🗑️  Clearing package cache...");
    await this.cacheManager.clearCache();
    console.log("✅ Cache cleared successfully!");
  }

  async cleanup(maxAge: number): Promise<void> {
    console.log(`🧹 Cleaning up packages older than ${maxAge} days...`);
    const removedCount = await this.cacheManager.clearOldCache(maxAge);
    console.log(`✅ Removed ${removedCount} old packages`);
  }

  async list(): Promise<void> {
    const packages = await this.cacheManager.listCachedPackages();

    if (packages.length === 0) {
      console.log("No packages cached yet.");
      console.log("Run 'deno task cache:warm-up' to populate the cache.");
      return;
    }

    console.log(`\n📦 Cached Packages (${packages.length}):`);
    console.log("========================");
    packages.sort().forEach(pkg => {
      console.log(`  ${pkg}`);
    });
    console.log("");
  }

  async check(packages: string[]): Promise<void> {
    console.log(`🔍 Checking cache status for packages...`);
    console.log("");

    for (const pkg of packages) {
      const cached = await this.cacheManager.isPackageCached(pkg);
      const status = cached ? "✅ CACHED" : "❌ NOT CACHED";
      console.log(`  ${pkg.padEnd(20)} ${status}`);
    }
    console.log("");
  }
}

function parseCliArgs(): CliOptions {
  const args = parseArgs(Deno.args, {
    string: ["cache-dir", "max-age", "packages"],
    boolean: ["verbose", "essential", "common", "help"],
    alias: { v: "verbose", h: "help" },
  });

  const options: CliOptions = {
    command: args._[0]?.toString() || 'help',
    packages: [],
    verbose: args.verbose || false,
  };

  if (args["cache-dir"]) {
    options.cacheDir = args["cache-dir"];
  }

  if (args["max-age"]) {
    options.maxAge = parseInt(args["max-age"], 10);
  }

  if (args.essential) {
    options.packages = getEssentialPackages();
  } else if (args.common) {
    options.packages = getCommonPackages();
  } else if (args.packages) {
    options.packages = args.packages.split(',').map(p => p.trim());
  } else {
    // Add remaining args as package names
    options.packages = args._.slice(1).map(arg => arg.toString());
  }

  return options;
}

function printHelp(): void {
  console.log(`
🐍 Anode Pyodide Package Cache Manager (Deno)
==============================================

Usage:
  deno task cache-cli <command> [options] [packages...]

Commands:
  warm-up    Pre-load packages into cache (downloads if needed)
  stats      Show cache statistics
  list       List all cached packages
  clear      Clear entire cache
  cleanup    Remove packages older than specified days
  check      Check if specific packages are cached
  help       Show this help message

Options:
  --cache-dir <path>    Custom cache directory
  --max-age <days>      Max age for cleanup command (default: 30)
  --verbose, -v         Verbose output
  --essential           Use essential package set
  --common              Use common package set
  --packages <list>     Comma-separated package list

Examples:
  # Warm up cache with essential packages
  deno task cache-cli warm-up --essential

  # Warm up cache with common packages (includes scipy, sympy, etc.)
  deno task cache-cli warm-up --common

  # Warm up specific packages
  deno task cache-cli warm-up numpy pandas matplotlib requests

  # Show cache statistics
  deno task cache-cli stats

  # List cached packages
  deno task cache-cli list

  # Check if specific packages are cached
  deno task cache-cli check numpy pandas requests

  # Clean up packages older than 7 days
  deno task cache-cli cleanup --max-age 7

  # Clear entire cache
  deno task cache-cli clear

  # Use custom cache directory
  deno task cache-cli stats --cache-dir /custom/path

Package Sets:
  Essential: ipython, matplotlib, numpy, pandas, requests, micropip
  Common:    Essential + scipy, sympy, bokeh, plotly
`);
}

async function main(): Promise<void> {
  const options = parseCliArgs();
  const cli = new CacheCLI(options.cacheDir, options.verbose);

  try {
    switch (options.command) {
      case 'warm-up':
      case 'warmup':
        const packages = options.packages?.length
          ? options.packages
          : getEssentialPackages();
        await cli.warmUp(packages);
        break;

      case 'stats':
        await cli.stats();
        break;

      case 'list':
        await cli.list();
        break;

      case 'clear':
        await cli.clear();
        break;

      case 'cleanup':
        const maxAge = options.maxAge || 30;
        await cli.cleanup(maxAge);
        break;

      case 'check':
        if (!options.packages?.length) {
          console.error("❌ No packages specified for check command");
          Deno.exit(1);
        }
        await cli.check(options.packages);
        break;

      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${options.command}`);
        console.log("Run 'deno task cache-cli help' for usage information.");
        Deno.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    Deno.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main().catch(console.error);
}

export { CacheCLI };
