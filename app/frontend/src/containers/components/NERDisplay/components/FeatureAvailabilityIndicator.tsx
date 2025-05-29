// app/frontend/src/containers/components/NERDisplay/components/FeatureAvailabilityIndicator.tsx
import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { 
  CheckCircle, 
  Schedule, 
  Warning,
  Info
} from '@mui/icons-material';

interface FeatureAvailabilityIndicatorProps {
  feature: string;
  available: boolean;
  loading?: boolean;
  limited?: boolean;
  description?: string;
}

const FeatureAvailabilityIndicator: React.FC<FeatureAvailabilityIndicatorProps> = ({
  feature,
  available,
  loading = false,
  limited = false,
  description
}) => {
  const getChipProps = () => {
    if (loading) {
      return {
        label: `${feature} (Loading...)`,
        color: 'default' as const,
        variant: 'outlined' as const,
        icon: <Schedule />
      };
    }
    
    if (limited) {
      return {
        label: `${feature} (Limited)`,
        color: 'warning' as const,
        variant: 'outlined' as const,
        icon: <Warning />
      };
    }
    
    if (available) {
      return {
        label: `${feature} ✓`,
        color: 'success' as const,
        variant: 'filled' as const,
        icon: <CheckCircle />
      };
    }
    
    return {
      label: `${feature} (Unavailable)`,
      color: 'error' as const,
      variant: 'outlined' as const,
      icon: <Info />
    };
  };

  const chipProps = getChipProps();
  const chip = <Chip size="small" {...chipProps} />;

  if (description) {
    return (
      <Tooltip title={description} placement="top">
        {chip}
      </Tooltip>
    );
  }

  return chip;
};

export default React.memo(FeatureAvailabilityIndicator);