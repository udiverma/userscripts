# AGENTS.md

Instructions for AI coding agents working in this repo. Humans: see [CONTRIBUTING.md](CONTRIBUTING.md).

## What this repo is

A collection of Tampermonkey userscripts. Each one is a single file in `scripts/<slug>.user.js`, and installs auto-update from the raw GitHub URL.

## Finding a script

Read `scripts.json`: `name`, `description`, `sites`, `tags`, `install`. Don't scrape the README.

## Commands

| Task | Command |
|---|---|
| Scaffold | `npm run new -- <kebab-slug> '<match-pattern>'` |
| Regenerate everything | `npm run build` |
| Validate (CI) | `npm run check` |

## Rules

1. Never edit the README table, `scripts.json` or `llms.txt` by hand; run `npm run build`.
2. Don't write `@namespace`, `@homepageURL`, `@supportURL`, `@updateURL` or `@downloadURL`; the build owns them.
3. `@description` is 100 characters or fewer, and is one plain sentence.
4. Every `@tag` must exist in `tags.json`. Add new tags there only if none fit.
5. Any change to a script must raise its `@version` (semver).
6. Use the narrowest `@match` and `@grant none` unless you truly need more.
7. No `eval`, `new Function`, minified or obfuscated code, or unpinned `@require`.
8. `npm run check` must pass before you open a PR.
