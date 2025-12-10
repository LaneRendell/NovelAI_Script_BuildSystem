import {
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
  readdirSync,
  readFileSync,
  watch as _watch,
  write,
  copyFileSync,
  readFile,
} from "fs";
import { join, relative, dirname, resolve as _resolve, sep } from "path";
import { get } from "https";
import { program } from "commander";
import inquirer from "inquirer";
import { randomUUID } from "crypto";
import * as yaml from "yaml";

const __dirname = import.meta.dirname;

// =============================================================================
// CLI Entry Point
// =============================================================================

// Set up commander
program.description("NovelAI Script Build System").version("1.0.0");

program
  .command("build", { isDefault: true })
  .argument("[project]", "Project name to build")
  .option("-w, --watch", "Watch for changes and rebuild automatically")
  .option(
    "-r, --refresh-types",
    "Force download fresh NovelAI type definitions",
  )
  .action(async (project, options) => {
    if (options.help) {
      showHelp();
      process.exit(0);
    }

    ensureDirectories();

    // If forcing a type refresh
    if (options.refreshTypes) {
      // Fetch external types first
      await fetchExternalTypes(true);
    } else {
      // Fetch external types first
      await fetchExternalTypes();
    }

    // Run build or watch
    if (options.watch) {
      watch(project).catch((err) => {
        console.error("Watch error:", err);
        process.exit(1);
      });
    } else if (project) {
      buildOne(project)
        .then((success) => {
          process.exit(success ? 0 : 1);
        })
        .catch((err) => {
          console.error("Build error:", err);
          process.exit(1);
        });
    } else {
      buildAll()
        .then((success) => {
          process.exit(success ? 0 : 1);
        })
        .catch((err) => {
          console.error("Build error:", err);
          process.exit(1);
        });
    }
  });

program.command("new").action(() => {
  createNewProject();
});

program.addHelpText(
  "after",
  `Examples:
  node build.js                    Build all projects
  node build.js my-script          Build only "my-script" project
  node build.js --watch            Watch and rebuild all projects
  node build.js --watch my-script  Watch specific project
  node build.js --refresh-types    Build with fresh type definitions`,
);

program.parse();

// Ensure dist and external directories exist
function ensureDirectories() {
  if (!existsSync("dist")) {
    mkdirSync("dist", { recursive: true });
  }
  if (!existsSync("external")) {
    mkdirSync("external", { recursive: true });
  }
}

// =============================================================================
// External Types Fetching
// =============================================================================

function fetchExternalTypes(forceRefresh = false) {
  return new Promise((resolve, reject) => {
    const url = "https://novelai.github.io/scripting/types/script-types.d.ts";
    const outputPath = join(__dirname, "external", "script-types.d.ts");

    // Check if file already exists and is less than 24 hours old (unless force refresh)
    if (!forceRefresh && existsSync(outputPath)) {
      const stats = statSync(outputPath);
      const age = Date.now() - stats.mtimeMs;
      const hoursOld = age / (1000 * 60 * 60);

      if (hoursOld < 24) {
        console.log("✓ Using cached NovelAI type definitions");
        resolve();
        return;
      }
    }

    console.log(
      forceRefresh
        ? "📥 Force refreshing NovelAI type definitions..."
        : "📥 Fetching NovelAI type definitions...",
    );

    get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch types: HTTP ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        writeFileSync(outputPath, data, "utf8");
        console.log("✓ NovelAI type definitions downloaded");
        resolve();
      });
    }).on("error", reject);
  });
}

// =============================================================================
// Project Discovery
// =============================================================================

/**
 * Discover all projects in the projects/ directory
 */
