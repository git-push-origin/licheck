const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeLicense, categorize, detectLicenseFromText, extractCopyright } = require('./license');

/** Strip SPDX version qualifiers for comparison: GPL-3.0-only / GPL-2.0+ → GPL-x.0. */
function spdxBase (id) {
  return id.replace(/-(only|or-later)$/i, '').replace(/\+$/, '').trim();
}

/**
 * Extract atomic license identifiers from a (possibly compound) SPDX expression.
 * Splits on AND / OR / WITH and strips parentheses.
 */
function spdxTokens (license) {
  if (!/[()]|\bAND\b|\bOR\b|\bWITH\b/.test(license)) return [license];
  return license
    .replace(/[()]/g, ' ')
    .split(/\bAND\b|\bOR\b|\bWITH\b/)
    .map(t => t.trim())
    .filter(Boolean);
}

/**
 * Returns true if a license string matches any entry in the list.
 * For compound SPDX expressions every component token is checked individually.
 * SPDX 3.x -only / -or-later suffixes are stripped before string comparison.
 * @param {string} license
 * @param {Array<string|RegExp>} list
 * @returns {boolean}
 */
function matchesLicenseList (license, list) {
  if (!list.length) return false;
  const tokens = spdxTokens(license);
  return tokens.some(token => {
    const base = spdxBase(token);
    const baseLower = base.toLowerCase();
    return list.some(f => {
      if (f instanceof RegExp) return f.test(token) || f.test(base);
      const fBase = spdxBase(String(f)).toLowerCase();
      return baseLower === fBase;
    });
  });
}

/**
 * Returns true if package name matches any entry in the list (exact or RegExp).
 * @param {string} name
 * @param {Array<string|RegExp>} list
 * @returns {boolean}
 */
function matchesNameList (name, list) {
  return list.some(f => f instanceof RegExp ? f.test(name) : name === String(f));
}

/**
 * Returns true if package name starts with any prefix in the list (or matches any RegExp).
 * @param {string} name
 * @param {Array<string|RegExp>} list
 * @returns {boolean}
 */
function nameStartsWithList (name, list) {
  return list.some(f => f instanceof RegExp ? f.test(name) : name.startsWith(String(f)));
}

/** Filenames that typically contain license text (checked in order). */
const LICENSE_FILE_NAMES = [
  'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE.rst',
  'LICENCE', 'LICENCE.md', 'LICENCE.txt',
  'license', 'license.md', 'license.txt',
  'COPYING', 'COPYING.md', 'COPYING.txt'
];

/**
 * Read a file safely; returns null on any error.
 * @param {string} filePath
 * @returns {string|null}
 */
