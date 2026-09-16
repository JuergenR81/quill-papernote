# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Quill Next is a maintained fork of [Quill](https://quilljs.com/), a rich-text editor. It keeps the original Quill API and Delta data structures compatible while modernizing the tooling and adding framework integrations. It's a pnpm-based monorepo with four packages under `packages/`:

- **`quill`** (published as `quill-next`) — the core editor. Written in TypeScript, bundled with Webpack, tested with Vitest (unit/fuzz) and Playwright (E2E).
- **`quill-next-react`** — React wrapper (`<QuillEditor>` component, hooks, plugins). Built with Vite.
- **`quill-next-vue`** — Vue 3 wrapper. Built with Vite.
- **`website`** — Next.js docs/demo site (quill-next.diverse.space), also used as a dev harness for the core editor.

Note: `.github/DEVELOPMENT.md` describes an npm-workspaces setup; that's stale. The repo actually uses **pnpm workspaces** (see root `package.json` / `pnpm-workspace.yaml`, and CI in `.github/workflows/_test.yml`).

## Commands

Run from the repo root unless noted. Use `pnpm --filter <pkg>` or `-w <pkg>` to scope to one package (package names: `quill-next`, `quill-next-react`, `@quill-next/vue`, `website`).

```bash
pnpm install                 # install all workspace deps

pnpm run build                # build all packages (pnpm -r build)
pnpm run build:quill          # build only the core editor
pnpm run build:website        # build only the website
pnpm run lint                 # lint all packages (pnpm -r run lint)

pnpm start                    # quill webpack dev server (:9080) + website Next dev server (:9000)
                              # `prestart` builds quill + quill-next-react first, which the website imports
                              # busy ports fall back to free ones (scripts/dev.mjs), and it prints the URLs
pnpm --filter quill-next run start      # only quill's dev server (port 'auto')
pnpm --filter website run dev           # only the website, against the published CDN quill
```

The website loads Quill from the dev server over HTTP, so the two must agree on a port:
`scripts/dev.mjs` picks it and passes `QUILL_DEV_PORT` to both (read in `packages/website/env.js`
and `packages/quill/webpack.config.cjs`). Don't hardcode the port in either place.

Never use `npm` in this repo. It is a pnpm workspace (`workspace:*` deps), and in pnpm `-w` means
`--workspace-root`, not "the workspace named X" — `pnpm start -w quill` re-runs the *root* `start`
script and recurses. Select a package with `--filter <name>` instead.

### Core editor (`packages/quill`)

```bash
pnpm --filter quill-next run lint:eslint       # eslint only
pnpm --filter quill-next run lint:tsc          # tsc --noEmit --skipLibCheck

pnpm --filter quill-next run test:unit         # Vitest unit tests (browser mode via Playwright provider)
pnpm --filter quill-next run test:fuzz         # Vitest fuzz tests
pnpm --filter quill-next run test:e2e          # Playwright E2E tests

# Single unit test file:
pnpm --filter quill-next exec vitest --config test/unit/vitest.config.ts run test/unit/formats/list.spec.ts

# Single E2E test file:
pnpm --filter quill-next exec playwright test test/e2e/history.spec.ts
```

Unit tests live in `packages/quill/test/unit/**/*.spec.ts` and run in a real browser (Playwright provider, default chromium — override with `BROWSER=firefox|webkit`), mirroring the directory structure of `src/`. E2E tests live in `packages/quill/test/e2e/*.spec.ts` and spin up a webpack dev server against `test/e2e/__dev_server__`.

### React package (`packages/quill-next-react`)

```bash
pnpm --filter quill-next-react run test:unit   # Vitest
pnpm --filter quill-next-react run lint
pnpm --filter quill-next-react run storybook   # Storybook dev server, port 6006
```

### Vue package (`packages/quill-next-vue`)

Has no tests yet (`test:unit` is a no-op echo). `pnpm --filter @quill-next/vue run lint` / `run build` apply.

## Architecture

### Core editor split: `core.ts` vs `quill.ts`

The core package exposes two entry points that both register into a shared static `Quill.imports` registry via `Quill.register(...)`:

- **`src/core.ts`** registers only the primitives: blots (`blots/block`, `blots/text`, `blots/scroll`, …) and baseline modules (`clipboard`, `history`, `keyboard`, `uploader`, `input`, `uiNode`). This is the minimal editor with no formats or themes.
- **`src/quill.ts`** (the package's `main`) imports `core.ts`'s `Quill` and layers on top: all formats (`formats/bold`, `formats/list`, `formats/table`, …), the `syntax`/`table`/`toolbar` modules, and the `snow`/`bubble` themes.

When adding a new format or module, register it in the appropriate entry point (or in the consuming package, like `quill-next-react` does for its `next` theme — see below) rather than hardcoding it into `Editor`/`Quill` directly.

### Parchment-based document model

Quill's document tree is a [Parchment](https://github.com/quilljs/parchment) blot tree (`src/blots/*`), rooted at a `Scroll` blot. Formats (`src/formats/*`) are Parchment `Attributor`s or blot subclasses registered under `formats/<name>`, `attributors/class/<name>`, or `attributors/style/<name>` keys — the same format is often registered multiple times under different attributor strategies (class vs. inline style), see the `Quill.register(...)` blocks in `src/quill.ts`.

Content changes flow through `@quill-next/delta-es` (`Delta`/`Op`), a fork of `quill/delta` published as ESM to keep the bundle tree-shakeable. This is why the codebase uses `lodash-es` instead of `lodash` throughout.

### Module system

`src/core/module.ts` defines the `Module` base class; concrete modules (`src/modules/*.ts`) extend it and are instantiated per-`Quill`-instance based on the `modules` option / `Quill.DEFAULTS.modules`. Modules are destroyed via `quill.destroy()`, which is a Quill Next addition over upstream Quill specifically to avoid memory leaks when modules hold external resources.

### Themes

`src/core/theme.ts` defines the `Theme` base class; `src/themes/{base,snow,bubble}.ts` implement it and control toolbar/tooltip UI wiring (`src/ui/*`). Themes are registered under `themes/<name>` and selected via `QuillOptions.theme`.

### React integration (`packages/quill-next-react`)

`editor.component.tsx` wraps core `Quill` for React. It does **not** mutate the shared `Quill.imports` registry permanently — `makeQuillWithBlots()` swaps in a copy, registers a React-specific `next` theme and `NextKeyboard` module plus any per-instance `blots`, constructs the `Quill` instance, then restores the original `Quill.imports`. This lets consumers pass custom Parchment blots per `<QuillEditor>` instance without polluting global state for other instances.

Editor behavior beyond the base component is composed via:
- **Hooks** (`src/hooks/`) — e.g. `use-quill-text-change`, `use-quill-selection-change`, `use-quill-keyboard-binding`, for subscribing to Quill events from React.
- **Plugins** (`src/plugins/`, `src/notion-like/plugins/`) — e.g. `toolbar-plugin`, `slash-command-plugin`, `link-toolbar-plugin` — self-contained editor behaviors composed alongside `<QuillEditor>`.

### Format allowlisting

`QuillOptions.formats` (a string array or `null`) restricts which formats are recognized by the editor. Note: soft-break (`formats/soft-break`, an addition over upstream Quill for `Shift+Enter`) must be explicitly registered as a core format whenever a `formats` allowlist is set, or it silently stops working — see `createRegistryWithFormats.ts` in `src/core/utils/`.
