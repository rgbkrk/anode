/**
 * Anywidget Output Component for Anode
 *
 * This component renders anywidget widgets within Anode notebooks by:
 * - Loading the widget's ESM module dynamically
 * - Creating a LiveStore-backed model that syncs with the backend
 * - Managing the widget lifecycle (initialize, render, cleanup)
 * - Handling CSS injection for widget styling
 */

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@livestore/react";
import { LiveStoreAnywidgetModel } from "./AnywidgetModel";
import { tables, events } from "@runt/schema";
import { queryDb } from "@livestore/livestore";

interface AnywidgetOutputProps {
  modelId: string;
  esmCode: string;
  cssCode?: string;
}

interface AnyWidget {
  initialize?: (context: {
    model: any;
    experimental?: any;
  }) => Promise<(() => void) | void> | (() => void) | void;
  render?: (context: {
    model: any;
    el: HTMLElement;
    experimental?: any;
  }) => Promise<(() => void) | void> | (() => void) | void;
}

/**
 * Main anywidget output component
 */
export const AnywidgetOutput: React.FC<AnywidgetOutputProps> = ({
  modelId,
  esmCode,
  cssCode,
}) => {
  const { store } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<LiveStoreAnywidgetModel | null>(null);
  const [widget, setWidget] = useState<AnyWidget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Subscribe to model state changes from LiveStore
  const modelsQuery = React.useMemo(
    () =>
      queryDb(tables.anywidgetModels.select().where({ id: modelId }).limit(1)),
    [modelId]
  );
  const modelData = store.useQuery(modelsQuery);

  // Initialize model when modelData is available
  useEffect(() => {
    if (!modelData?.[0]) {
      // Model doesn't exist yet, create it optimistically
      store.commit(
        events.anywidgetModelCreated({
          modelId,
          initialState: {},
        })
      );
      return;
    }

    const liveStoreModel = new LiveStoreAnywidgetModel(
      modelId,
      store,
      modelData[0].state
    );
    setModel(liveStoreModel);
  }, [modelData, modelId, store]);

  // Load and initialize the ESM widget module
  useEffect(() => {
    if (!esmCode) return;

    const loadWidget = async () => {
      try {
        setError(null);

        // Create a blob URL for the ESM code
        const blob = new Blob([esmCode], { type: "application/javascript" });
        const moduleUrl = URL.createObjectURL(blob);

        try {
          const module = await import(/* @vite-ignore */ moduleUrl);
          const widgetDef = module.default;

          if (!isValidAnyWidget(widgetDef)) {
            throw new Error(
              "Module does not export a valid anywidget definition"
            );
          }

          // Initialize the widget definition (handle both function and object forms)
          const widgetInstance =
            typeof widgetDef === "function" ? await widgetDef() : widgetDef;

          setWidget(widgetInstance);
        } finally {
          // Clean up the blob URL
          URL.revokeObjectURL(moduleUrl);
        }
      } catch (error) {
        console.error("Failed to load anywidget ESM module:", error);
        setError(error instanceof Error ? error.message : String(error));
      }
    };

    loadWidget();
  }, [esmCode]);

  // Initialize and render the widget when both model and widget are ready
  useEffect(() => {
    if (!containerRef.current || !widget || !model) return;

    const initializeAndRender = async () => {
      try {
        setError(null);

        // Clear any previous content
        containerRef.current!.innerHTML = "";

        // Create experimental context (minimal implementation)
        const experimental = {
          invoke: async (_name: string, _msg: any, _options?: any) => {
            console.warn("anywidget.invoke not supported in Anode");
            throw new Error("anywidget.invoke not supported in Anode");
          },
        };

        // Initialize the widget if it has an initialize method
        let initCleanup: (() => void) | void;
        if (widget.initialize) {
          initCleanup = await widget.initialize({ model, experimental });
        }

        // Render the widget if it has a render method
        let renderCleanup: (() => void) | void;
        if (widget.render) {
          renderCleanup = await widget.render({
            model,
            el: containerRef.current!,
            experimental,
          });
        }

        // Store cleanup functions
        cleanupRef.current = () => {
          if (typeof renderCleanup === "function") {
            renderCleanup();
          }
          if (typeof initCleanup === "function") {
            initCleanup();
          }
        };
      } catch (error) {
        console.error("Failed to initialize/render anywidget:", error);
        setError(error instanceof Error ? error.message : String(error));
      }
    };

    initializeAndRender();

    // Cleanup function
    return () => {
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (error) {
          console.error("Error during anywidget cleanup:", error);
        }
        cleanupRef.current = null;
      }
    };
  }, [widget, model]);

  // Update model when LiveStore state changes (from other clients or backend)
  useEffect(() => {
    if (model && modelData?.[0]) {
      model.updateFromExternal(modelData[0].state);
    }
  }, [model, modelData]);

  // Inject CSS if provided
  useEffect(() => {
    if (!cssCode) return;

    const style = document.createElement("style");
    style.textContent = cssCode;
    style.setAttribute("data-anywidget-model", modelId);
    document.head.appendChild(style);

    return () => {
      // Clean up CSS when component unmounts
      const existingStyle = document.head.querySelector(
        `style[data-anywidget-model="${modelId}"]`
      );
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, [cssCode, modelId]);

  // Render error state if there's an error
  if (error) {
    return (
      <div className="anywidget-error rounded border border-red-300 bg-red-50 p-4">
        <h4 className="mb-2 font-semibold text-red-800">Anywidget Error</h4>
        <p className="text-red-700">{error}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-red-600">Debug Info</summary>
          <pre className="mt-1 text-xs whitespace-pre-wrap text-red-600">
            Model ID: {modelId}
            {esmCode && `\nESM Code Length: ${esmCode.length} characters`}
            {cssCode && `\nCSS Code Length: ${cssCode.length} characters`}
          </pre>
        </details>
      </div>
    );
  }

  // Render loading state
  if (!model || !widget) {
    return (
      <div className="anywidget-loading p-4 text-gray-600">
        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-gray-600"></div>
          <span>Loading anywidget...</span>
        </div>
      </div>
    );
  }

  // Render the widget container
  return (
    <div
      ref={containerRef}
      className="anywidget-container"
      data-anywidget-model={modelId}
    />
  );
};

/**
 * Type guard to check if an object is a valid anywidget definition
 */
function isValidAnyWidget(
  obj: any
): obj is AnyWidget | (() => AnyWidget | Promise<AnyWidget>) {
  if (typeof obj === "function") return true;
  if (typeof obj === "object" && obj !== null) {
    return (
      typeof obj.initialize === "function" ||
      typeof obj.render === "function" ||
      obj.initialize === undefined ||
      obj.render === undefined
    );
  }
  return false;
}

/**
 * Error boundary for anywidget components
 */
export class AnywidgetErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      "Anywidget error boundary caught an error:",
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="anywidget-error rounded border border-red-300 bg-red-50 p-4">
          <h4 className="mb-2 font-semibold text-red-800">
            Widget Render Error
          </h4>
          <p className="text-red-700">
            {this.state.error?.message ||
              "An error occurred while rendering the widget."}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
