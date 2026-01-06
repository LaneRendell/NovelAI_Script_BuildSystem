import { randomUUID } from "crypto";
import { access, constants, mkdir, writeFile } from "fs/promises";
import inquirer from "inquirer";
import { basename, join } from "path";
import yaml, { Document } from "yaml";
import { currentEpochS, Project } from "./project";
import { writeTsConfig } from "../utils";

// Constants
const INDEX_TS_TEMPLATE = `(async () => {
  api.v1.log("Hello World!");
})();`;

const COMPAT_VERSION = "naiscript-1.0";
// Helpers

async function checkExistingProject(projectPath: string): Promise<boolean> {
  return Promise.race([
    access(join(projectPath, "src"), constants.F_OK),
    access(join(projectPath, "project.yaml"), constants.F_OK),
  ])
    .then(() => true)
    .catch(() => false);
}

export async function createNewProject(projectPath: string): Promise<void> {
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

  const projectExists = await checkExistingProject(projectPath);
  if (projectExists) {
    console.error("Project already exists");
  }

  await mkdir(join(projectPath, "src"), { recursive: true });

  const projectYamlDocument = new Document({
    compatibilityVersion: COMPAT_VERSION,
    id: randomUUID(),
    name: answers.name,
    version: "0.0.0",
    createdAt: currentEpochS(),
    author: answers.author,
    description: answers.description + ` License: ${answers.license}`,
    memoryLimit: 8,
    updatedAt: currentEpochS(),
    config: [],
  });
  const project: Project = {
    name: basename(projectPath),
    path: projectPath,
    meta: projectYamlDocument,
  };

  await Promise.all([
    writeFile(
      join(projectPath, "project.yaml"),
      yaml.stringify(project.meta),
      "utf-8",
    ),
    writeFile(join(projectPath, "src", "index.ts"), INDEX_TS_TEMPLATE, "utf-8"),
    writeTsConfig(projectPath),
  ]);

  console.log(`Project initialized at ${projectPath}`);
}
