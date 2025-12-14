# NovelAI Script Build System

A multi-project TypeScript build system for creating NovelAI scripts. This tool uses Rollup to bundle multiple TypeScript files into single scripts that can be copied and pasted into the NovelAI script editor.

## Features

- **Multi-Project Support**: Manage multiple scripts in one repository
- **Modular Development**: Write each script across multiple TypeScript files with imports/exports
- **Automatic Type Definitions**: Fetches the latest NovelAI API types automatically
- **Type Safety**: Full TypeScript support with IntelliSense and type checking
- **Watch Mode**: Automatic rebuilds when files change during development
- **Auto-Discovery**: Projects without `project.json` are auto-discovered from their `src/` folder
- **Single File Output**: Each project bundles into one script with no external dependencies

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v22.18 or higher)
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/LaneRendell/NovelAI_Script_BuildSystem
cd NovelAI_Script_BuildSystem
npm install
```

### Your First Build

```bash
npm run build
```

This builds all projects in the `projects/` directory. Output appears in `dist/`.

## Project Structure

```text
NovelAI_Script_BuildSystem/
├── examples/                     # Example scripts live here
│   ├── example-script/           # Full-featured example with imports
│   │   ├── project.yaml          # Unified project configuration
│   │   └── src/
│   │       ├── utils.ts          # Utility module (demonstrates exports)
│   │       └── index.ts          # Main entry point (demonstrates imports)
│   └── word-counter/             # Simple single-file example
│       ├── project.yaml          # Unified project configuration
│       └── src/
│           └── index.ts          # Word/character counting utility
├── projects/                     # All your scripts live here
├── external/                     # Auto-downloaded type definitions
│   └── script-types.d.ts
├── dist/                         # Build output (generated)
│   ├── example-script.naiscript  # Built script ready for NovelAI
│   └── word-counter.naiscript    # Built script ready for NovelAI
├── build.ts                      # Build system
├── package.json                  # Node.js configuration
└── tsconfig.json                 # TypeScript configuration
```

## Creating a New Project

### Quick Start (No Configuration)

1. Use the new project command:

   ```bash
   npm run new
   ```

   Answer the questions, your new project will be placed under `projects/my-script` if you name your script 'my-script'.

2. Edit and add more TypeScript files:

   ```bash
   # Create your main script file
   touch projects/my-script/src/index.ts
   ```

3. Build:
   ```bash
   npm run build
   ```

The build system will auto-discover all `.ts` files in the `src/` folder and bundle them.

### Configuration (project.yaml)

Bundling incorporates metadata from a `project.yaml` file in your project folder. This unified configuration matches the YAML frontmatter of `.naiscript` files:

```yaml
compatibilityVersion: naiscript-1.0
id: xxxxxxxx-4xxx-xxxx-xxxx-xxxxxxxxxxxxxxxx
name: my-awesome-script
version: 1.0.0
author: Your Name <your.email@example.com>
description: My amazing NovelAI script
memoryLimit: 8
createdAt: 1234567890123
updatedAt: 1234567894564
config:
  - # Custom configuration items here
```

**Fields:**

- `compatibilityVersion` - NAIScript compatibility version (always "naiscript-1.0")
- `id` - Unique ID required to update your script. Don't change.
- `name` - Output filename (creates `dist/{kebab-name}.naiscript`)
- `version` - Script version (appears in header)
- `author` - Your name/email (appears in header)
- `description` - Script description (appears in header)
- `memoryLimit` - How many megabytes of in-browser local-storage memory your script can use for storage. Maximum 128.
- `createdAt` - Timestamp of when your script was created
- `updatedAt` - Timestamp of when script was updated. Automatically updated on builds
- `config` - Array of custom configuration items (replaces config.yaml)

## Build Commands

| Command                            | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `npm run build`                    | Build all projects                        |
| `npm run build -- my-script`       | Build only "my-script" project            |
| `npm run build:watch`              | Watch all projects and rebuild on changes |
| `npm run build:watch -- my-script` | Watch only "my-script"                    |
| `npm run format`                   | Format source code files with prettier    |
| `npm run typecheck`                | Check for TypeScript errors               |
| `npm run clean`                    | Remove the dist directory                 |
| `npm run help`                     | Show build system help                    |

## Version 3.1.0

- Enhanced watch mode with better feedback, showing when builds start and complete

## Writing Scripts with Imports

You can split your code across multiple files using imports/exports. The build system removes all module syntax in the final output.

### Named Imports (Traditional Style)

**projects/my-script/src/utils.ts**

```typescript
export interface Config {
  enabled: boolean;
  debugMode: boolean;
}

export async function saveConfig(config: Config) {
  await api.v1.storage.set("config", config);
}

export function log(message: string) {
  api.v1.log(`[MyScript] ${message}`);
}
```

**projects/my-script/src/index.ts**

```typescript
import type { Config } from "./utils";
import { saveConfig, log } from "./utils";

const config: Config = {
  enabled: true,
  debugMode: false,
};

async function init() {
  log("Starting...");
  await saveConfig(config);
}

