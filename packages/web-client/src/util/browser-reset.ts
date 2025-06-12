/**
 * Browser Reset Utilities
 *
 * Functions to programmatically clear browser storage for development.
 * Used primarily for cleaning LiveStore OPFS, sessionStorage, and other
 * cached data that might persist between development sessions.
 */

// Check if we're in development mode
const isDev = import.meta.env.DEV;

/**
 * Clear all browser storage related to LiveStore
 */
export async function clearAllBrowserStorage(): Promise<void> {
  if (!isDev) {
    console.warn('Browser storage clearing is only available in development mode');
    return;
  }

  console.log('🧹 Clearing all browser storage...');

  const results: { storage: string; success: boolean; error?: string }[] = [];

  // 1. Clear sessionStorage
  try {
    sessionStorage.clear();
    results.push({ storage: 'sessionStorage', success: true });
    console.log('  ✅ Cleared sessionStorage');
  } catch (error) {
    results.push({
      storage: 'sessionStorage',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.error('  ❌ Failed to clear sessionStorage:', error);
  }

  // 2. Clear localStorage
  try {
    localStorage.clear();
    results.push({ storage: 'localStorage', success: true });
    console.log('  ✅ Cleared localStorage');
  } catch (error) {
    results.push({
      storage: 'localStorage',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.error('  ❌ Failed to clear localStorage:', error);
  }

  // 3. Clear IndexedDB (if any LiveStore databases exist)
  try {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        const deleteRequest = indexedDB.deleteDatabase(db.name);
        await new Promise((resolve, reject) => {
          deleteRequest.onsuccess = () => resolve(void 0);
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      }
    }
    results.push({ storage: 'indexedDB', success: true });
    console.log('  ✅ Cleared IndexedDB databases');
  } catch (error) {
    results.push({
      storage: 'indexedDB',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.error('  ❌ Failed to clear IndexedDB:', error);
  }

  // 4. Clear OPFS (Origin Private File System) if supported
  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    try {
      const opfsRoot = await navigator.storage.getDirectory();

      // Remove all files and directories
      for await (const [name, handle] of opfsRoot.entries()) {
        try {
          await opfsRoot.removeEntry(name, { recursive: true });
        } catch (removeError) {
          console.warn(`  ⚠️  Failed to remove OPFS entry ${name}:`, removeError);
        }
      }

      results.push({ storage: 'OPFS', success: true });
      console.log('  ✅ Cleared OPFS (Origin Private File System)');
    } catch (error) {
      results.push({
        storage: 'OPFS',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('  ❌ Failed to clear OPFS:', error);
    }
  } else {
    console.log('  ⏭️  OPFS not supported in this browser');
  }

  // 5. Clear any caches
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      results.push({ storage: 'caches', success: true });
      console.log('  ✅ Cleared browser caches');
    } catch (error) {
      results.push({
        storage: 'caches',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('  ❌ Failed to clear caches:', error);
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n🎯 Browser storage cleanup complete:`);
  console.log(`  ✅ Successfully cleared: ${successful} storage types`);
  if (failed > 0) {
    console.log(`  ❌ Failed to clear: ${failed} storage types`);
  }

  return;
}

/**
 * Check if URL has reset parameter and clear storage if found
 */
export function handleResetParameter(): boolean {
  if (!isDev) return false;

  const url = new URL(window.location.href);
  const shouldReset = url.searchParams.has('reset');

  if (shouldReset) {
    console.log('🔄 Reset parameter detected, clearing browser storage...');

    // Clear the parameter from URL first
    url.searchParams.delete('reset');
    window.history.replaceState(null, '', url.toString());

    // Clear storage asynchronously
    clearAllBrowserStorage().then(() => {
      console.log('✅ Browser storage cleared due to reset parameter');
      console.log('🔄 Page will reload to apply clean state...');

      // Small delay to let console messages show
      setTimeout(() => {
        window.location.reload();
      }, 500);
    });

    return true;
  }

  return false;
}

/**
 * Add global reset function for console access
 */
export function setupGlobalReset(): void {
  if (!isDev) return;

  // Make reset function available globally for console access
  (window as any).__resetBrowserStorage = clearAllBrowserStorage;

  console.log('🛠️  Dev mode: Browser reset available via __resetBrowserStorage()');
}

/**
 * Display browser storage usage information
 */
export async function showStorageInfo(): Promise<void> {
  if (!isDev) return;

  console.log('📊 Browser Storage Information:');

  // Storage quota info
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const usedMB = Math.round((estimate.usage || 0) / 1024 / 1024 * 100) / 100;
      const quotaMB = Math.round((estimate.quota || 0) / 1024 / 1024 * 100) / 100;
      const usedPercent = quotaMB > 0 ? Math.round((usedMB / quotaMB) * 100) : 0;

      console.log(`  💾 Storage quota: ${usedMB}MB / ${quotaMB}MB (${usedPercent}%)`);
    } catch (error) {
      console.log('  ❌ Could not get storage estimate:', error);
    }
  }

  // Session storage
  const sessionItems = Object.keys(sessionStorage).length;
  console.log(`  🗂️  sessionStorage: ${sessionItems} items`);

  // Local storage
  const localItems = Object.keys(localStorage).length;
  console.log(`  🗂️  localStorage: ${localItems} items`);

  // IndexedDB
  try {
    const databases = await indexedDB.databases();
    console.log(`  🗄️  IndexedDB: ${databases.length} databases`);
  } catch (error) {
    console.log('  ❌ Could not enumerate IndexedDB databases');
  }

  // OPFS support
  const opfsSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;
  console.log(`  📁 OPFS support: ${opfsSupported ? '✅ Available' : '❌ Not supported'}`);
}

/**
 * Initialize browser reset utilities in development
 */
export function initBrowserReset(): void {
  if (!isDev) return;

  // Handle reset parameter on page load
  handleResetParameter();

  // Setup global functions
  setupGlobalReset();

  // Show storage info after a delay to not interfere with app startup
  setTimeout(() => {
    showStorageInfo();
  }, 1000);
}
