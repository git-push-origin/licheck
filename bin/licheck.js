#!/usr/bin/env node

/**
 * licheck CLI
 *
 * Usage:
 *   licheck [options]
 */

const fs = require('fs');
const path = require('path');
const licheck = require('../index');

// ─── Arg Parser ───────────────────────────────────────────────────────────────

/**
 * Parse a comma-separated list of license patterns.
 * Each entry may be a plain string or a /regex/flags literal.
 */
function parsePatternList (str) {
  return str.split(',').map(s => {
    s = s.trim();
    const m = s.match(/^\/(.+)\/([gimsuy]*)$/);
    return m ? new RegExp(m[1], m[2]) : s;
  });
}

/** Return the next argv value, or exit with a clear error if it is missing. */
function nextVal (argv, i, flag) {
  const val = argv[i + 1];
  if (val === undefined || val.startsWith('--')) {
    process.stderr.write(`\n  ✖  Option ${flag} requires a value\n\n`);
    process.exit(1);
  }
  return val;
}

function parseArgs (argv) {
  const args = {};
  let i = 0;
  while (i < argv.length) {
    // Normalize --camelCase to --kebab-case so both forms are accepted
    const arg = argv[i].startsWith('--')
      ? '--' + argv[i].slice(2).replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      : argv[i];
    switch (arg) {
      case '--start': args.start = nextVal(argv, i, arg); i++; break;
      case '--format': args.format = nextVal(argv, i, arg); i++; break;
      case '--production': args.production = true; break;
      case '--development': args.development = true; break;
      case '--no-peer': args.noPeer = true; break;
      case '--no-optional': args.noOptional = true; break;
      case '--exclude': args.exclude = parsePatternList(nextVal(argv, i, arg)); i++; break;
      case '--exclude-packages-starting-with': args.excludePackagesStartingWith = parsePatternList(nextVal(argv, i, arg)); i++; break;
      case '--include-packages': args.includePackages = parsePatternList(nextVal(argv, i, arg)); i++; break;
      case '--exclude-private': args.excludePrivate = true; break;
      case '--exclude-licenses': args.excludeLicenses = parsePatternList(nextVal(argv, i, arg)); i++; break;
      case '--only-licenses': args.onlyLicenses = parsePatternList(nextVal(argv, i, arg)); i++; break;
      case '--fail-on': args.failOnLicenses = parsePatternList(nextVal(argv, i, arg)); i++; args.failOn = true; break;
      case '--clarifications-file': args.clarificationsFile = nextVal(argv, i, arg); i++; break;
      case '--depth': args.depth = parseInt(nextVal(argv, i, arg), 10); i++; break;
      case '--no-color': args.noColor = true; break;
      case '--summary': args.summaryOnly = true; break;
      case '--out': args.out = nextVal(argv, i, arg); i++; break;
      case '--project': args.projectName = nextVal(argv, i, arg); i++; break;
      case '--version': args.version = true; break;
      case '--help':
      case '-h': args.help = true; break;
      default:
        if (arg.startsWith('--')) {
          process.stderr.write(`Unknown option: ${arg}\n`);
          process.exit(1);
        }
    }
    i++;
  }
  return args;
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp () {
  process.stdout.write(`
  licheck — zero-dependency npm license auditor

  Usage:
    licheck [options]

  Options:
    --start <path>                      Project root directory (default: cwd)
    --format <fmt>                      Output format: text | json | csv | markdown | spdx
                                          (default: text)
    --production                        Only include production dependencies
    --development                       Only include dev dependencies
    --no-peer                           Exclude peer dependencies
    --no-optional                       Exclude optional dependencies from the production/development closure
    --exclude <pkg,...>                 Comma-separated package names to exclude
    --exclude-packages-starting-with    Exclude packages whose name starts with these prefixes
      <prefix,...>
    --include-packages <pkg,...>        Only include these packages (whitelist)
    --exclude-private                   Exclude packages with "private": true
    --exclude-licenses <l,...>          Exclude packages with these licenses
                                          Accepts /regex/flags (e.g. /^GPL/i)
    --only-licenses <l,...>             Only show packages with these licenses
                                          Accepts /regex/flags (e.g. /^MIT/i)
    --fail-on <l,...>                   Exit code 1 if these licenses are found
                                          Accepts /regex/flags (e.g. /^(A)?GPL/i)
    --clarifications-file <path>        JSON file with per-package license overrides
    --depth <n>                         Max node_modules nesting depth (default: 5)
    --no-color                          Disable ANSI colors in text output
    --summary                           Show summary only (works with text and json)
    --out <file>                        Write report to file instead of stdout
    --project <name>                    Project name used in SPDX documents
    --version                           Print version and exit
    --help, -h                          Show this help

  Examples:
    licheck
    licheck --format json --out licenses.json
    licheck --format csv --out licenses.csv
    licheck --fail-on GPL-3.0,AGPL-3.0
    licheck --only-licenses MIT,ISC --format markdown
    licheck --production --no-peer --format spdx --project my-app
    licheck --exclude-packages-starting-with @internal/,@private/
    licheck --clarifications-file clarifications.json

`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main () {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    process.stdout.write(`licheck v${pkg.version}\n`);
    return;
  }

  if (args.help) {
    printHelp();
    return;
  }

  if (args.production && args.development) {
    process.stderr.write('\n  ✖  --production and --development cannot be used together\n\n');
    process.exit(1);
  }

  const VALID_FORMATS = ['text', 'json', 'csv', 'markdown', 'md', 'spdx'];
  const fmt = (args.format || 'text').toLowerCase();
  if (!VALID_FORMATS.includes(fmt)) {
    process.stderr.write(`\n  ✖  Unknown format: "${args.format}". Valid formats: text, json, csv, markdown, spdx\n\n`);
    process.exit(1);
  }

  if (args.summaryOnly && ['csv', 'spdx'].includes(fmt)) {
    process.stderr.write(`  ⚠  --summary has no effect with --format ${fmt}\n`);
  }

  const startDir = path.resolve(args.start || process.cwd());

  const scanOptions = {
    start: startDir,
    production: args.production || false,
    development: args.development || false,
    noPeer: args.noPeer || false,
    noOptional: args.noOptional || false,
    exclude: args.exclude || [],
    excludePackagesStartingWith: args.excludePackagesStartingWith || [],
    includePackages: args.includePackages || [],
    excludePrivate: args.excludePrivate || false,
    excludeLicenses: args.excludeLicenses || [],
    onlyLicenses: args.onlyLicenses || [],
    // CLI owns the fail-on exit decision so the report always prints first.
    // Pass failOn: false to prevent scan() from throwing before format() runs.
    failOn: false,
    failOnLicenses: args.failOnLicenses || [],
    clarificationsFile: args.clarificationsFile || null,
    depth: args.depth || 5
  };

  const formatOptions = {
    noColor: args.noColor || !!args.out,
    summaryOnly: args.summaryOnly || false,
    projectName: args.projectName || path.basename(startDir)
  };

  let result;
  try {
    result = licheck.check(scanOptions);
  } catch (err) {
    process.stderr.write(`\n  ✖  ${err.message}\n\n`);
    process.exit(1);
  }

  const output = licheck.format(result, fmt, formatOptions);

  if (args.out) {
    try {
      const outPath = path.resolve(args.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, output, 'utf8');
      process.stdout.write(`  ✔  Report written to: ${args.out}\n`);
    } catch (err) {
      process.stderr.write(`  ✖  Could not write file: ${err.message}\n`);
      process.exit(1);
    }
  } else {
    process.stdout.write(output + '\n');
  }

  if (args.failOn && args.failOnLicenses.length) {
    const offenders = result.packages.filter(
      p => licheck.utils.matchesLicenseList(p.license, args.failOnLicenses)
    );
    if (offenders.length) {
      const names = offenders.map(p => `${p.name}@${p.version}`).join(', ');
      process.stderr.write(`\n  ✖  Disallowed license(s) found: ${names}\n\n`);
      process.exit(1);
    }
  }
}

main();
