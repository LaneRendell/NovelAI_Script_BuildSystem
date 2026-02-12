import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { join } from "path";
import { InputOptions, OutputOptions } from "rollup";
import { Document } from "yaml";
import { Project } from "./project";

export function rollupInputOptions(project: Project): InputOptions {
  return {
    input: join(project.path, "src", "index.ts"),
    plugins: [
      nodeResolve(),
      {
        name: "watch-project-yaml",
        buildStart() {
          this.addWatchFile(join(project.path, "project.yaml"));
        },
      },
      typescript({
        exclude: ["external/"],
        tsconfig: join(project.path, "tsconfig.json"),
      }),
    ],
    onwarn(warning) {
      console.warn(warning.message);
    },
  };
}

function generateScriptHeader(meta: Document) {
  return `/*---
${meta.toString()}---*/

/**
 * ${meta.get("name")}
 * Built with NovelAI Script Build System
 */\n`;
}

export function rollupOutputOptions(project: Project): OutputOptions {
  return {
    dir: join(project.path, "dist"),
    format: "esm",
    entryFileNames: `${project.name}.naiscript`,
    banner() {
      return generateScriptHeader(project.meta);
    },
  };
}
