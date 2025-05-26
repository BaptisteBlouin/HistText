import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { LoadingButton } from '../../../components/ui';

interface EmptyStateComponentProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  };
  variant?: 'default' | 'minimal';
  size?: 'small' | 'medium' | 'large';
}

const EmptyStateComponent: React.FC<EmptyStateComponentProps> = ({ 
  icon, 
  title, 
  description, 
  action,
  variant = 'default',
  size = 'medium'
}) => {
  const theme = useTheme();

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          py: 4,
          iconSize: 48,
          titleVariant: 'h6' as const,
          descMaxWidth: 300
        };
      case 'large':
        return {
          py: 12,
          iconSize: 96,
          titleVariant: 'h4' as const,
          descMaxWidth: 600
        };
      default:
        return {
          py: 8,
          iconSize: 80,
          titleVariant: 'h5' as const,
          descMaxWidth: 400
        };
    }
  };

  const getVariantStyles = () => {
    if (variant === 'minimal') {
      return {
        background: 'transparent'
      };
    }
    return {
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      borderRadius: 2,
      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
    };
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  return (
    <Box sx={{ 
      textAlign: 'center', 
      ...variantStyles,
      ...sizeStyles
    }}>
      <Box sx={{ 
        fontSize: sizeStyles.iconSize, 
        color: 'text.secondary', 
        mb: 3, 
        opacity: 0.6,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
      }}>
        {icon}
      </Box>
      
      <Typography 
        variant={sizeStyles.titleVariant}
        color="text.secondary" 
        gutterBottom 
        sx={{ fontWeight: 600 }}
      >
        {title}
      </Typography>
      
      <Typography 
        variant="body1" 
        color="text.secondary" 
        sx={{ 
          maxWidth: sizeStyles.descMaxWidth, 
          mx: 'auto', 
          mb: action ? 3 : 0,
          lineHeight: 1.6
        }}
      >
        {description}
      </Typography>
      
      {action && (
        <LoadingButton
          variant="outlined" 
          startIcon={action.icon}
          onClick={action.onClick}
          sx={{ 
            borderColor: '#667eea',
            color: '#667eea',
            '&:hover': { 
              borderColor: '#5a6fd8',
              backgroundColor: 'rgba(102, 126, 234, 0.1)'
            }
          }}
        >
          {action.label}
        </LoadingButton>
      )}
    </Box>
  );
};

export default React.memo(EmptyStateComponent);