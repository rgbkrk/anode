// Import the REACTIVE kernel adapter logic that handles LiveStore events
import "./kernel-adapter.js";

const NOTEBOOK_ID = process.env.NOTEBOOK_ID || "demo-notebook";

console.log(`🐍 Pyodide Kernel (Node.js Runtime) starting`);
console.log(`📓 Serving notebook: ${NOTEBOOK_ID}`);
console.log(`🔗 LiveStore REACTIVE adapter starting (event-driven execution only)...`);
console.log(`🤖 AI Integration: ${process.env.OPENAI_API_KEY ? 'OpenAI API configured ✅' : 'Mock responses only - set OPENAI_API_KEY for real AI ⚠️'}`);
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
  console.log("🎉 Kernel service shutdown complete");

  // Force exit after 5 seconds
  setTimeout(() => {
    console.log("⚠️ Force exit after timeout");
    process.exit(1);
  }, 5000);

  process.exit(0);
};

// Handle shutdown signals
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught exception:", error);
  shutdown();
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled rejection at:", promise, "reason:", reason);
  shutdown();
});

console.log("🎉 Kernel service operational - LiveStore REACTIVE mode");
console.log("📡 Listening for reactive queue changes...");
console.log("🔌 Press Ctrl+C to stop");
