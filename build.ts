import typescript from "@rollup/plugin-typescript";
import { program } from "commander";
import { randomUUID } from "crypto";
import { existsSync, statSync, writeFileSync } from "fs";
import fs from "fs/promises";
import { get } from "https";
import inquirer from "inquirer";
import { basename, join } from "path";
import type { InputOptions, OutputOptions, RollupWatcher } from "rollup";
import { rollup, watch } from "rollup";
import * as yaml from "yaml";

const __dirname = import.meta.dirname;

type Project = {
  name: string;
  path: string;
  meta: Meta;
};
type ProjectMap = Map<string, Project>;

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

// =============================================================================
// CLI Entry Point
// =============================================================================

// Helpers
const getProjectOrDie = (name, projects: ProjectMap) => {
  const project = projects.get(name);
  if (!project) {
    console.error(`Project not found: ${name}`);
    process.exit(1);
  }
  return project;
};

const resolveProjects = async (name: string | undefined): Promise<ProjectMap> =>
  new Promise(async (resolve) => {
    const projects = await discoverProjects();
    // If a name is passed, then resolve us down to just the requested project
    if (name) {
      const project = getProjectOrDie(name, projects);
      projects.clear();
      projects.set(name, project);
    }

    console.log(
      `\n📦 Found ${projects.size} project(s): ${[...projects.keys()].join(
        ", ",
      )}`,
    );
    resolve(projects);
  });

// Set up commander
program.description("NovelAI Script Build System").version("3.0.0");

program.command("new").action(() => {
  createNewProject();
});

program
  .command("build", { isDefault: true })
  .description("Build projects")
  .argument("[project]", "Limit build to this single project")
  .option("-r, --refresh", "Force download fresh NovelAI type definitions")
  .action(async (name, options) => {
    await fetchExternalTypes(options.refresh);
    const projects = await resolveProjects(name);
    // Build selected projects
    Promise.all([...projects.values()].map(buildProject))
      .then(() => {
        console.log(`\n✅ Build complete! Built ${projects.size} project(s)`);
        process.exit(0);
      })
      .catch((err) => {
        console.error("Build error:", err);
        process.exit(1);
      });
  });

program
  .command("watch")
  .description("Automatically watch and rebuild projects on changes.")
  .argument("[project]", "Limit watching to this single project")
  .option("-r, --refresh", "Force download fresh NovelAI type definitions")
  .action(async (name, options) => {
    await fetchExternalTypes(options.refresh);
    const projects = await resolveProjects(name);
    const watchers: RollupWatcher[] = [];
    // Watch selected projects.
    watchers.push(...[...projects.values()].map(watchProject));
    ["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) =>
      process.on(signal, () => {
        console.log(" Cleaning up, closing watchers");
        watchers.forEach((watcher) => watcher.close());
        process.exit(0);
      }),
    );
  });

program.parse();

// =============================================================================
// External Types Fetching
// =============================================================================

function fetchExternalTypes(forceRefresh = false) {
  return new Promise((resolve, reject) => {
    const url = "http://novelai.net/scripting/types/script-types.d.ts";
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

/**
 * Discover all projects in the projects/ directory
 */
async function discoverProjects(): Promise<ProjectMap> {
  const projectsDir = join(__dirname, "projects");

  await fs.mkdir(projectsDir, { recursive: true });

  return fs
    .readdir(projectsDir, { withFileTypes: true })
    .then((pdirs) =>
      pdirs.map((pdir) => ensureProject(join(pdir.parentPath, pdir.name))),
    )
    .then((ps) => Promise.all(ps))
    .then((ps) => new Map(ps.map((p) => [p.name, p])));
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
  return `/*---
${yaml.stringify({ ...meta, compatibilityVersion: "naiscript-1.0" })}---*/

/**
 * ${meta.name}
 * Built with NovelAI Script Build System
 */\n`;
}

const rollupInputOptions = (project: Project): InputOptions => ({
  input: join(project.path, "src", "index.ts"),
  plugins: [
    {
      name: "watch-project-yaml",
      buildStart() {
        this.addWatchFile(join(project.path, "project.yaml"));
      },
    },
    typescript(),
  ],
  onwarn(warning) {
    console.warn(warning.message);
  },
});

const rollupOutputOptions = (project: Project): OutputOptions => ({
  dir: join(__dirname, "dist"),
  format: "esm",
  entryFileNames: `${project.name}.naiscript`,
  banner() {
    return generateScriptHeader(project.meta);
  },
});

async function buildProject(project: Project) {
  const { name, path, meta } = project;

  console.log(`\n🔨 Building project: ${name}`);

  meta.updatedAt = currentEpochS();

  await rollup(rollupInputOptions(project)).then((bundle) =>
    bundle.write(rollupOutputOptions(project)).then(() => bundle.close()),
  );

  // Write new project.yaml file
  await fs
    .writeFile(join(path, "project.yaml"), yaml.stringify(meta))
    .catch(console.error);

  // Show output file size
  const outputPath = join(join(__dirname, "dist"), `${name}.naiscript`);
  const stats = await fs.stat(outputPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`✅ Built: dist/${name}.naiscript (${sizeKB} KB)`);

  return true;
}

// =============================================================================
// Watch Mode
// =============================================================================

const watchProject = (project: Project) => {
  console.log(`    Watching project: ${project.name}`);
  return watch({
    ...rollupInputOptions(project),
    ...{ output: rollupOutputOptions(project) },
  }).on("event", async (event) => {
    const currentProjectFile = await fs.readFile(
      join(project.path, "project.yaml"),
    );
    const currentProjectMeta = yaml.parse(
      currentProjectFile.toString(),
    ) as Meta;
    currentProjectMeta.updatedAt = currentEpochS();

    switch (event.code) {
      case "START":
        console.log(`    Building project: ${project.name}...`);
        project.meta = currentProjectMeta;
        break;
      case "END":
        // Write new project.yaml file
        await fs
          .writeFile(
            join(project.path, "project.yaml"),
            yaml.stringify(currentProjectMeta),
          )
          .catch(console.error);
        console.log(`    Built project: ${project.name}...`);
    }
  });
};

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
