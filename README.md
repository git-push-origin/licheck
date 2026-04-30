# licheck

> Zero-dependency npm license checker. Scan your `node_modules` and generate rich license reports in seconds.

[![CI](https://github.com/git-push-origin/licheck/actions/workflows/test.yml/badge.svg)](https://github.com/git-push-origin/licheck/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js: >=14.14](https://img.shields.io/badge/Node.js-%3E%3D14.14-brightgreen.svg)](https://nodejs.org)
[![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()

---

## Features

- **Zero dependencies** — pure Node.js 14.14+ (Linux, Windows), Node.js 16+ (macOS) (`fs`, `path`, `crypto` only)
- **Dual CJS / ESM** — works with `require()` and `import` out of the box, full TypeScript declarations included
- **Multi-source detection** — reads `package.json` fields and heuristically detects licenses from `LICENSE` file text
- **SPDX normalization** — maps common aliases (`"The MIT License"`, `"Apache 2.0"`, etc.) to canonical SPDX identifiers
- **Copyright extraction** — parses copyright lines from license files
- **NOTICE file detection** — flags packages that ship an Apache-style `NOTICE` file
- **Clarifications file** — override any package's license with a JSON file, with optional SHA-256 checksum verification
- **5 output formats** — `text`, `json`, `csv`, `markdown`, `spdx`
- **Flexible filtering** — by dep type (prod/dev/peer), package name prefix, or license id (strings or RegExp)
- **CI fail-on** — exit with code 1 if disallowed licenses are detected
- **Scoped packages** — handles `@scope/package` correctly
- **Nested `node_modules`** — traverses non-hoisted installs up to a configurable depth

---

## Installation

```bash
npm install licheck
# or globally for CLI use
npm install -g licheck
```

---

## CLI Usage

```bash
# Basic scan (color text table)
licheck

# Export as JSON
licheck --format json --out licenses.json

# Export as CSV
licheck --format csv --out licenses.csv

# Export as Markdown
licheck --format markdown --out LICENSES.md

# Export as SPDX bill of materials
licheck --format spdx --project my-app --out bom.spdx.json

# Only production deps, skip peer deps
licheck --production --no-peer

# Only show MIT and ISC packages
licheck --only-licenses MIT,ISC

# Fail CI if any GPL or AGPL packages are found
licheck --fail-on GPL-2.0,GPL-3.0,AGPL-3.0

# Exclude specific packages or prefixes
licheck --exclude lodash,express
licheck --exclude-packages-starting-with @internal/

# Apply license overrides from a clarifications file
licheck --clarifications-file clarifications.json
```

### All CLI Options

All multi-word flags accept both kebab-case and camelCase — `--exclude-packages-starting-with` and `--excludePackagesStartingWith` are equivalent.

| Flag | Description | Default |
|------|-------------|---------|
| `--start <path>` | Project root directory | `process.cwd()` |
| `--format <fmt>` | Output format: `text \| json \| csv \| markdown \| md \| spdx` | `text` |
| `--production` | Only production dependencies | — |
| `--development` | Only dev dependencies | — |
| `--no-peer` | Exclude peer dependencies | — |
| `--no-optional` | Exclude optional dependencies from the production/development closure | — |
| `--exclude <pkg,...>` | Comma-separated package names to exclude. Accepts `/regex/flags` | — |
| `--exclude-packages-starting-with <p,...>` | Exclude packages whose name starts with these prefixes. Accepts `/regex/flags` | — |
| `--include-packages <pkg,...>` | Only include these packages (whitelist). Accepts `/regex/flags` | — |
| `--exclude-private` | Exclude packages with `"private": true` | — |
| `--exclude-licenses <l,...>` | Exclude packages with these licenses | — |
| `--only-licenses <l,...>` | Only show packages with these licenses | — |
| `--fail-on <l,...>` | Exit code 1 if these licenses are found | — |
| `--clarifications-file <path>` | JSON file with per-package license overrides | — |
| `--depth <n>` | Max `node_modules` nesting depth | `5` |
| `--no-color` | Disable ANSI colors (text format) | — |
| `--summary` | Show summary only (works with `text`, `json`, and `markdown`) | — |
| `--out <file>` | Write report to file | stdout |
| `--project <name>` | Project name for SPDX documents | cwd basename |
| `--version` | Print version and exit | — |
| `--help` | Show help | — |

---

## Programmatic API

### `check(options)` → `{ packages, summary }`

Scan a project and return structured results.

```js
// CJS
const licheck = require('licheck');

// ESM
import licheck from 'licheck';
import { check, validate, format } from 'licheck';
```

```js
const result = licheck.check({
  start: '/path/to/project',   // default: process.cwd()
  production: true,            // only prod deps
  noPeer: true,                // skip peer deps
  exclude: ['lodash'],         // skip these packages
  failOn: true,
  failOnLicenses: ['GPL-3.0', 'AGPL-3.0'],
});

console.log(result.summary.total);    // → 142
console.log(result.summary.licenses); // → { MIT: 110, ISC: 20, ... }

for (const pkg of result.packages) {
  console.log(pkg.name, pkg.version, pkg.license, pkg.category);
  if (pkg.copyright)   console.log(' ', pkg.copyright);
  if (pkg.noticeFile)  console.log('  NOTICE:', pkg.noticeFile);
}
```

#### `PackageInfo` shape

```ts
{
  name:          string;
  version:       string;
  license:       string;   // normalized SPDX, e.g. "MIT"
  category:      'permissive' | 'weak-copyleft' | 'strong-copyleft' | 'public-domain' | 'unknown';
  licenseFile:   string | null;   // absolute path to LICENSE file, if found
  licenseSource: 'package.json' | 'license-file-text' | 'license-file' | 'clarification' | 'none';
  description:   string;
  homepage:      string;
  path:          string;          // absolute path to package directory
  private:       boolean;
  copyright:     string;          // copyright line(s) extracted from the license file
  noticeFile:    string | null;   // absolute path to NOTICE file, if present
}
```

#### `ScanOptions`

| Option | Type | Description |
|--------|------|-------------|
| `start` | `string` | Project root (default: `process.cwd()`) |
| `production` | `boolean` | Only packages in `dependencies` |
| `development` | `boolean` | Only packages in `devDependencies` |
| `noPeer` | `boolean` | Exclude packages listed in `peerDependencies` |
| `noOptional` | `boolean` | Exclude optional deps from the production/development closure |
| `exclude` | `Array<string \| RegExp>` | Package names to skip |
| `excludePackagesStartingWith` | `Array<string \| RegExp>` | Skip packages whose name starts with any of these (plain string uses `startsWith`, RegExp is tested against the full name) |
| `includePackages` | `Array<string \| RegExp>` | Whitelist — only include these packages (empty = include all) |
| `excludePrivate` | `boolean` | Skip packages with `"private": true` |
| `excludeLicenses` | `Array<string \| RegExp>` | Skip packages with matching licenses |
| `onlyLicenses` | `Array<string \| RegExp>` | Only include packages with matching licenses |
| `failOn` | `boolean` | Throw if any `failOnLicenses` matches are found |
| `failOnLicenses` | `Array<string \| RegExp>` | Licenses that trigger the `failOn` check |
| `clarificationsFile` | `string` | Path to a JSON file with per-package license overrides |
| `depth` | `number` | Max `node_modules` nesting depth (default: `5`) |

> **License matching and SPDX suffixes** — each entry in `excludeLicenses`, `onlyLicenses`, `failOnLicenses`, and `validate`'s disallowed list is tested against both the raw license string stored on the package *and* its base form with SPDX version qualifiers stripped (`-only`, `-or-later`, and the deprecated `+` suffix). This means `/^GPL-3\.0$/` and `"GPL-3.0"` will match `GPL-3.0`, `GPL-3.0-only`, `GPL-3.0-or-later`, and `GPL-3.0+` — which is almost always the right behavior for compliance gates.

---

### `format(result, fmt, opts)` → `string`

Format results as a string.

```js
const text     = licheck.format(result, 'text',     { noColor: true });
const json     = licheck.format(result, 'json',     { pretty: true, summaryOnly: false });
const csv      = licheck.format(result, 'csv');
const markdown = licheck.format(result, 'markdown');
const spdx     = licheck.format(result, 'spdx',     { projectName: 'my-app' });
```

---

### `validate(disallowed, options)` → `PackageInfo[]`

Returns packages with disallowed licenses (empty array = all clear). Supports strings and RegExp.

```js
const offenders = licheck.validate(['GPL-2.0', 'GPL-3.0', /^AGPL/i], {
  start: process.cwd(),
  production: true,
});

if (offenders.length > 0) {
  console.error('Disallowed licenses:', offenders.map(p => `${p.name} (${p.license})`));
  process.exit(1);
}
```

---

### `print(options, fmt)`

Convenience: scan and immediately print to stdout.

```js
licheck.print({ production: true }, 'json');
```

---

### Low-level utilities (`utils`)

```js
const { utils } = require('licheck');

utils.normalizeLicense('The MIT License');       // → 'MIT'
utils.normalizeLicense({ type: 'Apache-2.0' });  // → 'Apache-2.0'
utils.categorize('GPL-3.0');                     // → 'strong-copyleft'
utils.detectLicenseFromText(licenseFileText);    // → 'MIT' | null
utils.extractCopyright(licenseFileText);         // → 'Copyright (c) 2024 Acme'
```

---

## Clarifications File

When a package has an incorrect or missing license declaration, you can override it with a clarifications file:

```json
{
  "some-package@1.2.3": {
    "license": "MIT",
    "licenseFile": "LICENSE",
    "checksum": "sha256:a1b2c3..."
  },
  "legacy-package": {
    "license": "Apache-2.0"
  }
}
```

Keys are matched as `name@version` first, then `name`-only as a fallback. If `checksum` is provided, licheck verifies the SHA-256 hash of the license file before accepting the override — the build fails if the file has changed since you audited it.

To extract a subregion for checksum purposes (e.g. a multi-license file), use `licenseStart` / `licenseEnd`:

```json
{
  "bundled-pkg@2.0.0": {
    "license": "MIT",
    "licenseStart": "Permission is hereby granted",
    "licenseEnd": "SOFTWARE.",
    "checksum": "sha256:..."
  }
}
```

---

## License Categories

| Category | Examples |
|----------|---------|
| `permissive` | MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, CC-BY-4.0 |
| `weak-copyleft` | LGPL-2.1, LGPL-3.0, MPL-2.0, EPL-2.0 |
| `strong-copyleft` | GPL-2.0, GPL-3.0, AGPL-3.0 |
| `public-domain` | CC0-1.0, Unlicense, WTFPL |
| `unknown` | Anything unrecognized, UNLICENSED |

---

## Running Tests

```bash
node test/index.test.js
```

---

## License

MIT — see [LICENSE.md](LICENSE.md)
