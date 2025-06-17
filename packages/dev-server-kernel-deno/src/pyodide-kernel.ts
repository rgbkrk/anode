// TODO: Pyodide v0.27.7 has import path issues in Node.js environments
// The package expects files in src/js/ which don't exist in the npm package structure
// This affects integration tests but the kernel should work in browser environments
import { loadPyodide } from "npm:pyodide";
import {
  OutputType,
  ErrorOutputData,
  RichOutputData,
  StreamOutputData,
} from "../../../shared/schema.ts";
import {
  defaultCacheManager,
  getCacheConfig,
  getEssentialPackages,
} from "./cache-utils.ts";

export interface OutputData {
  type: OutputType;
  data: RichOutputData | ErrorOutputData | StreamOutputData | unknown;
  metadata?: Record<string, unknown>;
  position: number;
}

export class PyodideKernel {
  private pyodide: any | null = null;
  private readonly notebookId: string;
  private initialized = false;
  private outputs: OutputData[] = [];
  private outputPosition = 0;

  constructor(notebookId: string) {
    this.notebookId = notebookId;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log(
      `🐍 Initializing Pyodide kernel for notebook ${this.notebookId}`,
    );

    try {
      // Ensure cache directory exists
      await defaultCacheManager.ensureCacheDir();

      // Get cache configuration
      const cacheConfig = getCacheConfig();

      // Get essential packages for initialization
      const essentialPackages = getEssentialPackages();

      console.log(`📦 Using package cache: ${cacheConfig.packageCacheDir}`);
      console.log(`📦 Will load packages: ${essentialPackages.join(", ")}`);

      // Use modern Deno + Pyodide loading approach
      this.pyodide = await loadPyodide({
        ...cacheConfig, // Cache packages locally for faster subsequent loads
        stdout: (text: string) => {
          console.log("[py stdout]:", text);
          this.addStreamOutput("stdout", text);
        },
        stderr: (text: string) => {
          console.error("[py stderr]:", text);
          this.addStreamOutput("stderr", text);
        },
      });

      // Load essential packages after Pyodide initialization
      console.log(`📦 Loading essential packages...`);
      try {
        await this.pyodide!.loadPackage(essentialPackages);
        console.log(
          `✅ Successfully loaded ${essentialPackages.length} packages`,
        );
      } catch (packageError) {
        console.warn(`⚠️ Some packages failed to load:`, packageError);
        // Try loading packages individually to identify which ones fail
        for (const pkg of essentialPackages) {
          try {
            await this.pyodide!.loadPackage([pkg]);
            console.log(`✅ Loaded ${pkg}`);
          } catch (err) {
            console.warn(`❌ Failed to load ${pkg}:`, err);
          }
        }
      }

      // Log cache statistics
      const cacheStats = await defaultCacheManager.getCacheStats();
      console.log(
        `📊 Cache stats: ${cacheStats.packageCount} packages, ${cacheStats.totalSizeMB}MB`,
      );
    } catch (error) {
      console.error("❌ Failed to initialize Pyodide kernel:", error);
      throw error;
    }

    // Set up the IPython environment with custom display hooks
    await this.pyodide!.runPythonAsync(`
import sys
import io
import json
import builtins
from IPython.core.interactiveshell import InteractiveShell
from IPython.core.displayhook import DisplayHook
from IPython.core.displaypub import DisplayPublisher
from IPython.core.history import HistoryManager
import matplotlib
import matplotlib.pyplot as plt

# Configure matplotlib for SVG output
matplotlib.use('svg')

# Custom History Manager (no-op for lite environment)
class LiteHistoryManager(HistoryManager):
    def __init__(self, shell=None, config=None, **traits):
        self.enabled = False
        super().__init__(shell=shell, config=config, **traits)

# Custom Display Publisher for handling display() calls
class LiteDisplayPublisher(DisplayPublisher):
    def __init__(self, shell=None, *args, **kwargs):
        super().__init__(shell, *args, **kwargs)
        self.js_callback = None

    def publish(self, data, metadata=None, source=None, *, transient=None, update=False, **kwargs):
        if self.js_callback:
            self.js_callback(data, metadata or {}, transient or {})
        # Don't call super() to avoid duplicate outputs

    def clear_output(self, wait=False):
        # For now, just log - could implement UI clearing later
        print(f"[Clear Output] wait={wait}")

# Custom Display Hook for execution results
class LiteDisplayHook(DisplayHook):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.js_callback = None
        self.execution_count = 0

    def __call__(self, result):
        """Override call to capture execution results"""
        if result is not None:
            # Increment execution count
            self.execution_count += 1

            # Format the result using IPython's standard formatting
            format_dict, md_dict = self.compute_format_data(result)

            # Send to JavaScript if we have a callback
            if self.js_callback and format_dict:
                self.js_callback(self.execution_count, format_dict, md_dict or {})

            # NOTE: We don't need to call the super because we're passing the result back in the callback
            # super().__call__(result)

        return result

# Create the shell instance with custom display classes
shell = InteractiveShell.instance(
    displayhook_class=LiteDisplayHook,
    display_pub_class=LiteDisplayPublisher,
)

# Override history manager
shell.history_manager = LiteHistoryManager(shell=shell, parent=shell)

# Custom matplotlib show function that uses IPython display
_original_show = plt.show

def _capture_matplotlib_show(block=None):
    """Capture matplotlib plots as SVG and send via display system"""
    if plt.get_fignums():
        fig = plt.gcf()
        svg_buffer = io.StringIO()

        try:
            fig.savefig(svg_buffer, format='svg', bbox_inches='tight',
                       facecolor='white', edgecolor='none')
            svg_content = svg_buffer.getvalue()
            svg_buffer.close()

            # Use IPython's display system
            from IPython.display import display, SVG
            display(SVG(svg_content))

            plt.clf()
        except Exception as e:
            print(f"Error capturing plot: {e}")

    return _original_show(block=block) if block is not None else _original_show()

plt.show = _capture_matplotlib_show

print("🐍 IPython environment ready with rich display support (Deno optimized)")
`);

    this.initialized = true;
    console.log(`✅ Pyodide kernel ready for notebook ${this.notebookId}`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async execute(code: string): Promise<OutputData[]> {
    if (!this.initialized) await this.initialize();
    if (!code.trim()) return [];

    // Reset output collection
    this.outputs = [];
    this.outputPosition = 0;

    try {
      // Set up JavaScript callbacks for this execution
      let displayCallbackCount = 0;
      let executionCallbackCount = 0;

      (this.pyodide!.globals as any).set(
        "js_display_callback",
        (data: any, metadata: any, transient: any) => {
          displayCallbackCount++;
          const jsData = data && data.toJs ? data.toJs() : data;
          const jsMeta = metadata && metadata.toJs ? metadata.toJs() : metadata;
          this.addDisplayData(jsData, jsMeta);
        },
      );

      (this.pyodide!.globals as any).set(
        "js_execution_callback",
        (execution_count: number, data: any, metadata: any) => {
          executionCallbackCount++;
          const jsData = data && data.toJs ? data.toJs() : data;
          const jsMeta = metadata && metadata.toJs ? metadata.toJs() : metadata;
          this.addExecutionResult(jsData, jsMeta);
        },
      );

      // Wire up the callbacks
      await this.pyodide!.runPythonAsync(`
# Set up callbacks for this execution
shell.display_pub.js_callback = js_display_callback
shell.displayhook.js_callback = js_execution_callback
`);

      // Execute the code using runPythonAsync to enable async features like networking
      try {
        // Store the code in a Python variable to avoid quoting issues
        this.pyodide!.globals.set("user_code", code);

        // Execute through IPython shell using runPythonAsync
        await this.pyodide!.runPythonAsync(`
# Execute user code through IPython shell to maintain display hooks
result = shell.run_cell(user_code, store_history=True)

# Check for execution errors and re-raise them so they're caught by runPythonAsync
if result.error_before_exec:
    raise result.error_before_exec
elif result.error_in_exec:
    raise result.error_in_exec
`);
      } catch (pythonError: any) {
        // Handle any Python exceptions during execution
        this.addError(
          "PythonError",
          pythonError.message || "Execution failed",
          [pythonError.toString()],
        );
      }
    } catch (err: unknown) {
      const errorData: ErrorOutputData = {
        ename: (err as Error)?.name ?? "KernelError",
        evalue: (err as Error)?.message ?? "Kernel execution failed",
        traceback: [(err as Error)?.stack ?? ""],
      };

      this.outputs.push({
        type: "error",
        data: errorData,
        position: this.outputPosition++,
      });
    }

    return this.outputs;
  }

  private addStreamOutput(name: "stdout" | "stderr", text: string): void {
    // Only add non-empty text and filter out our debug messages
    if (
      text.trim() &&
      !text.includes("[py stdout]") &&
      !text.includes("[py stderr]")
    ) {
      // Look for existing stream output of the same type
      const lastOutput = this.outputs[this.outputs.length - 1];

      if (
        lastOutput &&
        lastOutput.type === "stream" &&
        (lastOutput.data as StreamOutputData).name === name
      ) {
        // Update existing stream output by appending new text with newline
        const streamData = lastOutput.data as StreamOutputData;
        streamData.text += (streamData.text.endsWith("\n") ? "" : "\n") + text;
      } else {
        // Create new stream output
        this.outputs.push({
          type: "stream",
          data: {
            name: name,
            text: text,
          } as StreamOutputData,
          metadata: {},
          position: this.outputPosition++,
        });
      }
    }
  }

  private addDisplayData(data: any, metadata: any): void {
    this.outputs.push({
      type: "display_data",
      data: this.formatDisplayData(data),
      metadata: metadata || {},
      position: this.outputPosition++,
    });
  }

  private addExecutionResult(data: any, metadata: any): void {
    if (data && Object.keys(data).length > 0) {
      this.outputs.push({
        type: "execute_result",
        data: this.formatDisplayData(data),
        metadata: metadata || {},
        position: this.outputPosition++,
      });
    }
  }

  private addError(ename: string, evalue: string, traceback: string[]): void {
    this.outputs.push({
      type: "error",
      data: {
        ename,
        evalue,
        traceback,
      } as ErrorOutputData,
      position: this.outputPosition++,
    });
  }

  private formatDisplayData(data: any): RichOutputData {
    if (!data || typeof data !== "object") {
      return { "text/plain": String(data || "") };
    }

    const formatted: RichOutputData = {};

    // Handle common MIME types
    const mimeTypes = [
      "text/plain",
      "text/html",
      "text/markdown",
      "application/json",
      "image/png",
      "image/jpeg",
      "image/svg+xml",
      "application/pdf",
    ];

    for (const mimeType of mimeTypes) {
      if (data[mimeType] !== undefined) {
        formatted[mimeType] = data[mimeType];
      }
    }

    // Ensure we always have text/plain
    if (!formatted["text/plain"] && Object.keys(formatted).length === 0) {
      formatted["text/plain"] = String(data);
    }

    return formatted;
  }

  async terminate(): Promise<void> {
    if (this.pyodide) {
      // Clean up IPython shell
      await this.pyodide.runPythonAsync(`
try:
    shell.reset()
except:
    pass
`);
    }

    this.pyodide = null;
    this.initialized = false;
  }
}
