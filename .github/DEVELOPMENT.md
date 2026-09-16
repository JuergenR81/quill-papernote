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
