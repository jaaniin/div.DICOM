/**
 * DICOM Data Formatters
 */

export const formatDicomDate = (dateStr?: string): string => {
  if (!dateStr || dateStr.includes('Unknown') || dateStr.length < 8) return dateStr || 'Unknown';
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
};

export const formatDicomTime = (timeStr?: string): string => {
  if (!timeStr || timeStr.includes('Unknown') || timeStr.length < 6) return timeStr || '';
  return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
};

export const formatNumber = (numStr?: string | number, decimals: number = 3): string => {
  if (numStr === undefined || numStr === null || numStr === 'Unknown') return String(numStr ?? 'Unknown');
  const num = typeof numStr === 'string' ? parseFloat(numStr) : numStr;
  if (isNaN(num)) return String(numStr);
  return parseFloat(num.toFixed(decimals)).toString();
};
