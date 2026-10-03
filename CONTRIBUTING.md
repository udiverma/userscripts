# Contributing

Thanks for helping. Bug fixes, new scripts, and new tags are all welcome.

## Setup

Requires Node 20+ and no `npm install`; the tooling has no dependencies.

```sh
git clone https://github.com/udiverma/userscripts && cd userscripts
npm run setup        # enables the pre-commit hook (version bump + build)
```

## Add a script

```sh
npm run new -- my-script 'https://example.com/*'
```

This creates `scripts/my-script.user.js`. Fill in the header:

| Field | Rule |
|---|---|
| `@name` | Human-readable and unique in the repo |
| `@description` | One sentence, **100 characters max** |
| `@version` | `MAJOR.MINOR.PATCH`, starting at `1.0.0` |
| `@tag` | One or more tags from [`tags.json`](tags.json), one per line |
| `@match` | As narrow as possible; avoid `*://*/*` |
| `@grant` | Only what you use; prefer `none` |
| `@license` | An SPDX id, usually `MIT` |

Leave out `@namespace`, `@homepageURL`, `@supportURL`, `@updateURL` and `@downloadURL`. `npm run build` writes them for you.

Then:

```sh
npm run build        # normalizes headers, regenerates the README table, scripts.json, llms.txt
npm run check        # what CI runs
```

## Change a script

Edit it and raise `@version` (patch for fixes, minor for features). Installed copies only update when the version goes up. With the hook enabled, an unchanged version gets a patch bump automatically when you commit.

## Test locally without copy-paste

```sh
npm run dev -- my-script
```

This prints a stub, and copies it on macOS, that loads your working file through `@require file://...`. Paste the stub into a new Tampermonkey script once, and from then on, saving the file and reloading the page runs your latest code. In Chrome, first turn on *Allow access to file URLs* for Tampermonkey under `chrome://extensions` → Tampermonkey → Details. Disable the installed copy while you use the `[dev]` one so the script doesn't run twice.

## New tags

Add the tag and a one-line meaning to [`tags.json`](tags.json) in the same PR. Use lowercase, hyphenated tags, and keep them broad. Prefer existing tags.

## Rules

- One self-contained file per script. No build step and no bundlers.
- No `eval`, `new Function`, minified, or obfuscated code. Reviewers have to be able to read it.
- `@require` / `@resource` must be `https` and pinned to a version, for example `https://cdn.jsdelivr.net/npm/lib@1.2.3/...`.
- Don't send page data anywhere unless that's the script's stated purpose, and the description says so.
- One script or one fix per PR.
