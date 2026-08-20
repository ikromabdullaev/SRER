import { describe, it, expect } from "vitest";
import { findMissingContent } from "./content";

/**
 * DOAJ reads these pages closely, and the navigation links to all of them.
 * The article fallback rules deliberately do not apply here: a missing file is
 * a build failure, not a graceful degradation, so the matrix is asserted
 * rather than hoped for.
 */
describe("content pages", () => {
  it("exist in every locale", async () => {
    expect(await findMissingContent()).toEqual([]);
  });
});