function discoverProjects() {
  const projectsDir = join(__dirname, "projects");
  const projects = [];

  if (!existsSync(projectsDir)) {
    return projects;
  }

  const entries = readdirSync(projectsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = join(projectsDir, entry.name);
    const metaPath = join(projectPath, "project.json");
    const configPath = join(projectPath, "config.yaml");

    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf8"));
        projects.push({
          name: entry.name,
          path: projectPath,
          meta: projectMetaDefaultWithUpdate(entry.name, meta),
          config: projectConfigOrDefault(configPath),
        });
      } catch (err) {
        console.warn(
          `⚠️  Invalid project.json in ${entry.name}: ${err.message}`,
        );
      }
    } else {
      // Auto-discover project without project.json (use defaults)
      const srcPath = join(projectPath, "src");
      if (existsSync(srcPath)) {
        console.log(
          `ℹ️  Project "${entry.name}" has no project.json, using defaults`,
        );
        projects.push({
          name: entry.name,
          path: projectPath,
          config: projectMetaDefaultWithUpdate(entry.name, {
            sourceFiles: autoDiscoverSourceFiles(srcPath),
          }),
        });
      }
    }
  }

  return projects;
}

function projectMetaDefaultWithUpdate(name, config) {
  return {
    id: randomUUID(),
    name: name,
    version: "1.0.0",
    createdAt: currentEpochS(),
    author: "Unknown",
    description: "",
    license: "MIT",
    sourceFiles: ["src/index.ts"],
    memoryLimit: 8,
    ...config, // Merge current project.json over the above defaults
    updatedAt: currentEpochS(), // Update the updatedAt field
  };
}

/**
 * Auto-discover TypeScript files in a src directory
 */
function autoDiscoverSourceFiles(srcPath) {
  const files = [];

  function scanDir(dir, relativeTo) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(relativeTo, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        scanDir(fullPath, relativeTo);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        files.push("src/" + relativePath);
      }
    }
  }

  scanDir(srcPath, srcPath);

  // Sort to put index.ts last (it's usually the entry point)
  files.sort((a, b) => {
    if (a.includes("index.ts")) return 1;
    if (b.includes("index.ts")) return -1;
    return a.localeCompare(b);
  });

  return files;
}

// =============================================================================
// Build Functions
// =============================================================================

/**
 * Parse namespace imports from content
 * Returns array of { alias: string, modulePath: string }
 */
function parseNamespaceImports(content) {
  const namespaceImports = [];
  // Match: import * as alias from "./module" or './module'
  const regex =
    /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    namespaceImports.push({
      alias: match[1],
      modulePath: match[2],
    });
  }
  return namespaceImports;
}

/**
 * Parse exported VALUE identifiers from a module's content
 * Returns array of exported names (functions, constants, classes, enums)
 * Note: interfaces and type aliases are NOT included - they don't exist at runtime
 */
