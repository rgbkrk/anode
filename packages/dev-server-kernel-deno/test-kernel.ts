#!/usr/bin/env -S deno run --allow-all

/**
 * Simple test script to demonstrate Deno kernel capabilities
 * This script tests basic functionality without requiring a full notebook setup
 */

import { PyodideKernel } from "./src/pyodide-kernel.ts";
import { openaiClient } from "./src/openai-client.ts";
import { defaultCacheManager } from "./src/cache-utils.ts";

async function testPyodideKernel() {
  console.log("🧪 Testing Pyodide Kernel...");

  const kernel = new PyodideKernel("test-notebook");

  try {
    await kernel.initialize();
    console.log("✅ Kernel initialized successfully");

    // Test basic Python execution
    console.log("\n📝 Testing basic Python execution...");
    const outputs = await kernel.execute("print('Hello from Deno + Pyodide!')");
    console.log(`📤 Generated ${outputs.length} outputs:`);
    outputs.forEach((output, i) => {
      console.log(`  ${i + 1}. Type: ${output.type}`);
      if (output.type === "stream") {
        console.log(`     Text: ${JSON.stringify((output.data as any).text)}`);
      }
    });

    // Test numpy calculation
    console.log("\n🔢 Testing numpy calculation...");
    const numpyOutputs = await kernel.execute(`
import numpy as np
result = np.array([1, 2, 3, 4, 5]).sum()
print(f"Sum of [1,2,3,4,5] = {result}")
result
`);
    console.log(`📤 Numpy test generated ${numpyOutputs.length} outputs`);

    // Test pandas
    console.log("\n📊 Testing pandas DataFrame...");
    const pandasOutputs = await kernel.execute(`
import pandas as pd
df = pd.DataFrame({'A': [1, 2, 3], 'B': [4, 5, 6]})
print("Created DataFrame:")
print(df)
df.sum()
`);
    console.log(`📤 Pandas test generated ${pandasOutputs.length} outputs`);

    await kernel.terminate();
    console.log("✅ Kernel terminated successfully");

  } catch (error) {
    console.error("❌ Kernel test failed:", error);
    return false;
  }

  return true;
}

async function testCacheSystem() {
  console.log("\n🧪 Testing Cache System...");

  try {
    const stats = await defaultCacheManager.getCacheStats();
    console.log(`✅ Cache has ${stats.packageCount} packages (${stats.totalSizeMB}MB)`);

    // Test package checking
    const testPackages = ["numpy", "pandas", "matplotlib", "nonexistent-package"];
    for (const pkg of testPackages) {
      const cached = await defaultCacheManager.isPackageCached(pkg);
      console.log(`  📦 ${pkg}: ${cached ? "✅ CACHED" : "❌ NOT CACHED"}`);
    }

    return true;
  } catch (error) {
    console.error("❌ Cache test failed:", error);
    return false;
  }
}

async function testOpenAIClient() {
  console.log("\n🧪 Testing OpenAI Client...");

  try {
    const isReady = openaiClient.isReady();
    console.log(`✅ OpenAI client status: ${isReady ? "READY" : "NOT CONFIGURED"}`);

    if (isReady) {
      console.log("🤖 Testing AI response generation...");
      const outputs = await openaiClient.generateResponse("What is 2 + 2?", {
        model: "gpt-4o-mini",
        maxTokens: 100,
      });
      console.log(`📤 AI generated ${outputs.length} outputs`);
      console.log(`📝 Response type: ${outputs[0]?.type}`);
    } else {
      console.log("⚠️ Set OPENAI_API_KEY to test real AI responses");
    }

    return true;
  } catch (error) {
    console.error("❌ OpenAI test failed:", error);
    return false;
  }
}

