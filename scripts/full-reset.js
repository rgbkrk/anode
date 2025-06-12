#!/usr/bin/env node

/**
 * Full Reset Script
 *
 * Comprehensive cleanup of all LiveStore storage including both
 * server-side storage and browser storage guidance.
 */

import { promises as fs } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { spawn } from "child_process";

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
  magenta: "\x1b[35m",
};

function log(message, color = "") {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, cwd = rootDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, cwd, stdio: 'pipe' });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

async function main() {
  log("🧹 FULL RESET: Cleaning ALL LiveStore storage...", colors.bright + colors.magenta);
  log("This includes server storage, build artifacts, and browser storage guidance.", colors.cyan);

  // Step 1: Run the existing clean-store script
  log("\n" + "=".repeat(60), colors.cyan);
  log("📦 Step 1: Running server-side cleanup...", colors.bright + colors.blue);

  try {
    const { stdout } = await runCommand("node scripts/clean-store.js");
    // The clean-store script already has good output, so we'll just run it
    console.log(stdout);
  } catch (error) {
    log(`❌ Server cleanup failed: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Step 2: Browser storage instructions
  log("\n" + "=".repeat(60), colors.magenta);
  log("🌐 Step 2: Browser Storage Cleanup", colors.bright + colors.magenta);

  log("\n📱 Your browser has persistent LiveStore data that needs manual clearing:", colors.yellow);
  log("   • OPFS (Origin Private File System) - Main storage location");
  log("   • Session Storage - Client session identity");
  log("   • Local Storage - Additional cached data");
  log("   • SharedWorker/WebWorker state");

  log("\n🧹 Choose your cleanup method:", colors.bright);

  log("\n🎯 Method 1: URL Reset (Recommended)", colors.green);
  log("   1. Visit your app with ?reset parameter:");
  log("   2. http://localhost:5173?reset");
  log("   3. The app will automatically clear browser storage");

  log("\n🔧 Method 2: Manual DevTools", colors.blue);
  log("   1. Open DevTools (F12)");
  log("   2. Go to Application → Storage");
  log("   3. Clear all storage types:");
  log("      - OPFS (Origin Private File System)");
  log("      - Session Storage");
  log("      - Local Storage");
  log("      - IndexedDB (if any)");
  log("   4. Reload the page");

  log("\n🕵️ Method 3: Incognito Mode", colors.cyan);
  log("   1. Open an incognito/private window");
  log("   2. Navigate to your app");
  log("   3. This guarantees a clean browser state");

  log("\n⚡ Method 4: Hard Browser Reset", colors.yellow);
  log("   1. Close all browser tabs with your app");
  log("   2. Clear all browsing data for localhost");
  log("   3. Restart your browser");
  log("   4. This is the nuclear option");

  // Step 3: Final verification instructions
  log("\n" + "=".repeat(60), colors.green);
  log("✅ Step 3: Verification", colors.bright + colors.green);

  log("\n🔍 After cleaning browser storage, verify reset worked:", colors.bright);
  log("   1. Start your dev server: pnpm dev");
  log("   2. Open your app in browser");
  log("   3. Check that no old data appears");
  log("   4. Create a test notebook to verify functionality");

  log("\n💡 Signs of incomplete cleanup:", colors.yellow);
  log("   • Old notebooks still appear");
  log("   • Cell outputs from previous sessions");
  log("   • Execution states that don't match server");
  log("   • Sync conflicts or duplicate data");

  // Step 4: Additional troubleshooting
  log("\n" + "=".repeat(60), colors.cyan);
  log("🛠️  Troubleshooting", colors.bright + colors.cyan);

  log("\n🔄 If you still see old data after cleanup:", colors.bright);
  log("   1. Check browser console for errors");
  log("   2. Verify sync backend is running (pnpm dev:sync)");
  log("   3. Try the cleanup-queue script: pnpm cleanup-queue");
  log("   4. Use incognito mode for testing");
  log("   5. Check the LiveStore devtools at localhost:5173/_livestore");

  log("\n🎯 Quick reset workflow:", colors.green);
  log("   1. Run: node scripts/full-reset.js");
  log("   2. Visit: http://localhost:5173?reset");
  log("   3. Start fresh with: pnpm dev");

  // Summary
  log("\n" + "=".repeat(60), colors.magenta);
  log("🎉 FULL RESET COMPLETE!", colors.bright + colors.magenta);
  log("\n📋 What was cleaned:", colors.bright);
  log("   ✅ Server-side storage (databases, eventlogs)");
  log("   ✅ Cloudflare Worker storage");
  log("   ✅ Build artifacts and caches");
  log("   ✅ Temporary files and logs");
  log("   📝 Browser storage (requires manual action)");

  log("\n🚀 Next steps:", colors.bright + colors.green);
  log("   1. Clear browser storage using one of the methods above");
  log("   2. Run: pnpm dev");
  log("   3. Visit: http://localhost:5173");
  log("   4. Enjoy your completely clean LiveStore environment!");

  log("\n💪 Pro tip: Bookmark http://localhost:5173?reset for quick browser resets!", colors.cyan);
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
