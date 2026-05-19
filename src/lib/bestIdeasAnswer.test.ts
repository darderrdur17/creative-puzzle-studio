import { describe, it, expect } from "vitest";
import { normalizeBestIdeasAnswer } from "./bestIdeasAnswer";

describe("normalizeBestIdeasAnswer", () => {
  it("trims whitespace", () => {
    expect(normalizeBestIdeasAnswer("  morning walks  ")).toBe("morning walks");
  });

  it("caps length at 200 characters", () => {
    const long = "a".repeat(250);
    expect(normalizeBestIdeasAnswer(long)).toHaveLength(200);
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeBestIdeasAnswer("   ")).toBe("");
  });
});
