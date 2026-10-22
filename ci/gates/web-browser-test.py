"""Run the web app's browser tests in the engines its test configuration names.

It runs the app's own `test:browser` script through the npm workspace, which is
`vitest run` over the browser project `apps/web/vite.config.ts` names. That
configuration decides the file set and the instances, so no path is passed.

The suite is a gate of its own because it drives real engines, which is the
only way to read what a browser decides: the layout a viewport width selects,
the color the cascade resolves a token to, and whether the document overflows
its own width. All three read correctly under jsdom, which lays nothing out, so
the jsdom project the `typescript` gate runs sees none of them.

Asked for artifacts, it adds vitest's JUnit report and nothing else. The test
configuration reads `CI_GATE_ARTIFACTS` as the directory the reports go in, and
`CI_GATE_COVERAGE=0` as this suite's refusal of the v8 coverage the
`typescript` gate wants of the jsdom project: instrumenting three real engines costs time and
states nothing the jsdom run does not.

The report is asked for through that configuration rather than on vitest's
command line because the JUnit reporter's `classnameTemplate` can only be given
there, and that template is what keeps this suite's six runs of one file six
distinct tests in the metrics rather than one.
"""

from the_test_cabinet_ci import artifacts_dir, enter_repo_root, fail, run, succeeded

# From the workspace root, so npm finds the workspace regardless of the
# caller's working directory.
root = enter_repo_root()

if not (root / "node_modules").is_dir():
    fail("The npm workspace is not installed. Install it first:", "    npm ci")

# The engines belong to the image this suite runs in, not to the npm workspace:
# they are copied in when that image is built, so `npm ci` leaves them absent
# in an image built without them, and vitest then fails deep inside its browser
# provider. The check below needs to know where they live, because
# it asks Playwright itself, which honours PLAYWRIGHT_BROWSERS_PATH. It then
# says plainly which ones are missing. The `playwright` package in
# apps/web/package.json is the client that drives them, and its version is the
# one the engines must have been downloaded by: the superrepo, whose
# devcontainer and CI images carry the engines, holds the two pins together.
ABSENT_ENGINES = """
const { existsSync } = require("node:fs");
const playwright = require("playwright");
const absent = ["chromium", "firefox", "webkit"].filter((engine) => {
  try {
    return !existsSync(playwright[engine].executablePath());
  } catch {
    return true;
  }
});
process.stdout.write(absent.join(", "));
"""
engines = run(["node", "--eval", ABSENT_ENGINES], capture=True)
if engines.returncode != 0:
    # node has already said why on stderr.
    fail("Playwright could not be asked where its engines live.")
missing = engines.stdout
if missing:
    fail(
        f"Playwright has no browser to drive ({missing}). Run the gate in the superrepo's",
        "devcontainer or the web CI image, which carry the engines of the playwright",
        "image the superrepo's devcontainer names, or install them with:",
        "    npx playwright install chromium firefox webkit",
    )

# The variable may name a relative path, and npm runs the suite from the app's
# folder: the absolute form means the same directory there. The `0` is what
# leaves coverage out of this suite alone.
artifacts = artifacts_dir()
environment = {} if artifacts is None else {"CI_GATE_ARTIFACTS": str(artifacts), "CI_GATE_COVERAGE": "0"}

if not succeeded(["npm", "run", "--silent", "--workspace", "apps/web", "test:browser"], env=environment):
    fail(
        "",
        "The web app's browser tests failed. Reproduce them with:",
        "    npm run --workspace apps/web test:browser",
    )
