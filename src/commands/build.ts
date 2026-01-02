import { writeFile } from "fs/promises";
import { join } from "path";
import { rollup } from "rollup";
import { currentEpochS, Project } from "./project";
import { rollupInputOptions, rollupOutputOptions } from "./rollup-config";

export async function buildProject(project: Project) {
  const { name, path, meta } = project;

  console.log(`\n🔨 Building project: ${name}`);

  meta.set("updatedAt", currentEpochS());

  await rollup(rollupInputOptions(project)).then((bundle) =>
    bundle.write(rollupOutputOptions(project)).then(() => bundle.close()),
  );

  // Write new project.yaml file
  await writeFile(join(path, "project.yaml"), meta.toString()).catch(
    console.error,
  );

  return true;
}
