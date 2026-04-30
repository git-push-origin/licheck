/**
 * Known SPDX license identifiers and their common name aliases.
 * Used to normalize license strings found in package.json files.
 */
const SPDX_ALIASES = {
  // MIT variants
  mit: 'MIT',
  'mit license': 'MIT',
  'the mit license': 'MIT',

  // Apache variants
  'apache-2.0': 'Apache-2.0',
  'apache 2.0': 'Apache-2.0',
  apache2: 'Apache-2.0',
  'apache license 2.0': 'Apache-2.0',
  'apache license, version 2.0': 'Apache-2.0',

  // BSD variants
  'bsd-2-clause': 'BSD-2-Clause',
  'bsd-3-clause': 'BSD-3-Clause',
  'bsd 2-clause': 'BSD-2-Clause',
  'bsd 3-clause': 'BSD-3-Clause',
  'simplified bsd': 'BSD-2-Clause',
  'new bsd': 'BSD-3-Clause',
  'revised bsd': 'BSD-3-Clause',

  // GPL variants
  'gpl-2.0': 'GPL-2.0',
  'gpl-3.0': 'GPL-3.0',
  gplv2: 'GPL-2.0',
  gplv3: 'GPL-3.0',
  'gnu gpl v2': 'GPL-2.0',
  'gnu gpl v3': 'GPL-3.0',
  'gnu general public license v2.0': 'GPL-2.0',
  'gnu general public license v3.0': 'GPL-3.0',

  // LGPL variants
  'lgpl-2.0': 'LGPL-2.0',
  'lgpl-2.1': 'LGPL-2.1',
  'lgpl-3.0': 'LGPL-3.0',

  // AGPL variants
  'agpl-3.0': 'AGPL-3.0',
  'gnu agpl v3': 'AGPL-3.0',

  // ISC
  isc: 'ISC',
  'isc license': 'ISC',

  // MPL
  'mpl-2.0': 'MPL-2.0',
  'mozilla public license 2.0': 'MPL-2.0',

  // CC
  'cc0-1.0': 'CC0-1.0',
  cc0: 'CC0-1.0',
  'creative commons zero': 'CC0-1.0',

  // WTFPL
  wtfpl: 'WTFPL',

  // Unlicense (the actual open-source license)
  unlicense: 'Unlicense',
  'the unlicense': 'Unlicense',

  // UNLICENSED — npm convention meaning "no license, all rights reserved"
  unlicensed: 'UNLICENSED',

  // 0BSD
  '0bsd': '0BSD',

  // Python
  'python-2.0': 'Python-2.0',

  // Public Domain
  'public domain': 'Public Domain'
};

/**
 * Categorize licenses by permissiveness level:
 *   permissive  - MIT, ISC, BSD, Apache, etc.
 *   weak-copyleft - LGPL, MPL, EPL
 *   strong-copyleft - GPL, AGPL
 *   public-domain - CC0, Unlicense, WTFPL, 0BSD
 *   unknown
 */
const LICENSE_CATEGORIES = {
  permissive: [
    'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0',
    'Python-2.0', 'Zlib', 'Artistic-2.0', '0BSD', 'BlueOak-1.0.0',
    'CC-BY-4.0', 'CC-BY-3.0', 'CC-BY-2.5'
  ],
  'weak-copyleft': [
    'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'EPL-1.0', 'EPL-2.0',
    'CDDL-1.0', 'EUPL-1.1', 'EUPL-1.2'
  ],
  'strong-copyleft': [
    'GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'AGPL-1.0', 'OSL-3.0'
  ],
  'public-domain': [
    'CC0-1.0', 'Unlicense', 'WTFPL', 'Public Domain'
  ]
};

/**
 * Normalizes a raw license string to a canonical SPDX identifier.
 * @param {string|{type?: string, name?: string}|string[]} raw - The raw license value from package.json
 * @returns {string} Normalized license string
 */
function normalizeLicense (raw) {
  if (!raw) return 'UNKNOWN';

  // Handle legacy {type: 'MIT'} object form
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeLicense(raw.type || raw.name || '');
  }

  // Handle array of licenses — join with OR
  if (Array.isArray(raw)) {
    return raw.map(normalizeLicense).join(' OR ');
  }

  const str = String(raw).trim();

  // Already a valid SPDX expression with parens / AND / OR operators
  if (/[()]|\bAND\b|\bOR\b|\bWITH\b/.test(str)) {
    return str;
  }

  const key = str.toLowerCase().replace(/\s+/g, ' ');
  const alias = Object.prototype.hasOwnProperty.call(SPDX_ALIASES, key) ? SPDX_ALIASES[key] : undefined;
  return alias || str || 'UNKNOWN';
}

// Higher rank = more restrictive. Used only inside categorize.
const CATEGORY_RANK = {
  'strong-copyleft': 4,
  'weak-copyleft': 3,
  permissive: 2,
  'public-domain': 1,
  unknown: 0
};

