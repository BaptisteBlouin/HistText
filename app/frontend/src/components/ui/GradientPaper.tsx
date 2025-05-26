import React from 'react';
import { Paper, PaperProps, alpha } from '@mui/material';

interface GradientPaperProps extends PaperProps {
  gradient?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  direction?: number;
}

const GRADIENTS = {
  primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  secondary: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  warning: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  error: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  info: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
};

const GradientPaper: React.FC<GradientPaperProps> = ({
  gradient,
  direction = 135,
  sx,
  ...props
}) => {
  const gradientStyle = gradient ? {
    background: GRADIENTS[gradient]
  } : {};

  return (
    <Paper
      {...props}
      sx={{
        ...gradientStyle,
        ...sx
      }}
    />
  );
};

export default React.memo(GradientPaper);