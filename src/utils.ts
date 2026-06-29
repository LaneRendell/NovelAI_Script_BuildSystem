import { createWriteStream } from "fs";
import { cp, mkdir, stat, writeFile } from "fs/promises";
import { join } from "path";
import { pipeline } from "stream/promises";

const ICON_TYPES_FILE = "nai-icons.d.ts";
// dist/utils.js lives in dist/, the asset ships at dist/assets/nai-icons.d.ts
const ICON_TYPES_SOURCE = join(__dirname, "assets", ICON_TYPES_FILE);

const NAI_TYPES_URL_BASE = "https://novelai.net/scripting/types/";
const NAI_TYPES = "script-types.d.ts"
const JSX_TYPES = "jsx-typings.d.ts"
const EXPERIMENTAL_TYPES = "script-types-experimental.d.ts"

const TYPE_FILES = [NAI_TYPES, JSX_TYPES, EXPERIMENTAL_TYPES];
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function isFresh(path: string) {
  try {
    const { mtimeMs } = await stat(path);
    return Date.now() - mtimeMs < MAX_AGE_MS;
  } catch {
    // File doesn't exist (or can't be read) -> treat as stale so we fetch it.
    return false;
  }
}

export async function fetchExternalTypes(projectPath: string) {
  const externalDir = join(projectPath, "external");
  await mkdir(externalDir, { recursive: true });

  for (const file of TYPE_FILES) {
    const outputPath = join(externalDir, file);

    if (await isFresh(outputPath)) {
      console.log(`✓ ${file} is up to date, skipping.`);
      continue;
    }

    console.log(`📥 Fetching ${file}...`);

    const res = await fetch(NAI_TYPES_URL_BASE + file);

    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${file}: HTTP ${res.status}, ${res.statusText}`,
      );
    } else if (!res.body) {
      throw new Error(`Got result for ${file}, but body is empty`);
    }

    try {
      await pipeline(res.body, createWriteStream(outputPath));
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  await copyIconTypes(projectPath);
}

export async function copyIconTypes(
  projectPath: string,
  source: string = ICON_TYPES_SOURCE,
): Promise<void> {
  const externalDir = join(projectPath, "external");
  await mkdir(externalDir, { recursive: true });
  await cp(source, join(externalDir, ICON_TYPES_FILE));
}

const TSCONFIG = {
  compilerOptions: {
    target: "ES2023",
    module: "ESNext",
    lib: ["ES2023"],
    moduleResolution: "bundler",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    allowSyntheticDefaultImports: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    noEmit: true,
    typeRoots: ["./external", "./node_modules/@types"],
    rewriteRelativeImportExtensions: true,
  },
  include: ["src/**/*", "external/**/*"],
  exclude: ["node_modules", "dist", "**/*.test.ts"],
};

export function writeTsConfig(projectPath: string) {
  return writeFile(
    join(projectPath, "tsconfig.json"),
    JSON.stringify(TSCONFIG, undefined, 2),
    "utf-8",
  );
}
