import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const lib = require('./scanner.js');

export const { scan, buildPackageInfo, collectPackageDirs, matchesLicenseList } = lib;
