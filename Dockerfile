# syntax=docker/dockerfile:1
# The image of console.testcabinet.ai. Its pipeline builds it on every gated push to master
# and staging, natively once per architecture (scripts/ci/image.sh), and fuses
# the two into the multi-arch `testcabinet.azurecr.io/console.testcabinet.ai:<commit>` a
# deployment pins (scripts/ci/manifest.sh).
#
# The build context is the repository root, held to what .dockerignore admits,
# and the `build-context` gate holds every COPY below to that allowlist. The
# kit writes this file once, as a scaffold, and it then belongs to the
# repository: an update never merges into it.
#
# The build installs the npm workspace from its lock and builds it, then
# serves the static bundle the build emits through nginx. A package of the
# project installs from the project's private feed, which `.npmrc` names: the
# pipeline hands the build npm's configuration scripts/ci/npm-feed.sh wrote,
# carrying the job's token, as the secret `npmrc`, mounted for the one RUN
# that installs and never entering a layer. A build handed none reaches the
# public registry alone, so its install of a package of the project fails.
FROM docker.io/library/node:24-bookworm-slim AS build
WORKDIR /src
COPY . .
# The commit the image is built from, which the build context, carrying no
# `.git`, cannot tell; the pipeline passes it.
ARG TCAB_BUILD_COMMIT
# The npm cache is a cache mount, so a build reuses the tarballs an earlier one
# downloaded.
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    --mount=type=cache,target=/root/.npm \
    npm ci \
    && TCAB_BUILD_COMMIT="${TCAB_BUILD_COMMIT}" npm run build

# nginx-unprivileged runs as a non-root user (uid 101) and listens on 8080,
# with no Linux capability and no privileged port; its default server serves
# /usr/share/nginx/html. A single-page app replaces that server with one
# falling back to index.html, so a deep link loads.
FROM docker.io/nginxinc/nginx-unprivileged:1-bookworm
# The bundle the build emits. The scaffold names the root's `dist/`; a site
# whose bundle is a workspace member's names that member's here.
COPY --from=build /src/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
