# NovelAI Script Build System

A TypeScript build system for creating NovelAI scripts. This tool bundles multiple TypeScript files into a single script that can be copied and pasted into the NovelAI script editor.

## Features

- **Modular Development**: Write your script across multiple TypeScript files with imports/exports
- **Automatic Type Definitions**: Fetches the latest NovelAI API types automatically
- **Type Safety**: Full TypeScript support with IntelliSense and type checking
- **Watch Mode**: Automatic rebuilds when files change during development
- **Single File Output**: Bundles everything into one script with no external dependencies
- **Import/Export Removal**: Automatically removes ES6 module syntax for NovelAI compatibility

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- npm (comes with Node.js)

### Installation

**Option 1: Clone the repository**

```bash
git clone https://github.com/LaneRendell/NovelAI_Script_BuildSystem
cd NovelAI_Script_BuildSystem
npm install
```

**Option 2: Download as ZIP**

1. Download this repository as a ZIP file
2. Extract it to your desired location
3. Open a terminal in the extracted folder
4. Run `npm install`

### Your First Build

1. **Install dependencies** (if you haven't already):

```bash
npm install
```

2. **Build the example script**:

```bash
npm run build
```

3. **Find your bundled script** in `dist/yourscriptname.ts`

4. **Test it in NovelAI**:
   - Open the file `dist/yourscriptname.ts`
   - Copy the entire contents
   - Go to NovelAI → Script Editor
   - Paste the contents
   - Save and enable your script

## Starting Your Own Project

This repository is designed as a **template/skeleton** for your NovelAI script development. Here's how to use it:

1. **Fork or download** this repository to start your own project
2. **Delete or modify** the example code in `src/` to build your own script
3. **Keep the build system** ([build.js](build.js), [package.json](package.json), [tsconfig.json](tsconfig.json))
4. **Customize** your project - see [Customizing for Your Project](#customizing-for-your-project) below
5. **Develop** your script using the workflow below

## Development Workflow

### Project Structure

```text
NovelAI_Script_BuildSystem/
├── src/                    # Your TypeScript source files
│   ├── utils.ts           # Example utility module (you can delete/modify this)
│   └── index.ts           # Main entry point (you can modify this)
├── external/              # Auto-downloaded NovelAI type definitions
│   └── script-types.d.ts  # Fetched automatically on first build
├── dist/                  # Build output (generated, git-ignored)
│   └── yourscriptname.ts  # Final bundled script ready for NovelAI
├── build.js               # Build system (keep this)
├── package.json           # Node.js configuration (keep this)
├── tsconfig.json          # TypeScript configuration (keep this)
└── README.md             # Documentation (you can customize this)
```

### Writing Modular Scripts with Imports

**The build system supports imports/exports!** You can organize your code across multiple files.

**Example**: `src/utils.ts`

```typescript
// Define and export types
export interface MyConfig {
    enabled: boolean;
}

// Export functions
export async function saveData(key: string, value: any) {
    await api.v1.storage.set(key, value);
}

export function formatMessage(msg: string): string {
    return `[MyScript] ${msg}`;
}
```

**Example**: `src/index.ts`

```typescript
// Import from your utility files
import type { MyConfig } from "./utils";
import { saveData, formatMessage } from "./utils";

const config: MyConfig = {
    enabled: true,
    apiKey: "my-key",
};

async function init() {
    api.v1.log(formatMessage("Starting..."));
    await saveData("config", config);
}

init();
```

**Important**: When you add new source files, update the `sourceFiles` array in [build.js](build.js):

```javascript
// List files in dependency order - dependencies FIRST
const sourceFiles = [
    'src/utils.ts',      // This is imported by index.ts, so it comes first
    'src/helpers.ts',    // Another dependency
    'src/index.ts',      // Main file that imports others comes last
];
```

The build system will automatically:

- Remove all `import` and `export` statements
- Bundle files in the order you specify
- Preserve all your code and types

### Available Commands

- `npm install` - Install dependencies (run this first!)
- `npm run build` - Build your script once
- `npm run build:watch` - Watch for changes and rebuild automatically (great for development!)
- `npm run typecheck` - Check for TypeScript errors without building
- `npm run clean` - Remove the dist directory

### Customizing for Your Project

#### 1. Update Package Information

Edit [package.json](package.json) with your project details:

```json
{
  "name": "my-novelai-script",
  "version": "1.0.0",
  "description": "My awesome NovelAI script",
  "author": "Your Name <your.email@example.com>",
  "license": "MIT"
}
```

#### 2. Update Script Metadata

Edit the header in [build.js](build.js):

```javascript
const scriptHeader = `/**
 * My Amazing Script
 * Version: 1.0.0
 * Author: Your Name <your.email@example.com>
 * Description: Does amazing things in NovelAI
 * License: MIT
 */

`;
```

#### 3. Change Output Filename

In [build.js](build.js) at line ~110, update this line:

```javascript
const outputPath = path.join(__dirname, 'dist', 'my-script-name.ts');
```

#### 4. Organize Your Source Files

Create `.ts` files in the `src/` directory for different parts of your script:

```text
src/
├── types.ts        # Type definitions and interfaces
├── config.ts       # Configuration
├── utils.ts        # Utility functions
├── handlers.ts     # Event handlers and hooks
├── ui.ts           # UI components
└── index.ts        # Main entry point (imports and initializes everything)
```

**Remember**: Update the `sourceFiles` array in [build.js](build.js) whenever you add files:

```javascript
const sourceFiles = [
    'src/types.ts',      // Types first
    'src/config.ts',     // Then config
    'src/utils.ts',      // Then utilities
    'src/handlers.ts',   // Then handlers
    'src/ui.ts',         // Then UI
    'src/index.ts',      // Main entry point last
];
```

### Development Tips

#### Use Watch Mode for Active Development

When actively developing your script, use watch mode:

```bash
npm run build:watch
```

This will automatically rebuild your script whenever you save a file. Keep this running in a terminal while you work!

#### Type Checking

Run type checking to catch errors before building:

```bash
npm run typecheck
```

You'll get full IntelliSense and autocomplete for the NovelAI API in your editor!

## NovelAI API Reference

The build system automatically downloads the latest NovelAI type definitions from the official source. You'll have full IntelliSense and autocomplete support for all NovelAI APIs:

### Core APIs

- **`api.v1.script`** - Script metadata (read-only info about your script)
- **`api.v1.storage`** - Persistent key-value storage for your script data
- **`api.v1.hooks`** - Register hooks for generation events and other triggers
- **`api.v1.log()`** / **`api.v1.error()`** - Logging functions

### Document & Editor

- **`api.v1.document`** - Read and manipulate story paragraphs
- **`api.v1.editor`** - Trigger generation, check editor state
- **`api.v1.memory`** - Read and update story memory
- **`api.v1.an`** - Read and update author's note

### Generation & AI

- **`api.v1.generate`** - Generate text with GLM 4.6 (with streaming support)
- **`api.v1.generationParameters`** - Get/set generation parameters
- **`api.v1.image`** - Generate images
- **`api.v1.tokenizer`** - Encode/decode text to/from tokens

### Content & UI

- **`api.v1.lorebook`** - Manage lorebook entries and categories
- **`api.v1.ui`** - Create UI extensions (buttons, panels, modals, toasts)
- **`api.v1.commentBot`** - Control the comment bot (HypeBot)

### Utilities

- **`api.v1.messaging`** - Inter-script communication
- **`api.v1.timers`** - Delayed execution and sleep
- **`api.v1.random`** - Random number generation and dice rolling
- **`api.v1.tts`** - Text-to-speech control

### Type Definitions

All types are automatically available including:

- `GenerationParams`, `GenerationResponse`, `GenerationChoice`
- `LorebookEntry`, `LorebookCategory`
- `UIExtension`, `UIPart` (and all their variants)
- `Section`, `DocumentSelection`
- And many more!

**Official Documentation**: [NovelAI Scripting Docs](https://docs.novelai.net/scripting/introduction.html)

## Example Scripts

The included example demonstrates:

- **Modular code organization** with imports ([src/utils.ts](src/utils.ts) → [src/index.ts](src/index.ts))
- **UI extensions** - Toolbar buttons with callbacks
- **Generation hooks** - Intercept and modify generation at different stages
- **Persistent storage** - Track statistics across script loads
- **Lorebook API** - Query and filter lorebook entries
- **Type safety** - Using TypeScript interfaces for configuration

Check the `src/` directory for the complete working example.

## Tips and Best Practices

### Use Modern TypeScript Features

You can use all modern TypeScript features during development:

```typescript
// Types and interfaces
interface Config {
    enabled: boolean;
    threshold: number;
}

// Generics
function wrapInArray<T>(item: T): T[] {
    return [item];
}

// Async/await
async function loadData() {
    const data = await api.v1.storage.get('myKey');
    return data ?? defaultValue;
}

// Optional chaining and nullish coalescing
const value = entry.keys?.find(k => k === "search") ?? "default";
```

### Code Organization Patterns

**Small Scripts** (single feature):

```text
src/
└── index.ts       # Everything in one file
```

**Medium Scripts** (multiple features):

```text
src/
├── utils.ts       # Helper functions
└── index.ts       # Main logic + initialization
```

**Large Scripts** (complex application):

```text
src/
├── types.ts        # Type definitions
├── config.ts       # Configuration constants
├── storage.ts      # Storage utilities
├── lorebook.ts     # Lorebook helpers
├── generation.ts   # Generation hooks
├── ui.ts           # UI components
└── index.ts        # Initialization and orchestration
```

### Debugging Your Script

**1. Use `api.v1.log()` for debugging** (not `console.log`):

```typescript
api.v1.log("Debug info:", someVariable);
api.v1.error("Something went wrong:", error);
```

Output appears in NovelAI's developer console (F12 in browser).

**2. Type-check before building**:

```bash
npm run typecheck
```

Catches errors before you even build!

**3. Use watch mode for fast iteration**:

```bash
npm run build:watch
```

Make a change → save → auto-rebuild → test in NovelAI.

## Troubleshooting

### "Cannot find module" errors during development

If your editor shows import errors:

1. Make sure you ran `npm install`
2. Restart your TypeScript language server (in VS Code: `Cmd/Ctrl+Shift+P` → "Restart TypeScript Server")
3. Check that `external/script-types.d.ts` exists (run `npm run build` to download it)

### Type definitions not found

The build system downloads NovelAI types automatically on first build. If you see type errors:

1. Delete the `external/` directory
2. Run `npm run build` to re-download them

### Import/export errors in NovelAI

The build system removes all `import`/`export` statements. If you see module errors when running in NovelAI:

1. **Check build output**: Make sure `npm run build` completed without errors
2. **Check file order**: Verify files in `sourceFiles` are in dependency order (dependencies first)
3. **Avoid dynamic imports**: Don't use `import()` or `require()` - they won't work

### Build succeeds but script doesn't work in NovelAI

1. **Check the browser console** (F12) for error messages
2. **Verify the script is enabled** in NovelAI's script manager
3. **Check permissions**: Some APIs require specific permissions
4. **Test incrementally**: Comment out code sections to isolate the problem

## Frequently Asked Questions

### Can I use npm packages in my script?

No. NovelAI scripts run in the browser without access to npm packages. The build system doesn't bundle dependencies - it only bundles your own source files. You can only use:

- Browser-native APIs (like `fetch`, `setTimeout`, etc.)
- The NovelAI API (`api.v1.*`)
- Code you write yourself

### Do I need to include the type definitions in my build?

No! The build system automatically downloads them to the `external/` folder for TypeScript support during development. They are NOT included in your final bundled script - only your code from `src/` is bundled.

### Can I use the same script across multiple stories?

Yes! NovelAI supports account-level scripts that work across all stories. Storage is separated:

- Account scripts: Storage is shared across all stories
- Story scripts: Storage is specific to that story

### How do I share my script with others?

**Option 1**: Share your source code (this entire project folder) - others can modify and build it themselves.

**Option 2**: Share the built script (`dist/yourscriptname.ts`) - others can copy and paste it directly into NovelAI, but won't be able to modify it easily.

## License

MIT License - feel free to use this build system for your NovelAI script projects!

## Resources

- **[NovelAI Scripting Documentation](https://docs.novelai.net/scripting/introduction.html)** - Official guide and tutorials
- **[NovelAI Scripting API Reference](https://docs.novelai.net/en/scripting/api-reference)** - Complete API documentation
- **[TypeScript Documentation](https://www.typescriptlang.org/docs/)** - Learn TypeScript
- **[NovelAI Discord](https://discord.gg/novelai)** - Get help from the community

---

**Ready to start?** Fork/download this repository and start building your NovelAI script! 🚀
