import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const lib = require('./reporter.js');

export const { toText, toJSON, toCSV, toMarkdown, toSPDX } = lib;
