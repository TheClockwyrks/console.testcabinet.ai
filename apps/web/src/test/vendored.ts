// Where the drift guards over the vendored replay assets read from.
//
// `@clockwyrks/ui` ships its own copies of the Foray and Lattice cases' replay
// assets (the sprite sheets and atlases, the Foray engine, the Lattice reference
// scenarios), so every host draws a run without fetching the case bundle. The
// copies are vendored from the case versions in the test-suites checkout by the
// superrepo's scripts/vendor-foray-assets.mjs and scripts/vendor-lattice-assets.mjs,
// which write them into the ui-common checkout. The console is what holds the
// test-suites data edge, so the guards live here: they read the copies out of
// the package the console resolves, as it ships them, and the bundles out of
// the test-suites checkout `TCAB_DEFINITIONS_ROOT` names.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The directory `@clockwyrks/ui` resolves to from this app. */
const ui = path.dirname(
  createRequire(import.meta.url).resolve("@clockwyrks/ui/package.json"),
);

/** This repository's root: `apps/web/src/test` is four levels below it. */
const repoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

/** The variable naming the test-suites checkout. */
export const DEFINITIONS_VARIABLE = "TCAB_DEFINITIONS_ROOT";

/**
 * The test-suites checkout, the directory holding `test-cases/`.
 *
 * `TCAB_DEFINITIONS_ROOT` names it, as the pipeline's checks job sets it to the
 * checkout it makes beside this repository's. Unset, it is the `test-suites`
 * directory beside this repository, which is where the superrepo holds both.
 * A checkout that is not there fails the guards that read it rather than
 * skipping them: a guard that passes without its data guards nothing.
 *
 * @param env The environment the root is read from.
 */
export function definitionsRoot(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const named = env[DEFINITIONS_VARIABLE];
  const root =
    named === undefined || named === ""
      ? path.join(repoRoot, "../test-suites")
      : path.resolve(named);
  if (!existsSync(path.join(root, "test-cases"))) {
    throw new Error(
      `No test-suites checkout at ${root}: it holds no test-cases/. ` +
        `Check test-suites out and name it in ${DEFINITIONS_VARIABLE}.`,
    );
  }
  return root;
}

/**
 * The directory of the shipped copy of a page's vendored assets, as the built
 * package carries it (`dist/` mirrors `src/`).
 *
 * @param page The run page the assets belong to, `foray` or `lattice`.
 */
export function vendoredAssets(page: "foray" | "lattice"): string {
  return path.join(ui, "dist/app/pages/runs", page, "assets");
}

/**
 * A directory of a committed case version in the test-suites checkout.
 *
 * @param version The version's path under `test-suites/test-cases/`.
 */
export function caseVersion(version: string): string {
  const directory = path.join(definitionsRoot(), "test-cases", version);
  if (!existsSync(directory)) {
    throw new Error(
      `The test-suites checkout holds no ${version}: ${directory}`,
    );
  }
  return directory;
}

/**
 * Whether a shipped copy holds what the bundle's file holds.
 *
 * A binary asset ships byte for byte. A JSON one is compared by its value: the
 * package's TypeScript build re-emits every JSON module its sources import with
 * its own indentation, so the shipped bytes are the bundle's data laid out anew.
 *
 * @param shipped The shipped copy's path.
 * @param bundled The case bundle's file.
 */
export function sameAsset(shipped: string, bundled: string): boolean {
  const copy = readFileSync(shipped);
  const original = readFileSync(bundled);
  return shipped.endsWith(".json")
    ? JSON.stringify(JSON.parse(copy.toString("utf8"))) ===
        JSON.stringify(JSON.parse(original.toString("utf8")))
    : copy.equals(original);
}
