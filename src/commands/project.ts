import { readFile } from "fs/promises";
import { join, basename } from "path";
import { parseDocument, Document } from "yaml";

export type Project = {
  name: string;
  path: string;
  meta: Document;
};
export async function loadProject(projectPath: string): Promise<Project> {
  const project = await readFile(join(projectPath, "project.yaml"))
    .then((buf) => parseDocument(buf.toString()))
    .catch((err) => {
      throw new Error(
        `Project file not found at ${projectPath}. Create project with \`nibs new\``,
      );
    });

  return {
    name: basename(projectPath),
    path: projectPath,
    meta: project,
  };
}

export function currentEpochS() {
  return Math.floor(Date.now() / 1000);
}