function parseValueExports(content) {
  const exports = [];

  // Match: export function name
  const funcRegex = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Match: export const/let/var name
  const varRegex = /^export\s+(?:const|let|var)\s+(\w+)/gm;
  while ((match = varRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Match: export class name
  const classRegex = /^export\s+class\s+(\w+)/gm;
  while ((match = classRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Match: export enum name
  const enumRegex = /^export\s+enum\s+(\w+)/gm;
  while ((match = enumRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  return exports;
}

/**
 * Parse exported TYPE declarations from a module's content
 * Returns array of { name, declaration } for interfaces and type aliases
 * These need to go in a namespace for type access via namespace.TypeName
 */
function parseTypeExports(content) {
  const typeExports = [];

  // Match: export interface Name { ... }
  // Need to handle nested braces
  const interfaceRegex =
    /^export\s+(interface\s+\w+(?:\s+extends\s+[^{]+)?)\s*\{/gm;
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const startIndex = match.index;
    const declarationStart = match[1]; // "interface Name" or "interface Name extends X"

    // Find the matching closing brace
    let braceCount = 1;
    let i = match.index + match[0].length;
    while (i < content.length && braceCount > 0) {
      if (content[i] === "{") braceCount++;
      else if (content[i] === "}") braceCount--;
      i++;
    }

    const fullDeclaration = content.slice(startIndex + "export ".length, i);
    const name = declarationStart.match(/interface\s+(\w+)/)[1];
    typeExports.push({ name, declaration: fullDeclaration });
  }

  // Match: export type Name = ...;
  const typeAliasRegex = /^export\s+(type\s+(\w+)(?:<[^>]*>)?\s*=\s*[^;]+;)/gm;
  while ((match = typeAliasRegex.exec(content)) !== null) {
    typeExports.push({
      name: match[2],
      declaration: match[1],
    });
  }

  return typeExports;
}

/**
 * Resolve a relative module path to a source file path
 */
function resolveModulePath(importPath, currentFile, projectPath) {
  // Remove ./ or ../ prefix and add .ts extension if needed
  let resolved = importPath;
  if (!resolved.endsWith(".ts")) {
    resolved += ".ts";
  }

  // Get the directory of the current file
  const currentDir = dirname(currentFile);

  // Resolve relative to current file's directory
  const fullPath = _resolve(projectPath, currentDir, resolved);

  // Return path relative to project root
  return relative(projectPath, fullPath).replace(/\\/g, "/");
}

function removeImportsExports(content) {
  // Remove import statements (including multiline imports and type imports)
  content = content.replace(
    /^import\s+type\s+[\s\S]*?from\s+['"].*?['"];?\s*\n?/gm,
    "",
  );
  content = content.replace(
    /^import\s+[\s\S]*?from\s+['"].*?['"];?\s*\n?/gm,
    "",
  );
  content = content.replace(/^\/\/.*import.*from.*\n?/gm, "");

  // Remove export keywords (but keep the declarations)
  content = content.replace(/^export\s+/gm, "");

  return content;
}

function generateScriptHeader(config) {
  const {
    id,
    name,
    createdAt,
    updatedAt,
    version,
    author,
    license,
    description,
    memoryLimit,
  } = config;
  return `/*---
${yaml.stringify({
  compatibilityVersion: "naiscript-1.0",
  id,
  name,
  createdAt,
  updatedAt,
  version,
  author,
  description,
  memoryLimit,
})}---*/

/**
 * ${name}
 * License: ${license}
 * Built with NovelAI Script Build System
 */\n`;
}

async function buildProject(project) {
  const { name, path: projectPath, meta, config } = project;

  console.log(`\n🔨 Building project: ${name}`);

  // First pass: Build export maps for all source files
  const valueExportMap = new Map(); // Map<modulePath, string[]> - value exports (functions, const, etc.)
  const typeExportMap = new Map(); // Map<modulePath, Array<{name, declaration}>> - type exports (interfaces, type aliases)
  const rawContents = new Map(); // Map<filePath, string> - raw file contents

  for (const file of meta.sourceFiles) {
    const filePath = join(projectPath, file);

    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    rawContents.set(file, content);

    // Parse and store value exports (runtime) for this file
    const valueExports = parseValueExports(content);
    valueExportMap.set(file, valueExports);

    // Parse and store type exports (compile-time) for this file
    const typeExports = parseTypeExports(content);
    typeExportMap.set(file, typeExports);
  }

  // Second pass: Build a map of which namespace wrappers need to be generated after each source file
  // Map<sourceFile, Array<{ alias, valueExports[], typeExports[] }>>
  const wrappersAfterFile = new Map();

  for (const file of meta.sourceFiles) {
    const content = rawContents.get(file);
    if (!content) continue;

    const namespaceImports = parseNamespaceImports(content);

    for (const nsImport of namespaceImports) {
      // Resolve the module path relative to the importing file
      const resolvedPath = resolveModulePath(
        nsImport.modulePath,
        file,
        projectPath,
      );

      // Look up exports for this module
      const moduleValueExports = valueExportMap.get(resolvedPath) || [];
      const moduleTypeExports = typeExportMap.get(resolvedPath) || [];

      if (moduleValueExports.length > 0 || moduleTypeExports.length > 0) {
        // Add wrapper to be generated after the source module
        if (!wrappersAfterFile.has(resolvedPath)) {
          wrappersAfterFile.set(resolvedPath, []);
        }

        const wrappers = wrappersAfterFile.get(resolvedPath);
        // Check if we already have a wrapper for this alias
        const existing = wrappers.find((w) => w.alias === nsImport.alias);
        if (!existing) {
          wrappers.push({
            alias: nsImport.alias,
            valueExports: moduleValueExports,
            typeExports: moduleTypeExports,
          });
        }
      }
    }
  }

  // Write meta with bumped updatedAt
  writeFileSync(
    join(project.path, "project.json"),
    JSON.stringify(project.meta, null, 2),
  );

  // Build the bundled content
  let bundledContent = generateScriptHeader(meta);

  for (const file of meta.sourceFiles) {
    const filePath = join(projectPath, file);

    if (!existsSync(filePath)) {
      console.warn(`⚠️  Skipping missing file: ${file}`);
      continue;
    }

    let content = rawContents.get(file);

    // Remove imports and exports
    content = removeImportsExports(content);

    // Add file separator comment
    bundledContent += `\n// ============================================================================\n`;
    bundledContent += `// ${file}\n`;
    bundledContent += `// ============================================================================\n\n`;
    bundledContent += content;
    bundledContent += "\n";

    // Generate namespace wrappers for this module (if any files import it as namespace)
    const wrappers = wrappersAfterFile.get(file);
    if (wrappers && wrappers.length > 0) {
      bundledContent += `// Namespace wrapper(s) for ${file}\n`;
      for (const wrapper of wrappers) {
        // Generate TypeScript namespace for types (interfaces, type aliases)
        // This uses declaration merging with the const below
        if (wrapper.typeExports.length > 0) {
          bundledContent += `namespace ${wrapper.alias} {\n`;
          for (const typeExport of wrapper.typeExports) {
            // Indent each line of the declaration
            const indented = typeExport.declaration
              .split("\n")
              .map((line) => `    ${line}`)
              .join("\n");
            bundledContent += `    export ${indented.trimStart()}\n`;
          }
          bundledContent += `}\n`;
        }

        // Generate const object for runtime values (functions, variables, etc.)
        if (wrapper.valueExports.length > 0) {
          bundledContent += `const ${wrapper.alias} = {\n`;
          bundledContent += wrapper.valueExports
            .map((e) => `    ${e}`)
            .join(",\n");
          bundledContent += `\n};\n`;
        }
        bundledContent += "\n";
      }
    }
  }

  // Create project-specific output directory
  const projectDistDir = join(__dirname, "dist", name);
  if (!existsSync(projectDistDir)) {
    mkdirSync(projectDistDir, { recursive: true });
  }

  // Write the bundled script
  const outputFilename = `${meta.name}.naiscript`;
  const outputPath = join(projectDistDir, outputFilename);
  writeFileSync(outputPath, bundledContent, "utf8");

  // Show output file size
  const stats = statSync(outputPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`✅ Built: dist/${name}/${outputFilename} (${sizeKB} KB)`);

  return true;
}

async function buildAll(forceRefreshTypes = false) {
  const projectsDir = join(__dirname, "projects");

  if (!existsSync(projectsDir)) {
    console.error("❌ No projects/ directory found.");
    console.error(
      "   Create a projects/ directory with subdirectories for each project.",
    );
    console.error("   Example: projects/my-script/src/index.ts");
    return false;
  }

  const projects = discoverProjects();

  if (projects.length === 0) {
    console.error("❌ No valid projects found in projects/ directory");
    console.error(
      "   Each project needs a src/ directory (project.json is optional)",
    );
    return false;
  }

  console.log(
    `\n📦 Found ${projects.length} project(s): ${projects.map((p) => p.name).join(", ")}`,
  );

  let allSuccess = true;
  for (const project of projects) {
    const success = await buildProject(project);
    if (!success) allSuccess = false;
  }

  console.log(`\n✅ Build complete! Built ${projects.length} project(s)`);
  return allSuccess;
}

async function buildOne(projectName) {
  const projects = discoverProjects();
  const project = projects.find(
    (p) => p.name === projectName || p.config.name === projectName,
  );

  if (!project) {
    console.error(`❌ Project "${projectName}" not found`);
    console.error(
      `   Available projects: ${projects.map((p) => p.name).join(", ") || "(none)"}`,
    );
    return false;
  }

  return await buildProject(project);
}

// =============================================================================
// Watch Mode
// =============================================================================

async function watch(projectName) {
  const projectsDir = join(__dirname, "projects");

  if (!existsSync(projectsDir)) {
    console.error("❌ No projects/ directory found to watch");
    return;
  }

  console.log("👀 Watching for changes...");

  if (projectName) {
    // Watch specific project
    const projectDir = join(projectsDir, projectName);
    if (!existsSync(projectDir)) {
      console.error(`❌ Project "${projectName}" not found`);
      return;
    }

    _watch(projectDir, { recursive: true }, (_eventType, filename) => {
      if (filename && filename.endsWith(".ts")) {
        console.log(`\n📝 ${projectName}/${filename} changed, rebuilding...`);
        buildOne(projectName).catch((err) =>
          console.error("Build error:", err),
        );
      }
    });
    console.log(`   Watching project: ${projectName}`);
  } else {
    // Watch all projects
    _watch(projectsDir, { recursive: true }, (_eventType, filename) => {
      if (filename && filename.endsWith(".ts")) {
        // Extract project name from path
        const parts = filename.split(sep);
        const changedProject = parts[0];

        console.log(
          `\n📝 ${filename} changed, rebuilding ${changedProject}...`,
        );
        buildOne(changedProject).catch((err) =>
          console.error("Build error:", err),
        );
      }
    });
    console.log("   Watching all projects");
  }

  // Initial build
  if (projectName) {
    await buildOne(projectName);
  } else {
    await buildAll();
  }
}

// =============================================================================
// Utilities
// =============================================================================

function currentEpochS() {
  return Math.floor(Date.now() / 1000);
}

function generateIndexTS() {
  return `(async () => {
  api.v1.log("Hello World!");
})();`;
}

function projectConfigOrDefault(srcPath) {
  if (existsSync(srcPath)) {
    return readFileSync(srcPath);
  } else {
    return yaml.stringify([
      {
        name: "config_1",
        prettyName: "New Config",
        type: "string",
      },
    ]);
  }
}

// =============================================================================
// Create new project
// =============================================================================

function createNewProject() {
  inquirer
    .prompt([
      {
        type: "input",
        name: "name",
        message: "What will you name your script?",
        validate: (input) => input.length > 0,
        filter: (input) => input.toLowerCase().replaceAll(/\s+/g, "-"),
      },
      {
        type: "input",
        name: "author",
        message: "And who is the author?",
      },
      {
        type: "input",
        name: "description",
        message: "Write a brief description:",
        default: "",
      },
      {
        type: "input",
        name: "license",
        message: "What license is the script published under?",
        default: "MIT",
      },
    ])
    .then((answers) => {
      const project = {
        id: randomUUID(),
        name: answers.name,
        version: "1.0.0",
        createdAt: currentEpochS(),
        updatedAt: currentEpochS(),
        author: answers.author,
        description: answers.description,
        license: answers.license,
        sourceFiles: ["src/index.ts"],
      };

      const projectPath = join(__dirname, "projects", answers.name);
      if (!existsSync(projectPath)) {
        mkdirSync(projectPath, { recursive: true });
      } else {
        console.error("Project already exists");
        return;
      }

      // Write project json
      writeFileSync(
        join(projectPath, "project.json"),
        JSON.stringify(project, null, 2),
        "utf8",
      );

      // Write config yaml
      const configPath = join(projectPath, "config.yaml");
      writeFileSync(configPath, projectConfigOrDefault(configPath), "utf8");

      // Write entry index ts
      const indexTsPath = join(projectPath, "src", "index.ts");

      mkdirSync(dirname(indexTsPath), { recursive: true });
      writeFileSync(indexTsPath, generateIndexTS(), "utf8");

      console.log(`Project created at ${projectPath}`);
    });
}