init();
```

### Namespace Imports

You can also use namespace imports (`import * as name`) to keep track of where functions come from:

**projects/my-script/src/index.ts**

```typescript
import type { Config } from "./utils";
import * as utils from "./utils";

const config: Config = {
  enabled: true,
  debugMode: false,
};

async function init() {
  utils.log("Starting...");
  await utils.saveConfig(config);
}

init();
```

The build system automatically generates a namespace wrapper object using Rollup:

```typescript
const utils = {
  saveConfig,
  log,
};
```

You can mix both styles in the same file if needed.

### Coding Style and Formatting

For your convenience, a formatting tool `prettier` is included to automatically format code to the common standard style for Javascript and Typescript. This tool aids in collaboration by reducing formatting friction between collaborators and presenting a readable and commonly-accepted standard of coding style. It can be invoked at any time with the package script:

```bash
npm run format
```

## NovelAI API Reference

The build system automatically downloads NovelAI type definitions. You get full IntelliSense for:

### Core APIs

- **`api.v1.storage`** - Persistent key-value storage
- **`api.v1.hooks`** - Register hooks for generation events
- **`api.v1.log()` / `api.v1.error()`** - Logging

### Document & Editor

- **`api.v1.document`** - Read and manipulate story paragraphs
- **`api.v1.editor`** - Trigger generation, check editor state
- **`api.v1.memory`** / **`api.v1.an`** - Story memory and author's note

### Generation & AI

- **`api.v1.generate`** - Generate text with GLM 4.6
- **`api.v1.generationParameters`** - Get/set generation parameters
- **`api.v1.image`** - Generate images
- **`api.v1.tokenizer`** - Encode/decode text to tokens

### Content & UI

- **`api.v1.lorebook`** - Manage lorebook entries
- **`api.v1.ui`** - Create UI extensions (buttons, panels, modals)
- **`api.v1.commentBot`** - Control HypeBot

**Official Documentation**: [NovelAI Scripting Docs](https://docs.novelai.net/scripting/introduction.html)

## Example Projects

Two example projects are included to demonstrate different use cases:

### example-script (Full-Featured)

Located in `projects/example-script/`, this demonstrates:

- **Modular code organization** with imports/exports across files
- **UI extensions** - Toolbar buttons with callbacks
- **Generation hooks** - Intercept and modify generation
- **Persistent storage** - Track data across script loads
- **Lorebook API** - Query and filter entries
- **Type safety** - TypeScript interfaces

### word-counter (Simple)

Located in `projects/word-counter/`, this demonstrates:

- **Single-file script** - Simple project structure
- **Document API** - Reading story text
- **Editor API** - Getting text selection
- **UI toasts** - Displaying information to users
- **Toolbar buttons** - Adding custom UI

## Tips and Best Practices

### Use Watch Mode During Development

```bash
npm run build:watch
```

Auto-rebuilds when you save. Keep it running while you work!

### Debugging

```typescript
// Use api.v1.log, not console.log
api.v1.log("Debug:", someVariable);
api.v1.error("Error:", error);
```

Output appears in browser console (F12).

### Code Organization

**Simple script:**

```text
my-script/src/
└── index.ts
```

**Medium script:**

```text
my-script/src/
├── utils.ts
└── index.ts
```

**Complex script:**

```text
my-script/src/
├── types.ts
├── config.ts
├── storage.ts
├── hooks.ts
├── ui.ts
└── index.ts
```

## Troubleshooting

### "Cannot find module" errors

1. Run `npm install`
2. Restart your TypeScript language server
3. Run `npm run build` to download type definitions

### Type definitions not found

```bash
rm -rf external/
npm run build
```

### Script doesn't work in NovelAI

1. Check browser console (F12) for errors
2. Verify script is enabled in NovelAI
3. Check that your TypeScript files compile correctly
4. Verify that your scripts don't use unsupported browser APIs

### Build errors

1. Check for TypeScript syntax errors in your source files
2. Make sure all imported files exist and have correct extensions
3. Verify that you're using the latest version of the build system:
   ```bash
   npm install
   npm run build
   ```
4. For Rollup-related issues, try a clean build:
   ```bash
   npm run clean
   npm run build
   ```

## FAQ

### Can I use npm packages?

No. NovelAI scripts run in the browser without npm access. Use only:

- Browser-native APIs
- The NovelAI API (`api.v1.*`)
- Your own code

### How do I add another project?

Use the script `npm run new`. Or you may manually create a new folder in `projects/` with a `src/` subdirectory containing your TypeScript files. Optionally add a `project.yaml` for configuration. The build system will automatically generate a `project.yaml` file on first build.

### Can I have just one project?

Yes! Simply have one folder in `projects/`. If you want single-project simplicity, just put one project folder there.

## License

MIT License - feel free to use this build system for your NovelAI script projects!

## Resources

- **[NovelAI Scripting Documentation](https://docs.novelai.net/scripting/introduction.html)**
- **[NovelAI API Reference](https://docs.novelai.net/en/scripting/api-reference)**
- **[TypeScript Documentation](https://www.typescriptlang.org/docs/)**
- **[NovelAI Discord](https://discord.gg/novelai)**

---

**Ready to start?** Create a folder in `projects/` and start building your NovelAI scripts!
