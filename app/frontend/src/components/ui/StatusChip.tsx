import React from 'react';
import { Chip, ChipProps } from '@mui/material';

interface StatusChipProps extends Omit<ChipProps, 'color'> {
  status: 'loading' | 'success' | 'error' | 'warning' | 'info' | 'default';
  count?: number;
}

const STATUS_COLORS = {
  loading: 'primary',
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
  default: 'default'
} as const;

const StatusChip: React.FC<StatusChipProps> = ({ 
  status, 
  count, 
  label, 
  ...props 
}) => {
  const displayLabel = count !== undefined ? `${label} (${count})` : label;
  
  return (
    <Chip
      {...props}
      label={displayLabel}
      color={STATUS_COLORS[status]}
      size="small"
    />
  );
};

export default React.memo(StatusChip);