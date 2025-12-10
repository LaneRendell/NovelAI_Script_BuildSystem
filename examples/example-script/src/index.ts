// NovelAI Script Entry Point
// This is where your script logic begins

/**
 * This example script demonstrates basic NovelAI scripting features:
 * - Intercepting generation with hooks
 * - Modifying context and responses
 * - Using lorebook entries
 * - Creating UI extensions
 * - Persistent storage
 * - Using imports/exports (removed during build)
 */

// Import utilities from another file
// These imports will be removed during the build process

// You can use EITHER named imports (traditional style):
import { formatTimestamp, debugLog } from "./utils";

// OR namespace imports (the build system creates wrapper objects for these):
// This also works for TYPES - you can use utils.ScriptConfig, utils.ScriptStats, etc.
import * as utils from "./utils";

// Script configuration - using namespace type annotation (utils.ScriptConfig)
// This demonstrates that interfaces work with namespace imports!
const CONFIG: utils.ScriptConfig = {
  scriptName: "Example Script",
  version: "1.0.0",
  enabled: true,
  debugMode: false,
};

/**
 * Initialize the script
 * This runs when the script is first loaded
 */
async function init() {
  api.v1.log(`${CONFIG.scriptName} v${CONFIG.version} initialized`);

  // Register UI extension
  await registerUIExtension();

  // Set up generation hooks
  setupGenerationHooks();

  // Example: Use imported utility to increment run count (using namespace style)
  const runCount = await utils.incrementRunCount();
  // Using direct import style for debugLog
  debugLog(CONFIG, "Run count incremented to:", runCount);
  api.v1.log(`Script has been loaded ${runCount} times`);
}

/**
 * Register a UI extension to add a button to the toolbar
 */
async function registerUIExtension() {
  const toolbarButton = api.v1.ui.extension.toolbarButton({
    id: "example-button",
    text: "Example",
    callback: () => {
      handleButtonClick();
    },
  });

  await api.v1.ui.register([toolbarButton]);
}

/**
 * Handle toolbar button click
 */
async function handleButtonClick() {
  // Use imported utility for notifications (namespace style)
  await utils.showNotification("Example button clicked!", "success");

  // Using direct import style for formatTimestamp
  api.v1.log("Button clicked at:", formatTimestamp(Date.now()));

  // Example: Get current document text
  const text = await api.v1.document.textFromSelection();
  api.v1.log("Current document has", text.length, "characters");

  // Display stats using namespace style
  // Type annotation also uses namespace: utils.ScriptStats
  const stats: utils.ScriptStats = await utils.getStats();
  api.v1.log("Script stats:", stats);

  // Example: Call lorebook function
  await exampleLorebookUsage();
}

/**
 * Set up hooks for generation events
 */
function setupGenerationHooks() {
  // Hook called when generation is requested
  api.v1.hooks.register("onGenerationRequested", async (params) => {
    if (!CONFIG.enabled) return;

    api.v1.log("Generation requested:", params.model);

    // You can prevent generation by returning { stopGeneration: true }
    // return { stopGeneration: true };
  });

  // Hook called after context is built but before sending to AI
  api.v1.hooks.register("onContextBuilt", async (params) => {
    if (!CONFIG.enabled) return;

    api.v1.log("Context built with", params.messages.length, "messages");

    // Example: You can modify the messages here
    // const modifiedMessages = [...params.messages];
    // modifiedMessages.push({ role: "system", content: "Be creative!" });
    // return { messages: modifiedMessages };
  });

  // Hook called when response is received from AI
  api.v1.hooks.register("onResponse", async (params) => {
    if (!CONFIG.enabled) return;

    api.v1.log("Received response with", params.text.length, "choices");

    // Example: You can modify the response text here
    // const modifiedText = params.text.map(t => t.toUpperCase());
    // return { text: modifiedText };
  });

  // Hook called when generation is complete
  api.v1.hooks.register("onGenerationEnd", async () => {
    if (!CONFIG.enabled) return;

    api.v1.log("Generation ended");

    // Update statistics using namespace style
    const genCount = await utils.incrementGenerationCount();
    // Mix: using direct import for debugLog
    debugLog(CONFIG, "Generation count:", genCount);
  });
}

/**
 * Example: Work with lorebook entries
 */
async function exampleLorebookUsage() {
  // Get all lorebook entries
  const entries = await api.v1.lorebook.entries();

  api.v1.log(`Found ${entries.length} lorebook entries`);

  // Example: Find entries with a specific key
  const filtered = entries.filter((entry) =>
    entry.keys?.some((key) => key.toLowerCase().includes("example")),
  );

  api.v1.log(`Found ${filtered.length} entries matching 'example'`);

  // Example: You can also get specific entry by ID
  // const entry = await api.v1.lorebook.entry("entry-id-here");

  // Example: Custom generation using the generate API
  // Uncomment to use:
  // const messages = [
  //     { role: "user" as const, content: "Tell me a short story about a robot." }
  // ];
  // const params = { model: "glm-4-6", max_tokens: 200, temperature: 0.8 };
  // const response = await api.v1.generate(messages, params);
  // api.v1.log("Generated:", response.choices[0].text);
}

// Initialize the script when loaded
init();