function readFileSafe (filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Parse package.json for a given package directory.
 * Returns the parsed object or null.
 * @param {string} pkgDir
 * @returns {object|null}
 */
function readPackageJson (pkgDir) {
  const content = readFileSafe(path.join(pkgDir, 'package.json'));
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Find and read the first LICENSE-like file in a directory.
 * Returns { file, text } or null.
 * @param {string} pkgDir
 * @returns {{ file: string, text: string }|null}
 */
function findLicenseFile (pkgDir) {
  for (const name of LICENSE_FILE_NAMES) {
    const filePath = path.join(pkgDir, name);
    const text = readFileSafe(filePath);
    if (text !== null) {
      return { file: name, text };
    }
  }
  return null;
}

/** Filenames that indicate an Apache NOTICE file (checked in order). */
const NOTICE_FILE_NAMES = ['NOTICE', 'NOTICE.md', 'NOTICE.txt', 'NOTICE.rst'];

/**
 * Find a NOTICE file in a package directory.
 * Returns the absolute path or null.
 * @param {string} pkgDir
 * @returns {string|null}
 */
function findNoticeFile (pkgDir) {
  for (const name of NOTICE_FILE_NAMES) {
    const filePath = path.join(pkgDir, name);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

/**
 * Compute SHA-256 of a string, returned as "sha256:<hex>".
 * @param {string} text
 * @returns {string}
 */
function sha256 (text) {
  return 'sha256:' + crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Extract the text between licenseStart and licenseEnd markers (inclusive).
 * Returns the full text if neither marker is provided.
 * @param {string} text
 * @param {string|undefined} start
 * @param {string|undefined} end
 * @returns {string}
 */
function extractSubregion (text, start, end) {
  if (!start && !end) return text;
  const startIdx = start ? text.indexOf(start) : 0;
  if (start && startIdx === -1) {
    throw new Error(`licenseStart marker not found in license file: "${start}"`);
  }
  const endIdx = end ? text.indexOf(end, startIdx) : -1;
  if (end && endIdx === -1) {
    throw new Error(`licenseEnd marker not found in license file: "${end}"`);
  }
  return text.slice(startIdx, end ? endIdx + end.length : text.length);
}

/**
 * Build the transitive closure of package names reachable from a given set of direct deps.
 * Works with any node_modules layout (hoisted, pnpm-style, or deeply-nested) by reading
 * deps from the pre-collected pkgDirs list rather than guessing paths.
 * @param {string[]} directDeps
 * @param {string[]} pkgDirs - All package directories already collected by collectPackageDirs
 * @param {boolean} [includeOptional=true] - Whether to follow optionalDependencies during the walk
 * @returns {Set<string>}
 */
function buildDepClosure (directDeps, pkgDirs, includeOptional = true) {
  // Index every installed package by name so we can look up its deps regardless of nesting depth.
  const byName = new Map();
  for (const dir of pkgDirs) {
    const pkg = readPackageJson(dir);
    if (pkg && pkg.name) {
      if (!byName.has(pkg.name)) byName.set(pkg.name, []);
      byName.get(pkg.name).push(pkg);
    }
  }
  const closure = new Set();
  const queue = [...directDeps];
  while (queue.length > 0) {
    const name = queue.shift();
    if (closure.has(name)) continue;
    closure.add(name);
    for (const pkg of byName.get(name) || []) {
      for (const dep of Object.keys(pkg.dependencies || {})) {
        if (!closure.has(dep)) queue.push(dep);
      }
      if (includeOptional) {
        for (const dep of Object.keys(pkg.optionalDependencies || {})) {
          if (!closure.has(dep)) queue.push(dep);
        }
      }
    }
  }
  return closure;
}

/**
 * Load and parse a clarifications JSON file.
 * Throws if the file cannot be read or parsed.
 * @param {string} filePath
 * @returns {object}
 */
function loadClarifications (filePath) {
  const content = readFileSafe(path.resolve(filePath));
  if (content === null) throw new Error(`Clarifications file not found: ${filePath}`);
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid clarifications file (${filePath}): ${e.message}`);
  }
}

/**
 * Apply a single clarification entry to a PackageInfo object.
 * Verifies checksum if provided.
 * @param {object} info - PackageInfo to mutate
 * @param {object} entry - Clarification entry
 */
function applyClarification (info, entry) {
  const resolvedLicenseFile = entry.licenseFile
    ? (path.isAbsolute(entry.licenseFile) ? entry.licenseFile : path.join(info.path, entry.licenseFile))
    : null;

  if (entry.checksum) {
    const filePath = resolvedLicenseFile || info.licenseFile;
    if (!filePath) {
      throw new Error(`Checksum specified for ${info.name}@${info.version} but no license file found`);
    }
    const text = readFileSafe(filePath);
    if (text === null) {
      throw new Error(`License file not readable for checksum verification: ${filePath}`);
    }
    const region = extractSubregion(text, entry.licenseStart, entry.licenseEnd);
    const actual = sha256(region);
    if (actual !== entry.checksum) {
      throw new Error(
        `Checksum mismatch for ${info.name}@${info.version}: expected ${entry.checksum}, got ${actual}`
      );
    }
  }

  if (entry.license) {
    info.license = normalizeLicense(entry.license);
    info.licenseSource = 'clarification';
    info.category = categorize(info.license);
  }
  if (resolvedLicenseFile) {
    info.licenseFile = resolvedLicenseFile;
  }
}

/**
 * Extract the best possible license string for a package.
 * Priority:
 *   1. package.json `license` / `licenses` field
 *   2. Text-based detection from LICENSE file
 *   3. 'UNKNOWN'
 * @param {object} pkg  - Parsed package.json
 * @param {string} pkgDir
 * @returns {{ license: string, licenseFile: string|null, source: string }}
 */
function extractLicense (pkg, pkgDir) {
  // 1. From package.json
  const raw = pkg.license || pkg.licenses;
  if (raw) {
    // Handle "SEE LICENSE IN <filename>" format
    if (typeof raw === 'string' && /^see license in\s+\S/i.test(raw.trim())) {
      const filename = raw.trim().replace(/^see license in\s+/i, '').trim();
      const resolved = path.resolve(pkgDir, filename);
      if (resolved.startsWith(pkgDir + path.sep) || resolved === pkgDir) {
        const text = readFileSafe(resolved);
        if (text) {
          const detected = detectLicenseFromText(text);
          if (detected) {
            return { license: detected, licenseFile: filename, licenseText: text, source: 'license-file-text' };
          }
          return { license: 'Custom / See License File', licenseFile: filename, licenseText: text, source: 'license-file' };
        }
      }
      // Referenced file missing or outside package dir — fall through to license file detection
    } else {
      const normalized = normalizeLicense(raw);
      if (normalized && normalized !== 'UNKNOWN') {
        // UNLICENSED means explicitly no license — skip file lookup
        if (normalized === 'UNLICENSED') {
          return { license: 'UNLICENSED', licenseFile: null, licenseText: null, source: 'package.json' };
        }
        const licenseFileInfo = findLicenseFile(pkgDir);
        return {
          license: normalized,
          licenseFile: licenseFileInfo ? licenseFileInfo.file : null,
          licenseText: licenseFileInfo ? licenseFileInfo.text : null,
          source: 'package.json'
        };
      }
    }
  }

  // 2. From license file text
  const licenseFileInfo = findLicenseFile(pkgDir);
  if (licenseFileInfo) {
    const detected = detectLicenseFromText(licenseFileInfo.text);
    if (detected) {
      return {
        license: detected,
        licenseFile: licenseFileInfo.file,
        licenseText: licenseFileInfo.text,
        source: 'license-file-text'
      };
    }
    return {
      license: 'Custom / See License File',
      licenseFile: licenseFileInfo.file,
      licenseText: licenseFileInfo.text,
      source: 'license-file'
    };
  }

  return { license: 'UNKNOWN', licenseFile: null, licenseText: null, source: 'none' };
}

/**
 * List direct sub-directories of a given directory (non-recursive).
 * Handles scoped packages (@scope/pkg).
 * @param {string} dir
 * @returns {string[]} Absolute paths to package directories
 */
function listPackageDirs (dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.name.startsWith('@')) {
      // Scoped namespace — go one level deeper
      let scopedEntries;
      try {
        scopedEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const scopedEntry of scopedEntries) {
        if (scopedEntry.isDirectory()) {
          dirs.push(path.join(fullPath, scopedEntry.name));
        }
      }
    } else if (!entry.name.startsWith('.')) {
      dirs.push(fullPath);
    }
  }
  return dirs;
}

/**
 * Recursively collect all unique package directories from node_modules,
 * including nested node_modules (for non-hoisted installs).
 * @param {string} nodeModulesDir
 * @param {Set<string>} visited - Tracks visited real paths to avoid cycles
 * @param {number} depth - Current nesting depth
 * @param {number} maxDepth - Maximum nesting depth to traverse
 * @returns {string[]} Array of unique package directories
 */
function collectPackageDirs (nodeModulesDir, visited = new Set(), depth = 0, maxDepth = 5) {
  if (depth > maxDepth) return [];

  const pkgDirs = listPackageDirs(nodeModulesDir);
  const result = [];

  for (const pkgDir of pkgDirs) {
    let realPath;
    try {
      realPath = fs.realpathSync(pkgDir);
    } catch {
      realPath = pkgDir;
    }

    if (visited.has(realPath)) continue;
    visited.add(realPath);
    result.push(pkgDir);

    // Check for nested node_modules
    const nested = path.join(pkgDir, 'node_modules');
    try {
      const stat = fs.statSync(nested);
      if (stat.isDirectory()) {
        const nestedPkgs = collectPackageDirs(nested, visited, depth + 1, maxDepth);
        result.push(...nestedPkgs);
      }
    } catch {
      // no nested node_modules
    }
  }

  return result;
}

const REPO_SHORTHANDS = { github: 'github.com', gitlab: 'gitlab.com', bitbucket: 'bitbucket.org' };

/**
 * Extract a browsable URL from a package.json `repository` field.
 * Handles object form { url } and string form including npm shorthands (github:foo/bar).
 * @param {string|object|undefined} repo
 * @returns {string}
 */
function repoToUrl (repo) {
  if (!repo) return '';
  if (typeof repo === 'object') return repo.url || '';
  const str = String(repo).trim();
  const m = str.match(/^(github|gitlab|bitbucket):(.+)$/i);
  if (m) return `https://${REPO_SHORTHANDS[m[1].toLowerCase()]}/${m[2]}`;
  return str;
}

/**
 * Build a PackageInfo object from a package directory.
 * @param {string} pkgDir
 * @returns {PackageInfo|null}
 */
function buildPackageInfo (pkgDir) {
  const pkg = readPackageJson(pkgDir);
  if (!pkg || !pkg.name) return null;

  const { license, licenseFile, licenseText, source } = extractLicense(pkg, pkgDir);
  const isPrivate = pkg.private === true;
  const effectiveLicense = (isPrivate && license === 'UNKNOWN') ? 'UNLICENSED' : license;

  const licenseFilePath = licenseFile ? path.join(pkgDir, licenseFile) : null;
  const copyright = licenseText ? extractCopyright(licenseText) : '';

  return {
    name: pkg.name,
    version: pkg.version || 'unknown',
    license: effectiveLicense,
    licenseFile: licenseFilePath,
    licenseSource: source,
    category: categorize(effectiveLicense),
    description: pkg.description || '',
    homepage: pkg.homepage || repoToUrl(pkg.repository),
    path: pkgDir,
    private: isPrivate,
    copyright,
    noticeFile: findNoticeFile(pkgDir)
  };
}

/**
 * Scan a project's node_modules and return license info for every package.
 *
 * @param {object} options
 * @param {string}   options.start                        - Project root (default: process.cwd())
 * @param {boolean}  [options.production]                 - Only include production deps (reads root package.json); mutually exclusive with development
 * @param {boolean}  [options.development]                - Only include dev deps; mutually exclusive with production
 * @param {boolean}  [options.noPeer]                     - Exclude peer deps listed in root package.json
 * @param {boolean}  [options.noOptional]                 - Exclude optional deps from the production/development closure
 * @param {Array<string|RegExp>} [options.exclude]                    - Package names to exclude
 * @param {Array<string|RegExp>} [options.excludeLicenses]            - License identifiers to exclude from results
 * @param {Array<string|RegExp>} [options.onlyLicenses]               - Only include packages with these licenses
 * @param {boolean}              [options.excludePrivate]             - Exclude packages with private: true
 * @param {Array<string|RegExp>} [options.excludePackagesStartingWith] - Exclude packages whose name starts with any of these prefixes
 * @param {Array<string|RegExp>} [options.includePackages]            - Only include these specific package names
 * @param {boolean}              [options.failOn]                     - Throw if any packages match failOnLicenses
 * @param {Array<string|RegExp>} [options.failOnLicenses]             - License ids that trigger a failure when failOn is set
 * @param {number}               [options.depth]                      - Max node_modules nesting depth (default: 5)
 * @param {string}               [options.clarificationsFile]         - Path to a JSON file that overrides license info per package
 *
 * @returns {ScanResult}
 */
function scan (options = {}) {
  const {
    start = process.cwd(),
    production = false,
    development = false,
    exclude = [],
    excludeLicenses = [],
    onlyLicenses = [],
    failOn = false,
    failOnLicenses = [],
    depth = 5,
    excludePrivate = false,
    excludePackagesStartingWith = [],
    includePackages = [],
    noPeer = false,
    noOptional = false,
    clarificationsFile = null
  } = options;

  if (production && development) {
    throw new Error('production and development filters are mutually exclusive');
  }

  const nodeModulesDir = path.resolve(start, 'node_modules');

  if (!fs.existsSync(nodeModulesDir)) {
    throw new Error(`node_modules not found at: ${nodeModulesDir}`);
  }

  const pkgDirs = collectPackageDirs(nodeModulesDir, new Set(), 0, depth);

  // Optionally filter by dep type using root package.json
  let depFilter = null;
  let peerExclude = new Set();
  if (production || development || noPeer) {
    const rootPkg = readPackageJson(start);
    if (rootPkg) {
      if (production) {
        const prodStart = [
          ...Object.keys(rootPkg.dependencies || {}),
          ...(noOptional ? [] : Object.keys(rootPkg.optionalDependencies || {}))
        ];
        depFilter = buildDepClosure(prodStart, pkgDirs, !noOptional);
      }
      if (development) depFilter = buildDepClosure(Object.keys(rootPkg.devDependencies || {}), pkgDirs, !noOptional);
      if (noPeer) peerExclude = new Set(Object.keys(rootPkg.peerDependencies || {}));
    }
  }

  const excludeSet = new Set(exclude.filter(e => !(e instanceof RegExp)));
  const excludePatterns = exclude.filter(e => e instanceof RegExp);
  const includeSet = includePackages.length ? new Set(includePackages.filter(e => !(e instanceof RegExp))) : null;
  const includePatterns = includePackages.filter(e => e instanceof RegExp);
  const clarifications = clarificationsFile ? loadClarifications(clarificationsFile) : null;
  const packages = [];
  const seen = new Set();

  for (const pkgDir of pkgDirs) {
    const info = buildPackageInfo(pkgDir);
    if (!info) continue;

    const key = `${info.name}@${info.version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Filters
    if (excludePrivate && info.private) continue;
    if (excludeSet.has(info.name) || matchesNameList(info.name, excludePatterns)) continue;
    if (peerExclude.has(info.name)) continue;
    if (excludePackagesStartingWith.length && nameStartsWithList(info.name, excludePackagesStartingWith)) continue;
    if (includeSet && !includeSet.has(info.name) && !matchesNameList(info.name, includePatterns)) continue;
    if (depFilter && !depFilter.has(info.name)) continue;
    // Apply clarifications before license filters so overrides are visible to onlyLicenses/excludeLicenses
    if (clarifications) {
      const entry = clarifications[`${info.name}@${info.version}`] || clarifications[info.name];
      if (entry) applyClarification(info, entry);
    }

    if (excludeLicenses.length && matchesLicenseList(info.license, excludeLicenses)) continue;
    if (onlyLicenses.length && !matchesLicenseList(info.license, onlyLicenses)) continue;

    packages.push(info);
  }

  // Sort alphabetically by name
  packages.sort((a, b) => a.name.localeCompare(b.name));

  // Build summary
  const licenseCounts = {};
  const categoryCounts = { permissive: 0, 'weak-copyleft': 0, 'strong-copyleft': 0, 'public-domain': 0, unknown: 0 };

  for (const p of packages) {
    licenseCounts[p.license] = (licenseCounts[p.license] || 0) + 1;
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }

  const summary = {
    total: packages.length,
    licenses: licenseCounts,
    categories: categoryCounts
  };

  // Fail-on check
  if (failOn && failOnLicenses.length) {
    const failing = packages.filter(p => matchesLicenseList(p.license, failOnLicenses));
    if (failing.length) {
      const names = failing.map(p => `${p.name}@${p.version} (${p.license})`).join(', ');
      throw new Error(`Disallowed license(s) found: ${names}`);
    }
  }

  return { packages, summary };
}

module.exports = { scan, buildPackageInfo, collectPackageDirs, matchesLicenseList };
