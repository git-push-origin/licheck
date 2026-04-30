import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const licheck = require('./index.js');

export const { check, format, print, validate, utils } = licheck;
export default licheck;
