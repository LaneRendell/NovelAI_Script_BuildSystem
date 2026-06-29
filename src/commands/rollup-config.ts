import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { join } from "path";
import { InputOptions, OutputOptions } from "rollup";
import { Document } from "yaml";
import { iconsPlugin } from "../plugins/icons";
import { Project } from "./project";

export function rollupInputOptions(
  project: Project,
  minify = false,
): InputOptions {
  return {
    input: join(project.path, "src", "index.ts"),
    preserveSymlinks: true,
    plugins: [
      iconsPlugin(),
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
      // Keep only the /*---...---*/ frontmatter banner.
      // The banner's comment text starts with "---\n" and ends with
      // "---", so match that shape exactly.
      ...(minify
        ? [
          terser({
            format: {
              comments: (_node, comment) =>
                comment.type === "comment2" &&
                /^---\n[\s\S]*---$/.test(comment.value),
            },
          }),
        ]
        : []),
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
