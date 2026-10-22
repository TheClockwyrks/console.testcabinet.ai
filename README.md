# console.testcabinet.ai

The operator console, served as the tcab-web image.

This repository is one component of
[The Test Cabinet](https://github.com/TheClockwyrks/TheTestCabinet). What it is
and how it fits with the others is stated by the documentation site, which
lives in the superrepo at `apps/docs/src/content/docs/`. Its Repositories page,
`apps/docs/src/content/docs/development/repositories.md`, draws the edges
between the repositories.

## Getting started

Open the superrepo in its devcontainer, which carries every toolchain the
repositories need, and work from this repository's root.

One command runs every gate:

```sh
make gate
```

Each gate is a file under `ci/gates/` whose stem is the gate's id.
`uv run --quiet --project ci gate list` names them all, and
`azure-pipelines.yml` runs each one as a step of its own on every push, inside
the CI images the superrepo builds.

## The image

The `Dockerfile` at the root is the repository's image, built from the root
with `.dockerignore` as its allowlist. On every gated push to `master` and
`staging` the pipeline builds it natively for amd64 and arm64
(`scripts/ci/image.sh`) and fuses the two into the multi-arch
`testcabinet.azurecr.io/console.testcabinet.ai:<commit>` a deployment pins
(`scripts/ci/manifest.sh`).
It installs and builds the npm workspace and serves the bundle through
nginx. The `build-context` gate holds every `COPY` to the allowlist. The kit
wrote the `Dockerfile` once, and it is the repository's to grow.

## The console

`apps/web` is the operator console, the browser app served at `/` of an
environment's origin behind Cloudflare Access. The Console page of the
documentation site, `apps/docs/src/content/docs/components/web/overview.md` in
the superrepo, states what it is and how it is configured and deployed. It is
a host of `@clockwyrks/ui`, and it builds against the published packages of
contracts (`@clockwyrks/run-record`, `@clockwyrks/backend-api`), engines and
ui-common at the exact versions `apps/web/package.json` pins. On its own the
workspace installs them from the project's feed, which needs a feed token in
the user's npm configuration (see `.npmrc`); inside the superrepo
`scripts/repos/link-packages.sh` links each one to its sibling checkout
instead.

```sh
npm ci
npm run dev            # the development server on port 1430
npm run build          # the static bundle, into apps/web/dist
npm test               # the jsdom suite
npm run test:browser   # the browser suite, in Chromium, Firefox and WebKit
npm run lint           # ESLint, with the ratchet in eslint-suppressions.json
```

The development server binds port 1430, or the port
`THE_TEST_CABINET_WEB_PORT` names, and proxies `/api`, `/artifacts` and
`/arena` to the services the superrepo's `make -C deployments/local
local-forward` forwards to localhost, presenting the local identity.
`.env.development` holds those defaults and says how a gitignored
`.env.development.local` aims them elsewhere; `.env.example` documents the
optional build-time variables. Both are read from the repository root.

The jsdom suite holds the replay assets `@clockwyrks/ui` vendors to the case
versions they were copied from, which it reads from the test-suites checkout
`TCAB_DEFINITIONS_ROOT` names (the directory holding `test-cases/`), or from
`../test-suites` beside this repository where it is unset, as in the
superrepo. A checkout that is not there fails those tests rather than skipping
them.

The image is nginx serving the bundle, with the server in `nginx.conf`, which
falls back to `index.html` so a deep link loads. Its one build argument,
`VITE_SHARE_ORIGIN`, is the origin a share link is built on: `https://tcab.ai`,
the default, for prod, and `https://staging.tcab.ai` for a staging build.

Two gates beside the kit's are this repository's own: `web-lint`, ESLint over
the app, and `web-browser-test`, the browser suite, which needs the Playwright
engines the superrepo's devcontainer and web CI image carry.
