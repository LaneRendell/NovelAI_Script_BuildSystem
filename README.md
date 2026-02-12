# NovelAI Script Build System

A CLI tool for building NovelAI scripts from TypeScript files. This tool uses Rollup to bundle multiple TypeScript files into single scripts that can be copied and pasted into the NovelAI script editor.

## Features

- **Standalone CLI Tool**: Install globally and use anywhere
- **Modular Development**: Write scripts across multiple TypeScript files with imports/exports
- **Automatic Type Definitions**: Fetches the latest NovelAI API types automatically
- **Type Safety**: Full TypeScript support with IntelliSense and type checking
- **Watch Mode**: Automatic rebuilds when files change during development
- **Single File Output**: Each project bundles into one script with no external dependencies

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (comes with Node.js)

### Installation

```bash
npm install -g nibs-cli
```

### Your First Build

```bash
nibs build
```

This builds the current project. Output appears in `dist/`.

## Project Structure

```text
my-novelai-script/
├── src/                        # Your TypeScript files
│   ├── index.ts               # Main entry point
│   └── utils.ts               # Utility modules
├── project.yaml               # Project configuration
├── tsconfig.json              # TypeScript configuration
├── dist/                      # Build output (generated)
│   └── my-script.naiscript    # Built script ready for NovelAI
├── external/                  # Auto-downloaded type definitions
│   └── script-types.d.ts
└── package.json               # Optional (for your own development dependencies such as prettier formatter)
```

## Usage

### Importing an existing project

1. Use the `import` command:

   ```bash
   nibs import my-script.naiscript
   ```
   
   This will create a `my-script/` directory, importing the `project.yaml` and `src/index.ts` from the `.naiscript` file. You can immediately `cd` into that directory and `nibs build`.


### Creating a New Project

1. Use the `new` command:

   ```bash
   nibs new my-script
   ```

   This will create a new project in `my-script/` directory with the basic structure.

2. Edit your TypeScript files:

   ```bash
   # Edit the main script file
   my-script/src/index.ts
   ```

3. Build:
   ```bash
   cd my-script
   nibs build
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

## CLI Commands

| Command | Description |
|---------|-------------|
| `nibs new <directory>` | Create a new project |
| `nibs build [directory]` | Build project (default command) |
| `nibs watch [directory]` | Watch project and rebuild on changes |
| `nibs import <file>` | Import an existing .naiscript and create a project directory |
| `nibs help` | Show help information |

## Writing Scripts with Imports

You can split your code across multiple files using imports/exports. The build system removes all module syntax in the final output.

### Named Imports (Traditional Style)

**src/utils.ts**

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

**src/index.ts**

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

**src/index.ts**

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

## Using npm Packages

NIBS can bundle npm packages into your scripts. Since the build system uses Rollup with node module resolution, any package you install in your project directory can be imported and inlined into the final `.naiscript` output.

### Setup

Initialize a `package.json` in your project directory and install packages:

```bash
cd my-script
npm init -y
npm install lodash-es
```

Then import them in your TypeScript files:

```typescript
import { debounce } from "lodash-es";

