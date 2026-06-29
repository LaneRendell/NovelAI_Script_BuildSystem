import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { copyIconTypes } from "./utils";

describe("copyIconTypes", () => {
  let dir: string;
  let source: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nibs-copy-"));
    source = join(dir, "src-nai-icons.d.ts");
    await writeFile(source, 'declare module "nai:icons/feather" {}\n', "utf-8");
  });

  it("copies the ambient types into the project's external dir", async () => {
    const projectPath = join(dir, "project");
    await mkdir(projectPath, { recursive: true });

    await copyIconTypes(projectPath, source);

    const copied = await readFile(
      join(projectPath, "external", "nai-icons.d.ts"),
      "utf-8",
    );
    expect(copied).toContain('declare module "nai:icons/feather"');
    await rm(dir, { recursive: true, force: true });
  });
});
