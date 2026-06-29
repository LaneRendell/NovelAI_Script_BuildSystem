import { cp, mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(join(root, "dist", "assets"), { recursive: true });
await cp(join(root, "assets"), join(root, "dist", "assets"), { recursive: true });
console.log("Copied assets -> dist/assets");