const debouncedSave = debounce(async () => {
  await api.v1.storage.set("data", myData);
}, 500);
```

The build system resolves the import from `node_modules/`, inlines the package code, and produces a single self-contained `.naiscript` file with no external dependencies.

### Runtime Constraints

**NovelAI scripts run inside a Web Worker sandbox powered by the QuickJS runtime.** This is a very different environment from Node.js or a browser page. Packages you use must be compatible with these constraints:

- **No Node.js APIs** - `fs`, `path`, `http`, `child_process`, `Buffer`, and all other Node.js built-in modules are unavailable
- **No DOM APIs** - `document`, `window`, `localStorage`, and other browser page APIs are unavailable (scripts run in a Web Worker, not a page)
- **No network access** - `fetch`, `XMLHttpRequest`, and WebSocket are unavailable
- **QuickJS engine** - The JavaScript engine is QuickJS, not V8. Most ES2023 features are supported, but some newer APIs or V8-specific behaviors may not be available

### What Works

- **Pure logic packages** - Algorithms, data structures, parsers, math libraries, string manipulation, validation
- **ESM packages** - Packages that ship ES module builds (check for `"module"` or `"exports"` fields in the package's `package.json`)

### What Won't Work

- Packages that depend on Node.js built-in modules (e.g., `axios`, `fs-extra`)
- Packages that access the DOM (e.g., `react`, `jquery`)
- Packages that use network APIs (e.g., `node-fetch`, `socket.io-client`)
- Packages that ship only CommonJS builds (no ESM entry point) — these may fail to bundle correctly

### Tips

- Check a package's dependencies and source before installing — if it imports `fs`, `http`, or `path`, it won't work
- Prefer packages with `-es` or `esm` variants (e.g., `lodash-es` instead of `lodash`)
- Keep your bundle small — every dependency gets inlined into the final script
- Test your built `.naiscript` in NovelAI after adding new packages to catch runtime incompatibilities early

## NovelAI API Reference

The build system automatically downloads NovelAI type definitions. In supported editors you get full completion and IDE documentation.

**Official Documentation**: [NovelAI Scripting Docs](https://docs.novelai.net/scripting/introduction.html)

## Example Projects

Two example projects are included to demonstrate different use cases:

### example-script (Full-Featured)

Located in `examples/example-script/`, this demonstrates:

- **Modular code organization** with imports/exports across files
- **UI
 extensions** - Toolbar buttons with callbacks
- **Generation hooks** - Intercept and modify generation
- **Persistent storage** - Track data across script loads
- **Lorebook API** - Query and filter entries
- **Type safety** - TypeScript interfaces

### word-counter (Simple)

Located in `examples/word-counter/`, this demonstrates:

- **Single-file script** - Simple project structure
- **Document API** - Reading story text
- **Editor API** - Getting text selection
- **UI toasts** - Displaying information to users
- **Toolbar buttons** - Adding custom UI

## Tips and Best Practices

### Use Watch Mode During Development

```bash
nibs watch
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
src/
└── index.ts
```

**Medium script:**

```text
src/
├── utils.ts
└── index.ts
```

**Complex script:**

```text
src/
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
3. Run `nibs build` to download type definitions

### Type definitions not found

```bash
rm -rf external/
nibs build
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
   npm install -g nibs-cli
   ```
4. For Rollup-related issues, try a clean build:
   ```bash
   rm -rf dist/
   nibs build
   ```

## FAQ

### Can I use npm packages?

Yes, as of v4.2! Install packages with `npm install` in your project directory and import them normally. The build system bundles them into your `.naiscript` file. However, NovelAI scripts run in a **Web Worker sandbox under the QuickJS runtime**, so packages must be pure JavaScript logic with no Node.js, DOM, or network dependencies. See [Using npm Packages](#using-npm-packages) for details.

### How do I add another project?

Use the CLI command `nibs new <directory>`. Or you may manually create a new folder with a `src/` subdirectory containing your TypeScript files.

### Legacy Projects (v3.x and earlier)

If you're upgrading from the older npm-run-script based version:

1. **Install the CLI tool**:
   ```bash
   npm install -g nibs-cli
   ```

2. **Move your projects** out of the repository's `projects/` folder and into your own source control repository

3. **Update your workflow**:
   - Old: `npm run build -- my-project`
   - New: `cd my-project && nibs build`

The old multi-project-folder structure is no longer supported. Each script should now be managed in its own directory.

## License

MIT License - feel free to use this CLI tool for your NovelAI script projects!

## Resources

- **[NovelAI Scripting Documentation](https://docs.novelai.net/scripting/introduction.html)**
- **[NovelAI API Reference](https://docs.novelai.net/en/scripting/api-reference)**
- **[TypeScript Documentation](https://www.typescriptlang.org/docs/)**
- **[NovelAI Discord](https://discord.gg/novelai)**

---

**Ready to start?** Run `nibs new my-script` and start building your NovelAI scripts!
