import { existsSync, statSync, writeFileSync, watch as _watch } from "fs";
import fs from "fs/promises";
import { join, sep, basename } from "path";
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
  node build.ts                    Build all projects
  node build.ts my-script          Build only "my-script" project
  node build.ts --watch            Watch and rebuild all projects
  node build.ts --watch my-script  Watch specific project
  node build.ts --refresh-types    Build with fresh type definitions`,
);

program.parse();

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
        resolve(1);
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
        resolve(1);
      });
    }).on("error", reject);
  });
}

// =============================================================================
// Project Discovery
// =============================================================================

type Project = {
  name: string;
  path: string;
  meta: Meta;
};

type Meta = {
  compatibilityVersion: string;
  id: string;
  name: string;
  version: string;
  createdAt: number;
  author: string;
  description: string;
  memoryLimit: number;
  updatedAt: number;
  config: Array<any>;
};

type LegacyMeta = Meta & {
  sourceFiles?: Array<string>;
  license?: string;
};

/**
 * Discover all projects in the projects/ directory
 */
async function discoverProjects(): Promise<Project[]> {
  const projectsDir = join(__dirname, "projects");

  await fs.mkdir(projectsDir, { recursive: true });

  return fs
    .readdir(projectsDir, { withFileTypes: true })
    .then((pdirs) =>
      pdirs.map((pdir) => ensureProject(join(pdir.parentPath, pdir.name))),
    )
    .then((ps) => Promise.all(ps));
}

const COMPAT_VERSION = "naiscript-1.0";
async function ensureProject(projectPath: string): Promise<Project> {
  const project: Project = {
    name: basename(projectPath),
    path: projectPath,
    meta: {
      compatibilityVersion: COMPAT_VERSION,
      id: randomUUID(),
      name: basename(projectPath),
      version: "0.0.0",
      createdAt: currentEpochS(),
      author: "Unknown",
      description: "",
      memoryLimit: 8,
      updatedAt: currentEpochS(),
      config: [],
    },
  };
  // Backwards-compatibility: Read project.json and config.yaml and merge with defaults.
  const meta = await fs
    .readFile(join(projectPath, "project.json"))
    .then((buf) => JSON.parse(buf.toString()) as LegacyMeta)
    .catch(() => ({}) as LegacyMeta);
  const config = await fs
    .readFile(join(projectPath, "config.yaml"))
    .then((buf) => yaml.parse(buf.toString()))
    .catch(() => []);
  // New project.yaml source of truth overrides the above when present.
  const projectYaml = await fs
    .readFile(join(projectPath, "project.yaml"))
    .then((buf) => yaml.parse(buf.toString()) as Meta)
    .catch(() => ({}) as Meta);
  delete meta.sourceFiles;
  if (meta.license) {
    meta.description += ` License: ${meta.license}`;
  }
  delete meta.license;
  project.meta = { ...project.meta, ...meta };
  project.meta.config = config;
  project.meta = { ...project.meta, ...projectYaml };
  return project;
}

async function checkExistingProject(projectPath: string): Promise<boolean> {
  return Promise.any([
    fs.access(join(projectPath, "src"), fs.constants.F_OK),
    fs.access(join(projectPath, "project.json"), fs.constants.F_OK),
    fs.access(join(projectPath, "project.yaml"), fs.constants.F_OK),
    fs.access(join(projectPath, "config.yaml"), fs.constants.F_OK),
  ])
    .then(() => true)
    .catch(() => false);
}

// =============================================================================
// Build Functions
// =============================================================================

function generateScriptHeader(meta: Meta) {
  const {
    id,
    name,
    createdAt,
    updatedAt,
    version,
    author,
    description,
    memoryLimit,
    config,
  } = meta;
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
 * Built with NovelAI Script Build System
 */\n`;
}

async function buildProject(project: Project) {
  const { name, path: projectPath, meta } = project;

  console.log(`\n🔨 Building project: ${name}`);

  meta.updatedAt = currentEpochS();

  const bundle = await rollup({
    input: join(projectPath, "src", "index.ts"),
    plugins: [typescript()],
    onwarn(warning) {
      console.warn(warning.message);
    },
  });

  const projectDistDir = join(__dirname, "dist");
  const outputFilename = `${name}.naiscript`;

  // Write the bundled script
  await bundle.write({
    dir: projectDistDir,
    format: "esm",
    entryFileNames: outputFilename,
    banner() {
      return generateScriptHeader(meta);
    },
  });

  await bundle.close();

  // Write new project.yaml file
  try {
    await fs.writeFile(join(projectPath, "project.yaml"), yaml.stringify(meta));
  } catch (err) {
    console.error(err);
  }
  // Show output file size
  const outputPath = join(projectDistDir, outputFilename);
  const stats = statSync(outputPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`✅ Built: dist/${outputFilename} (${sizeKB} KB)`);

  return true;
}

async function buildAll() {
  const projectsDir = join(__dirname, "projects");

  if (!existsSync(projectsDir)) {
    console.error("❌ No projects/ directory found.");
    console.error(
      "   Create a projects/ directory with subdirectories for each project.",
    );
    console.error("   Example: projects/my-script/src/index.ts");
    return false;
  }

  const projects = await discoverProjects();

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

async function buildOne(projectName: string) {
  try {
    const projects = await discoverProjects();
    const project = projects.find(
      (p) => p.name === projectName || p.meta.name === projectName,
    );

    if (!project) {
      console.error(`❌ Project "${projectName}" not found`);
      console.error(
        `   Available projects: ${projects.map((p) => p.name).join(", ") || "(none)"}`,
      );
      return false;
    }

    return await buildProject(project);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    return false;
  }
}

// =============================================================================
// Watch Mode
// =============================================================================

async function watch(projectName: string) {
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

const currentEpochS = () => Math.floor(Date.now() / 1000);

const INDEX_TS_TEMPLATE = `(async () => {
  api.v1.log("Hello World!");
})();`;

const kebabCase = (name: string) => name.toLowerCase().replaceAll(/\s+/g, "-");

// =============================================================================
// Create new project
// =============================================================================

async function createNewProject(): Promise<Project> {
  const answers = await inquirer.prompt([
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
  ]);
  const projectPath = join(__dirname, "projects", kebabCase(answers.name));

  const projectExists = await checkExistingProject(projectPath);
  if (projectExists) {
    console.error("Project already exists");
    return ensureProject(projectPath);
  }

  await fs.mkdir(join(projectPath, "src"), { recursive: true });

  const project = await ensureProject(projectPath).then((project) => {
    project.meta.name = answers.name;
    project.meta.author = answers.author;
    project.meta.description =
      answers.description + ` License: ${answers.license}`;
    return project;
  });

  await Promise.all([
    fs.writeFile(
      join(projectPath, "project.yaml"),
      yaml.stringify(project.meta),
      "utf-8",
    ),
    fs.writeFile(
      join(projectPath, "src", "index.ts"),
      INDEX_TS_TEMPLATE,
      "utf-8",
    ),
  ]);

  console.log(`Project created at ${projectPath}`);

  return project;
}
