#! /usr/bin/env node

import { program } from "commander";
import { access, constants, stat } from "fs/promises";
import { join, resolve } from "path";
import { cwd, exit } from "process";
import { buildProject } from "./commands/build";
import { createNewProject } from "./commands/new";
import { loadProject } from "./commands/project";
import { watchProject } from "./commands/watch";
import { fetchExternalTypes } from "./utils";
import { importNaiscript } from "./commands/import";

program.description("NovelAI Script Build System").version("4.4.0");

program.command("new [directory]").action((directory = ".") => {
  const projectPath = resolve(cwd(), directory);

  createNewProject(projectPath);
});

program
  .command("build [directory]", { isDefault: true })
  .description("Build project")
  .option("--minify", "Minify the build output")
  .option("--no-minify", "Force a readable (un-minified) build")
  .action(async (directory = ".", options) => {
    const projectPath = resolve(cwd(), directory);
    await fetchExternalTypes(projectPath);

    try {
      const project = await loadProject(projectPath);
      // CLI flag wins; otherwise fall back to project.yaml; default false.
      const minify = options.minify ?? project.meta.get("minify") === true;
      await buildProject(project, minify);

      console.log(`\n✅ Build complete!`);
      // Show output file size
      const outputPath = join(
        join(projectPath, "dist"),
        `${project.name}.naiscript`,
      );
      const stats = await stat(outputPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(
        `✅ Built: dist/${project.name}.naiscript (${sizeKB} KB)${
          minify ? " (minified)" : ""
        }`,
      );

      process.exit(0);
    } catch (err) {
      console.log("Build error:", err);
      process.exit(1);
    }
  });

program
  .command("watch [directory]")
  .description("Automatically watch and rebuild project on changes.")
  .action(async (directory = ".") => {
    const projectPath = resolve(cwd(), directory);
    await fetchExternalTypes(projectPath);

    try {
      const project = await loadProject(projectPath);
      const watcher = watchProject(project);

      ["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) =>
        process.on(signal, () => {
          console.log(" Cleaning up, closing watcher");
          watcher.close();
          process.exit(0);
        }),
      );
    } catch (err: any) {
      console.log(`Watch error: ${err.message}`);
    }
  });

program
  .command("import <naiscript>")
  .description(
    "Import a naiscript file and initialize a new directory with the decompiled script.",
  )
  .action(async (naiscript: string) => {
    const filePath = resolve(cwd(), naiscript);

    await access(filePath, constants.R_OK).catch(() => {
      console.log(`File ${naiscript} is either not readable or doesn't exist.`);
      exit(1);
    });

    if (!naiscript.endsWith(".naiscript")) {
      console.log(`File ${naiscript} is not a '.naiscript' file.`);
      exit(1);
    }
    await importNaiscript(filePath).catch((err) => {
      console.log(`Error importing ${naiscript}: ${err.message}`);
      exit(2);
    });
  });

program.parse();
