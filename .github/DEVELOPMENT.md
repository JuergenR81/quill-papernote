# Development

A [pnpm workspaces](https://pnpm.io/workspaces) monorepo containing four packages:

| Package | Published as | What it is |
| --- | --- | --- |
| `packages/quill` | `quill-next` | The editor. TypeScript, bundled with Webpack. |
| `packages/quill-next-react` | `quill-next-react` | React wrapper. Built with Vite. |
| `packages/quill-next-vue` | `@quill-next/vue` | Vue 3 wrapper. Built with Vite. |
| `packages/website` | — | Docs site at [quill-next.diverse.space](https://quill-next.diverse.space). Next.js. |

## Requirements

- **Node.js 20 or newer.**
- **pnpm.** Not optional: the packages depend on each other through pnpm's `workspace:*`
  protocol, which npm and Yarn cannot resolve. `npm install` fails in this repo.
  The version is pinned in the root `package.json` under `packageManager`; the easiest way
  to get it is `corepack enable`, which reads that field for you.

## Install

```shell
pnpm install
```

## Run

```shell
pnpm start
```

This builds `quill-next` and `quill-next-react` (the website imports both), then starts two
dev servers and prints the URLs:

```
  Quill dev server  http://localhost:9080
  Website           http://localhost:9000
  Try it at         http://localhost:9080/
```

**Use the URLs it prints.** If port 9000 or 9080 is already taken — a second checkout, a
leftover run — it moves to a free port and says so. A stale server left on the default port
will keep answering with a broken page, so stop old ones first:

```shell
pkill -f 'webpack serve'; pkill -f 'next dev'; pkill -f next-server
```

### Trying the editor

Open **the Quill dev server URL** (`http://localhost:9080/` by default). It serves
`packages/quill/demo/index.html` — a toolbar, an editor and a live Delta view, loading
`./quill.js` from the same origin. This is the quickest way to try a change by hand. The file
is a dev harness, not part of the published package; edit it freely.

To run just that server without the website:

```shell
pnpm --filter quill-next run start
```

### Working against another project

To try a change inside a real application, link the package instead of publishing it:

```shell
pnpm --filter quill-next run build      # once, for the .d.ts and the CSS
cd packages/quill && npm link
cd ../../../your-app && npm link quill-next
```

Then leave a watcher running while you work:

```shell
pnpm --filter quill-next run build:watch
```

That recompiles `src/` into `dist/` on every save, which is what the linked package
serves. The full `build` additionally emits type declarations and extracts the CSS, so
run it again when you change `.styl` files or want current `.d.ts`.

Undo the link with `npm unlink quill-next && npm install` in the app, then
`npm rm --global quill-next`. `ls -ld node_modules/quill-next` tells you which one is
active: a symlink is your build, a directory is the published package.

> **Known issue — the docs site playground.** The `/standalone/*` and `/playground/*` pages
> render inside a remote CodeSandbox iframe served over HTTPS, which then tries to load
> `quill.js` back out of your local HTTP dev server. Browsers block that as mixed content, so
> you get an unstyled toolbar and `Quill is not defined`. Nothing is wrong with your build —
> the page never received it. Use the demo harness above instead.

## Test

Tests run headless. Set `HEADED=true` to watch them in a real browser window.

```shell
pnpm --filter quill-next run test:unit    # unit tests (watch mode)
pnpm --filter quill-next run test:fuzz    # fuzz tests
pnpm --filter quill-next run test:e2e     # end-to-end tests
pnpm --filter quill-next run lint         # eslint + tsc
```

Browsers have to be downloaded once. Do this **without** `sudo` — the binaries go to
`~/.cache/ms-playwright`, and running as root puts them in `/root` where your user cannot find them:

```shell
pnpm --filter quill-next exec playwright install          # all three, for E2E
pnpm --filter quill-next exec playwright install chromium # enough for unit tests
```

Run it from inside the workspace, so it downloads the revisions this repo's pinned Playwright
expects. A globally installed or newer Playwright fetches different revisions, and the E2E run then
fails instantly with `Executable doesn't exist at .../firefox-<rev>/firefox`.

`--with-deps` additionally installs system libraries through `apt-get`, which is the only part that
needs root. Most desktop Linux installs already have them; check with
`ldd ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome | grep "not found"` before reaching for
sudo. If something really is missing, install only that part:
`sudo $(pnpm --filter quill-next exec which playwright) install-deps`.

Run a single file:

```shell
pnpm --filter quill-next exec vitest --config test/unit/vitest.config.ts run test/unit/formats/list.spec.ts
pnpm --filter quill-next exec playwright test test/e2e/history.spec.ts
```

Unit tests live in `packages/quill/test/unit/**/*.spec.ts`, mirror the layout of `src/`, and run
in a real browser (Chromium by default — override with `BROWSER=firefox|webkit`).

> `playwright` is pinned to `1.49.0` by `pnpm.overrides` in the root `package.json`, while
> `@playwright/test` floats on `^1.54.1`. The reason for the pin was never recorded. Leave it
> alone unless you are prepared to run the full E2E suite on all three browsers afterwards.

## Build

```shell
pnpm run build           # every package
pnpm run build:quill     # the editor only
pnpm run build:website   # the docs site only
pnpm run lint            # every package
```

## Workflow

1. `pnpm start`
2. Try the change by hand on the Quill dev server URL
3. `pnpm --filter quill-next run test:unit`
4. `pnpm --filter quill-next run lint`
5. If it all holds, run the E2E tests

## Remotes

This is a fork, so two remotes are in play:

| Remote | Points at | Used for |
| --- | --- | --- |
| `origin` | your fork | everything you push |
| `upstream` | [quill-next/quill-next](https://github.com/quill-next/quill-next) | seeing what changed there, taking fixes, offering them back |

A fresh clone of the upstream repository has it as `origin`, so it gets renamed rather
than removed — renaming moves the remote-tracking branches along, so `upstream/main` is
there immediately without fetching, and the connection stays available for the cases
below:

```shell
git remote rename origin upstream
git remote add origin https://github.com/<you>/quill-papernote.git
git push -u origin main
```

### Taking a change from upstream

```shell
git fetch upstream
git log --oneline main..upstream/main        # what is new there
git cherry-pick <commit>
```

Pull requests that are not merged yet can be fetched by number, which is how an open
upstream fix can be tried before it lands:

```shell
git fetch upstream pull/56/head:pr-56
git log --oneline main..pr-56
```

Check that it applies before committing to it — `git cherry-pick --no-commit` leaves
the change staged so the tests can run first.

## Releasing

Releases are cut from a tag. The version lives in `packages/quill/package.json`, and
the tag has to agree with it — the release script refuses to run otherwise, so a `v2.3.0`
tag on a commit that still says `2.2.6` cannot quietly publish the wrong thing.

```shell
cd packages/quill && npm version --no-git-tag-version 2.3.0
cd ../..
git commit -am "chore(release): 2.3.0"
git tag -a v2.3.0 -m "Version 2.3.0"
git push origin main --follow-tags
```

`npm version` only commits and tags when it runs in the root of the git
repository, so from `packages/quill` it silently edits `package.json` and
nothing else. Doing those two steps by hand is what makes the tag land on the
commit that carries the version, which is what the release script checks.

Push with `--follow-tags`, never `--tags`: the upstream tags `v2.2.3`, `v2.2.4`
and `v2.2.6` are in this clone, they all match `tags: ["v*"]`, and each one
would start its own release run.

Pushing the tag starts `.github/workflows/release.yml`, which runs the full test suite,
builds and packs the package, and attaches `quill-next-<version>.tgz` to a GitHub
release. Consuming projects install that tarball by URL:

```shell
npm install https://github.com/<you>/quill-papernote/releases/download/v2.3.0/quill-next-2.3.0.tgz
```

Nothing goes to npm unless `scripts/release.js` is given `--npm`. To see what a release
would do without making one, run the workflow by hand from the Actions tab and leave the
dry-run box ticked, or locally:

```shell
node scripts/release.js --dry-run
```
