import React from 'react';
import { Badge, BadgeProps } from '@mui/material';

interface CountBadgeProps extends BadgeProps {
  count?: number;
  maxCount?: number;
  showZero?: boolean;
}

const CountBadge: React.FC<CountBadgeProps> = ({
  count = 0,
  maxCount = 999,
  showZero = false,
  children,
  ...props
}) => {
  const shouldShow = count > 0 || showZero;
  
  return (
    <Badge
      {...props}
      badgeContent={shouldShow ? count : undefined}
      max={maxCount}
      invisible={!shouldShow}
    >
      {children}
    </Badge>
  );
};

export default React.memo(CountBadge);