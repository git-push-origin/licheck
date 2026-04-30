/**
 * Format helpers for rendering scan results in various output formats.
 */

const CATEGORY_EMOJI = {
  permissive: '✅',
  'weak-copyleft': '⚠️ ',
  'strong-copyleft': '🔴',
  'public-domain': '🆓',
  unknown: '❓'
};

// ─── Plain Text ───────────────────────────────────────────────────────────────

/**
 * Render results as a human-readable plain-text table.
 * @param {ScanResult} result
 * @param {object} opts
 * @param {boolean} opts.noColor     - Disable ANSI color codes
 * @param {boolean} opts.summaryOnly - Show only the summary section
 * @returns {string}
 */
function toText (result, opts = {}) {
  const { packages, summary } = result;
  const { noColor = false, summaryOnly = false } = opts;

  const disableColor = noColor || 'NO_COLOR' in process.env || !process.stdout.isTTY;

  const c = disableColor
    ? { bold: s => s, reset: '' }
    : { bold: s => `\x1b[1m${s}\x1b[0m`, reset: '\x1b[0m' };

  function pad (str, len) {
    const s = String(str);
    if (s.length > len) return s.slice(0, Math.max(0, len - 1)) + '…';
    return s.padEnd(len);
  }

  const summaryLines = [
    '',
    c.bold('Summary'),
    `  Total packages : ${summary.total}`,
    '',
    '  By category:',
    ...Object.entries(summary.categories)
      .filter(([, count]) => count > 0)
      .map(([cat, count]) => `    ${CATEGORY_EMOJI[cat]} ${pad(cat, 20)} ${count}`),
    '',
    '  By license:',
    ...Object.entries(summary.licenses)
      .sort((a, b) => b[1] - a[1])
      .map(([lic, count]) => `    ${pad(lic, 25)} ${count}`),
    ''
  ];

  if (summaryOnly) {
    return [c.bold('licheck — License Report'), ...summaryLines].join('\n');
  }

  let maxName = 10;
  let maxVer = 9;
  let maxLic = 10;

  for (const p of packages) {
    if (p.name.length > maxName) maxName = p.name.length;
    if (p.version.length > maxVer) maxVer = p.version.length;
    if (p.license.length > maxLic) maxLic = p.license.length;
  }
  const colWidth = {
    name: Math.min(40, maxName + 2),
    version: Math.min(15, maxVer + 2),
    license: Math.min(60, maxLic + 2),
    cat: 18
  };

  const divider = '─'.repeat(colWidth.name + colWidth.version + colWidth.license + colWidth.cat + 5);

  const header = [
    pad('Package', colWidth.name),
    pad('Version', colWidth.version),
    pad('License', colWidth.license),
    pad('Category', colWidth.cat)
  ].join(' │ ');

  const rows = packages.map(p => {
    const cat = `${CATEGORY_EMOJI[p.category]} ${p.category}`;
    return [
      pad(p.name, colWidth.name),
      pad(p.version, colWidth.version),
      pad(p.license, colWidth.license),
      pad(cat, colWidth.cat)
    ].join(' │ ');
  });

  return [
    '',
    c.bold('licheck — License Report'),
    divider,
    c.bold(header),
    divider,
    ...rows,
    divider,
    ...summaryLines
  ].join('\n');
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

/**
 * Render results as a JSON string.
 * @param {ScanResult} result
 * @param {object} opts
 * @param {boolean} opts.pretty - Pretty-print (default: true)
 * @param {boolean} opts.summaryOnly - Only output the summary
 * @returns {string}
 */
function toJSON (result, opts = {}) {
  const { pretty = true, summaryOnly = false } = opts;
  const data = summaryOnly ? result.summary : result;
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

/**
 * Escape a value for CSV output.
 * @param {string} val
 * @returns {string}
 */
function csvEscape (val) {
  const str = String(val == null ? '' : val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Render results as CSV.
 * @param {ScanResult} result
 * @returns {string}
 */
function toCSV (result) {
  const headers = ['name', 'version', 'license', 'category', 'licenseSource', 'description', 'homepage', 'path', 'copyright', 'noticeFile'];
  const rows = [headers.map(csvEscape).join(',')];
  for (const p of result.packages) {
    rows.push(headers.map(h => csvEscape(p[h])).join(','));
  }
  return rows.join('\n');
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

function mdCell (val) {
  return String(val == null ? '' : val).replace(/\|/g, '\\|');
}

/**
 * Render results as a Markdown table.
 * @param {ScanResult} result
 * @param {object} opts
 * @param {boolean} opts.summaryOnly - Omit the packages table
 * @returns {string}
 */
function toMarkdown (result, opts = {}) {
  const { packages, summary } = result;
  const { summaryOnly = false } = opts;

  const licenseList = Object.entries(summary.licenses)
    .sort((a, b) => b[1] - a[1])
    .map(([lic, count]) => `- **${lic}**: ${count}`)
    .join('\n');

  const summarySection = [
    '## License Distribution',
    '',
    licenseList,
    '',
    '## Category Breakdown',
    '',
    ...Object.entries(summary.categories)
      .filter(([, c]) => c > 0)
      .map(([cat, count]) => `- ${CATEGORY_EMOJI[cat]} **${cat}**: ${count}`),
    ''
  ];

  if (summaryOnly) {
    return [
      '# License Report',
      '',
      `> Total packages scanned: **${summary.total}**`,
      '',
      ...summarySection
    ].join('\n');
  }

  const tableRows = packages.map(p =>
    `| ${mdCell(p.name)} | ${mdCell(p.version)} | ${mdCell(p.license)} | ${mdCell(p.category)} |`
  );

  return [
    '# License Report',
    '',
    `> Total packages scanned: **${summary.total}**`,
    '',
    '## Packages',
    '',
    '| Package | Version | License | Category |',
    '|---------|---------|---------|----------|',
    ...tableRows,
    '',
    ...summarySection
  ].join('\n');
}

// ─── SPDX ─────────────────────────────────────────────────────────────────────

/**
 * Render results as an SPDX-compatible bill of materials (JSON format).
 * https://spdx.github.io/spdx-spec/
 * @param {ScanResult} result
 * @param {object} opts
 * @param {string} opts.projectName
 * @returns {string}
 */
function toSPDX (result, opts = {}) {
  const { projectName = 'unnamed-project', created, namespaceSeed } = opts;
  const createdTs = created || new Date().toISOString();
  const nsSeed = namespaceSeed !== undefined ? namespaceSeed : Date.now();

  const doc = {
    SPDXID: 'SPDXRef-DOCUMENT',
    spdxVersion: 'SPDX-2.3',
    creationInfo: {
      created: createdTs,
      creators: ['Tool: licheck']
    },
    name: projectName,
    dataLicense: 'CC0-1.0',
    documentNamespace: `https://spdx.org/spdxdocs/${projectName}-${nsSeed}`,
    packages: result.packages.map((p, i) => ({
      SPDXID: `SPDXRef-Package-${i}`,
      name: p.name,
      versionInfo: p.version,
      licenseConcluded: p.license,
      licenseDeclared: p.license,
      copyrightText: p.copyright || 'NOASSERTION',
      downloadLocation: p.homepage || 'NOASSERTION'
    }))
  };

  return JSON.stringify(doc, null, 2);
}

module.exports = { toText, toJSON, toCSV, toMarkdown, toSPDX };
