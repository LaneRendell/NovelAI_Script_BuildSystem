import { describe, it, expect } from "vitest";
import { featherProvider } from "./feather-provider";

describe("featherProvider", () => {
  it("loads the full feather set", async () => {
    const icons = await featherProvider.load();
    expect(icons.size).toBeGreaterThan(200);
  });

  it("maps zap to a single polygon with the expected points", async () => {
    const icons = await featherProvider.load();
    const zap = icons.get("Zap");
    expect(zap).toEqual({
      viewBox: "0 0 24 24",
      children: [
        { tag: "polygon", attrs: { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" } },
      ],
    });
  });

  it("maps kebab names to PascalCase export names", async () => {
    const icons = await featherProvider.load();
    expect(icons.has("ToggleLeft")).toBe(true);
  });
});
