# userscripts

[![check](https://github.com/udiverma/userscripts/actions/workflows/check.yml/badge.svg)](https://github.com/udiverma/userscripts/actions/workflows/check.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Small, auto-updating [Tampermonkey](https://www.tampermonkey.net/) userscripts. Install once and fixes arrive on their own.

## Scripts

<!-- scripts:start -->
| Script | Description | Sites | Tags | |
|---|---|---|---|---|
| _No scripts yet._ | [Add the first one →](CONTRIBUTING.md) | | | |
<!-- scripts:end -->

<sub>The table above is generated from each script's header by `npm run build`. Don't edit it by hand.</sub>

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Click **Install** next to a script, then confirm in the extension.

Every script's `@updateURL` points at this repo, so installed copies update when the `@version` goes up. Tampermonkey checks daily by default; you can change that under *Dashboard → Settings → Script Update*.

## Contributing

Fixes, new scripts, and new tags are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `npm run new -- my-script`, write it, `npm run build`, open a PR.

## For AI agents

- [`scripts.json`](scripts.json): every script's name, description, sites, tags, and install URL, as JSON.
- [`llms.txt`](llms.txt): the same as plain text, following the [llms.txt](https://llmstxt.org/) convention.
- [`tags.json`](tags.json): the tag vocabulary.
- [`AGENTS.md`](AGENTS.md): rules for agents that add or change scripts.

## License

[MIT](LICENSE). Each script states its own `@license`.
