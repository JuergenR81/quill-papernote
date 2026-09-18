# quill-papernote

A fork of [Quill Next](https://github.com/quill-next/quill-next) that fixes losing
formatting after Enter and soft breaks, adds accessible checklists and markdown
headings, and makes the repository runnable again.

It exists because these bugs were in the way of PaperNote, a Chrome extension. Use it
if they are in your way too — but it comes with no support and no stability promises.

Everything outside the [fixes](#fixes-on-top-of-quill-next-226) is unchanged: the API,
the Delta format and the package name `quill-next`, so it drops into an existing
project without touching a single import.

## Relationship to upstream

| | |
| --- | --- |
| Base | Quill Next 2.2.6 |
| Package name | `quill-next` — deliberately unchanged, so imports keep working |
| Compatibility | Same public API and Delta format |
| Fixes | Offered upstream where they apply |


## Key differences with Quill

- **Delta ES**: Quill Next uses [Delta ES](https://github.com/vincentdchan/delta-es) as the Delta data structure, which is a fork of [Delta](https://github.com/quilljs/delta) with ES module. _You should not aware of this, unless you are a core developer of Quill_.
  - Use `lodash-es` instead of `lodash` internally.
  - This helps to reduce the bundle size. And be friendly to tree shaking.
- **Destroy method**: Quill Next adds a `destroy` method to the Quill object, which is used to destroy the editor and destroy all the modules. This helps to avoid memory leaks.

```ts
const quill = new Quill('#editor');
quill.destroy();  // the modules are also destroyed
```
- Exports built-in modules as ES modules.
  - Keyboard: `quill/modules/keyboard`
- React integration package: `quill-next-react`
  - [Plugins](https://quill-next.diverse.space/docs/plugins/plugins) and [hooks](https://quill-next.diverse.space/docs/plugins/plugins) for React.
- Support [Soft Break](https://github.com/slab/quill/pull/4565)
  - Press `Shift + Enter` to insert a soft break.

## Fixes on top of Quill Next 2.2.6

These are in this repository but not yet in the published `quill-next` package.

**Formatting survives a rewritten line.** Pressing `Enter` used to drop every inline
format — bold, colour, size — because only block-scoped formats were carried to the new
line. They are kept now; links and inline code deliberately end at the block break. The
same gap affected two more paths:

- `Shift + Enter` inserts a soft break that keeps the surrounding formats, and text typed
  after it stays formatted. Pressing it with text selected now replaces the selection,
  which plain `Enter` already did.
- Typing `[]`, `-` or `1.` followed by a space turns the line into a list item without
  losing the formats that the typed characters carried.

Applying the formats in one pass also removes a crash: doing it one at a time re-ran
Parchment's optimize pass per format and could fail to converge next to a soft break,
throwing `[Parchment] Maximum optimize iterations reached` for a combination such as a
large font size together with bold.

**Checklists are real checkboxes to assistive technology.** Checklist items carry
`role="checkbox"` and a synced `aria-checked`. The role sits on the `<li>` so the item's
own text becomes its accessible name, which is why no separate label is needed.
`Ctrl`/`Cmd` + `Enter` toggles an item from the keyboard, since `Tab` is already bound to
indenting.

**Configured arrays replace defaults instead of merging by index.** Module options were
merged with lodash `merge`, so overriding a keyboard binding with `format: ['list']`
against the default `['blockquote', 'indent', 'list']` silently produced
`['list', 'indent', 'list']` and the binding fired in unintended contexts. This also
affected `uploader.mimetypes`.

**Toolbar dropdowns match reliably.** Selecting the active `<option>` interpolated the
format value into a CSS attribute selector, escaping quotes but not backslashes. A value
ending in `\` silently matched nothing; one containing `\"` threw a `SyntaxError` that
aborted the toolbar update. Values are compared directly now.

**`getSemanticHTML` can keep regular spaces.** Since Quill 2.0.3 every space became
`&nbsp;`, which neither wraps nor collapses, so exporting and re-importing changed the
document:

```ts
quill.getSemanticHTML()                             // "zwei&nbsp;&nbsp;Wörter"
quill.getSemanticHTML({ preserveWhitespace: true }) // "zwei  Wörter"
```

The default is unchanged. Adapted from [#55](https://github.com/quill-next/quill-next/pull/55).

The development setup was also repaired — `pnpm start` used to recurse infinitely, and the
docs told you to use npm. See [DEVELOPMENT.md](./.github/DEVELOPMENT.md).

## Quickstart

### React Quill

```bash
npm install quill-next quill-next-react
```

```tsx
import { Delta } from 'quill-next'
import QuillEditor from 'quill-next-react';

export default function App() {
  return (
    <QuillEditor
      defaultValue={new Delta().insert("Hello world")}
      config={{ theme: "next"}}
    />
  )
}
```

### Vanilla Quill

Instantiate a new Quill object with a css selector for the div that should become the editor.

```html
<!-- Include stylesheet -->
<link href="https://esm.sh/quill-next/dist/quill.snow.css" rel="stylesheet" />

<!-- Create the editor container -->
<div id="editor">
  <p>Hello World!</p>
  <p>Some initial <strong>bold</strong> text</p>
  <p><br /></p>
</div>

<!-- Initialize Quill editor -->
<script type="module">
  import Quill from 'https://esm.sh/quill-next';

  const quill = new Quill('#editor', {
    theme: 'snow'
  });
</script>
```

Take a look at the [Quill Next](https://quill-next.diverse.space/) website for more documentation, guides and [live playground](https://quill-next.diverse.space/playground/snow)!

## Download

```shell
npm install quill-next
```


## Packages

- **[Quill](./packages/quill/)** (`quill-next`): The editor itself — Quill with bug fixes and improvements.
- **[Quill Next React](./packages/quill-next-react/)** (`quill-next-react`): The React wrapper.
- **[Quill Next Vue](./packages/quill-next-vue/)** (`@quill-next/vue`): The Vue 3 wrapper.
- **[Website](./packages/website/)**: The documentation site, demos and playground.

## Development

This repository is a **pnpm** workspace and needs **Node.js 20+**. npm and Yarn cannot install
it — the packages reference each other with pnpm's `workspace:*` protocol. Run `corepack enable`
to pick up the pnpm version pinned in `package.json`.

```shell
pnpm install     # install
pnpm start       # build the libraries, then run both dev servers
```

`pnpm start` prints the URLs it bound to. Open the **Quill dev server** URL
(`http://localhost:9080/` by default) to try the editor directly; it serves a local demo
harness with a toolbar and a live Delta view.

```shell
pnpm --filter quill-next run test:unit    # unit tests (headless)
pnpm --filter quill-next run lint         # eslint + tsc
pnpm run build                            # build every package
```

Full details, including a known issue with the hosted playground pages, are in
[DEVELOPMENT.md](./.github/DEVELOPMENT.md).

## License

BSD 3-clause
