import React, { Suspense } from "react";
import { StreamOutputData } from "@runt/schema";
import {
  AnsiStreamOutput,
  OutputData,
  ToolCallData,
} from "../outputs/index.js";
import "../outputs/outputs.css";

// Dynamic import for anywidget output
const AnywidgetOutput = React.lazy(() =>
  import("../anywidget/AnywidgetOutput.js").then((m) => ({
    default: m.AnywidgetOutput,
  }))
);
const AnywidgetErrorBoundary = React.lazy(() =>
  import("../anywidget/AnywidgetOutput.js").then((m) => ({
    default: m.AnywidgetErrorBoundary,
  }))
);

// Dynamic imports for heavy components
const MarkdownRenderer = React.lazy(() =>
  import("../outputs/MarkdownRenderer.js").then((m) => ({
    default: m.MarkdownRenderer,
  }))
);
const JsonOutput = React.lazy(() =>
  import("../outputs/JsonOutput.js").then((m) => ({ default: m.JsonOutput }))
);
const AiToolCallOutput = React.lazy(() =>
  import("../outputs/AiToolCallOutput.js").then((m) => ({
    default: m.AiToolCallOutput,
  }))
);
const HtmlOutput = React.lazy(() =>
  import("../outputs/HtmlOutput.js").then((m) => ({ default: m.HtmlOutput }))
);
const ImageOutput = React.lazy(() =>
  import("../outputs/ImageOutput.js").then((m) => ({ default: m.ImageOutput }))
);
const SvgOutput = React.lazy(() =>
  import("../outputs/SvgOutput.js").then((m) => ({ default: m.SvgOutput }))
);
const PlainTextOutput = React.lazy(() =>
  import("../outputs/PlainTextOutput.js").then((m) => ({
    default: m.PlainTextOutput,
  }))
);

interface RichOutputProps {
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  outputType?: "display_data" | "execute_result" | "stream" | "error";
}

export const RichOutput: React.FC<RichOutputProps> = ({
  data,
  outputType = "display_data",
}) => {
  // Handle stream outputs specially
  if (outputType === "stream") {
    const streamData = data as unknown as StreamOutputData;
    return (
      <AnsiStreamOutput text={streamData.text} streamName={streamData.name} />
    );
  }

  const outputData = data as OutputData;

  // Determine the best media type to render, in order of preference
  const getPreferredMediaType = (): string | null => {
    const preferenceOrder = [
      "application/vnd.jupyter.widget-view+json",
      "application/vnd.anode.aitool+json",
      "text/markdown",
      "text/html",
      "image/png",
      "image/jpeg",
      "image/svg+xml",
      "image/svg",
      "application/json",
      "text/plain",
    ];

    for (const mediaType of preferenceOrder) {
      if (
        outputData[mediaType] !== undefined &&
        outputData[mediaType] !== null
      ) {
        return mediaType;
      }
    }

    return null;
  };

  const mediaType = getPreferredMediaType();

  if (!mediaType) {
    return (
      <div className="bg-gray-50/50 p-3 text-sm text-gray-500 italic">
        No displayable content
      </div>
    );
  }

  const renderContent = () => {
    const LoadingSpinner = () => (
      <div className="flex items-center justify-center p-4">
        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-gray-900"></div>
      </div>
    );

    switch (mediaType) {
      case "application/vnd.jupyter.widget-view+json":
        const widgetData = outputData[mediaType] as any;
        if (!widgetData?.model_id) {
          return (
            <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Invalid anywidget data: missing model_id
            </div>
          );
        }

        // Extract ESM and CSS from the widget state or metadata
        const esmCode =
          outputData["application/vnd.jupyter.widget-state+json"]?.state?._esm;
        const cssCode =
          outputData["application/vnd.jupyter.widget-state+json"]?.state?._css;

        if (!esmCode) {
          return (
            <div className="border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
              Anywidget missing ESM code
            </div>
          );
        }

        return (
          <Suspense fallback={<LoadingSpinner />}>
            <AnywidgetErrorBoundary>
              <AnywidgetOutput
                modelId={widgetData.model_id}
                esmCode={esmCode}
                cssCode={cssCode}
              />
            </AnywidgetErrorBoundary>
          </Suspense>
        );

      case "application/vnd.anode.aitool+json":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <AiToolCallOutput
              toolData={outputData[mediaType] as ToolCallData}
            />
          </Suspense>
        );

      case "text/markdown":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <MarkdownRenderer
              content={String(outputData[mediaType] || "")}
              enableCopyCode={true}
            />
          </Suspense>
        );

      case "text/html":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <HtmlOutput content={String(outputData[mediaType] || "")} />
          </Suspense>
        );

      case "image/png":
      case "image/jpeg":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <ImageOutput
              src={String(outputData[mediaType] || "")}
              mediaType={mediaType as "image/png" | "image/jpeg"}
            />
          </Suspense>
        );

      case "image/svg+xml":
      case "image/svg":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <SvgOutput content={String(outputData[mediaType] || "")} />
          </Suspense>
        );

      case "application/json":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <JsonOutput data={outputData[mediaType]} />
          </Suspense>
        );

      case "text/plain":
      default:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <PlainTextOutput content={String(outputData[mediaType] || "")} />
          </Suspense>
        );
    }
  };

  return (
    <div className="rich-output">
      <div className="max-w-full overflow-hidden">{renderContent()}</div>
    </div>
  );
};

// Helper function to create rich output data
export const createRichOutput = (
  content: string,
  mediaType: string = "text/plain"
) => {
  return {
    [mediaType]: content,
  };
};

// Helper function to create markdown output
export const createMarkdownOutput = (markdown: string) => {
  return createRichOutput(markdown, "text/markdown");
};

// Helper function to create SVG output
export const createSvgOutput = (svg: string) => {
  return createRichOutput(svg, "image/svg+xml");
};
