import React from 'react';
import { Chip, ChipProps } from '@mui/material';

/**
 * Props for StatusChip component.
 * - `status`: Visual state indicator (affects chip color).
 * - `count`: Optional count to append to the label.
 * - All ChipProps (except 'color', which is managed by status) are supported.
 */
interface StatusChipProps extends Omit<ChipProps, 'color'> {
  status: 'loading' | 'success' | 'error' | 'warning' | 'info' | 'default';
  count?: number;
}

/**
 * Maps status values to MUI color values.
 */
const STATUS_COLORS = {
  loading: 'primary',
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
  default: 'default'
} as const;

/**
 * Displays a colored Chip for status indication, optionally with a count.
 * - Color is determined by the status prop.
 * - If count is given, it's shown in parentheses after the label.
 */
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
