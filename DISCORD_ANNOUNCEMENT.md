# 🚀 NovelAI Script Build System - Now Available!

Hey everyone! I'm excited to share a new **TypeScript Build System** for NovelAI script development that makes creating complex scripts much easier! 🎉

## What is it?

A complete development environment that lets you write NovelAI scripts using **modern TypeScript** with **multiple files**, **imports/exports**, and **full type safety** - then automatically bundles everything into a single script ready for NovelAI.

## ✨ Key Features

- **📦 Modular Development** - Split your script across multiple files with imports/exports
- **🔍 Full TypeScript Support** - IntelliSense, autocomplete, and type checking for the entire NovelAI API
- **🤖 Auto Type Definitions** - Automatically fetches the latest NovelAI API types
- **👀 Watch Mode** - Auto-rebuild on save for rapid development
- **🎯 Single File Output** - Bundles everything into one script with zero dependencies

## 🎯 Why Use This?

Instead of writing everything in one giant file, you can now organize your code like a real project:

```typescript
// src/utils.ts
export async function saveToStorage(key: string, value: any) {
    await api.v1.storage.set(key, value);
}

// src/index.ts
import { saveToStorage } from "./utils";

async function init() {
    await saveToStorage("myData", { foo: "bar" });
}
```

The build system **removes all imports/exports** and bundles it into a single file that works in NovelAI!

## 🚀 Quick Start

**Prerequisites:** Node.js (v16+)

```bash
# 1. Clone the repo
git clone https://github.com/LaneRendell/NovelAI_Script_BuildSystem
cd NovelAI_Script_BuildSystem

# 2. Install dependencies
npm install

# 3. Build the example
npm run build

# 4. Copy dist/yourscriptname.ts into NovelAI!
```

## 📚 What's Included

- Complete working example demonstrating:
  - ✅ Modular code with imports
  - ✅ UI extensions (toolbar buttons)
  - ✅ Generation hooks
  - ✅ Persistent storage
  - ✅ Lorebook API usage
- Full documentation with examples
- TypeScript configuration
- Build and watch scripts

## 💡 Perfect For

- Complex scripts with lots of code
- Scripts with multiple features that should be organized separately
- Anyone who wants type safety and IntelliSense
- Developers used to modern JS/TS workflows

## 🔗 Get Started

**GitHub:** https://github.com/LaneRendell/NovelAI_Script_BuildSystem

The repo includes comprehensive documentation, examples, and everything you need to start building modular NovelAI scripts!

## 📖 Resources

- Full README with detailed instructions
- Complete example script showing all major features
- Troubleshooting guide
- FAQ section

---

**Questions?** Feel free to ask here or open an issue on GitHub!

Happy scripting! 🎨✨
