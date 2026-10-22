import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DEFINITIONS_VARIABLE, definitionsRoot } from "./test/vendored";

// The drift guards read the case bundles out of the test-suites checkout, and
// a checkout that is missing fails them rather than letting them pass with
// nothing compared.

describe("the test-suites checkout the drift guards read", () => {
  const made: string[] = [];

  afterEach(() => {
    for (const directory of made.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("is the directory TCAB_DEFINITIONS_ROOT names", () => {
    const root = mkdtempSync(path.join(tmpdir(), "definitions-"));
    made.push(root);
    mkdirSync(path.join(root, "test-cases"));

    expect(DEFINITIONS_VARIABLE).toBe("TCAB_DEFINITIONS_ROOT");
    expect(definitionsRoot({ TCAB_DEFINITIONS_ROOT: root })).toBe(root);
  });

  it("fails where the named directory holds no test-cases/", () => {
    const root = mkdtempSync(path.join(tmpdir(), "definitions-"));
    made.push(root);

    expect(() => definitionsRoot({ TCAB_DEFINITIONS_ROOT: root })).toThrow(
      /No test-suites checkout/,
    );
  });

  it("fails where the named directory does not exist", () => {
    expect(() =>
      definitionsRoot({
        TCAB_DEFINITIONS_ROOT: path.join(tmpdir(), "no-such-test-suites"),
      }),
    ).toThrow(/No test-suites checkout/);
  });
});
