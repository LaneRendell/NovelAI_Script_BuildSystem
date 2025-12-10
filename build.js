import {
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
  readdirSync,
  readFileSync,
  watch as _watch,
  globSync,
} from "fs";
import { join, relative, dirname, resolve, sep } from "path";
import { get } from "https";
import { program } from "commander";
import inquirer from "inquirer";
import { randomUUID } from "crypto";
import * as yaml from "yaml";
import { rollup } from "rollup";
import typescript from "@rollup/plugin-typescript";

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
          meta: projectMetaDefaultWithUpdate(entry.name, {}),
          config: projectConfigOrDefault(entry.name, {}),
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
    memoryLimit: 8,
    ...config, // Merge current project.json over the above defaults
    updatedAt: currentEpochS(), // Update the updatedAt field
  };
}

/**
 * Auto-discover TypeScript files in a src directory
 */

// =============================================================================
// Build Functions
// =============================================================================

function generateScriptHeader(meta, config) {
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
  } = meta;
  readFileSync;
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
  config,
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

  const bundle = await rollup({
    input: join(projectPath, "src", "index.ts"),
    plugins: [
      {
        resolveId(source, importer) {
          if (importer) {
            return resolve(dirname(importer), source) + ".ts";
          }
        },
      },
      typescript(),
    ],
    onwarn(warning) {
      console.warn(warning.message);
    },
  });

  const kebabName = meta.name.toLowerCase().replaceAll(/\s+/g, "-");
  const projectDistDir = join(__dirname, "dist");
  const outputFilename = `${kebabName}.naiscript`;

  // Write the bundled script
  await bundle.write({
    dir: projectDistDir,
    format: "esm",
    entryFileNames: outputFilename,
    banner() {
      return generateScriptHeader(meta, config);
    },
  });

  await bundle.close();
  // Show output file size
  const outputPath = join(projectDistDir, outputFilename);
  const stats = statSync(outputPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`✅ Built: dist/${outputFilename} (${sizeKB} KB)`);

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
    return yaml.parse(readFileSync(srcPath).toString());
  } else {
    return [];
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
