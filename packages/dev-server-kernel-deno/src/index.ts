// Import the REACTIVE kernel adapter logic that handles LiveStore events
import "./kernel-adapter.ts";

const NOTEBOOK_ID = Deno.env.get("NOTEBOOK_ID") || "demo-notebook";

console.log(`🐍 Pyodide Kernel (Deno Runtime) starting`);
console.log(`📓 Serving notebook: ${NOTEBOOK_ID}`);
console.log(
  `🔗 LiveStore REACTIVE adapter starting (event-driven execution only)...`,
);
console.log(
  `🤖 AI Integration: ${Deno.env.get("OPENAI_API_KEY") ? "OpenAI API configured ✅" : "Mock responses only - set OPENAI_API_KEY for real AI ⚠️"}`,
);
console.log(``);
console.log(`⚡ Code & AI execution happens via REACTIVE LiveStore queries:`);
console.log(`   1. Web client emits cellExecutionRequested event (code or AI)`);
console.log(
  `   2. This service reacts to queue changes via queryDb subscriptions`,
);
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
