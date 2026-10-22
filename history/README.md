# history

The record of how this repository's history was extracted from the monorepo,
[The Test Cabinet](https://github.com/TheClockwyrks/TheTestCabinet), where the
console lived as `apps/web/` until the extraction. Nothing builds or tests
against these files; they are kept so the provenance outlives the scratch clone
the extraction ran in.

## The extraction

The history below the scaffold commit is the monorepo's `issue/repos-17` branch
at `c402ce500aee33cbe16e3e8ef6d92fc8c085198c` (its `nightly` at
`24a546b59` and the one commit that taught the repository kit to build this
repository's image), filtered to the paths in [`paths.txt`](paths.txt) by git
filter-repo 2.47.0:

```sh
git clone -q --no-local --no-checkout --single-branch --branch issue/repos-17 \
  --no-tags <the-test-cabinet> x
cd x
uvx --from git-filter-repo==2.47.0 git-filter-repo --force \
  --paths-from-file ../paths.txt --prune-empty always --preserve-commit-hashes
```

Of the 7,174 commits reachable from that commit, 98 touched a path in the list
and were kept (23 of them merges); the rest were pruned. No tag was carried. The
tip tree of `apps/web/` hashes the same as the monorepo's at that commit
(`3dbaee3f082ad675a39ee87ed5637e7400f4636e`).

The app is kept where it was in the monorepo, at `apps/web/`, so the filter
needed no rename and the npm workspace the kit renders (`apps/*`) holds it
as it is.

## The files

- [`paths.txt`](paths.txt) is the list handed to `--paths-from-file`
  (sha256 `2ec1e4a47e98e4211b9ce846e35d6bf2ca2aaba887b2cd19eebadf50a02c5eec`).
  It is generated, not hand-written: the moved directory (`apps/web/`), and
  every path a tracked file under it had before a rename or copy, collected by
  `git log --follow -M -C --name-status` over each of the 33 files, so a file's
  history reaches back past the commits that moved it into place. The earlier
  paths are the desktop app's `index.html` and `package.json` under
  `apps/desktop/`, the gallery's `tsconfig.json`, logos and icons under
  `apps/site/`, the documentation site's icon, and the lattice vendor test
  under `packages/ui/` the console's lattice drift guard began as.
- [`commit-map`](commit-map) is filter-repo's map from each monorepo commit (left)
  to the commit it became here (right), all zeros for a pruned one.
  `--preserve-commit-hashes` left the commit ids quoted in the messages as they
  were, so an id in a message below the scaffold commit names a monorepo commit,
  and this map translates it.

## The live-path review

`paths.txt` intersected with the monorepo's tree at the extraction commit names,
outside `apps/web/`, exactly twelve live files:

```text
apps/docs/public/cabinet.svg
apps/site/public/cabinet.svg
apps/site/public/logos/anthropic.svg
apps/site/public/logos/deepseek.svg
apps/site/public/logos/google.svg
apps/site/public/logos/meta.svg
apps/site/public/logos/mistral.svg
apps/site/public/logos/openai.svg
apps/site/public/logos/qwen.svg
apps/site/public/logos/xai.svg
apps/site/public/openrouter.svg
apps/site/tsconfig.json
```

Each is a copy source: a console file began as a copy of it, and the monorepo
kept its own copy. They were kept in the list so `git log --follow` and blame of
the files copied from them reach their history before the copy. Their commits
after the copy, which touch the monorepo's copies only, are in this history
too, and the scaffold commit deletes the twelve files.

## What came from outside the history

The image's two files were rewritten from the monorepo's console image rather
than carried with history: the `Dockerfile` the kit scaffolds took the place of
`deployments/images/web.Dockerfile`, and `nginx.conf` is
`deployments/images/web/nginx.conf`. `tsconfig.base.json` is a copy of the
monorepo's root one, which the app extended there. Their history before the
extraction stays in the monorepo.
