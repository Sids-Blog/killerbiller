/**
 * CSV Export Utility
 * Provides functionality to export data to CSV files
 */

export interface CSVExportOptions<T = Record<string, unknown>> {
  filename: string;
  headers: string[];
  data: T[];
  transformData?: (row: T) => Record<string, unknown>;
}

export const exportToCSV = <T>({ filename, headers, data, transformData }: CSVExportOptions<T>) => {
  try {
    // Transform data if transformer function is provided
    const processedData = transformData ? data.map(transformData) : data;
    
    // Create timestamp for export
    const now = new Date();
    const timestamp = now.toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Create CSV content
    const csvContent = [
      // Export timestamp above the table
      `Exported on: ${timestamp}`,
      '',
      // Headers
      headers.join(','),
      // Data rows
      ...processedData.map(row => 
        headers.map(header => {
          const value = row[header] ?? '';
          // Escape quotes and wrap in quotes if value contains comma, quote, or newline
          const escapedValue = String(value).replace(/"/g, '""');
          return /[,"\n\r]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
        }).join(',')
      )
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      // Create detailed timestamp for filename
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
      link.setAttribute('download', `${filename}-${dateStr}-${timeStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw new Error('Failed to export CSV file');
  }
};

// Helper function to format currency
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '0.00';
  return amount.toFixed(2);
};

// Helper function to format date
export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN');
};

// Helper function to format datetime
export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN');
};