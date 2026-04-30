import type { LicenseCategory } from './license';

export interface PackageInfo {
  name: string;
  version: string;
  license: string;
  category: LicenseCategory;
  licenseFile: string | null;
  licenseSource: 'package.json' | 'license-file-text' | 'license-file' | 'clarification' | 'none';
  description: string;
  homepage: string;
  path: string;
  private: boolean;
  copyright: string;
  noticeFile: string | null;
}

export interface ScanSummary {
  total: number;
  licenses: Record<string, number>;
  categories: Record<LicenseCategory, number>;
}

export interface ScanResult {
  packages: PackageInfo[];
  summary: ScanSummary;
}

export interface ClarificationEntry {
  license?: string;
  licenseFile?: string;
  checksum?: string;
  licenseStart?: string;
  licenseEnd?: string;
}

export interface ScanOptions {
  start?: string;
  production?: boolean;
  development?: boolean;
  exclude?: Array<string | RegExp>;
  excludePackagesStartingWith?: Array<string | RegExp>;
  includePackages?: Array<string | RegExp>;
  excludeLicenses?: Array<string | RegExp>;
  onlyLicenses?: Array<string | RegExp>;
  failOn?: boolean;
  failOnLicenses?: Array<string | RegExp>;
  depth?: number;
  excludePrivate?: boolean;
  noPeer?: boolean;
  noOptional?: boolean;
  clarificationsFile?: string;
}

export function scan(options?: ScanOptions): ScanResult;
export function buildPackageInfo(pkgDir: string): PackageInfo | null;
export function collectPackageDirs(nodeModulesDir: string, visited?: Set<string>, depth?: number, maxDepth?: number): string[];
export function matchesLicenseList(license: string, list: Array<string | RegExp>): boolean;
