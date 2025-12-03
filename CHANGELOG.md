# Changelog

All notable changes to the NovelAI Script Build System will be documented in this file.

## [2.1.0] - 2024-12-02

### Added

- **Namespace import support**: You can now use `import * as name from "./module"` syntax
  - The build system automatically generates namespace wrapper objects
  - Use `name.function()` syntax to clearly indicate where functions come from
  - Mix namespace and named imports in the same project
  - Wrappers are generated immediately after the source module to ensure proper ordering
  - **Full type support**: Interfaces and type aliases are accessible via `namespace.TypeName`
    - Uses TypeScript declaration merging (namespace + const with same name)

### Example

```typescript
// You can now write this:
import * as utils from "./utils";

// And use both types and functions:
const config: utils.ScriptConfig = { name: "My Script" };
utils.formatTimestamp(Date.now());
```

The build system generates both a namespace (for types) and const (for values):

```typescript
namespace utils {
    export interface ScriptConfig { ... }
}
const utils = {
    formatTimestamp,
    showNotification,
    // ...all value exports
};
```

---

## [2.0.0] - 2024-11-29

### Added

- **Multi-project support**: Manage multiple scripts in a single repository
  - Each project lives in its own folder under `projects/`
  - Build all projects at once or specify a single project to build
  - Each project gets its own output directory in `dist/`

- **Project configuration** via `project.json`:
  - Define script name, version, author, description, and license
  - Explicitly specify source file order for proper bundling
  - Optional: projects without `project.json` are auto-discovered

- **Auto-discovery of source files**: Projects without `project.json` automatically discover all `.ts` files in their `src/` folder

- **Per-project IDE support**: Each project's dist folder includes its own `tsconfig.json` for proper type hints when viewing built output

- **New example project**: `word-counter` - a simple single-file script demonstrating document/editor APIs

- **CLI improvements**:
  - `npm run build` - Build all projects
  - `npm run build -- <project-name>` - Build specific project
  - `npm run build:watch -- <project-name>` - Watch specific project
  - `npm run help` - Show usage information

### Changed

- **Project structure**: Scripts now live in `projects/<name>/src/` instead of root `src/`
- **Output structure**: Built scripts now output to `dist/<project-name>/<script-name>.ts`
- **Version bumped to 2.0.0** to reflect breaking changes in project structure

### Removed

- Legacy single-project mode with root `src/` directory (use `projects/` instead)

## [1.0.0] - 2024-11-29

### Added

- Initial release
- TypeScript bundling for NovelAI scripts
- Automatic fetching of NovelAI type definitions with 24-hour caching
- Import/export removal for NovelAI compatibility
- Watch mode for development
- Example script demonstrating NovelAI API features:
  - Generation hooks
  - UI extensions
  - Persistent storage
  - Lorebook API
- Full TypeScript support with IntelliSense
- Comprehensive documentation

---

## Migration Guide: 1.x to 2.0

If you're upgrading from version 1.x:

1. **Move your source files**:
   ```bash
   mkdir -p projects/my-script/src
   mv src/* projects/my-script/src/
   rmdir src
   ```

2. **Create a project.json** (optional but recommended):
   ```json
   {
       "name": "my-script",
       "version": "1.0.0",
       "author": "Your Name",
       "description": "Your script description",
       "license": "MIT",
       "sourceFiles": [
           "src/utils.ts",
           "src/index.ts"
       ]
   }
   ```

3. **Update your workflow**:
   - Old: `npm run build` → Output in `dist/yourscriptname.ts`
   - New: `npm run build` → Output in `dist/my-script/my-script.ts`

4. **Delete old dist folder** and rebuild:
   ```bash
   npm run clean
   npm run build
   ```
