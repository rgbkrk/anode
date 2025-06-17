// Import the REACTIVE kernel adapter logic that handles LiveStore events
import "./kernel-adapter.ts";

const PORT = parseInt(Deno.env.get("PORT") || "3001");
const NOTEBOOK_ID = Deno.env.get("NOTEBOOK_ID") || "demo-notebook";

// Create HTTP server ONLY for health checks and status - NO execution endpoints
const server = Deno.serve({ port: PORT }, async (req: Request) => {
  // Add CORS headers for web client access
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Health check endpoint
  if (url.pathname === "/health") {
    const responseBody = JSON.stringify({
      status: "ok",
      notebook: NOTEBOOK_ID,
      timestamp: new Date().toISOString(),
      service: "dev-server-kernel-deno",
      execution_model: "livestore-events-only",
      ai_support: Deno.env.get("OPENAI_API_KEY")
        ? "enabled (OpenAI configured)"
        : "enabled (mock responses - set OPENAI_API_KEY for real AI)",
    });

    return new Response(responseBody, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  // Status endpoint with LiveStore connection details
  if (url.pathname === "/status") {
    const memoryUsage = {
      rss: Deno.memoryUsage().rss,
      heapTotal: Deno.memoryUsage().heapTotal,
      heapUsed: Deno.memoryUsage().heapUsed,
      external: Deno.memoryUsage().external,
    };

    const responseBody = JSON.stringify({
      service: "dev-server-kernel-deno",
      notebook: NOTEBOOK_ID,
      port: PORT,
      uptime: performance.now() / 1000, // Convert to seconds
      memory: memoryUsage,
      execution_model: "livestore-events-only",
      ai_support: Deno.env.get("OPENAI_API_KEY")
        ? "enabled (OpenAI configured)"
        : "enabled (mock responses - set OPENAI_API_KEY for real AI)",
      note: "This service responds ONLY to LiveStore cellExecutionRequested events for code and AI cells",
      env: {
        DENO_VERSION: Deno.version.deno,
        LIVESTORE_SYNC_URL: Deno.env.get("LIVESTORE_SYNC_URL") || "ws://localhost:8787",
        AUTH_TOKEN: Deno.env.get("AUTH_TOKEN") ? "[REDACTED]" : "[NOT SET]",
      },
    });

    return new Response(responseBody, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  // Default 404 with helpful information
  const responseBody = JSON.stringify({
    error: "Not found",
    available_endpoints: ["/health", "/status"],
    execution_model: "livestore-events-only",
    ai_support: Deno.env.get("OPENAI_API_KEY")
      ? "enabled (OpenAI configured)"
      : "enabled (mock responses - set OPENAI_API_KEY for real AI)",
    note: "This kernel service does NOT provide HTTP execution endpoints",
  });

  return new Response(responseBody, {
    status: 404,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});

console.log(`🐍 Kernel Service (Deno) running on port ${PORT}`);
console.log(`📓 Serving notebook: ${NOTEBOOK_ID}`);
console.log(`🔗 LiveStore REACTIVE adapter starting (event-driven execution only)...`);
console.log(`🤖 AI Integration: ${Deno.env.get("OPENAI_API_KEY") ? 'OpenAI API configured ✅' : 'Mock responses only - set OPENAI_API_KEY for real AI ⚠️'}`);
console.log(`💡 Available endpoints:`);
console.log(`   • GET  http://localhost:${PORT}/health`);
console.log(`   • GET  http://localhost:${PORT}/status`);
console.log(``);
console.log(`⚡ Code & AI execution happens via REACTIVE LiveStore queries:`);
console.log(`   1. Web client emits cellExecutionRequested event (code or AI)`);
console.log(`   2. This service reacts to queue changes via queryDb subscriptions`);
console.log(`   3. Python code executes with Pyodide OR AI calls OpenAI API`);
console.log(`   4. Results sent back via cellOutputAdded events`);
console.log(`   5. All connected clients see results in real-time`);

// Graceful shutdown
let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("🛑 Shutting down kernel service...");
  console.log("🔗 LiveStore REACTIVE adapter will handle its own cleanup...");

  // Note: Deno.serve returns an HttpServer that handles cleanup automatically
  // when the process exits, so we don't need manual server.close()

  console.log("✅ HTTP server closed");
  console.log("🎉 Kernel service shutdown complete");

  // Force exit after 5 seconds
  setTimeout(() => {
    console.log("⚠️ Force exit after timeout");
    Deno.exit(1);
  }, 5000);

  Deno.exit(0);
};

// Handle shutdown signals
Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// Handle unhandled errors
globalThis.addEventListener("error", (event) => {
  console.error("💥 Uncaught exception:", event.error);
  shutdown();
});

globalThis.addEventListener("unhandledrejection", (event) => {
  console.error("💥 Unhandled rejection:", event.reason);
  shutdown();
});

console.log("🎉 Kernel service operational - LiveStore REACTIVE mode");
console.log("📡 Listening for reactive queue changes...");
console.log("🔌 Press Ctrl+C to stop");
