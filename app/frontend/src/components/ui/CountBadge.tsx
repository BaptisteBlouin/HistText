import React from 'react';
import { Badge, BadgeProps } from '@mui/material';

/**
 * Props for CountBadge component.
 * - `count`: Number to display in the badge.
 * - `maxCount`: Maximum number shown before displaying as "max+".
 * - `showZero`: If true, shows the badge when count is zero.
 * - All other MUI BadgeProps are supported.
 */
interface CountBadgeProps extends BadgeProps {
  count?: number;
  maxCount?: number;
  showZero?: boolean;
}

/**
 * Displays a badge for counts, hiding when count is zero (unless showZero is true).
 * Useful for notifications, unread messages, or item counts.
 */
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
