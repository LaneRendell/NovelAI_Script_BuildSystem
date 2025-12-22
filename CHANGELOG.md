# Changelog

All notable changes to the NovelAI Script Build System will be documented in this file.

## [3.2.1] - 2025-12-22

### Fixed

- **YAML Document Preserves block scalars exactly (|)** Previously because the YAML document was being transformed into JSON, the interpretation of various block scalar styles would vary depending on the number of newlines in your scalar, tending towards the `>-` (folded, strip) style even if your original configuration used the `|` (literal) style. Now we preserve a YAML document object throughout the code path, which preserves the YAML AST and properties like the scalar style. Folded style might not preserve, but the `|` (literal) and `|-` (literal, strip) style will stay.

### Removed
- **`config.yaml` file ingestion** The config yaml file was only briefly supported, and I can't actually find a version of the code where it was the canonical form to place configuration. To simplify the code for this change, `config.yaml` read was removed. If you have a `config.yaml` file, please manually copy it into your `project.yaml` going forward.

## [3.2.0] - 2025-12-21

### Fixed

- **Changes to project.yaml trigger watcher builds** Now if you're adding configuration to your `project.yaml` or making any other changes, `npm run build:watch` will automatically rebuild your project, including updates in the frontmatter of the `.naiscript` output.

## [3.1.0] - 2025-12-13

### Added

- **Enhanced Watch Mode Feedback** Watch mode now provides clearer feedback showing when builds start and complete, improving developer experience during development

## [3.0.0] - 2025-12-11

### Added

- **Unified Configuration System** Merged `project.json` and `config.yaml` into a single `project.yaml` file that matches the YAML frontmatter of `.naiscript` files
- **Automatic Migration** Running `npm run build` will automatically generate a `project.yaml` file combining existing `project.json` and `config.yaml` configurations
- **Enhanced Project Creation** New projects now automatically generate `project.yaml` files

### Changed

- **Configuration Format** All project configuration now uses YAML format instead of JSON for consistency with `.naiscript` frontmatter
- **Configuration Fields** License information is now included in description field instead of being a separate field

## [2.4.2] - 2025-12-11

- Fix bug related to the custom simple resolver being unnecessary.

## [2.4.1] - 2025-12-11

- **Typescript build.ts** Node.js supports typescript natively so long as it can be executed by stripping types. Converting to typescript allows us to find mistakes in the code and correct them.

## [2.4.0] - 2025-12-10

### Added

- **Rollup Migration** Migrated build system from custom bundler to Rollup for better TypeScript compilation and bundling
- **Simplified Build Process** Removed complex manual parsing of imports/exports and namespace generation
- **Enhanced Error Handling** Better TypeScript error reporting during build process
- **Streamlined Output** Built scripts now output directly to `dist/` directory with `.naiscript` extension

### Changed

- **Build Dependencies** Added `rollup` and `@rollup/plugin-typescript` for modern TypeScript compilation
- **Output Structure** Scripts now output to `dist/{kebab-name}.naiscript` instead of nested project directories
- **Source File Handling** No longer requires explicit `sourceFiles` array in `project.json` - Rollup automatically handles file resolution
- **Header Generation** Script headers now include config.yaml content for better script metadata

## [2.3.0] - 2025-12-10

- **Code formatting with prettier** All source code files can be easily formatted with `npm run format`. This is a helper to improve code consistency and style.

## [2.2.0] - 2025-12-09

### Added

- **NAIScript Output** Build system now outputs `.naiscript` bundles.
- **Config Support** The `config.yaml` file can now be added to your projects, and will be bundled with your `.naiscript` on builds.

## [2.1.0] - 2025-12-02

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

## [2.0.0] - 2025-11-29

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

## [1.0.0] - 2025-11-29

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
     "sourceFiles": ["src/utils.ts", "src/index.ts"]
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

---

## Migration Guide: 2.x to 2.4

If you're upgrading from version 2.x:

1. **No changes required to existing projects** - All projects continue to work as before

2. **Update dependencies** (optional but recommended):
   ```bash
   npm install
   ```

3. **Clean rebuild recommended** for best results:
   ```bash
   npm run clean
   npm run build
   ```

4. **Updated output structure**:
   - Old: `dist/<project-name>/<script-name>.ts`
   - New: `dist/<kebab-name>.naiscript`
   - The build system now uses kebab-case for script names (lowercase, spaces replaced with hyphens)

5. **Source file handling**:
   - No longer requires explicit `sourceFiles` array in `project.json`
   - Rollup automatically resolves imports and builds the correct dependency order
   - This simplifies project configuration

---

## Migration Guide: 2.x to 3.0

If you're upgrading to version 3.0 with the unified configuration system:

1. **Automatic Migration** (Recommended):
   - Run `npm run build` to automatically generate `project.yaml` files
   - The system will combine your existing `project.json` and `config.yaml` files
   - Verify the generated `project.yaml` contains all your configuration

2. **Cleanup**:
   - After verifying the `project.yaml` file works correctly, you should delete the old `project.json` and `config.yaml` files
   - The `project.yaml` file supercedes the old config files.
