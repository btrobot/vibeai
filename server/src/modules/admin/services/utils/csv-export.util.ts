/**
 * CSV Export Utility
 * Handles CSV generation with UTF-8 BOM for Excel compatibility
 */

export interface CsvExportOptions {
  delimiter?: string;
  includeBOM?: boolean;
}

/**
 * Generate CSV string from array of objects
 */
export function generateCsv<T extends Record<string, any>>(
  data: T[],
  options: CsvExportOptions = {}
): string {
  const { delimiter = ',', includeBOM = true } = options;

  if (data.length === 0) {
    return includeBOM ? '﻿' : '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Build CSV rows
  const rows = data.map(obj => {
    return headers.map(header => {
      const value = obj[header];
      // Handle null, undefined, and objects
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      // Escape quotes and wrap in quotes if contains delimiter or quote
      const stringValue = String(value);
      if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(delimiter);
  });

  // Combine headers and rows
  const csvContent = [headers.join(delimiter), ...rows].join('\n');

  // Add UTF-8 BOM for Excel compatibility
  return includeBOM ? `﻿${csvContent}` : csvContent;
}

/**
 * Convert object keys to CSV headers (camelCase to Title Case)
 */
export function toCsvHeaders(obj: Record<string, any>): string[] {
  return Object.keys(obj).map(key => 
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  );
}

/**
 * Escape CSV value
 */
export function escapeCsvValue(value: any, delimiter: string = ','): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // If value contains delimiter, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}
