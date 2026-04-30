import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const lib = require('./license.js');

export const { normalizeLicense, categorize, detectLicenseFromText, extractCopyright, SPDX_ALIASES, LICENSE_CATEGORIES } = lib;
