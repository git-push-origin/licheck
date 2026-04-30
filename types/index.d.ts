import type { ScanOptions, ScanResult, ScanSummary, PackageInfo } from './lib/scanner';
import type { LicenseCategory } from './lib/license';
import type { TextFormatOptions, JsonFormatOptions, MarkdownFormatOptions, SpdxFormatOptions } from './lib/reporter';

export type { ScanOptions, ScanResult, ScanSummary, PackageInfo, LicenseCategory, TextFormatOptions, JsonFormatOptions, MarkdownFormatOptions, SpdxFormatOptions };

export type OutputFormat = 'text' | 'json' | 'csv' | 'markdown' | 'md' | 'spdx';

export interface FormatOptions extends TextFormatOptions, JsonFormatOptions, MarkdownFormatOptions, SpdxFormatOptions {}

export function check(options?: ScanOptions): ScanResult;
export function format(result: ScanResult, fmt?: OutputFormat, opts?: FormatOptions): string;
export function print(options?: ScanOptions, fmt?: OutputFormat): ScanResult;
export function validate(disallowed: Array<string | RegExp>, options?: ScanOptions): PackageInfo[];

export const utils: {
  normalizeLicense(raw: string | { type?: string; name?: string } | string[]): string;
  categorize(license: string): LicenseCategory;
  detectLicenseFromText(text: string): string | null;
  extractCopyright(text: string): string;
  matchesLicenseList(license: string, list: Array<string | RegExp>): boolean;
};

declare const _default: {
  check: typeof check;
  format: typeof format;
  print: typeof print;
  validate: typeof validate;
  utils: typeof utils;
};
export default _default;
