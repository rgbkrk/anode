// Re-export AnsiOutput from the notebook folder for convenience
export { AnsiStreamOutput } from "../notebook/AnsiOutput.js";

// Note: Heavy output components are now dynamically imported in RichOutput.tsx
// to reduce bundle size. They are no longer exported from this index file.

// Helper types
export interface OutputData {
  "text/plain"?: string;
  "text/markdown"?: string;
  "text/html"?: string;
  "image/svg+xml"?: string;
  "image/svg"?: string;
  "image/png"?: string;
  "image/jpeg"?: string;
  "application/json"?: unknown;
  "application/vnd.anode.aitool+json"?: ToolCallData;
  "application/vnd.jupyter.widget-view+json"?: JupyterWidgetData;
  "application/vnd.jupyter.widget-state+json"?: JupyterWidgetState;
  [key: string]: unknown;
}

export interface ToolCallData {
  tool_call_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  status: "success" | "error";
  timestamp: string;
  execution_time_ms?: number;
}

export interface JupyterWidgetData {
  version_major: number;
  version_minor: number;
  model_id: string;
}

export interface JupyterWidgetState {
  state: {
    _model_module: string;
    _model_name: string;
    _model_module_version: string;
    _view_module: string;
    _view_name: string;
    _view_module_version: string;
    _esm?: string;
    _css?: string;
    [key: string]: any;
  };
  buffer_paths?: Array<Array<string | number>>;
}
