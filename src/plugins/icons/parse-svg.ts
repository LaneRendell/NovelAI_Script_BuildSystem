import { SvgNode } from "./types";

const ALLOWED_TAGS = new Set([
  "path",
  "circle",
  "line",
  "polyline",
  "polygon",
  "rect",
  "ellipse",
]);

// Matches an opening element (self-closing or not). Closing tags ("</tag>")
// don't match because the char after "<" must be a letter, not "/".
const ELEMENT_RE = /<([a-zA-Z][\w-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*\/?>/g;
const ATTR_RE = /([\w:-]+)\s*=\s*"([^"]*)"/g;

export function parseSvgFragment(fragment: string): SvgNode[] {
  const nodes: SvgNode[] = [];
  ELEMENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ELEMENT_RE.exec(fragment)) !== null) {
    const tag = match[1];
    if (!ALLOWED_TAGS.has(tag)) {
      throw new Error(`Unsupported SVG element '${tag}' in icon fragment`);
    }
    const attrs: Record<string, string> = {};
    const attrString = match[2] ?? "";
    ATTR_RE.lastIndex = 0;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = ATTR_RE.exec(attrString)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    nodes.push({ tag, attrs });
  }
  return nodes;
}
