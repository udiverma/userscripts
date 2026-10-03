#!/usr/bin/env node
// Zero-dependency tooling for this repo. Run `node tools/userscripts.mjs help`.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'udiverma/userscripts';
const BRANCH = 'main';
const SCRIPTS_DIR = 'scripts';
const MAX_DESC = 100;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const TABLE_START = '<!-- scripts:start -->';
const TABLE_END = '<!-- scripts:end -->';

const urls = slug => {
  const path = `${SCRIPTS_DIR}/${slug}.user.js`;
  return {
    path,
    raw: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`,
    source: `https://github.com/${REPO}/blob/${BRANCH}/${path}`,
    support: `https://github.com/${REPO}/issues/new?template=bug.yml&script=${slug}`,
  };
};

// Keys this tool owns; anything you write for them is overwritten on build.
const managed = slug => {
  const u = urls(slug);
  return {
    namespace: `https://github.com/${REPO}`,
    homepageURL: u.source,
    supportURL: u.support,
    updateURL: u.raw,
    downloadURL: u.raw,
  };
};

// Canonical header order; unknown keys keep their relative order at the end.
const ORDER = [
  'name', 'namespace', 'version', 'description', 'author', 'license', 'icon',
  'homepageURL', 'supportURL', 'updateURL', 'downloadURL', 'tag',
  'match', 'include', 'exclude-match', 'exclude', 'grant', 'connect',
  'require', 'resource', 'run-at', 'run-in', 'sandbox', 'inject-into', 'noframes',
];

// ── Header parsing ────────────────────────────────────────

function parse(src) {
  const start = src.indexOf('// ==UserScript==');
  const end = src.indexOf('// ==/UserScript==');
  if (start !== 0 || end < 0) return null;
  const entries = [];
  for (const line of src.slice(start, end).split('\n').slice(1)) {
    const m = line.match(/^\/\/\s*@(\S+)(?:\s+(.*?))?\s*$/);
    if (m) entries.push([m[1], m[2] ?? '']);
  }
  const body = src.slice(end + '// ==/UserScript=='.length).replace(/^\n+/, '');
  return { entries, body };
}

const get = (entries, key) => entries.filter(([k]) => k === key).map(([, v]) => v);
const first = (entries, key) => get(entries, key)[0];

function render(entries, body) {
  const rank = k => {
    const i = ORDER.indexOf(k.split(':')[0]);
    return i < 0 ? ORDER.length : i;
  };
  const sorted = entries.map((e, i) => [e, i]).sort((a, b) => rank(a[0][0]) - rank(b[0][0]) || a[1] - b[1]);
  const width = Math.max(12, ...entries.map(([k]) => k.length + 1));
  const lines = sorted.map(([[k, v]]) => `// @${k.padEnd(width)} ${v}`.trimEnd());
  return `// ==UserScript==\n${lines.join('\n')}\n// ==/UserScript==\n\n${body.replace(/\s*$/, '\n')}`;
}

function normalize(slug, src) {
  const parsed = parse(src);
  if (!parsed) return src;
  const own = managed(slug);
  const entries = parsed.entries.filter(([k]) => !(k in own));
  for (const [k, v] of Object.entries(own)) entries.push([k, v]);
  return render(entries, parsed.body);
}

// ── Loading + validation ──────────────────────────────────

const readJSON = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

function load() {
  return readdirSync(join(ROOT, SCRIPTS_DIR))
    .filter(f => f.endsWith('.user.js'))
    .sort()
    .map(file => {
      const slug = file.replace(/\.user\.js$/, '');
      const src = readFileSync(join(ROOT, SCRIPTS_DIR, file), 'utf8');
      return { slug, file, src, parsed: parse(src) };
    });
}

