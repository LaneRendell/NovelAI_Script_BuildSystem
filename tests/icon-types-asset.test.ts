import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Guards the in-vivo TS2786 bug: icon components must return JSX.Element
// (the NAI JSX typings define JSX.Element = preact.VNode), not `unknown`,
// or every <Zap/> fails to typecheck as a JSX component in consumer projects.
describe("assets/nai-icons.d.ts", () => {
  const dts = readFileSync(
    join(process.cwd(), "assets", "nai-icons.d.ts"),
    "utf-8",
  );

  it("declares the feather virtual module", () => {
    expect(dts).toContain('declare module "nai:icons/feather"');
  });

  it("types IconComponent's return as JSX.Element, not unknown", () => {
    expect(dts).toContain("type IconComponent = (props?: IconProps) => JSX.Element;");
    expect(dts).not.toContain("=> unknown");
  });

  it("exports named icon components", () => {
    expect(dts).toContain("export const Zap: IconComponent;");
  });
});
