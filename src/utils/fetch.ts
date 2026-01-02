import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import { dirname } from "path/posix";
import { pipeline } from "stream/promises";

const NAI_TYPES_URL = "https://novelai.net/scripting/types/script-types.d.ts";

export async function fetchExternalTypes(projectPath: string) {
  const outputPath = join(projectPath, "external", "script-types.d.ts");

  await mkdir(dirname(outputPath), { recursive: true });

  console.log("📥 Fetching NovelAI type definitions...");

  const res = await fetch(NAI_TYPES_URL);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch types: HTTP ${res.status}, ${res.statusText}`,
    );
  } else if (!res.body) {
    throw new Error("Got result, but body is empty");
  }

  try {
    await pipeline(res.body, createWriteStream(outputPath));
  } catch (err) {
    console.error(err);
    throw err;
  }
}
