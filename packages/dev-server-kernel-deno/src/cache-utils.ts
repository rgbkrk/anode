import { join } from "@std/path";
import { exists, ensureDir } from "@std/fs";

export interface CacheConfig {
  cacheDir: string;
  packages: string[];
  maxCacheSize?: number; // MB
  maxCacheAge?: number; // days
}

export class PyodideCacheManager {
  private cacheDir: string;
  private lockFile: string;

  constructor(cacheDir?: string) {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "/tmp";
    this.cacheDir = cacheDir || join(homeDir, ".anode", "pyodide-cache");
    this.lockFile = join(this.cacheDir, ".cache-lock");
  }

  /**
   * Ensure cache directory exists
   */
  async ensureCacheDir(): Promise<void> {
    try {
      await ensureDir(this.cacheDir);
    } catch (error) {
      console.warn(`Failed to create cache directory ${this.cacheDir}:`, error);
    }
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Check if package is cached
   */
  async isPackageCached(packageName: string): Promise<boolean> {
    try {
      const files: string[] = [];
      for await (const dirEntry of Deno.readDir(this.cacheDir)) {
        if (dirEntry.isFile) {
          files.push(dirEntry.name);
        }
      }

      // Check if any cached file starts with the package name followed by a hyphen or dot
      // This handles versioned filenames like "numpy-2.0.2-cp312-cp312-pyodide_2024_0_wasm32.whl"
      return files.some(file => {
        const nameWithoutExt = file.substring(0, file.lastIndexOf('.')) || file;
        return nameWithoutExt.startsWith(`${packageName}-`) ||
               nameWithoutExt === packageName ||
               nameWithoutExt.startsWith(`${packageName}_`);
      });
    } catch {
      return false;
    }
  }

  /**
   * List all cached packages
   */
  async listCachedPackages(): Promise<string[]> {
    try {
      const files: string[] = [];
      for await (const dirEntry of Deno.readDir(this.cacheDir)) {
        if (dirEntry.isFile && (dirEntry.name.endsWith('.whl') || dirEntry.name.endsWith('.zip'))) {
          files.push(dirEntry.name);
        }
      }

      return files
        .map(file => {
          const nameWithoutExt = file.substring(0, file.lastIndexOf('.')) || file;
          // Extract base package name by taking everything before the first hyphen
          // e.g., "numpy-2.0.2-cp312..." -> "numpy"
          const packageName = nameWithoutExt.split('-')[0];
          return packageName;
        })
        // Remove duplicates since multiple versions might exist
        .filter((name, index, array) => array.indexOf(name) === index)
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * Get cache size in MB
   */
  async getCacheSize(): Promise<number> {
    try {
      let totalSize = 0;

      for await (const dirEntry of Deno.readDir(this.cacheDir)) {
        if (dirEntry.isFile) {
          const filePath = join(this.cacheDir, dirEntry.name);
          const stat = await Deno.stat(filePath);
          totalSize += stat.size;
        }
      }

      // Convert to MB with better precision for small files
      const sizeMB = totalSize / (1024 * 1024);
      return Math.round(sizeMB * 100) / 100; // Round to 2 decimals, but keep precision for small files
    } catch {
      return 0;
    }
  }

  /**
   * Clear old cache files based on age
   */
  async clearOldCache(maxAgeInDays: number = 30): Promise<number> {
    try {
      const now = Date.now();
      const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
      let removedCount = 0;

      for await (const dirEntry of Deno.readDir(this.cacheDir)) {
        if (dirEntry.name === '.cache-lock') continue; // Skip lock file

        if (dirEntry.isFile) {
          const filePath = join(this.cacheDir, dirEntry.name);
          const stat = await Deno.stat(filePath);
          const fileAge = now - stat.mtime!.getTime();

          if (fileAge > maxAge) {
            await Deno.remove(filePath);
            removedCount++;
            console.log(`Removed old cached file: ${dirEntry.name}`);
          }
        }
      }

      return removedCount;
    } catch (error) {
      console.warn("Failed to clear old cache:", error);
      return 0;
    }
  }

  /**
   * Clear entire cache
   */
  async clearCache(): Promise<void> {
    try {
      for await (const dirEntry of Deno.readDir(this.cacheDir)) {
        if (dirEntry.name === '.cache-lock') continue; // Skip lock file

        if (dirEntry.isFile) {
          const filePath = join(this.cacheDir, dirEntry.name);
          await Deno.remove(filePath);
        }
      }

      console.log(`Cache cleared: ${this.cacheDir}`);
    } catch (error) {
      console.warn("Failed to clear cache:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    cacheDir: string;
    packageCount: number;
    totalSizeMB: number;
    packages: string[];
  }> {
    const packages = await this.listCachedPackages();
    const totalSizeMB = await this.getCacheSize();

    return {
      cacheDir: this.cacheDir,
      packageCount: packages.length,
      totalSizeMB,
      packages,
    };
  }

  /**
   * Warm up cache by pre-loading common packages
   * This is useful for CI/CD or development environment setup
   */
  async warmUpCache(packages: string[] = [
    "ipython",
    "matplotlib",
    "numpy",
    "pandas",
    "requests",
    "micropip",
    "scipy",
    "sympy",
    "bokeh",
    "plotly"
  ]): Promise<void> {
    console.log(`🔥 Warming up package cache with ${packages.length} packages...`);

    // This would require importing and using Pyodide temporarily
    // For now, just ensure the cache directory exists
    await this.ensureCacheDir();

    console.log(`📁 Cache directory ready: ${this.cacheDir}`);
    console.log(`📦 Packages to cache: ${packages.join(', ')}`);
    console.log(`💡 Packages will be cached on first use by Pyodide`);
  }

  /**
   * Create a cache lock to prevent concurrent access issues
   */
  async acquireLock(): Promise<boolean> {
    try {
      await Deno.writeTextFile(this.lockFile, Date.now().toString(), { createNew: true });
      return true;
    } catch {
      return false; // Lock already exists
    }
  }

  /**
   * Release cache lock
   */
  async releaseLock(): Promise<void> {
    try {
      await Deno.remove(this.lockFile);
    } catch {
      // Lock file might not exist, ignore
    }
  }

  /**
   * Check if cache is locked
   */
  async isLocked(): Promise<boolean> {
    try {
      await Deno.stat(this.lockFile);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Default cache manager instance
 */
export const defaultCacheManager = new PyodideCacheManager();

/**
 * Get cache configuration for Pyodide loadPyodide() options
 */
export function getCacheConfig(customCacheDir?: string): { packageCacheDir: string } {
  const cacheManager = customCacheDir
    ? new PyodideCacheManager(customCacheDir)
    : defaultCacheManager;

  return {
    packageCacheDir: cacheManager.getCacheDir(),
  };
}

/**
 * Helper function to get common packages list
 */
export function getCommonPackages(): string[] {
  return [
    "ipython",
    "matplotlib",
    "numpy",
    "pandas",
    "requests",
    "micropip",
    "scipy",      // Scientific computing
    "sympy",      // Symbolic mathematics
    "bokeh",      // Interactive visualization
    "plotly",     // Plotting library
  ];
}

/**
 * Get essential packages (minimal set for basic functionality)
 */
export function getEssentialPackages(): string[] {
  return [
    "ipython",
    "matplotlib",
    "numpy",
    "pandas",
    "requests",
    "micropip",
  ];
}
