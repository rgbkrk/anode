#!/usr/bin/env node

/**
 * Clean Store Script
 *
 * Removes all LiveStore storage, build artifacts, and cached data
 * to provide a clean slate for development and testing.
 */

import { promises as fs } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// ANSI color codes for better output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "") {
  console.log(`${color}${message}${colors.reset}`);
}

async function pathExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function removeDirectory(path, description) {
  if (await pathExists(path)) {
    try {
      await fs.rm(path, { recursive: true, force: true });
      log(`   ✅ Removed ${description}`, colors.green);
      return true;
    } catch (error) {
      log(
        `   ❌ Failed to remove ${description}: ${error.message}`,
        colors.red,
      );
      return false;
    }
  } else {
    log(`   ⏭️  ${description} (not found)`, colors.yellow);
    return false;
  }
}

async function removePattern(baseDir, pattern, description) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    let removed = 0;

    for (const entry of entries) {
      if (entry.name.match(pattern)) {
        const fullPath = join(baseDir, entry.name);
        if (entry.isDirectory()) {
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          await fs.unlink(fullPath);
        }
        removed++;
      }
    }

    if (removed > 0) {
      log(`   ✅ Removed ${removed} ${description}`, colors.green);
    } else {
      log(`   ⏭️  No ${description} found`, colors.yellow);
    }

    return removed;
  } catch (error) {
    if (error.code !== "ENOENT") {
      log(`   ❌ Failed to clean ${description}: ${error.message}`, colors.red);
    }
    return 0;
  }
}

async function main() {
  log(
    "\n🧹 Cleaning all LiveStore storage and build artifacts...",
    colors.bright + colors.cyan,
  );

  let totalRemoved = 0;

  // 1. Cloudflare Worker storage (.wrangler directories)
  log("\n📦 Cloudflare Worker Storage:", colors.bright + colors.blue);
  if (
    await removeDirectory(
      join(rootDir, "packages/docworker/.wrangler"),
      "Cloudflare .wrangler directory",
    )
  ) {
    totalRemoved++;
  }

  // 2. Kernel server storage (tmp directories)
  log("\n🐍 Kernel Server Storage:", colors.bright + colors.blue);
  if (
    await removeDirectory(
      join(rootDir, "packages/dev-server-kernel-ls-client/tmp"),
      "Kernel server tmp directory",
    )
  ) {
    totalRemoved++;
  }

  // 3. Build artifacts (dist directories)
  log("\n🔨 Build Artifacts:", colors.bright + colors.blue);
  const packages = ["schema", "dev-server-kernel-ls-client"];
  for (const pkg of packages) {
    if (
      await removeDirectory(
        join(rootDir, `packages/${pkg}/dist`),
        `${pkg} dist directory`,
      )
    ) {
      totalRemoved++;
    }
  }

  // 4. Vite cache
  log("\n⚡ Vite Cache:", colors.bright + colors.blue);
  if (
    await removeDirectory(
      join(rootDir, "packages/web-client/node_modules/.vite"),
      "Vite cache directory",
    )
  ) {
    totalRemoved++;
  }

  // 5. Other common build/cache directories
  log("\n🗂️  Other Cache Directories:", colors.bright + colors.blue);
  const cachePatterns = [
    { path: rootDir, pattern: /^\.turbo$/, desc: "Turbo cache" },
    {
      path: join(rootDir, "packages/web-client"),
      pattern: /^\.next$/,
      desc: "Next.js cache",
    },
    {
      path: join(rootDir, "packages/web-client"),
      pattern: /^build$/,
      desc: "Web client build",
    },
    {
      path: join(rootDir, "packages/web-client"),
      pattern: /^out$/,
      desc: "Web client output",
    },
  ];

  for (const { path, pattern, desc } of cachePatterns) {
    const removed = await removePattern(path, pattern, desc);
    if (removed > 0) totalRemoved += removed;
  }

  // 6. SQLite databases and logs (be more selective)
  log("\n🗄️  Database Files:", colors.bright + colors.blue);
  const dbDirs = [
    join(rootDir, "packages/dev-server-kernel-ls-client"),
    join(rootDir, "packages/docworker"),
  ];

  for (const dir of dbDirs) {
    const removed = await removePattern(
      dir,
      /\.(db|sqlite|sqlite3|log)$/,
      "database files",
    );
    if (removed > 0) totalRemoved += removed;
  }

  // 7. Temporary and log files
  log("\n📋 Temporary Files:", colors.bright + colors.blue);
  const tempPatterns = [
    { path: rootDir, pattern: /^\.tmp/, desc: "temporary directories" },
    { path: rootDir, pattern: /\.log$/, desc: "log files" },
    { path: rootDir, pattern: /\.pid$/, desc: "process ID files" },
  ];

  for (const { path, pattern, desc } of tempPatterns) {
    const removed = await removePattern(path, pattern, desc);
    if (removed > 0) totalRemoved += removed;
  }

  // Summary
  log("\n" + "=".repeat(60), colors.cyan);
  if (totalRemoved > 0) {
    log(
      `✅ Cleanup complete! Removed ${totalRemoved} items.`,
      colors.bright + colors.green,
    );
    log("\n💡 What was cleaned:", colors.bright);
    log("   • All LiveStore databases and eventlogs");
    log("   • Cloudflare Worker storage and D1 databases");
    log("   • Build artifacts (dist directories)");
    log("   • Vite and other build tool caches");
    log("   • Temporary files and logs");
    log(
      "\n🎯 You now have a completely clean state for development!",
      colors.green,
    );
  } else {
    log("✨ Everything was already clean!", colors.bright + colors.green);
  }

  // Browser storage reminder
  log("\n" + "=".repeat(60), colors.yellow);
  log(
    "⚠️  IMPORTANT: Browser Storage Not Cleared",
    colors.bright + colors.yellow,
  );
  log(
    "\n📱 Your browser may still have cached LiveStore data in:",
    colors.yellow,
  );
  log("   • OPFS (Origin Private File System) - where LiveStore persists data");
  log("   • Session Storage - for client session identity");
  log("   • Local Storage - for any additional cached data");
  log("\n🧹 To clear browser storage:", colors.bright);
  log("   1. Open DevTools (F12) → Application → Storage");
  log("   2. Clear OPFS, Session Storage, and Local Storage");
  log("   3. OR visit your app with ?reset in URL for automatic cleanup");
  log("   4. OR use an incognito window for a truly clean state");
  log(
    "\n💡 If you see old data after cleanup, this is likely the cause!",
    colors.bright + colors.yellow,
  );

  log("\n🚀 Ready to start fresh. Run `pnpm dev` to begin.", colors.cyan);
}

// Handle errors gracefully
process.on("uncaughtException", (error) => {
  log(`\n💥 Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  log(`\n💥 Unhandled rejection: ${reason}`, colors.red);
  process.exit(1);
});

// Run the script
main().catch((error) => {
  log(`\n❌ Script failed: ${error.message}`, colors.red);
  process.exit(1);
});
