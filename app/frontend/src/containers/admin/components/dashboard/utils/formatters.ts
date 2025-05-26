export const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    return num.toLocaleString();
  };
  
  export const formatBytes = (bytes: number | undefined | null): string => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  export const formatPercentage = (ratio: number | undefined | null): string => {
    if (ratio === undefined || ratio === null || isNaN(ratio)) {
      return '0.0%';
    }
    return (ratio * 100).toFixed(1) + '%';
  };