function validate(scripts, tags) {
  const errors = [];
  const names = new Map();
  for (const { slug, file, src, parsed } of scripts) {
    const err = msg => errors.push(`${SCRIPTS_DIR}/${file}: ${msg}`);
    if (!SLUG_RE.test(slug)) err('file name must be kebab-case, e.g. my-script.user.js');
    if (!parsed) { err('must start with a // ==UserScript== header block'); continue; }
    const e = parsed.entries;
    for (const key of ['name', 'version', 'description', 'author', 'license']) {
      if (!first(e, key)) err(`missing @${key}`);
    }
    const name = first(e, 'name');
    if (name) {
      if (names.has(name)) err(`@name "${name}" is already used by ${names.get(name)}`);
      names.set(name, file);
    }
    const version = first(e, 'version');
    if (version && !VERSION_RE.test(version)) err(`@version "${version}" must be MAJOR.MINOR.PATCH`);
    const desc = first(e, 'description') ?? '';
    if (desc.length > MAX_DESC) err(`@description is ${desc.length} chars (max ${MAX_DESC})`);
    if (desc.startsWith('One sentence, 100 chars max')) err('@description is still the template placeholder');
    if (!get(e, 'match').length && !get(e, 'include').length) err('needs at least one @match (or @include)');
    const scriptTags = get(e, 'tag');
    if (!scriptTags.length) err('needs at least one @tag (see tags.json)');
    for (const t of scriptTags) if (!(t in tags)) err(`unknown @tag "${t}"; pick one from tags.json or add it there`);
    for (const key of ['require', 'resource']) {
      for (const v of get(e, key)) {
        const url = key === 'resource' ? v.split(/\s+/)[1] : v;
        if (!url?.startsWith('https://')) err(`@${key} must use https: ${v}`);
      }
    }
    if (/\beval\s*\(|new\s+Function\s*\(/.test(parsed.body)) err('eval()/new Function() are not allowed');
    if (parsed.body.split('\n').some(l => l.length > 400)) err('has a line over 400 chars; minified or obfuscated code is not accepted');
    if (normalize(slug, src) !== src) err('header is not normalized; run `npm run build`');
  }
  return errors;
}

// ── Generated outputs ─────────────────────────────────────

const hosts = e => [...new Set([...get(e, 'match'), ...get(e, 'include')].map(p => {
  const m = p.match(/^[^:]+:\/\/([^/]+)/);
  return m ? m[1].replace(/^\*\./, '') : p;
}))];

function index(scripts) {
  return scripts.map(({ slug, parsed: { entries: e } }) => {
    const u = urls(slug);
    return {
      slug,
      name: first(e, 'name'),
      version: first(e, 'version'),
      description: first(e, 'description'),
      tags: get(e, 'tag'),
      sites: hosts(e),
      matches: [...get(e, 'match'), ...get(e, 'include')],
      grants: get(e, 'grant'),
      author: first(e, 'author'),
      license: first(e, 'license'),
      install: u.raw,
      source: u.source,
    };
  });
}

const cell = s => String(s).replace(/\|/g, '\\|');

function table(items, tags) {
  const head = '| Script | Description | Sites | Tags | |\n|---|---|---|---|---|';
  if (!items.length) {
    return `${head}\n| _No scripts yet._ | [Add the first one →](CONTRIBUTING.md) | | | |`;
  }
  const rows = items.map(s => [
    `[${cell(s.name)}](${SCRIPTS_DIR}/${s.slug}.user.js)`,
    cell(s.description),
    s.sites.map(h => `\`${h}\``).join(' '),
    s.tags.map(t => `\`${t}\``).join(' '),
    `[Install](${s.install})`,
  ].join(' | '));
  const counts = Object.keys(tags)
    .map(t => [t, items.filter(s => s.tags.includes(t)).length])
    .filter(([, n]) => n)
    .map(([t, n]) => `\`${t}\` ${n}`)
    .join(' · ');
  return `${head}\n${rows.map(r => `| ${r} |`).join('\n')}\n\n<sub>${items.length} script${items.length === 1 ? '' : 's'} · ${counts}</sub>`;
}

function readme(current, items, tags) {
  const a = current.indexOf(TABLE_START);
  const b = current.indexOf(TABLE_END);
  if (a < 0 || b < 0) throw new Error(`README.md is missing ${TABLE_START} / ${TABLE_END}`);
  return `${current.slice(0, a + TABLE_START.length)}\n${table(items, tags)}\n${current.slice(b)}`;
}

function llms(items, tags) {
  const list = items.length
    ? items.map(s => `- [${s.name}](${s.install}): ${s.description} Sites: ${s.sites.join(', ')}. Tags: ${s.tags.join(', ')}.`).join('\n')
    : '- (none yet)';
  return `# userscripts

> Public, auto-updating Tampermonkey / Violentmonkey userscripts. Each script is one self-contained \`.user.js\` file whose @updateURL points at this repo, so installs update themselves.

Machine-readable index: https://raw.githubusercontent.com/${REPO}/${BRANCH}/scripts.json
Contributing (humans and agents): https://github.com/${REPO}/blob/${BRANCH}/AGENTS.md

## Scripts

${list}

## Tags

${Object.entries(tags).map(([t, d]) => `- ${t}: ${d}`).join('\n')}
`;
}

function outputs(scripts, tags) {
  const items = index(scripts);
  return {
    'scripts.json': JSON.stringify({ repo: `https://github.com/${REPO}`, count: items.length, scripts: items }, null, 2) + '\n',
    'llms.txt': llms(items, tags),
    'README.md': readme(readFileSync(join(ROOT, 'README.md'), 'utf8'), items, tags),
  };
}

// ── Git helpers ───────────────────────────────────────────

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitShow = (ref, path) => { try { return git('show', `${ref}:${path}`); } catch { return null; } };

const cmpVersion = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

// Changed scripts must raise @version, or installed copies never update.
function versionErrors(base) {
  const changed = git('diff', '--name-only', '--diff-filter=M', `${base}...HEAD`, '--', SCRIPTS_DIR)
    .split('\n').filter(f => f.endsWith('.user.js'));
  const errors = [];
  for (const path of changed) {
    const before = first(parse(gitShow(base, path) ?? '')?.entries ?? [], 'version');
    const after = first(parse(readFileSync(join(ROOT, path), 'utf8'))?.entries ?? [], 'version');
    if (before && after && VERSION_RE.test(before) && VERSION_RE.test(after) && cmpVersion(after, before) <= 0) {
      errors.push(`${path}: changed but @version is still ${after}; bump it (base has ${before})`);
    }
  }
  return errors;
}

// ── Commands ──────────────────────────────────────────────

const commands = {
  build() {
    const tags = readJSON('tags.json');
    for (const s of load()) {
      if (!s.parsed) continue;
      const fixed = normalize(s.slug, s.src);
      if (fixed !== s.src) { writeFileSync(join(ROOT, SCRIPTS_DIR, s.file), fixed); console.log(`normalized ${s.file}`); }
    }
    const scripts = load();
    const errors = validate(scripts, tags);
    for (const [file, content] of Object.entries(outputs(scripts.filter(s => s.parsed), tags))) {
      writeFileSync(join(ROOT, file), content);
    }
    report(errors, `built ${scripts.length} script(s)`);
  },

  check(args) {
    const tags = readJSON('tags.json');
    const scripts = load();
    const errors = validate(scripts, tags);
    for (const [file, content] of Object.entries(outputs(scripts.filter(s => s.parsed), tags))) {
      if (readFileSync(join(ROOT, file), 'utf8') !== content) errors.push(`${file} is out of date; run \`npm run build\``);
    }
    const base = args[args.indexOf('--base') + 1];
    if (args.includes('--base') && base) errors.push(...versionErrors(base));
    report(errors, `${scripts.length} script(s) OK`);
  },

  new([slug, ...rest]) {
    if (!slug || !SLUG_RE.test(slug)) fail('usage: npm run new -- <kebab-case-slug> [match-pattern]');
    const dest = join(ROOT, SCRIPTS_DIR, `${slug}.user.js`);
    if (existsSync(dest)) fail(`${SCRIPTS_DIR}/${slug}.user.js already exists`);
    const name = slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    const author = (() => { try { return git('config', 'user.name'); } catch { return 'your-name'; } })();
    const src = readFileSync(join(ROOT, 'tools/template.user.js'), 'utf8')
      .replaceAll('{{name}}', name)
      .replaceAll('{{author}}', author)
      .replaceAll('{{match}}', rest[0] ?? 'https://example.com/*');
    writeFileSync(dest, normalize(slug, src));
    console.log(`created ${SCRIPTS_DIR}/${slug}.user.js; edit @description, @match and @tag, then run npm run build`);
  },

  // Pre-commit: bump PATCH on staged scripts whose @version wasn't raised.
  bump() {
    const staged = git('diff', '--cached', '--name-only', '--diff-filter=M', '--', SCRIPTS_DIR)
      .split('\n').filter(f => f.endsWith('.user.js'));
    for (const path of staged) {
      const before = first(parse(gitShow('HEAD', path) ?? '')?.entries ?? [], 'version');
      const src = readFileSync(join(ROOT, path), 'utf8');
      const after = first(parse(src)?.entries ?? [], 'version');
      if (!before || !after || !VERSION_RE.test(before) || !VERSION_RE.test(after)) continue;
      if (cmpVersion(after, before) > 0) continue;
      const [ma, mi, pa] = before.split('.').map(Number);
      const next = `${ma}.${mi}.${pa + 1}`;
      writeFileSync(join(ROOT, path), src.replace(/^(\/\/\s*@version\s+)\S+/m, `$1${next}`));
      console.log(`bumped ${path} ${before} → ${next}`);
    }
  },

  // Local dev: a stub that @requires your working copy, so edits apply on reload.
  dev([slug]) {
    const s = load().find(x => x.slug === slug);
    if (!s?.parsed) fail(`usage: npm run dev -- <slug>   (slugs: ${load().map(x => x.slug).join(', ') || 'none'})`);
    const own = managed(slug);
    const entries = s.parsed.entries
      .filter(([k]) => !(k in own) || k === 'namespace')
      .map(([k, v]) => [k, k === 'name' ? `${v} [dev]` : v]);
    entries.push(['require', `file://${join(ROOT, SCRIPTS_DIR, s.file)}`]);
    const stub = render(entries, '// Code is loaded from the @require above. Edit the file, then reload the page.\n');
    try { execFileSync('pbcopy', { input: stub }); console.error('(copied to clipboard)'); } catch {}
    console.log(stub);
  },

  help() {
    console.log(`npm run new -- <slug> [match]   scaffold scripts/<slug>.user.js
npm run build                    normalize headers, regenerate README table, scripts.json, llms.txt
npm run check                    validate everything (what CI runs)
npm run dev -- <slug>            print + copy a Tampermonkey stub that loads your local file
npm run setup                    enable the git hooks (auto version bump + build on commit)`);
  },
};

function report(errors, ok) {
  if (errors.length) fail(errors.map(e => `✗ ${e}`).join('\n'));
  console.log(`✓ ${ok}`);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const [cmd = 'help', ...args] = process.argv.slice(2);
(commands[cmd] ?? commands.help)(args);
