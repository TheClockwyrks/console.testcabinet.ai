# syntax=docker/dockerfile:1
# The image of console.testcabinet.ai, which a deployment runs as `tcab-web`.
# Its pipeline builds it on every gated push to master and staging, natively
# once per architecture (scripts/ci/image.sh), and fuses the two into the
# multi-arch `testcabinet.azurecr.io/console.testcabinet.ai:<commit>` a
# deployment pins (scripts/ci/manifest.sh).
#
# The build context is the repository root, held to what .dockerignore admits,
# and the `build-context` gate holds every COPY below to that allowlist. The
# kit wrote this file once, as a scaffold, and it belongs to the repository:
# an update never merges into it.
#
# The image serves the console as static assets behind nginx: the `vite build`
# of apps/web copied into nginx's web root. In a cluster the edge routes `/` of
# the environment's origin to it through the Cloudflare Tunnel, behind
# Cloudflare Access; it has no public Service of its own. Nothing is configured
# at container start: the console names no service URL, addressing `/api`,
# `/artifacts` and `/arena` of its own origin, which the edge routes to the
# services, so the image is nginx and the bundle, with no entrypoint script and
# no environment. What a build bakes in is the share origin alone (see
# VITE_SHARE_ORIGIN below).
#
# To build it by hand from the repository root, with a feed token in an npm
# user configuration at ~/.npmrc (see .npmrc):
#   docker buildx build --load --secret id=npmrc,src=$HOME/.npmrc \
#     -t console.testcabinet.ai:local .

# ── Build stage ──────────────────────────────────────────────────────────────
# The build installs the npm workspace from its lock and builds it. The
# console's `@clockwyrks` packages install from the project's private feed,
# which `.npmrc` names: the pipeline hands the build npm's configuration
# scripts/ci/npm-feed.sh wrote, carrying the job's token, as the secret
# `npmrc`, mounted for the one RUN that installs and never entering a layer. A
# build handed none reaches the public registry alone, so its install of a
# package of the project fails.
FROM docker.io/library/node:24-bookworm-slim AS build
WORKDIR /src
COPY . .
# The commit the image is built from, which the build context, carrying no
# `.git`, cannot tell; the pipeline passes it.
ARG TCAB_BUILD_COMMIT
# The origin a share link is built on, the one value the bundle takes at build
# time: `https://tcab.ai` for prod, the default, and `https://staging.tcab.ai`
# for staging, which a build asks for with
# `--build-arg VITE_SHARE_ORIGIN=https://staging.tcab.ai`. Vite inlines a
# `VITE_` variable of the build's environment into the bundle.
ARG VITE_SHARE_ORIGIN=https://tcab.ai
# The npm cache is a cache mount, so a build reuses the tarballs an earlier one
# downloaded.
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    --mount=type=cache,target=/root/.npm \
    npm ci \
    && TCAB_BUILD_COMMIT="${TCAB_BUILD_COMMIT}" \
       VITE_SHARE_ORIGIN="${VITE_SHARE_ORIGIN}" npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
# nginx-unprivileged runs as a non-root user (uid 101) and listens on 8080,
# with no Linux capability and no privileged port. Pinned to the 1.x line on
# bookworm.
FROM docker.io/nginxinc/nginx-unprivileged:1-bookworm
# A single-page app's server: a real file wins, and every other path serves
# index.html, so a deep link loads. It replaces the stock default server.
COPY nginx.conf /etc/nginx/conf.d/default.conf
# The bundle Vite emits into apps/web/dist: index.html, the hashed JavaScript
# and CSS, and the public/ assets.
COPY --from=build /src/apps/web/dist /usr/share/nginx/html
# The base image's non-root user, named here so the run's user is explicit.
USER 101
EXPOSE 8080
