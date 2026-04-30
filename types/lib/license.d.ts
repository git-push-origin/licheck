export type LicenseCategory =
  | 'permissive'
  | 'weak-copyleft'
  | 'strong-copyleft'
  | 'public-domain'
  | 'unknown';

export const SPDX_ALIASES: Record<string, string>;
export const LICENSE_CATEGORIES: Record<Exclude<LicenseCategory, 'unknown'>, string[]>;

export function normalizeLicense(raw: string | { type?: string; name?: string } | string[]): string;
export function categorize(license: string): LicenseCategory;
export function detectLicenseFromText(text: string): string | null;
export function extractCopyright(text: string): string;
