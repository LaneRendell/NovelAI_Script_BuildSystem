import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { copyIconTypes, writeTsConfig } from "../src/utils";

describe("writeTsConfig", () => {
  it("enables JSX/TSX authoring with the global h/Fragment factory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nibs-tsconfig-"));
    await writeTsConfig(dir);

    const tsconfig = JSON.parse(
      await readFile(join(dir, "tsconfig.json"), "utf-8"),
    );
    expect(tsconfig.compilerOptions.jsx).toBe("react");
    expect(tsconfig.compilerOptions.jsxFactory).toBe("h");
    expect(tsconfig.compilerOptions.jsxFragmentFactory).toBe("Fragment");

    await rm(dir, { recursive: true, force: true });
  });
});

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

  it("does not throw when the source asset is missing (editor convenience, non-fatal)", async () => {
    const projectPath = join(dir, "project-missing");
    await mkdir(projectPath, { recursive: true });

    await expect(
      copyIconTypes(projectPath, join(dir, "does-not-exist.d.ts")),
    ).resolves.toBeUndefined();
    await rm(dir, { recursive: true, force: true });
  });
});
