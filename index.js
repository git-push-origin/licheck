/**
 * licheck
 * Zero-dependency license checker for npm projects.
 *
 * Usage:
 *   const licheck = require('licheck');
 *   const result  = licheck.check({ start: '/path/to/project' });
 *   console.log(licheck.format(result, 'text'));
 */

const { scan, matchesLicenseList } = require('./lib/scanner');
const { toText, toJSON, toCSV, toMarkdown, toSPDX } = require('./lib/reporter');
const { normalizeLicense, categorize, detectLicenseFromText, extractCopyright } = require('./lib/license');

/**
 * Scan a project's node_modules and return rich license information.
 *
 * @param {object} [options]
 * @param {string}   [options.start=process.cwd()]          Project root directory
 * @param {boolean}  [options.production]                   Only include production dependencies (mutually exclusive with development)
 * @param {boolean}  [options.development]                  Only include dev dependencies (mutually exclusive with production)
 * @param {boolean}  [options.noPeer]                       Exclude peer dependencies
 * @param {boolean}  [options.noOptional]                   Exclude optional dependencies from the production/development closure
 * @param {Array<string|RegExp>} [options.exclude]                      Package names to exclude
 * @param {Array<string|RegExp>} [options.excludePackagesStartingWith]  Exclude packages whose name starts with these prefixes
 * @param {Array<string|RegExp>} [options.includePackages]              Whitelist — only include these packages
 * @param {boolean}  [options.excludePrivate]               Exclude packages with private: true
 * @param {Array<string|RegExp>} [options.excludeLicenses]  Exclude packages with matching licenses
 * @param {Array<string|RegExp>} [options.onlyLicenses]     Only return packages with matching licenses
 * @param {boolean}  [options.failOn]                       Throw if any failOnLicenses match
 * @param {Array<string|RegExp>} [options.failOnLicenses]   Licenses that trigger the failOn check
 * @param {number}   [options.depth=5]                      Max node_modules nesting depth
 * @param {string}   [options.clarificationsFile]           Path to a JSON file with per-package license overrides
 *
 * @returns {ScanResult}
 *
 * @example
 * const result = licheck.check({ start: './my-project' });
 * result.packages.forEach(p => console.log(p.name, p.license));
 */
function check (options = {}) {
  return scan(options);
}

/**
 * Format scan results as a string.
 *
 * @param {object} result   - Result from check()
 * @param {'text'|'json'|'csv'|'markdown'|'md'|'spdx'} [fmt='text'] Output format
 * @param {object} [opts]   - Format-specific options
 * @param {boolean} [opts.noColor]      (text) Disable ANSI color
 * @param {boolean} [opts.pretty=true]  (json) Pretty-print
 * @param {boolean} [opts.summaryOnly]  (text|json|markdown) Emit only the summary section
 * @param {string}  [opts.projectName]   (spdx) Project name for the SPDX document
 * @param {string}  [opts.created]       (spdx) ISO 8601 timestamp for creationInfo.created; defaults to now
 * @param {string|number} [opts.namespaceSeed] (spdx) Suffix for documentNamespace; defaults to Date.now()
 *
 * @returns {string}
 */
function format (result, fmt = 'text', opts = {}) {
  switch (fmt.toLowerCase()) {
    case 'json': return toJSON(result, opts);
    case 'csv': return toCSV(result);
    case 'markdown':
    case 'md': return toMarkdown(result, opts);
    case 'spdx': return toSPDX(result, opts);
    case 'text': return toText(result, opts);
    default: throw new Error(`Unknown format: "${fmt}". Valid formats: text, json, csv, markdown, md, spdx`);
  }
}

/**
 * Convenience: scan a project and immediately print the report to stdout.
 *
 * @param {object} [options] - Same options as check()
 * @param {'text'|'json'|'csv'|'markdown'|'md'|'spdx'} [fmt='text']
 * @returns {ScanResult}
 */
function print (options = {}, fmt = 'text') {
  const result = check(options);
  process.stdout.write(format(result, fmt) + '\n');
  return result;
}

/**
 * Validate that a project has no disallowed licenses.
 * Returns an array of offending PackageInfo objects (empty = all good).
 *
 * @param {Array<string|RegExp>} disallowed  - License ids or patterns that are not permitted
 * @param {object}   [options]   - Same options as check()
 * @returns {PackageInfo[]}
 */
function validate (disallowed, options = {}) {
  const result = check(options);
  return result.packages.filter(p => matchesLicenseList(p.license, disallowed));
}

module.exports = {
  check,
  format,
  print,
  validate,
  // Expose low-level utilities for advanced use
  utils: { normalizeLicense, categorize, detectLicenseFromText, extractCopyright, matchesLicenseList }
};