/**
 * Returns the category for a given (normalized) license identifier.
 * For compound SPDX expressions:
 *   AND → most restrictive (must comply with all)
 *   OR  → most permissive (user may choose)
 *   WITH → categorize only the base license (ignore exception token)
 * @param {string} license
 * @returns {'permissive'|'weak-copyleft'|'strong-copyleft'|'public-domain'|'unknown'}
 */
function categorize (license) {
  if (!license || license === 'UNKNOWN') return 'unknown';

  if (/[()]|\bAND\b|\bOR\b|\bWITH\b/.test(license)) {
    const expr = license.replace(/[()]/g, ' ').trim();

    // WITH: categorize only the base license, ignore the exception identifier
    if (/\bWITH\b/.test(expr) && !/\bAND\b|\bOR\b/.test(expr)) {
      return categorize(expr.split(/\bWITH\b/)[0].trim());
    }

    // OR: user can choose any — return most permissive known category
    if (/\bOR\b/.test(expr)) {
      let best = 'unknown';
      for (const part of expr.split(/\bOR\b/)) {
        const cat = categorize(part.trim());
        const rank = CATEGORY_RANK[cat];
        // Prefer the lowest non-zero rank (most permissive known license)
        if (rank > 0 && (CATEGORY_RANK[best] === 0 || rank < CATEGORY_RANK[best])) best = cat;
      }
      return best;
    }

    // AND (or AND+WITH): must comply with all — return most restrictive
    let best = 'unknown';
    for (const token of expr.split(/\bAND\b|\bWITH\b/).map(t => t.trim()).filter(Boolean)) {
      const cat = categorize(token);
      if (CATEGORY_RANK[cat] > CATEGORY_RANK[best]) best = cat;
    }
    return best;
  }

  for (const [cat, ids] of Object.entries(LICENSE_CATEGORIES)) {
    for (const id of ids) {
      if (license.includes(id)) return cat;
    }
  }
  return 'unknown';
}

/**
 * Heuristically detect a license from the plain text of a LICENSE file.
 * Returns a normalized SPDX identifier or null.
 * @param {string} text
 * @returns {string|null}
 */
function detectLicenseFromText (text) {
  if (!text) return null;

  const t = text.toLowerCase();

  // Require the two phrases to appear within `window` characters of each other.
  // Prevents false positives when a document merely references a license name in
  // a compatibility paragraph while its own version marker sits elsewhere.
  function near (a, b, window = 500) {
    const i = t.indexOf(a);
    if (i === -1) return false;
    const j = t.indexOf(b, Math.max(0, i - window));
    return j !== -1 && Math.abs(j - i) <= window;
  }

  if (t.includes('permission is hereby granted, free of charge')) return 'MIT';
  if (near('apache license', 'version 2.0')) return 'Apache-2.0';
  // Check LGPL and AGPL before GPL — LGPL/AGPL files reference "GNU General Public License" internally
  if (near('gnu lesser general public license', 'version 3')) return 'LGPL-3.0';
  if (near('gnu lesser general public license', 'version 2.1')) return 'LGPL-2.1';
  if (near('gnu lesser general public license', 'version 2')) return 'LGPL-2.0';
  if (t.includes('gnu affero general public license')) return 'AGPL-3.0';
  if (near('gnu general public license', 'version 3')) return 'GPL-3.0';
  if (near('gnu general public license', 'version 2')) return 'GPL-2.0';
  if (near('mozilla public license', '2.0')) return 'MPL-2.0';
  // \bisc\b guards against substrings in words like "discharge" or "hospice"
  if (/\bisc license\b/i.test(t) || (/\bisc\b/i.test(t) && t.includes('permission to use, copy'))) return 'ISC';
  if (t.includes('redistribution and use in source and binary forms') && t.includes('neither the name')) return 'BSD-3-Clause';
  if (t.includes('redistribution and use in source and binary forms')) return 'BSD-2-Clause';
  if (t.includes('this is free and unencumbered software released into the public domain')) return 'Unlicense';
  if (t.includes('do what the fuck you want to public license')) return 'WTFPL';
  if (near('creative commons', 'cc0')) return 'CC0-1.0';

  return null;
}

/**
 * Extract copyright notice line(s) from license file text.
 * Returns a newline-joined string of all matching lines, or '' if none found.
 * @param {string} text
 * @returns {string}
 */
function extractCopyright (text) {
  if (!text) return '';
  const result = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!(/copyright/i.test(trimmed) || /©/.test(trimmed))) continue;
    // "the above copyright notice" references a prior assertion — it is boilerplate,
    // not a copyright holder line (appears in MIT permission notice and BSD clauses).
    if (/\bthe above copyright\b/i.test(trimmed)) continue;
    result.push(trimmed);
  }
  return result.join('\n');
}

module.exports = { normalizeLicense, categorize, detectLicenseFromText, extractCopyright, SPDX_ALIASES, LICENSE_CATEGORIES };
