/**
 * Simple test runner — zero dependencies, pure Node.js.
 * Run: node test/index.test.js
 */

const assert = require('assert');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const licheck = require('../index');
const { normalizeLicense, categorize, detectLicenseFromText } = require('../lib/license');
const { toText, toJSON, toCSV, toMarkdown, toSPDX } = require('../lib/reporter');

let passed = 0;
let failed = 0;

function test (name, fn) {
  try {
    fn();
    process.stdout.write(`  ✔  ${name}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(`  ✖  ${name}\n     ${err.message}\n`);
    failed++;
  }
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function runESM (code) {
  execSync('node --input-type=module', {
    input: code,
    cwd: path.join(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function createFakeProject (packages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-test-'));
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(nm);

  for (const [name, pkg] of Object.entries(packages)) {
    const pkgDir = path.join(nm, name);
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(pkg));
  }
  return dir;
}

// ─── normalizeLicense ─────────────────────────────────────────────────────────

process.stdout.write('\nnormalizeLicense\n');

test('returns MIT for "MIT"', () => {
  assert.strictEqual(normalizeLicense('MIT'), 'MIT');
});

test('normalizes "The MIT License" → MIT', () => {
  assert.strictEqual(normalizeLicense('The MIT License'), 'MIT');
});

test('normalizes "Apache 2.0" → Apache-2.0', () => {
  assert.strictEqual(normalizeLicense('Apache 2.0'), 'Apache-2.0');
});

test('handles legacy {type: "MIT"} object', () => {
  assert.strictEqual(normalizeLicense({ type: 'MIT' }), 'MIT');
});

test('handles array of licenses', () => {
  const result = normalizeLicense(['MIT', 'ISC']);
  assert.ok(result.includes('MIT'));
  assert.ok(result.includes('ISC'));
});

test('returns UNKNOWN for null', () => {
  assert.strictEqual(normalizeLicense(null), 'UNKNOWN');
});

test('returns UNKNOWN for empty string', () => {
  assert.strictEqual(normalizeLicense(''), 'UNKNOWN');
});

test('normalizes "UNLICENSED" to UNLICENSED', () => {
  assert.strictEqual(normalizeLicense('UNLICENSED'), 'UNLICENSED');
});

test('normalizes lowercase "unlicensed" to UNLICENSED', () => {
  assert.strictEqual(normalizeLicense('unlicensed'), 'UNLICENSED');
});

test('returns UNKNOWN for undefined', () => {
  assert.strictEqual(normalizeLicense(undefined), 'UNKNOWN');
});

test('handles legacy {name: "MIT"} object form', () => {
  assert.strictEqual(normalizeLicense({ name: 'MIT' }), 'MIT');
});

test('passes through SPDX OR expression unchanged', () => {
  assert.strictEqual(normalizeLicense('MIT OR Apache-2.0'), 'MIT OR Apache-2.0');
});

test('passes through SPDX AND expression unchanged', () => {
  assert.strictEqual(normalizeLicense('(MIT AND ISC)'), '(MIT AND ISC)');
});

test('passes through SPDX WITH expression unchanged', () => {
  assert.strictEqual(normalizeLicense('GPL-2.0 WITH Classpath-exception-2.0'), 'GPL-2.0 WITH Classpath-exception-2.0');
});

test('non-matching string returns itself unchanged', () => {
  assert.strictEqual(normalizeLicense('LicenseRef-custom'), 'LicenseRef-custom');
});

test('normalizes "ISC License" → ISC', () => {
  assert.strictEqual(normalizeLicense('ISC License'), 'ISC');
});

test('normalizes "Simplified BSD" → BSD-2-Clause', () => {
  assert.strictEqual(normalizeLicense('Simplified BSD'), 'BSD-2-Clause');
});

test('normalizes "New BSD" → BSD-3-Clause', () => {
  assert.strictEqual(normalizeLicense('New BSD'), 'BSD-3-Clause');
});

test('normalizes "Revised BSD" → BSD-3-Clause', () => {
  assert.strictEqual(normalizeLicense('Revised BSD'), 'BSD-3-Clause');
});

test('normalizes "GPLv2" → GPL-2.0', () => {
  assert.strictEqual(normalizeLicense('GPLv2'), 'GPL-2.0');
});

test('normalizes "GPLv3" → GPL-3.0', () => {
  assert.strictEqual(normalizeLicense('GPLv3'), 'GPL-3.0');
});

test('normalizes "CC0" → CC0-1.0', () => {
  assert.strictEqual(normalizeLicense('CC0'), 'CC0-1.0');
});

test('normalizes "The Unlicense" → Unlicense', () => {
  assert.strictEqual(normalizeLicense('The Unlicense'), 'Unlicense');
});

// ─── categorize ───────────────────────────────────────────────────────────────

process.stdout.write('\ncategorize\n');

test('MIT → permissive', () => {
  assert.strictEqual(categorize('MIT'), 'permissive');
});

test('Apache-2.0 → permissive', () => {
  assert.strictEqual(categorize('Apache-2.0'), 'permissive');
});

test('GPL-3.0 → strong-copyleft', () => {
  assert.strictEqual(categorize('GPL-3.0'), 'strong-copyleft');
});

test('LGPL-2.1 → weak-copyleft', () => {
  assert.strictEqual(categorize('LGPL-2.1'), 'weak-copyleft');
});

test('Unlicense → public-domain', () => {
  assert.strictEqual(categorize('Unlicense'), 'public-domain');
});

test('UNKNOWN → unknown', () => {
  assert.strictEqual(categorize('UNKNOWN'), 'unknown');
});

test('ISC → permissive', () => {
  assert.strictEqual(categorize('ISC'), 'permissive');
});

test('BSD-2-Clause → permissive', () => {
  assert.strictEqual(categorize('BSD-2-Clause'), 'permissive');
});

test('BSD-3-Clause → permissive', () => {
  assert.strictEqual(categorize('BSD-3-Clause'), 'permissive');
});

test('GPL-2.0 → strong-copyleft', () => {
  assert.strictEqual(categorize('GPL-2.0'), 'strong-copyleft');
});

test('AGPL-3.0 → strong-copyleft', () => {
  assert.strictEqual(categorize('AGPL-3.0'), 'strong-copyleft');
});

test('MPL-2.0 → weak-copyleft', () => {
  assert.strictEqual(categorize('MPL-2.0'), 'weak-copyleft');
});

test('EPL-2.0 → weak-copyleft', () => {
  assert.strictEqual(categorize('EPL-2.0'), 'weak-copyleft');
});

test('LGPL-3.0-or-later → weak-copyleft (or-later suffix variant)', () => {
  assert.strictEqual(categorize('LGPL-3.0-or-later'), 'weak-copyleft');
});

test('LGPL-2.1-or-later → weak-copyleft (or-later suffix variant)', () => {
  assert.strictEqual(categorize('LGPL-2.1-or-later'), 'weak-copyleft');
});

test('CC0-1.0 → public-domain', () => {
  assert.strictEqual(categorize('CC0-1.0'), 'public-domain');
});

test('CC-BY-4.0 → permissive', () => {
  assert.strictEqual(categorize('CC-BY-4.0'), 'permissive');
});

test('CC-BY-3.0 → permissive', () => {
  assert.strictEqual(categorize('CC-BY-3.0'), 'permissive');
});

test('WTFPL → public-domain', () => {
  assert.strictEqual(categorize('WTFPL'), 'public-domain');
});

test('empty string → unknown', () => {
  assert.strictEqual(categorize(''), 'unknown');
});

test('null → unknown', () => {
  assert.strictEqual(categorize(null), 'unknown');
});

test('SPDX OR expression returns most permissive: MIT OR GPL-3.0 → permissive', () => {
  assert.strictEqual(categorize('MIT OR GPL-3.0'), 'permissive');
});

test('SPDX AND expression returns most restrictive: MIT AND Apache-2.0 → permissive', () => {
  assert.strictEqual(categorize('MIT AND Apache-2.0'), 'permissive');
});

test('SPDX AND expression returns most restrictive: MIT AND LGPL-3.0 → weak-copyleft', () => {
  assert.strictEqual(categorize('MIT AND LGPL-3.0'), 'weak-copyleft');
});

test('SPDX WITH expression: GPL-2.0 WITH Classpath-exception-2.0 → strong-copyleft', () => {
  assert.strictEqual(categorize('GPL-2.0 WITH Classpath-exception-2.0'), 'strong-copyleft');
});

test('parenthesised SPDX expression: (MIT OR Apache-2.0) → permissive', () => {
  assert.strictEqual(categorize('(MIT OR Apache-2.0)'), 'permissive');
});

// ─── detectLicenseFromText ────────────────────────────────────────────────────

process.stdout.write('\ndetectLicenseFromText\n');

test('detects MIT from text', () => {
  const text = 'Permission is hereby granted, free of charge, to any person obtaining a copy...';
  assert.strictEqual(detectLicenseFromText(text), 'MIT');
});

test('detects Apache-2.0 from text', () => {
  const text = 'Apache License, Version 2.0';
  assert.strictEqual(detectLicenseFromText(text), 'Apache-2.0');
});

test('detects Unlicense from text', () => {
  const text = 'This is free and unencumbered software released into the public domain.';
  assert.strictEqual(detectLicenseFromText(text), 'Unlicense');
});

test('returns null for unrecognized text', () => {
  assert.strictEqual(detectLicenseFromText('random text here'), null);
});

test('returns null for null input', () => {
  assert.strictEqual(detectLicenseFromText(null), null);
});

test('returns null for empty string', () => {
  assert.strictEqual(detectLicenseFromText(''), null);
});

test('detects GPL-3.0 from text', () => {
  assert.strictEqual(detectLicenseFromText('GNU General Public License version 3'), 'GPL-3.0');
});

test('detects GPL-2.0 from text', () => {
  assert.strictEqual(detectLicenseFromText('GNU General Public License version 2'), 'GPL-2.0');
});

test('detects LGPL-3.0 from text', () => {
  assert.strictEqual(detectLicenseFromText('GNU Lesser General Public License version 3'), 'LGPL-3.0');
});

test('detects LGPL-2.1 from text', () => {
  assert.strictEqual(detectLicenseFromText('GNU Lesser General Public License version 2.1'), 'LGPL-2.1');
});

test('detects LGPL-2.0 from text', () => {
  assert.strictEqual(detectLicenseFromText('GNU Lesser General Public License version 2'), 'LGPL-2.0');
});

test('detects AGPL-3.0 from text', () => {
  assert.strictEqual(detectLicenseFromText('GNU Affero General Public License'), 'AGPL-3.0');
});

test('detects MPL-2.0 from text', () => {
  assert.strictEqual(detectLicenseFromText('Mozilla Public License 2.0'), 'MPL-2.0');
});

test('detects ISC from text', () => {
  assert.strictEqual(detectLicenseFromText('ISC License'), 'ISC');
});

test('detects BSD-3-Clause from text (has "neither the name" clause)', () => {
  assert.strictEqual(
    detectLicenseFromText('Redistribution and use in source and binary forms, neither the name of the author'),
    'BSD-3-Clause'
  );
});

test('detects BSD-2-Clause from text (no "neither the name" clause)', () => {
  assert.strictEqual(
    detectLicenseFromText('Redistribution and use in source and binary forms, with or without modification'),
    'BSD-2-Clause'
  );
});

test('detects WTFPL from text', () => {
  assert.strictEqual(detectLicenseFromText('Do what the fuck you want to public license'), 'WTFPL');
});

test('detects CC0-1.0 from text', () => {
  assert.strictEqual(detectLicenseFromText('Creative Commons CC0'), 'CC0-1.0');
});

test('LGPL text does not match GPL', () => {
  const lgplText = 'GNU Lesser General Public License version 2.1';
  const result = detectLicenseFromText(lgplText);
  assert.ok(result.startsWith('LGPL'), `Expected LGPL*, got ${result}`);
});

test('detectLicenseFromText: Apache name and version 1 kb apart do not produce false Apache-2.0', () => {
  // "Apache License" appears in a compatibility note, "version 2.0" appears in a document
  // header far away — the two phrases must be co-located to count.
  const far = 'x'.repeat(1000);
  const text = `PROPRIETARY LICENSE\n\nCompatible with the Apache License.\n\n${far}\n\nDocument version 2.0`;
  assert.strictEqual(detectLicenseFromText(text), null);
});

test('detectLicenseFromText: "discharge" containing "isc" does not produce false ISC', () => {
  // "isc" appears only as a substring of "discharge", not as a standalone word.
  const text = 'PROPRIETARY LICENSE\n\nThis covers medical discharge procedures.\n\nPermission to use, copy, modify, and distribute this software is granted.';
  assert.strictEqual(detectLicenseFromText(text), null);
});

// ─── Scanner ──────────────────────────────────────────────────────────────────

process.stdout.write('\nscanner\n');

test('throws if node_modules not found', () => {
  assert.throws(
    () => licheck.check({ start: '/nonexistent/path' }),
    /node_modules not found/
  );
});

test('returns empty packages for empty node_modules', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-empty-'));
  fs.mkdirSync(path.join(dir, 'node_modules'));
  const result = licheck.check({ start: dir });
  assert.strictEqual(result.packages.length, 0);
  fs.rmSync(dir, { recursive: true });
});

test('scans packages and extracts license', () => {
  const dir = createFakeProject({
    lodash: { name: 'lodash', version: '4.17.21', license: 'MIT' },
    express: { name: 'express', version: '4.18.0', license: 'MIT' },
    'some-gpl': { name: 'some-gpl', version: '1.0.0', license: 'GPL-3.0' }
  });
  const result = licheck.check({ start: dir });
  assert.strictEqual(result.packages.length, 3);
  assert.ok(result.packages.some(p => p.name === 'lodash' && p.license === 'MIT'));
  assert.ok(result.packages.some(p => p.name === 'some-gpl' && p.license === 'GPL-3.0'));
  fs.rmSync(dir, { recursive: true });
});

test('summary.total matches packages.length', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'ISC' }
  });
  const result = licheck.check({ start: dir });
  assert.strictEqual(result.summary.total, result.packages.length);
  fs.rmSync(dir, { recursive: true });
});

test('exclude filter works', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'ISC' }
  });
  const result = licheck.check({ start: dir, exclude: ['a'] });
  assert.ok(!result.packages.some(p => p.name === 'a'));
  assert.ok(result.packages.some(p => p.name === 'b'));
  fs.rmSync(dir, { recursive: true });
});

test('onlyLicenses filter works', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'GPL-3.0' }
  });
  const result = licheck.check({ start: dir, onlyLicenses: ['MIT'] });
  assert.ok(result.packages.every(p => p.license === 'MIT'));
  fs.rmSync(dir, { recursive: true });
});

test('failOn throws when disallowed license found', () => {
  const dir = createFakeProject({
    'bad-pkg': { name: 'bad-pkg', version: '1.0.0', license: 'GPL-3.0' }
  });
  assert.throws(
    () => licheck.check({ start: dir, failOn: true, failOnLicenses: ['GPL-3.0'] }),
    /Disallowed license/
  );
  fs.rmSync(dir, { recursive: true });
});

test('weak-copyleft package is scanned and categorized correctly', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'LGPL-3.0' },
    c: { name: 'c', version: '1.0.0', license: 'LGPL-3.0-or-later' }
  });
  const result = licheck.check({ start: dir });
  const b = result.packages.find(p => p.name === 'b');
  const c = result.packages.find(p => p.name === 'c');
  assert.strictEqual(b.category, 'weak-copyleft');
  assert.strictEqual(c.category, 'weak-copyleft');
  assert.strictEqual(result.summary.categories['weak-copyleft'], 2);
  fs.rmSync(dir, { recursive: true });
});

test('validate returns offending packages', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'GPL-3.0' }
  });
  const offenders = licheck.validate(['GPL-3.0'], { start: dir });
  assert.strictEqual(offenders.length, 1);
  assert.strictEqual(offenders[0].name, 'b');
  fs.rmSync(dir, { recursive: true });
});

test('validate returns empty array when no violations', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'ISC' }
  });
  const offenders = licheck.validate(['GPL-3.0'], { start: dir });
  assert.strictEqual(offenders.length, 0);
  fs.rmSync(dir, { recursive: true });
});

test('validate is case-insensitive', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'GPL-3.0' }
  });
  const offenders = licheck.validate(['gpl-3.0'], { start: dir });
  assert.strictEqual(offenders.length, 1);
  fs.rmSync(dir, { recursive: true });
});

test('validate handles multiple disallowed licenses', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'GPL-3.0' },
    c: { name: 'c', version: '1.0.0', license: 'AGPL-3.0' }
  });
  const offenders = licheck.validate(['GPL-3.0', 'AGPL-3.0'], { start: dir });
  assert.strictEqual(offenders.length, 2);
  assert.ok(offenders.some(p => p.name === 'b'));
  assert.ok(offenders.some(p => p.name === 'c'));
  fs.rmSync(dir, { recursive: true });
});

test('handles scoped packages (@scope/name)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-scoped-'));
  const nm = path.join(dir, 'node_modules');
  const scopeDir = path.join(nm, '@babel');
  const pkgDir = path.join(scopeDir, 'core');
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'package.json'),
    JSON.stringify({ name: '@babel/core', version: '7.0.0', license: 'MIT' }));
  const result = licheck.check({ start: dir });
  assert.ok(result.packages.some(p => p.name === '@babel/core'));
  fs.rmSync(dir, { recursive: true });
});

test('license detected from LICENSE file text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-lic-'));
  const nm = path.join(dir, 'node_modules', 'unlicensed-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'),
    JSON.stringify({ name: 'unlicensed-pkg', version: '1.0.0' }));
  fs.writeFileSync(path.join(nm, 'LICENSE'),
    'Permission is hereby granted, free of charge, to any person obtaining a copy...');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'unlicensed-pkg');
  assert.ok(pkg, 'Package should be found');
  assert.strictEqual(pkg.license, 'MIT');
  assert.strictEqual(pkg.licenseSource, 'license-file-text');
  fs.rmSync(dir, { recursive: true });
});

test('unrecognizable LICENSE file yields Custom / See License File', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-custom-'));
  const nm = path.join(dir, 'node_modules', 'custom-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'custom-pkg', version: '1.0.0' }));
  fs.writeFileSync(path.join(nm, 'LICENSE'), 'Proprietary software. All rights reserved.');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'custom-pkg');
  assert.strictEqual(pkg.license, 'Custom / See License File');
  assert.strictEqual(pkg.licenseSource, 'license-file');
  fs.rmSync(dir, { recursive: true });
});

test('LICENSE takes priority over LICENCE.txt when both exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-prio-'));
  const nm = path.join(dir, 'node_modules', 'prio-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'prio-pkg', version: '1.0.0' }));
  fs.writeFileSync(path.join(nm, 'LICENSE'), 'Permission is hereby granted, free of charge, to any person obtaining a copy...');
  fs.writeFileSync(path.join(nm, 'LICENCE.txt'), 'Do what the fuck you want to public license');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'prio-pkg');
  assert.strictEqual(pkg.license, 'MIT');
  assert.ok(pkg.licenseFile.endsWith('LICENSE'));
  fs.rmSync(dir, { recursive: true });
});

test('COPYING filename is recognized as a license file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-copying-'));
  const nm = path.join(dir, 'node_modules', 'copying-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'copying-pkg', version: '1.0.0' }));
  fs.writeFileSync(path.join(nm, 'COPYING'), 'Permission is hereby granted, free of charge, to any person obtaining a copy...');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'copying-pkg');
  assert.ok(pkg, 'Package should be found');
  assert.strictEqual(pkg.license, 'MIT');
  fs.rmSync(dir, { recursive: true });
});

test('licenseFile field is an absolute path to the actual file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-abspath-'));
  const nm = path.join(dir, 'node_modules', 'path-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'path-pkg', version: '1.0.0', license: 'MIT' }));
  fs.writeFileSync(path.join(nm, 'LICENSE'), 'MIT');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'path-pkg');
  assert.ok(path.isAbsolute(pkg.licenseFile));
  assert.ok(fs.existsSync(pkg.licenseFile));
  fs.rmSync(dir, { recursive: true });
});

test('package with malformed package.json is silently skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-malformed-'));
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(path.join(nm, 'good-pkg'), { recursive: true });
  fs.mkdirSync(path.join(nm, 'bad-pkg'), { recursive: true });
  fs.writeFileSync(path.join(nm, 'good-pkg', 'package.json'), JSON.stringify({ name: 'good-pkg', version: '1.0.0', license: 'MIT' }));
  fs.writeFileSync(path.join(nm, 'bad-pkg', 'package.json'), 'this is not json {{{');
  const result = licheck.check({ start: dir });
  assert.ok(result.packages.some(p => p.name === 'good-pkg'));
  assert.ok(!result.packages.some(p => p.name === 'bad-pkg'));
  fs.rmSync(dir, { recursive: true });
});

test('package with empty package.json ({}) is skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-empty-pkg-'));
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(path.join(nm, 'real-pkg'), { recursive: true });
  fs.mkdirSync(path.join(nm, 'empty-pkg'), { recursive: true });
  fs.writeFileSync(path.join(nm, 'real-pkg', 'package.json'), JSON.stringify({ name: 'real-pkg', version: '1.0.0', license: 'MIT' }));
  fs.writeFileSync(path.join(nm, 'empty-pkg', 'package.json'), '{}');
  const result = licheck.check({ start: dir });
  assert.ok(result.packages.some(p => p.name === 'real-pkg'));
  assert.ok(!result.packages.some(p => p.name === 'empty-pkg'));
  fs.rmSync(dir, { recursive: true });
});

test('package.json that is a directory is silently skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-pkgjson-dir-'));
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(path.join(nm, 'real-pkg'), { recursive: true });
  fs.mkdirSync(path.join(nm, 'dir-pkg', 'package.json'), { recursive: true });
  fs.writeFileSync(path.join(nm, 'real-pkg', 'package.json'), JSON.stringify({ name: 'real-pkg', version: '1.0.0', license: 'MIT' }));
  const result = licheck.check({ start: dir });
  assert.ok(result.packages.some(p => p.name === 'real-pkg'));
  assert.ok(!result.packages.some(p => p.name === 'dir-pkg'));
  fs.rmSync(dir, { recursive: true });
});

test('package with no name field is skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-noname-'));
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(path.join(nm, 'named-pkg'), { recursive: true });
  fs.mkdirSync(path.join(nm, 'nameless-pkg'), { recursive: true });
  fs.writeFileSync(path.join(nm, 'named-pkg', 'package.json'), JSON.stringify({ name: 'named-pkg', version: '1.0.0', license: 'MIT' }));
  fs.writeFileSync(path.join(nm, 'nameless-pkg', 'package.json'), JSON.stringify({ version: '1.0.0', license: 'MIT' }));
  const result = licheck.check({ start: dir });
  assert.strictEqual(result.packages.length, 1);
  assert.strictEqual(result.packages[0].name, 'named-pkg');
  fs.rmSync(dir, { recursive: true });
});

test('package with no version defaults to "unknown"', () => {
  const dir = createFakeProject({
    'no-version-pkg': { name: 'no-version-pkg', license: 'MIT' }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'no-version-pkg');
  assert.strictEqual(pkg.version, 'unknown');
  fs.rmSync(dir, { recursive: true });
});

test('"SEE LICENSE IN <file>" reads and detects license from the referenced file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-seelic-'));
  const nm = path.join(dir, 'node_modules', 'see-lic-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'see-lic-pkg', version: '1.0.0', license: 'SEE LICENSE IN LICENSE.md' }));
  fs.writeFileSync(path.join(nm, 'LICENSE.md'), 'Permission is hereby granted, free of charge, to any person obtaining a copy...');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'see-lic-pkg');
  assert.strictEqual(pkg.license, 'MIT');
  assert.strictEqual(pkg.licenseSource, 'license-file-text');
  assert.ok(pkg.licenseFile.endsWith('LICENSE.md'));
  fs.rmSync(dir, { recursive: true });
});

test('"SEE LICENSE IN <file>" with unrecognizable content yields Custom / See License File', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-seecustom-'));
  const nm = path.join(dir, 'node_modules', 'see-custom-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'see-custom-pkg', version: '1.0.0', license: 'SEE LICENSE IN EULA.txt' }));
  fs.writeFileSync(path.join(nm, 'EULA.txt'), 'Proprietary. All rights reserved.');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'see-custom-pkg');
  assert.strictEqual(pkg.license, 'Custom / See License File');
  assert.strictEqual(pkg.licenseSource, 'license-file');
  fs.rmSync(dir, { recursive: true });
});

test('"SEE LICENSE IN <file>" with missing file falls through to normal detection', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-seemissing-'));
  const nm = path.join(dir, 'node_modules', 'see-missing-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'see-missing-pkg', version: '1.0.0', license: 'SEE LICENSE IN MISSING.txt' }));
  fs.writeFileSync(path.join(nm, 'LICENSE'), 'Permission is hereby granted, free of charge, to any person obtaining a copy...');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'see-missing-pkg');
  assert.strictEqual(pkg.license, 'MIT');
  fs.rmSync(dir, { recursive: true });
});

test('"SEE LICENSE IN <file>" with path traversal is ignored and falls through', () => {
  // A malicious package.json pointing outside its own directory must not be followed.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-traversal-'));
  const secretPath = path.join(dir, 'SECRET.txt');
  fs.writeFileSync(secretPath, 'top-secret content');
  const nm = path.join(dir, 'node_modules', 'evil-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(
    path.join(nm, 'package.json'),
    JSON.stringify({ name: 'evil-pkg', version: '1.0.0', license: 'SEE LICENSE IN ../../SECRET.txt' })
  );
  // No LICENSE file in the package dir — should fall through to UNKNOWN, not read SECRET.txt
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'evil-pkg');
  assert.ok(pkg, 'package is still scanned');
  assert.ok(pkg.licenseFile === null || !pkg.licenseFile.includes('SECRET'), 'licenseFile must not point outside pkg dir');
  assert.ok(!pkg.copyright.includes('top-secret'), 'secret file content must not appear in copyright');
  fs.rmSync(dir, { recursive: true });
});

test('"license": "UNLICENSED" is treated as explicitly no license', () => {
  const dir = createFakeProject({
    'no-lic-pkg': { name: 'no-lic-pkg', version: '1.0.0', license: 'UNLICENSED' }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'no-lic-pkg');
  assert.strictEqual(pkg.license, 'UNLICENSED');
  assert.strictEqual(pkg.licenseSource, 'package.json');
  assert.strictEqual(pkg.licenseFile, null);
  assert.strictEqual(pkg.category, 'unknown');
  fs.rmSync(dir, { recursive: true });
});

test('"license": "unlicensed" (lowercase) is normalized to UNLICENSED', () => {
  const dir = createFakeProject({
    'lower-lic-pkg': { name: 'lower-lic-pkg', version: '1.0.0', license: 'unlicensed' }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'lower-lic-pkg');
  assert.strictEqual(pkg.license, 'UNLICENSED');
  fs.rmSync(dir, { recursive: true });
});

test('UNLICENSED package does not read license files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-unlic-'));
  const nm = path.join(dir, 'node_modules', 'unlic-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'unlic-pkg', version: '1.0.0', license: 'UNLICENSED' }));
  fs.writeFileSync(path.join(nm, 'LICENSE'), 'Permission is hereby granted, free of charge, to any person obtaining a copy...');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'unlic-pkg');
  assert.strictEqual(pkg.license, 'UNLICENSED');
  assert.strictEqual(pkg.licenseFile, null);
  fs.rmSync(dir, { recursive: true });
});

test('"private: true" package with no license is marked UNLICENSED', () => {
  const dir = createFakeProject({
    'private-pkg': { name: 'private-pkg', version: '1.0.0', private: true }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'private-pkg');
  assert.strictEqual(pkg.license, 'UNLICENSED');
  assert.strictEqual(pkg.private, true);
  fs.rmSync(dir, { recursive: true });
});

test('"private: true" package with a license field still uses that license', () => {
  const dir = createFakeProject({
    'private-mit': { name: 'private-mit', version: '1.0.0', license: 'MIT', private: true }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'private-mit');
  assert.strictEqual(pkg.license, 'MIT');
  assert.strictEqual(pkg.private, true);
  fs.rmSync(dir, { recursive: true });
});

test('excludePrivate option skips private packages', () => {
  const dir = createFakeProject({
    'public-pkg': { name: 'public-pkg', version: '1.0.0', license: 'MIT' },
    'private-pkg': { name: 'private-pkg', version: '1.0.0', private: true }
  });
  const result = licheck.check({ start: dir, excludePrivate: true });
  assert.ok(result.packages.some(p => p.name === 'public-pkg'));
  assert.ok(!result.packages.some(p => p.name === 'private-pkg'));
  fs.rmSync(dir, { recursive: true });
});

test('excludeLicenses filter removes matching packages', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'GPL-3.0' }
  });
  const result = licheck.check({ start: dir, excludeLicenses: ['GPL-3.0'] });
  assert.ok(!result.packages.some(p => p.license === 'GPL-3.0'));
  assert.ok(result.packages.some(p => p.name === 'a'));
  fs.rmSync(dir, { recursive: true });
});

test('excludePackagesStartingWith skips packages with matching prefix', () => {
  const dir = createFakeProject({
    '@acme/core': { name: '@acme/core', version: '1.0.0', license: 'MIT' },
    '@acme/utils': { name: '@acme/utils', version: '1.0.0', license: 'MIT' },
    'third-party': { name: 'third-party', version: '1.0.0', license: 'MIT' }
  });
  const result = licheck.check({ start: dir, excludePackagesStartingWith: ['@acme/'] });
  assert.ok(!result.packages.some(p => p.name.startsWith('@acme/')));
  assert.ok(result.packages.some(p => p.name === 'third-party'));
  fs.rmSync(dir, { recursive: true });
});

test('excludePackagesStartingWith supports multiple prefixes', () => {
  const dir = createFakeProject({
    '@acme/core': { name: '@acme/core', version: '1.0.0', license: 'MIT' },
    '@internal/lib': { name: '@internal/lib', version: '1.0.0', license: 'MIT' },
    'public-pkg': { name: 'public-pkg', version: '1.0.0', license: 'MIT' }
  });
  const result = licheck.check({ start: dir, excludePackagesStartingWith: ['@acme/', '@internal/'] });
  assert.strictEqual(result.packages.length, 1);
  assert.strictEqual(result.packages[0].name, 'public-pkg');
  fs.rmSync(dir, { recursive: true });
});

test('excludeLicenses accepts RegExp to match license variants', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'Apache-2.0' },
    c: { name: 'c', version: '1.0.0', license: 'Apache-1.0' }
  });
  const result = licheck.check({ start: dir, excludeLicenses: [/^apache/i] });
  assert.ok(result.packages.some(p => p.name === 'a'));
  assert.ok(!result.packages.some(p => p.name === 'b'));
  assert.ok(!result.packages.some(p => p.name === 'c'));
  fs.rmSync(dir, { recursive: true });
});

test('onlyLicenses accepts RegExp', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'LGPL-2.1' },
    c: { name: 'c', version: '1.0.0', license: 'LGPL-3.0' }
  });
  const result = licheck.check({ start: dir, onlyLicenses: [/^lgpl/i] });
  assert.ok(!result.packages.some(p => p.name === 'a'));
  assert.ok(result.packages.some(p => p.name === 'b'));
  assert.ok(result.packages.some(p => p.name === 'c'));
  fs.rmSync(dir, { recursive: true });
});

test('failOn accepts RegExp', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'GPL-3.0' },
    c: { name: 'c', version: '1.0.0', license: 'AGPL-3.0' }
  });
  assert.throws(
    () => licheck.check({ start: dir, failOn: true, failOnLicenses: [/^(a)?gpl/i] }),
    /Disallowed license/
  );
  fs.rmSync(dir, { recursive: true });
});

test('validate accepts RegExp in disallowed list', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'GPL-2.0' },
    c: { name: 'c', version: '1.0.0', license: 'GPL-3.0' }
  });
  const offenders = licheck.validate([/^gpl/i], { start: dir });
  assert.strictEqual(offenders.length, 2);
  assert.ok(offenders.every(p => p.license.toLowerCase().startsWith('gpl')));
  fs.rmSync(dir, { recursive: true });
});

test('validate: GPL-3.0-only matches GPL-3.0 in disallowed list', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'GPL-3.0-only' },
    b: { name: 'b', version: '1.0.0', license: 'MIT' }
  });
  const offenders = licheck.validate(['GPL-3.0'], { start: dir });
  assert.strictEqual(offenders.length, 1);
  assert.strictEqual(offenders[0].name, 'a');
  fs.rmSync(dir, { recursive: true });
});

test('validate: GPL-2.0+ (deprecated + suffix) matches GPL-2.0 in disallowed list', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'GPL-2.0+' },
    b: { name: 'b', version: '1.0.0', license: 'MIT' }
  });
  const offenders = licheck.validate(['GPL-2.0'], { start: dir });
  assert.strictEqual(offenders.length, 1);
  assert.strictEqual(offenders[0].name, 'a');
  fs.rmSync(dir, { recursive: true });
});

test('validate: GPL-3.0-or-later matches GPL-3.0 in disallowed list', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'GPL-3.0-or-later' },
    b: { name: 'b', version: '1.0.0', license: 'MIT' }
  });
  const offenders = licheck.validate(['GPL-3.0'], { start: dir });
  assert.strictEqual(offenders.length, 1);
  assert.strictEqual(offenders[0].name, 'a');
  fs.rmSync(dir, { recursive: true });
});

test('validate: compound AND expression matches if any token is disallowed', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT AND GPL-3.0' },
    b: { name: 'b', version: '1.0.0', license: 'MIT' }
  });
  const offenders = licheck.validate(['GPL-3.0'], { start: dir });
  assert.strictEqual(offenders.length, 1);
  assert.strictEqual(offenders[0].name, 'a');
  fs.rmSync(dir, { recursive: true });
});

test('validate: compound OR expression matches if any token is disallowed', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT OR GPL-3.0' },
    b: { name: 'b', version: '1.0.0', license: 'MIT' }
  });
  const offenders = licheck.validate(['GPL-3.0'], { start: dir });
  assert.strictEqual(offenders.length, 1);
  assert.strictEqual(offenders[0].name, 'a');
  fs.rmSync(dir, { recursive: true });
});

test('failOn: GPL-3.0-only triggers fail when GPL-3.0 is in failOnLicenses', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'GPL-3.0-only' }
  });
  assert.throws(
    () => licheck.check({ start: dir, failOn: true, failOnLicenses: ['GPL-3.0'] }),
    (err) => { assert.ok(err.message.includes('a')); return true; }
  );
  fs.rmSync(dir, { recursive: true });
});

test('failOn: compound expression triggers fail when a token is disallowed', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: '(MIT AND GPL-3.0)' }
  });
  assert.throws(
    () => licheck.check({ start: dir, failOn: true, failOnLicenses: ['GPL-3.0'] }),
    /Disallowed license/
  );
  fs.rmSync(dir, { recursive: true });
});

test('excludeLicenses: GPL-3.0-only excluded when GPL-3.0 in list', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'GPL-3.0-only' },
    b: { name: 'b', version: '1.0.0', license: 'MIT' }
  });
  const result = licheck.check({ start: dir, excludeLicenses: ['GPL-3.0'] });
  assert.ok(!result.packages.some(p => p.name === 'a'));
  assert.ok(result.packages.some(p => p.name === 'b'));
  fs.rmSync(dir, { recursive: true });
});

test('production filter includes only deps listed in dependencies', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'ISC' }
  });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', version: '1.0.0', dependencies: { a: '*' }, devDependencies: { b: '*' } })
  );
  const result = licheck.check({ start: dir, production: true });
  assert.ok(result.packages.some(p => p.name === 'a'));
  assert.ok(!result.packages.some(p => p.name === 'b'));
  fs.rmSync(dir, { recursive: true });
});

test('production filter includes transitive production deps', () => {
  // root → express (prod) → body-parser (transitive prod)
  // devtool is a dev dep and must be excluded
  const dir = createFakeProject({
    express: { name: 'express', version: '4.0.0', license: 'MIT', dependencies: { 'body-parser': '*' } },
    'body-parser': { name: 'body-parser', version: '1.0.0', license: 'MIT' },
    devtool: { name: 'devtool', version: '1.0.0', license: 'MIT' }
  });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', dependencies: { express: '*' }, devDependencies: { devtool: '*' } })
  );
  const result = licheck.check({ start: dir, production: true });
  assert.ok(result.packages.some(p => p.name === 'express'), 'direct prod dep included');
  assert.ok(result.packages.some(p => p.name === 'body-parser'), 'transitive prod dep included');
  assert.ok(!result.packages.some(p => p.name === 'devtool'), 'dev dep excluded');
  fs.rmSync(dir, { recursive: true });
});

test('production --fail-on catches transitive dep with disallowed license', () => {
  const dir = createFakeProject({
    express: { name: 'express', version: '4.0.0', license: 'MIT', dependencies: { 'body-parser': '*' } },
    'body-parser': { name: 'body-parser', version: '1.0.0', license: 'GPL-3.0' }
  });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', dependencies: { express: '*' } })
  );
  assert.throws(
    () => licheck.check({ start: dir, production: true, failOn: true, failOnLicenses: ['GPL-3.0'] }),
    (err) => {
      assert.ok(err.message.includes('body-parser'), 'error names the offending transitive dep');
      return true;
    }
  );
  fs.rmSync(dir, { recursive: true });
});

test('production scan includes deeply-nested transitive dep (non-hoisted layout)', () => {
  // Layout: root → express (top-level) → body-parser (nested under express) → qs (nested under body-parser)
  // qs is GPL-3.0 and must be caught by --production --fail-on even though it is never at the top level.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-nonhoisted-'));
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', dependencies: { express: '*' } }));

  const expressDir = path.join(dir, 'node_modules', 'express');
  fs.mkdirSync(expressDir, { recursive: true });
  fs.writeFileSync(path.join(expressDir, 'package.json'),
    JSON.stringify({ name: 'express', version: '4.0.0', license: 'MIT', dependencies: { 'body-parser': '*' } }));

  const bodyParserDir = path.join(expressDir, 'node_modules', 'body-parser');
  fs.mkdirSync(bodyParserDir, { recursive: true });
  fs.writeFileSync(path.join(bodyParserDir, 'package.json'),
    JSON.stringify({ name: 'body-parser', version: '1.0.0', license: 'MIT', dependencies: { qs: '*' } }));

  const qsDir = path.join(bodyParserDir, 'node_modules', 'qs');
  fs.mkdirSync(qsDir, { recursive: true });
  fs.writeFileSync(path.join(qsDir, 'package.json'),
    JSON.stringify({ name: 'qs', version: '6.0.0', license: 'GPL-3.0' }));

  const result = licheck.check({ start: dir, production: true });
  assert.ok(result.packages.some(p => p.name === 'qs'), 'deeply-nested transitive dep included');

  assert.throws(
    () => licheck.check({ start: dir, production: true, failOn: true, failOnLicenses: ['GPL-3.0'] }),
    (err) => { assert.ok(err.message.includes('qs'), 'error names the offending dep'); return true; }
  );
  fs.rmSync(dir, { recursive: true });
});

test('development filter includes only deps listed in devDependencies', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'ISC' }
  });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', version: '1.0.0', dependencies: { a: '*' }, devDependencies: { b: '*' } })
  );
  const result = licheck.check({ start: dir, development: true });
  assert.ok(!result.packages.some(p => p.name === 'a'));
  assert.ok(result.packages.some(p => p.name === 'b'));
  fs.rmSync(dir, { recursive: true });
});

test('production and development cannot be used together', () => {
  const dir = createFakeProject({ a: { name: 'a', version: '1.0.0', license: 'MIT' } });
  assert.throws(
    () => licheck.check({ start: dir, production: true, development: true }),
    /mutually exclusive/
  );
  fs.rmSync(dir, { recursive: true });
});

test('failOn with no failOnLicenses does not throw', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'GPL-3.0' }
  });
  assert.doesNotThrow(() => licheck.check({ start: dir, failOn: true, failOnLicenses: [] }));
  fs.rmSync(dir, { recursive: true });
});

test('failOn error message includes offending package name and license', () => {
  const dir = createFakeProject({
    'bad-pkg': { name: 'bad-pkg', version: '2.0.0', license: 'GPL-3.0' }
  });
  assert.throws(
    () => licheck.check({ start: dir, failOn: true, failOnLicenses: ['GPL-3.0'] }),
    (err) => {
      assert.ok(err.message.includes('bad-pkg'), 'message should include package name');
      assert.ok(err.message.includes('GPL-3.0'), 'message should include license');
      return true;
    }
  );
  fs.rmSync(dir, { recursive: true });
});

test('packages are sorted alphabetically by name', () => {
  const dir = createFakeProject({
    zebra: { name: 'zebra', version: '1.0.0', license: 'MIT' },
    apple: { name: 'apple', version: '1.0.0', license: 'MIT' },
    mango: { name: 'mango', version: '1.0.0', license: 'MIT' }
  });
  const result = licheck.check({ start: dir });
  const names = result.packages.map(p => p.name);
  assert.deepStrictEqual(names, [...names].sort());
  fs.rmSync(dir, { recursive: true });
});

test('duplicate name@version across nested node_modules is deduped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-dup-'));
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(path.join(nm, 'a'), { recursive: true });
  fs.writeFileSync(path.join(nm, 'a', 'package.json'), JSON.stringify({ name: 'a', version: '1.0.0', license: 'MIT' }));
  // same package nested inside another package's node_modules
  const nested = path.join(nm, 'b', 'node_modules', 'a');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nm, 'b', 'package.json'), JSON.stringify({ name: 'b', version: '1.0.0', license: 'ISC' }));
  fs.writeFileSync(path.join(nested, 'package.json'), JSON.stringify({ name: 'a', version: '1.0.0', license: 'MIT' }));
  const result = licheck.check({ start: dir });
  const aEntries = result.packages.filter(p => p.name === 'a');
  assert.strictEqual(aEntries.length, 1);
  fs.rmSync(dir, { recursive: true });
});

test('summary.licenses counts are accurate', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'MIT' },
    c: { name: 'c', version: '1.0.0', license: 'ISC' }
  });
  const { summary } = licheck.check({ start: dir });
  assert.strictEqual(summary.licenses.MIT, 2);
  assert.strictEqual(summary.licenses.ISC, 1);
  fs.rmSync(dir, { recursive: true });
});

test('summary.categories counts are accurate', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'GPL-3.0' },
    c: { name: 'c', version: '1.0.0', license: 'LGPL-2.1' }
  });
  const { summary } = licheck.check({ start: dir });
  assert.strictEqual(summary.categories.permissive, 1);
  assert.strictEqual(summary.categories['strong-copyleft'], 1);
  assert.strictEqual(summary.categories['weak-copyleft'], 1);
  fs.rmSync(dir, { recursive: true });
});

// ─── Reporters ────────────────────────────────────────────────────────────────

process.stdout.write('\nreporters\n');

const MOCK_RESULT = {
  packages: [
    { name: 'lodash', version: '4.17.21', license: 'MIT', category: 'permissive', licenseSource: 'package.json', description: 'Utility library', homepage: 'https://lodash.com', path: '/nm/lodash' },
    { name: 'left-pad', version: '1.3.0', license: 'WTFPL', category: 'public-domain', licenseSource: 'package.json', description: '', homepage: '', path: '/nm/left-pad' }
  ],
  summary: {
    total: 2,
    licenses: { MIT: 1, WTFPL: 1 },
    categories: { permissive: 1, 'weak-copyleft': 0, 'strong-copyleft': 0, 'public-domain': 1, unknown: 0 }
  }
};

test('toText produces output containing package names', () => {
  const out = toText(MOCK_RESULT, { noColor: true });
  assert.ok(out.includes('lodash'));
  assert.ok(out.includes('MIT'));
  assert.ok(out.includes('left-pad'));
});

test('toJSON produces valid JSON with packages array', () => {
  const json = JSON.parse(toJSON(MOCK_RESULT));
  assert.ok(Array.isArray(json.packages));
  assert.strictEqual(json.packages.length, 2);
});

test('toJSON summaryOnly emits summary', () => {
  const json = JSON.parse(toJSON(MOCK_RESULT, { summaryOnly: true }));
  assert.strictEqual(json.total, 2);
  assert.ok(!json.packages);
});

test('toCSV produces correct header and rows', () => {
  const csv = toCSV(MOCK_RESULT);
  const lines = csv.split('\n');
  assert.ok(lines[0].startsWith('name,version,license'));
  assert.ok(lines[1].includes('lodash'));
});

test('toMarkdown produces valid markdown table', () => {
  const md = toMarkdown(MOCK_RESULT);
  assert.ok(md.includes('| lodash |'));
  assert.ok(md.includes('## Packages'));
});

test('format() dispatches to correct reporter', () => {
  assert.ok(licheck.format(MOCK_RESULT, 'json').startsWith('{'));
  assert.ok(licheck.format(MOCK_RESULT, 'csv').startsWith('name,'));
  assert.ok(licheck.format(MOCK_RESULT, 'markdown').startsWith('#'));
  assert.ok(licheck.format(MOCK_RESULT, 'spdx').includes('spdxVersion'));
  assert.ok(typeof licheck.format(MOCK_RESULT, 'text') === 'string');
});

test('format("md") is an alias for markdown', () => {
  assert.strictEqual(
    licheck.format(MOCK_RESULT, 'md'),
    licheck.format(MOCK_RESULT, 'markdown')
  );
});

test('format() throws for unknown format', () => {
  assert.throws(
    () => licheck.format(MOCK_RESULT, 'xml'),
    /Unknown format/
  );
});

test('toCSV: value containing a comma is quoted', () => {
  const result = {
    packages: [{ name: 'pkg', version: '1.0.0', license: 'MIT', category: 'permissive', licenseSource: 'package.json', description: 'foo, bar', homepage: '', path: '/nm/pkg' }],
    summary: { total: 1, licenses: { MIT: 1 }, categories: { permissive: 1, 'weak-copyleft': 0, 'strong-copyleft': 0, 'public-domain': 0, unknown: 0 } }
  };
  const csv = toCSV(result);
  assert.ok(csv.includes('"foo, bar"'));
});

test('toCSV: value containing a double-quote is escaped', () => {
  const result = {
    packages: [{ name: 'pkg', version: '1.0.0', license: 'MIT', category: 'permissive', licenseSource: 'package.json', description: 'say "hello"', homepage: '', path: '/nm/pkg' }],
    summary: { total: 1, licenses: { MIT: 1 }, categories: { permissive: 1, 'weak-copyleft': 0, 'strong-copyleft': 0, 'public-domain': 0, unknown: 0 } }
  };
  const csv = toCSV(result);
  assert.ok(csv.includes('"say ""hello"""'));
});

test('toCSV: field containing bare \\r is quoted (RFC 4180)', () => {
  const result = {
    packages: [{ name: 'pkg', version: '1.0.0', license: 'MIT', category: 'permissive', licenseSource: 'package.json', description: 'line1\rline2', homepage: '', path: '/nm/pkg' }],
    summary: { total: 1, licenses: { MIT: 1 }, categories: { permissive: 1, 'weak-copyleft': 0, 'strong-copyleft': 0, 'public-domain': 0, unknown: 0 } }
  };
  const csv = toCSV(result);
  assert.ok(csv.includes('"line1\rline2"'));
});

test('toMarkdown: includes license distribution and category breakdown sections', () => {
  const md = toMarkdown(MOCK_RESULT);
  assert.ok(md.includes('## License Distribution'));
  assert.ok(md.includes('## Category Breakdown'));
  assert.ok(md.includes('**MIT**'));
});

test('toMarkdown: summaryOnly omits packages table', () => {
  const md = toMarkdown(MOCK_RESULT, { summaryOnly: true });
  assert.ok(md.includes('## License Distribution'));
  assert.ok(md.includes('## Category Breakdown'));
  assert.ok(!md.includes('## Packages'), 'packages section should be absent');
  assert.ok(!md.includes('| Package |'), 'table header should be absent');
});

test('toSPDX: produces valid JSON with required SPDX fields', () => {
  const doc = JSON.parse(toSPDX(MOCK_RESULT));
  assert.strictEqual(doc.spdxVersion, 'SPDX-2.3');
  assert.strictEqual(doc.SPDXID, 'SPDXRef-DOCUMENT');
  assert.ok(Array.isArray(doc.packages));
  assert.strictEqual(doc.packages.length, MOCK_RESULT.packages.length);
});

test('toSPDX: projectName appears in output', () => {
  const doc = JSON.parse(toSPDX(MOCK_RESULT, { projectName: 'my-app' }));
  assert.strictEqual(doc.name, 'my-app');
  assert.ok(doc.documentNamespace.includes('my-app'));
});

test('toSPDX: created and namespaceSeed produce deterministic output', () => {
  const opts = { projectName: 'my-app', created: '2024-01-01T00:00:00.000Z', namespaceSeed: 'abc123' };
  const out1 = toSPDX(MOCK_RESULT, opts);
  const out2 = toSPDX(MOCK_RESULT, opts);
  assert.strictEqual(out1, out2);
  const doc = JSON.parse(out1);
  assert.strictEqual(doc.creationInfo.created, '2024-01-01T00:00:00.000Z');
  assert.ok(doc.documentNamespace.endsWith('-abc123'));
});

test('toText: truncated long fields show ellipsis, not silent cut', () => {
  const longName = 'a'.repeat(50);
  const longLicense = 'MIT AND Apache-2.0 AND BSD-3-Clause AND ISC AND LGPL-2.1-or-later AND MPL-2.0';
  const result = {
    packages: [{ name: longName, version: '1.0.0', license: longLicense, category: 'permissive', licenseSource: 'package.json', description: '', homepage: '', path: '/nm/pkg', copyright: '', noticeFile: null }],
    summary: { total: 1, licenses: { MIT: 1 }, categories: { permissive: 1, 'weak-copyleft': 0, 'strong-copyleft': 0, 'public-domain': 0, unknown: 0 } }
  };
  const out = toText(result, { noColor: true });
  assert.ok(out.includes('…'), 'truncation marker present');
  assert.ok(!out.includes(longName), 'full 50-char name not emitted verbatim');
});

test('toText: handles empty packages list without crashing', () => {
  const empty = { packages: [], summary: { total: 0, licenses: {}, categories: { permissive: 0, 'weak-copyleft': 0, 'strong-copyleft': 0, 'public-domain': 0, unknown: 0 } } };
  const out = toText(empty, { noColor: true });
  assert.ok(typeof out === 'string');
  assert.ok(out.includes('Total packages'));
});

test('toText: summaryOnly omits package table rows', () => {
  const out = toText(MOCK_RESULT, { noColor: true, summaryOnly: true });
  assert.ok(out.includes('Total packages'));
  assert.ok(!out.includes('│'), 'table rows should not appear in summaryOnly mode');
});

test('toMarkdown: pipe characters in cell values are escaped', () => {
  const result = {
    packages: [{ name: 'a|b', version: '1.0.0', license: 'MIT|ISC', category: 'permissive', licenseSource: 'package.json', description: '', homepage: '', path: '/nm/ab', copyright: '', noticeFile: null }],
    summary: { total: 1, licenses: { MIT: 1 }, categories: { permissive: 1, 'weak-copyleft': 0, 'strong-copyleft': 0, 'public-domain': 0, unknown: 0 } }
  };
  const md = toMarkdown(result);
  assert.ok(md.includes('a\\|b'), 'pipe in name should be escaped');
  assert.ok(md.includes('MIT\\|ISC'), 'pipe in license should be escaped');
});

// ─── CJS / MJS interop ───────────────────────────────────────────────────────

process.stdout.write('\nCJS / MJS interop\n');

test('CJS: index exports check, format, print, validate, utils', () => {
  const mod = require('../index');
  assert.strictEqual(typeof mod.check, 'function');
  assert.strictEqual(typeof mod.format, 'function');
  assert.strictEqual(typeof mod.print, 'function');
  assert.strictEqual(typeof mod.validate, 'function');
  assert.strictEqual(typeof mod.utils, 'object');
  assert.strictEqual(typeof mod.utils.extractCopyright, 'function');
});

test('CJS: lib/license exports all symbols', () => {
  const mod = require('../lib/license');
  assert.strictEqual(typeof mod.normalizeLicense, 'function');
  assert.strictEqual(typeof mod.categorize, 'function');
  assert.strictEqual(typeof mod.detectLicenseFromText, 'function');
  assert.strictEqual(typeof mod.extractCopyright, 'function');
  assert.strictEqual(typeof mod.SPDX_ALIASES, 'object');
  assert.strictEqual(typeof mod.LICENSE_CATEGORIES, 'object');
});

test('CJS: lib/scanner exports all symbols', () => {
  const mod = require('../lib/scanner');
  assert.strictEqual(typeof mod.scan, 'function');
  assert.strictEqual(typeof mod.buildPackageInfo, 'function');
  assert.strictEqual(typeof mod.collectPackageDirs, 'function');
});

test('CJS: lib/reporter exports all symbols', () => {
  const mod = require('../lib/reporter');
  assert.strictEqual(typeof mod.toText, 'function');
  assert.strictEqual(typeof mod.toJSON, 'function');
  assert.strictEqual(typeof mod.toCSV, 'function');
  assert.strictEqual(typeof mod.toMarkdown, 'function');
  assert.strictEqual(typeof mod.toSPDX, 'function');
});

test('ESM: index.mjs named exports', () => {
  runESM(`
    import { check, format, print, validate, utils } from './index.mjs';
    if (typeof check !== 'function') throw new Error('check not a function');
    if (typeof format !== 'function') throw new Error('format not a function');
    if (typeof print !== 'function') throw new Error('print not a function');
    if (typeof validate !== 'function') throw new Error('validate not a function');
    if (typeof utils !== 'object') throw new Error('utils not an object');
    if (typeof utils.extractCopyright !== 'function') throw new Error('utils.extractCopyright not a function');
  `);
});

test('ESM: index.mjs default export has same shape', () => {
  runESM(`
    import licheck from './index.mjs';
    if (typeof licheck.check !== 'function') throw new Error('default.check not a function');
    if (typeof licheck.format !== 'function') throw new Error('default.format not a function');
    if (typeof licheck.print !== 'function') throw new Error('default.print not a function');
    if (typeof licheck.validate !== 'function') throw new Error('default.validate not a function');
    if (typeof licheck.utils !== 'object') throw new Error('default.utils not an object');
  `);
});

test('ESM: lib/license.mjs named exports', () => {
  runESM(`
    import { normalizeLicense, categorize, detectLicenseFromText, extractCopyright, SPDX_ALIASES, LICENSE_CATEGORIES } from './lib/license.mjs';
    if (typeof normalizeLicense !== 'function') throw new Error('normalizeLicense not a function');
    if (typeof categorize !== 'function') throw new Error('categorize not a function');
    if (typeof detectLicenseFromText !== 'function') throw new Error('detectLicenseFromText not a function');
    if (typeof extractCopyright !== 'function') throw new Error('extractCopyright not a function');
    if (typeof SPDX_ALIASES !== 'object') throw new Error('SPDX_ALIASES not an object');
    if (typeof LICENSE_CATEGORIES !== 'object') throw new Error('LICENSE_CATEGORIES not an object');
  `);
});

test('ESM: lib/scanner.mjs named exports', () => {
  runESM(`
    import { scan, buildPackageInfo, collectPackageDirs } from './lib/scanner.mjs';
    if (typeof scan !== 'function') throw new Error('scan not a function');
    if (typeof buildPackageInfo !== 'function') throw new Error('buildPackageInfo not a function');
    if (typeof collectPackageDirs !== 'function') throw new Error('collectPackageDirs not a function');
  `);
});

test('ESM: lib/reporter.mjs named exports', () => {
  runESM(`
    import { toText, toJSON, toCSV, toMarkdown, toSPDX } from './lib/reporter.mjs';
    if (typeof toText !== 'function') throw new Error('toText not a function');
    if (typeof toJSON !== 'function') throw new Error('toJSON not a function');
    if (typeof toCSV !== 'function') throw new Error('toCSV not a function');
    if (typeof toMarkdown !== 'function') throw new Error('toMarkdown not a function');
    if (typeof toSPDX !== 'function') throw new Error('toSPDX not a function');
  `);
});

test('ESM: normalizeLicense works via lib/license.mjs', () => {
  runESM(`
    import { normalizeLicense } from './lib/license.mjs';
    const result = normalizeLicense('The MIT License');
    if (result !== 'MIT') throw new Error('Expected MIT, got ' + result);
  `);
});

test('ESM: check() throws for missing node_modules via index.mjs', () => {
  runESM(`
    import { check } from './index.mjs';
    try {
      check({ start: '/nonexistent' });
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('node_modules not found')) throw err;
    }
  `);
});

// ─── extractCopyright ────────────────────────────────────────────────────────

process.stdout.write('\nextractCopyright\n');

const { extractCopyright } = require('../lib/license');

test('extracts copyright line containing "Copyright"', () => {
  const text = 'MIT License\nCopyright (c) 2024 Dmitry Egorov\nPermission is hereby granted';
  assert.ok(extractCopyright(text).includes('Copyright (c) 2024 Dmitry Egorov'));
});

test('extracts copyright line containing © symbol', () => {
  const text = '© 2024 Acme Corp.\nAll rights reserved.';
  assert.ok(extractCopyright(text).includes('© 2024 Acme Corp.'));
});

test('returns empty string when no copyright lines', () => {
  assert.strictEqual(extractCopyright('Permission is hereby granted'), '');
});

test('returns empty string for null input', () => {
  assert.strictEqual(extractCopyright(null), '');
});

test('returns empty string for empty string', () => {
  assert.strictEqual(extractCopyright(''), '');
});

test('extracts multiple copyright lines joined with newline', () => {
  const text = 'Copyright (c) 2020 Alice\nCopyright (c) 2022 Bob\nSome other text';
  const result = extractCopyright(text);
  assert.ok(result.includes('Copyright (c) 2020 Alice'));
  assert.ok(result.includes('Copyright (c) 2022 Bob'));
  assert.strictEqual(result.split('\n').length, 2);
});

test('case-insensitive match for "COPYRIGHT"', () => {
  const text = 'COPYRIGHT 2024 COMPANY';
  assert.ok(extractCopyright(text).includes('COPYRIGHT 2024 COMPANY'));
});

test('MIT permission-notice boilerplate is excluded from copyright', () => {
  const text = [
    'MIT License',
    'Copyright (c) 2024 Real Author',
    '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy',
    'of this software and associated documentation files (the "Software"), to deal',
    'in the Software without restriction, including without limitation the rights',
    'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
    'copies of the Software, and to permit persons to whom the Software is',
    'furnished to do so, subject to the following conditions:',
    '',
    'The above copyright notice and this permission notice shall be included in all',
    'copies or substantial portions of the Software.'
  ].join('\n');
  const result = extractCopyright(text);
  assert.ok(result.includes('Copyright (c) 2024 Real Author'), 'real line kept');
  assert.ok(!result.includes('The above copyright notice'), 'boilerplate excluded');
});

test('BSD redistribution clause "above copyright notice" is excluded', () => {
  const text = [
    'Copyright (c) 2020 BSD Corp',
    'Redistribution and use in source and binary forms, with or without',
    'modification, are permitted provided that the following conditions are met:',
    '1. Redistributions of source code must retain the above copyright notice,',
    '   this list of conditions and the following disclaimer.'
  ].join('\n');
  const result = extractCopyright(text);
  assert.ok(result.includes('Copyright (c) 2020 BSD Corp'), 'real line kept');
  assert.ok(!result.includes('retain the above copyright notice'), 'clause excluded');
});

test('copyright field is populated on scanned package', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-cpr-'));
  const nm = path.join(dir, 'node_modules', 'cpr-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'cpr-pkg', version: '1.0.0', license: 'MIT' }));
  fs.writeFileSync(path.join(nm, 'LICENSE'), 'MIT License\nCopyright (c) 2024 Test Author\nPermission is hereby granted, free of charge');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'cpr-pkg');
  assert.ok(pkg.copyright.includes('Copyright (c) 2024 Test Author'));
  fs.rmSync(dir, { recursive: true });
});

test('copyright field is empty string when no license file', () => {
  const dir = createFakeProject({
    'no-file-pkg': { name: 'no-file-pkg', version: '1.0.0', license: 'MIT' }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'no-file-pkg');
  assert.strictEqual(pkg.copyright, '');
  fs.rmSync(dir, { recursive: true });
});

// ─── noticeFile detection ────────────────────────────────────────────────────

process.stdout.write('\nnoticeFile detection\n');

test('repository object form populates homepage', () => {
  const dir = createFakeProject({
    'repo-obj': { name: 'repo-obj', version: '1.0.0', license: 'MIT', repository: { type: 'git', url: 'https://github.com/foo/bar.git' } }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'repo-obj');
  assert.strictEqual(pkg.homepage, 'https://github.com/foo/bar.git');
  fs.rmSync(dir, { recursive: true });
});

test('repository string URL populates homepage', () => {
  const dir = createFakeProject({
    'repo-str': { name: 'repo-str', version: '1.0.0', license: 'MIT', repository: 'https://github.com/foo/bar' }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'repo-str');
  assert.strictEqual(pkg.homepage, 'https://github.com/foo/bar');
  fs.rmSync(dir, { recursive: true });
});

test('repository shorthand "github:foo/bar" expands to https URL', () => {
  const dir = createFakeProject({
    'repo-short': { name: 'repo-short', version: '1.0.0', license: 'MIT', repository: 'github:foo/bar' }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'repo-short');
  assert.strictEqual(pkg.homepage, 'https://github.com/foo/bar');
  fs.rmSync(dir, { recursive: true });
});

test('repository shorthand "gitlab:foo/bar" expands correctly', () => {
  const dir = createFakeProject({
    'repo-gl': { name: 'repo-gl', version: '1.0.0', license: 'MIT', repository: 'gitlab:foo/bar' }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'repo-gl');
  assert.strictEqual(pkg.homepage, 'https://gitlab.com/foo/bar');
  fs.rmSync(dir, { recursive: true });
});

test('homepage takes precedence over repository', () => {
  const dir = createFakeProject({
    'hp-wins': { name: 'hp-wins', version: '1.0.0', license: 'MIT', homepage: 'https://example.com', repository: 'github:foo/bar' }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'hp-wins');
  assert.strictEqual(pkg.homepage, 'https://example.com');
  fs.rmSync(dir, { recursive: true });
});

test('noticeFile is null when no NOTICE file exists', () => {
  const dir = createFakeProject({
    'plain-pkg': { name: 'plain-pkg', version: '1.0.0', license: 'MIT' }
  });
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'plain-pkg');
  assert.strictEqual(pkg.noticeFile, null);
  fs.rmSync(dir, { recursive: true });
});

test('noticeFile is absolute path when NOTICE file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-notice-'));
  const nm = path.join(dir, 'node_modules', 'notice-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'notice-pkg', version: '1.0.0', license: 'Apache-2.0' }));
  fs.writeFileSync(path.join(nm, 'NOTICE'), 'Apache NOTICE file content');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'notice-pkg');
  assert.ok(pkg.noticeFile !== null);
  assert.ok(path.isAbsolute(pkg.noticeFile));
  assert.ok(pkg.noticeFile.endsWith('NOTICE'));
  assert.ok(fs.existsSync(pkg.noticeFile));
  fs.rmSync(dir, { recursive: true });
});

test('NOTICE.md is detected as noticeFile', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-noticemd-'));
  const nm = path.join(dir, 'node_modules', 'notice-md-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'notice-md-pkg', version: '1.0.0', license: 'Apache-2.0' }));
  fs.writeFileSync(path.join(nm, 'NOTICE.md'), 'Notice content');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'notice-md-pkg');
  assert.ok(pkg.noticeFile !== null);
  assert.ok(pkg.noticeFile.endsWith('NOTICE.md'));
  fs.rmSync(dir, { recursive: true });
});

test('NOTICE takes priority over NOTICE.md', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-noticepri-'));
  const nm = path.join(dir, 'node_modules', 'notice-pri-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'notice-pri-pkg', version: '1.0.0', license: 'Apache-2.0' }));
  fs.writeFileSync(path.join(nm, 'NOTICE'), 'main notice');
  fs.writeFileSync(path.join(nm, 'NOTICE.md'), 'md notice');
  const result = licheck.check({ start: dir });
  const pkg = result.packages.find(p => p.name === 'notice-pri-pkg');
  assert.ok(pkg.noticeFile.endsWith('NOTICE') && !pkg.noticeFile.endsWith('NOTICE.md'));
  fs.rmSync(dir, { recursive: true });
});

// ─── includePackages ─────────────────────────────────────────────────────────

process.stdout.write('\nincludePackages\n');

test('includePackages returns only listed packages', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'ISC' },
    c: { name: 'c', version: '1.0.0', license: 'Apache-2.0' }
  });
  const result = licheck.check({ start: dir, includePackages: ['a', 'c'] });
  assert.strictEqual(result.packages.length, 2);
  assert.ok(result.packages.some(p => p.name === 'a'));
  assert.ok(result.packages.some(p => p.name === 'c'));
  assert.ok(!result.packages.some(p => p.name === 'b'));
  fs.rmSync(dir, { recursive: true });
});

test('includePackages empty array includes all packages', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'ISC' }
  });
  const result = licheck.check({ start: dir, includePackages: [] });
  assert.strictEqual(result.packages.length, 2);
  fs.rmSync(dir, { recursive: true });
});

test('includePackages with unknown name returns empty', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' }
  });
  const result = licheck.check({ start: dir, includePackages: ['nonexistent'] });
  assert.strictEqual(result.packages.length, 0);
  fs.rmSync(dir, { recursive: true });
});

test('includePackages and exclude can be combined (exclude takes precedence)', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'ISC' }
  });
  // include a and b, but exclude b — only a should remain
  const result = licheck.check({ start: dir, includePackages: ['a', 'b'], exclude: ['b'] });
  assert.strictEqual(result.packages.length, 1);
  assert.strictEqual(result.packages[0].name, 'a');
  fs.rmSync(dir, { recursive: true });
});

// ─── noPeer ──────────────────────────────────────────────────────────────────

process.stdout.write('\nnoPeer\n');

test('noPeer excludes packages listed in peerDependencies', () => {
  const dir = createFakeProject({
    react: { name: 'react', version: '18.0.0', license: 'MIT' },
    lodash: { name: 'lodash', version: '4.17.21', license: 'MIT' }
  });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', version: '1.0.0', peerDependencies: { react: '^18' } })
  );
  const result = licheck.check({ start: dir, noPeer: true });
  assert.ok(!result.packages.some(p => p.name === 'react'));
  assert.ok(result.packages.some(p => p.name === 'lodash'));
  fs.rmSync(dir, { recursive: true });
});

test('noPeer: false (default) does not exclude peers', () => {
  const dir = createFakeProject({
    react: { name: 'react', version: '18.0.0', license: 'MIT' }
  });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', version: '1.0.0', peerDependencies: { react: '^18' } })
  );
  const result = licheck.check({ start: dir, noPeer: false });
  assert.ok(result.packages.some(p => p.name === 'react'));
  fs.rmSync(dir, { recursive: true });
});

test('noPeer with no peerDependencies in root package.json does nothing', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' }
  });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'root', version: '1.0.0' }));
  const result = licheck.check({ start: dir, noPeer: true });
  assert.ok(result.packages.some(p => p.name === 'a'));
  fs.rmSync(dir, { recursive: true });
});

// ─── noOptional ──────────────────────────────────────────────────────────────

process.stdout.write('\nnoOptional\n');

test('production closure includes transitive optionalDependencies by default', () => {
  const dir = createFakeProject({
    express: { name: 'express', version: '4.0.0', license: 'MIT', optionalDependencies: { 'optional-dep': '*' } },
    'optional-dep': { name: 'optional-dep', version: '1.0.0', license: 'GPL-3.0' }
  });
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', dependencies: { express: '*' } }));
  const result = licheck.check({ start: dir, production: true });
  assert.ok(result.packages.some(p => p.name === 'optional-dep'), 'optional dep included by default');
  fs.rmSync(dir, { recursive: true });
});

test('production closure excludes optionalDependencies when noOptional is true', () => {
  const dir = createFakeProject({
    express: { name: 'express', version: '4.0.0', license: 'MIT', optionalDependencies: { 'optional-dep': '*' } },
    'optional-dep': { name: 'optional-dep', version: '1.0.0', license: 'GPL-3.0' }
  });
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', dependencies: { express: '*' } }));
  const result = licheck.check({ start: dir, production: true, noOptional: true });
  assert.ok(!result.packages.some(p => p.name === 'optional-dep'), 'optional dep excluded');
  fs.rmSync(dir, { recursive: true });
});

test('production closure includes root-level optionalDependencies by default', () => {
  const dir = createFakeProject({
    express: { name: 'express', version: '4.0.0', license: 'MIT' },
    'root-optional': { name: 'root-optional', version: '1.0.0', license: 'GPL-3.0' }
  });
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', dependencies: { express: '*' }, optionalDependencies: { 'root-optional': '*' } }));
  const result = licheck.check({ start: dir, production: true });
  assert.ok(result.packages.some(p => p.name === 'root-optional'), 'root optional dep included by default');
  fs.rmSync(dir, { recursive: true });
});

test('production closure excludes root-level optionalDependencies when noOptional is true', () => {
  const dir = createFakeProject({
    express: { name: 'express', version: '4.0.0', license: 'MIT' },
    'root-optional': { name: 'root-optional', version: '1.0.0', license: 'MIT' }
  });
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'root', dependencies: { express: '*' }, optionalDependencies: { 'root-optional': '*' } }));
  const result = licheck.check({ start: dir, production: true, noOptional: true });
  assert.ok(!result.packages.some(p => p.name === 'root-optional'), 'root optional dep excluded');
  fs.rmSync(dir, { recursive: true });
});

test('noOptional: false (default) does not affect non-production scans', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT', optionalDependencies: { b: '*' } },
    b: { name: 'b', version: '1.0.0', license: 'MIT' }
  });
  const result = licheck.check({ start: dir, noOptional: true });
  assert.ok(result.packages.some(p => p.name === 'b'), 'noOptional only affects production/development filter');
  fs.rmSync(dir, { recursive: true });
});

// ─── clarifications file ─────────────────────────────────────────────────────

process.stdout.write('\nclarifications file\n');

test('clarificationsFile overrides package license by name@version', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-clar-'));
  const nm = path.join(dir, 'node_modules', 'mystery-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'mystery-pkg', version: '1.0.0' }));
  const clarFile = path.join(dir, 'clarifications.json');
  fs.writeFileSync(clarFile, JSON.stringify({ 'mystery-pkg@1.0.0': { license: 'MIT' } }));
  const result = licheck.check({ start: dir, clarificationsFile: clarFile });
  const pkg = result.packages.find(p => p.name === 'mystery-pkg');
  assert.strictEqual(pkg.license, 'MIT');
  assert.strictEqual(pkg.licenseSource, 'clarification');
  fs.rmSync(dir, { recursive: true });
});

test('clarificationsFile overrides package license by name-only key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-clar2-'));
  const nm = path.join(dir, 'node_modules', 'old-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'old-pkg', version: '2.0.0' }));
  const clarFile = path.join(dir, 'clarifications.json');
  fs.writeFileSync(clarFile, JSON.stringify({ 'old-pkg': { license: 'Apache-2.0' } }));
  const result = licheck.check({ start: dir, clarificationsFile: clarFile });
  const pkg = result.packages.find(p => p.name === 'old-pkg');
  assert.strictEqual(pkg.license, 'Apache-2.0');
  assert.strictEqual(pkg.category, 'permissive');
  fs.rmSync(dir, { recursive: true });
});

test('clarificationsFile: checksum verification passes for correct hash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-chk-'));
  const nm = path.join(dir, 'node_modules', 'chk-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'chk-pkg', version: '1.0.0' }));
  const licText = 'Permission is hereby granted, free of charge';
  fs.writeFileSync(path.join(nm, 'LICENSE'), licText);
  const { createHash } = require('crypto');
  const checksum = 'sha256:' + createHash('sha256').update(licText, 'utf8').digest('hex');
  const clarFile = path.join(dir, 'clarifications.json');
  fs.writeFileSync(clarFile, JSON.stringify({ 'chk-pkg@1.0.0': { license: 'MIT', checksum } }));
  assert.doesNotThrow(() => licheck.check({ start: dir, clarificationsFile: clarFile }));
  fs.rmSync(dir, { recursive: true });
});

test('clarificationsFile: checksum mismatch throws an error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-chkmis-'));
  const nm = path.join(dir, 'node_modules', 'chkmis-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'chkmis-pkg', version: '1.0.0' }));
  fs.writeFileSync(path.join(nm, 'LICENSE'), 'Permission is hereby granted, free of charge');
  const clarFile = path.join(dir, 'clarifications.json');
  fs.writeFileSync(clarFile, JSON.stringify({ 'chkmis-pkg@1.0.0': { license: 'MIT', checksum: 'sha256:wronghash' } }));
  assert.throws(
    () => licheck.check({ start: dir, clarificationsFile: clarFile }),
    /Checksum mismatch/
  );
  fs.rmSync(dir, { recursive: true });
});

test('clarificationsFile: subregion extraction with licenseStart/licenseEnd', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-sub-'));
  const nm = path.join(dir, 'node_modules', 'sub-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'sub-pkg', version: '1.0.0' }));
  const fullText = 'HEADER\nPermission is hereby granted\nSome middle text\nEND\nFOOTER';
  fs.writeFileSync(path.join(nm, 'LICENSE'), fullText);
  const { createHash } = require('crypto');
  const region = 'Permission is hereby granted\nSome middle text\nEND';
  const checksum = 'sha256:' + createHash('sha256').update(region, 'utf8').digest('hex');
  const clarFile = path.join(dir, 'clarifications.json');
  fs.writeFileSync(clarFile, JSON.stringify({
    'sub-pkg@1.0.0': {
      license: 'MIT',
      checksum,
      licenseStart: 'Permission is hereby granted',
      licenseEnd: 'END'
    }
  }));
  assert.doesNotThrow(() => licheck.check({ start: dir, clarificationsFile: clarFile }));
  fs.rmSync(dir, { recursive: true });
});

test('clarificationsFile: missing licenseStart marker throws instead of silently using full text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-badstart-'));
  const nm = path.join(dir, 'node_modules', 'bad-start-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'bad-start-pkg', version: '1.0.0' }));
  const fullText = 'HEADER\nSome license text\nFOOTER';
  fs.writeFileSync(path.join(nm, 'LICENSE'), fullText);
  const { createHash } = require('crypto');
  // Checksum of the full text — would pass silently under the old fallback behaviour
  const checksum = 'sha256:' + createHash('sha256').update(fullText, 'utf8').digest('hex');
  const clarFile = path.join(dir, 'clarifications.json');
  fs.writeFileSync(clarFile, JSON.stringify({
    'bad-start-pkg@1.0.0': { license: 'MIT', checksum, licenseStart: 'NOT_IN_FILE' }
  }));
  assert.throws(
    () => licheck.check({ start: dir, clarificationsFile: clarFile }),
    /licenseStart marker not found/
  );
  fs.rmSync(dir, { recursive: true });
});

test('clarificationsFile: missing licenseEnd marker throws instead of silently reading to EOF', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-badend-'));
  const nm = path.join(dir, 'node_modules', 'bad-end-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'bad-end-pkg', version: '1.0.0' }));
  const fullText = 'HEADER\nSome license text\nFOOTER';
  fs.writeFileSync(path.join(nm, 'LICENSE'), fullText);
  const { createHash } = require('crypto');
  const checksum = 'sha256:' + createHash('sha256').update(fullText, 'utf8').digest('hex');
  const clarFile = path.join(dir, 'clarifications.json');
  fs.writeFileSync(clarFile, JSON.stringify({
    'bad-end-pkg@1.0.0': { license: 'MIT', checksum, licenseStart: 'HEADER', licenseEnd: 'NOT_IN_FILE' }
  }));
  assert.throws(
    () => licheck.check({ start: dir, clarificationsFile: clarFile }),
    /licenseEnd marker not found/
  );
  fs.rmSync(dir, { recursive: true });
});

test('clarificationsFile missing file throws an error', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' }
  });
  assert.throws(
    () => licheck.check({ start: dir, clarificationsFile: '/nonexistent/clarifications.json' }),
    /Clarifications file not found/
  );
  fs.rmSync(dir, { recursive: true });
});

test('clarifications: name@version key takes precedence over name-only key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlc-clarprec-'));
  const nm = path.join(dir, 'node_modules', 'prec-pkg');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'prec-pkg', version: '3.0.0' }));
  const clarFile = path.join(dir, 'clarifications.json');
  fs.writeFileSync(clarFile, JSON.stringify({
    'prec-pkg@3.0.0': { license: 'ISC' },
    'prec-pkg': { license: 'GPL-3.0' }
  }));
  const result = licheck.check({ start: dir, clarificationsFile: clarFile });
  const pkg = result.packages.find(p => p.name === 'prec-pkg');
  assert.strictEqual(pkg.license, 'ISC');
  fs.rmSync(dir, { recursive: true });
});

// ─── CLI integration ──────────────────────────────────────────────────────────

process.stdout.write('\nCLI integration\n');

test('CLI --start: SPDX DocumentName reflects --start dir, not cwd', () => {
  const dir = createFakeProject({ a: { name: 'a', version: '1.0.0', license: 'MIT' } });
  const cli = path.join(__dirname, '..', 'bin', 'licheck.js');
  // Run from os.tmpdir() so cwd basename differs from the fixture basename
  const r = spawnSync(process.execPath, [cli, '--start', dir, '--format', 'spdx'], {
    encoding: 'utf8',
    cwd: os.tmpdir()
  });
  const doc = JSON.parse(r.stdout);
  assert.strictEqual(doc.name, path.basename(dir));
  assert.ok(doc.documentNamespace.includes(path.basename(dir)));
  fs.rmSync(dir, { recursive: true });
});

test('CLI --fail-on: prints full report to stdout before exiting 1', () => {
  const dir = createFakeProject({
    a: { name: 'a', version: '1.0.0', license: 'MIT' },
    b: { name: 'b', version: '1.0.0', license: 'ISC' }
  });
  const cli = path.join(__dirname, '..', 'bin', 'licheck.js');
  const r = spawnSync(process.execPath, [cli, '--start', dir, '--fail-on', 'MIT', '--no-color'], {
    encoding: 'utf8'
  });
  // Report must appear in stdout
  assert.ok(r.stdout.includes('Package'), `stdout missing report header; got: ${r.stdout}`);
  assert.ok(r.stdout.includes('a'), `stdout missing offending package row; got: ${r.stdout}`);
  // Failure notice in stderr
  assert.ok(r.stderr.includes('Disallowed'), `stderr missing failure notice; got: ${r.stderr}`);
  // Exit code 1
  assert.strictEqual(r.status, 1);
  fs.rmSync(dir, { recursive: true });
});

// ─── Result ───────────────────────────────────────────────────────────────────

process.stdout.write(`\n${'─'.repeat(40)}\n`);
process.stdout.write(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}\n\n`);
if (failed > 0) process.exit(1);
