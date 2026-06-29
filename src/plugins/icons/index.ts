import type { Plugin } from "rollup";
import { emitModule } from "./emit-module";
import { providerRegistry } from "./registry";

const VIRTUAL_RE = /^nai:icons\/(?<set>[a-z0-9-]+)$/;
const RESOLVED_PREFIX = "\0nai:icons:";

export function iconsPlugin(): Plugin {
  return {
    name: "nai-icons",
    resolveId(source) {
      const match = VIRTUAL_RE.exec(source);
      if (!match) return null;
      return RESOLVED_PREFIX + match.groups!.set;
    },
    async load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null;
      const set = id.slice(RESOLVED_PREFIX.length);
      const provider = providerRegistry.get(set);
      if (!provider) {
        const available = [...providerRegistry.keys()].join(", ");
        return this.error(`Unknown iconset '${set}'. Available: ${available}`);
      }
      const iconMap = await provider.load();
      return emitModule(iconMap);
    },
  };
}