async function benchmarkStartup() {
  console.log("\n⏱️ Benchmarking Kernel Startup...");

  const startTime = performance.now();

  const kernel = new PyodideKernel("benchmark-notebook");
  await kernel.initialize();

  const initTime = performance.now() - startTime;
  console.log(`⚡ Kernel initialization: ${initTime.toFixed(2)}ms`);

  const execStart = performance.now();
  await kernel.execute("import numpy as np; print('Ready!')");
  const execTime = performance.now() - execStart;
  console.log(`⚡ First execution: ${execTime.toFixed(2)}ms`);

  await kernel.terminate();

  const totalTime = performance.now() - startTime;
  console.log(`⚡ Total time: ${totalTime.toFixed(2)}ms`);
}

async function runAllTests() {
  console.log("🚀 Deno Kernel Test Suite");
  console.log("========================\n");

  const tests = [
    { name: "Cache System", fn: testCacheSystem },
    { name: "OpenAI Client", fn: testOpenAIClient },
    { name: "Pyodide Kernel", fn: testPyodideKernel },
    { name: "Startup Benchmark", fn: benchmarkStartup },
  ];

  const results: { name: string; success: boolean; time: number }[] = [];

  for (const test of tests) {
    const startTime = performance.now();
    console.log(`🧪 Running ${test.name} test...`);

    try {
      const success = await test.fn();
      const time = performance.now() - startTime;
      results.push({ name: test.name, success, time });

      if (success) {
        console.log(`✅ ${test.name} test passed (${time.toFixed(2)}ms)`);
      } else {
        console.log(`❌ ${test.name} test failed (${time.toFixed(2)}ms)`);
      }
    } catch (error) {
      const time = performance.now() - startTime;
      results.push({ name: test.name, success: false, time });
      console.log(`❌ ${test.name} test failed (${time.toFixed(2)}ms)`);
      console.error(`   Error: ${error}`);
    }

    console.log(); // Add spacing between tests
  }

  // Summary
  console.log("📊 Test Results Summary");
  console.log("=======================");

  let passCount = 0;
  let totalTime = 0;

  for (const result of results) {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.name.padEnd(20)} ${result.time.toFixed(2)}ms`);
    if (result.success) passCount++;
    totalTime += result.time;
  }

  console.log(`\n🎯 Results: ${passCount}/${results.length} tests passed`);
  console.log(`⏱️ Total time: ${totalTime.toFixed(2)}ms`);

  if (passCount === results.length) {
    console.log("\n🎉 All tests passed! Deno kernel is working perfectly.");
  } else {
    console.log("\n⚠️ Some tests failed. Check the logs above for details.");
  }

  Deno.exit(passCount === results.length ? 0 : 1);
}

// Show usage help
function showHelp() {
  console.log(`
🧪 Deno Kernel Test Suite
=========================

Usage:
  deno run --allow-all test-kernel.ts [options]

Options:
  --cache-only    Test only the cache system
  --ai-only       Test only the OpenAI client
  --kernel-only   Test only the Pyodide kernel
  --benchmark     Run only the startup benchmark
  --help, -h      Show this help

Examples:
  # Run all tests
  deno run --allow-all test-kernel.ts

  # Test only cache system
  deno run --allow-all test-kernel.ts --cache-only

  # Quick benchmark
  deno run --allow-all test-kernel.ts --benchmark

Environment:
  OPENAI_API_KEY  Set to test real AI responses (optional)
`);
}

// Main execution
if (import.meta.main) {
  const args = Deno.args;

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    Deno.exit(0);
  }

  if (args.includes("--cache-only")) {
    const success = await testCacheSystem();
    Deno.exit(success ? 0 : 1);
  }

  if (args.includes("--ai-only")) {
    const success = await testOpenAIClient();
    Deno.exit(success ? 0 : 1);
  }

  if (args.includes("--kernel-only")) {
    const success = await testPyodideKernel();
    Deno.exit(success ? 0 : 1);
  }

  if (args.includes("--benchmark")) {
    await benchmarkStartup();
    Deno.exit(0);
  }

  // Run all tests by default
  await runAllTests();
}
