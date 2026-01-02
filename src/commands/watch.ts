import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { watch } from "rollup";
import { parseDocument } from "yaml";
import { currentEpochS, Project } from "./project";
import { rollupInputOptions, rollupOutputOptions } from "./rollup-config";

export function watchProject(project: Project) {
  console.log(`    Watching project: ${project.name}`);
  return watch({
    ...rollupInputOptions(project),
    ...{ output: rollupOutputOptions(project) },
  }).on("event", async (event) => {
    const currentProjectFile = await readFile(
      join(project.path, "project.yaml"),
    );
    const currentProjectMeta = parseDocument(currentProjectFile.toString());
    currentProjectMeta.set("updatedAt", currentEpochS());

    switch (event.code) {
      case "START":
        console.log(`    Building project: ${project.name}...`);
        project.meta = currentProjectMeta;
        break;
      case "END":
        // Write new project.yaml file
        await writeFile(
          join(project.path, "project.yaml"),
          currentProjectMeta.toString(),
        ).catch(console.error);
        console.log(`    Built project: ${project.name}...`);
    }
  });
}
