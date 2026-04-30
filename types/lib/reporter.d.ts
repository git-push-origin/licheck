import type { ScanResult } from './scanner';

export interface TextFormatOptions {
  noColor?: boolean;
  summaryOnly?: boolean;
}

export interface JsonFormatOptions {
  pretty?: boolean;
  summaryOnly?: boolean;
}

export interface MarkdownFormatOptions {
  summaryOnly?: boolean;
}

export interface SpdxFormatOptions {
  projectName?: string;
  /** ISO 8601 timestamp for creationInfo.created. Defaults to current time. */
  created?: string;
  /** Suffix appended to the documentNamespace URL. Defaults to Date.now(). Pass a fixed value for reproducible output. */
  namespaceSeed?: string | number;
}

export function toText(result: ScanResult, opts?: TextFormatOptions): string;
export function toJSON(result: ScanResult, opts?: JsonFormatOptions): string;
export function toCSV(result: ScanResult): string;
export function toMarkdown(result: ScanResult, opts?: MarkdownFormatOptions): string;
export function toSPDX(result: ScanResult, opts?: SpdxFormatOptions): string;
