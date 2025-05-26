import React from 'react';
import { Avatar, AvatarProps } from '@mui/material';

interface IconAvatarProps extends AvatarProps {
  icon?: React.ReactNode;
  text?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

const IconAvatar: React.FC<IconAvatarProps> = ({
  icon,
  text,
  color = 'primary',
  sx,
  ...props
}) => {
  const getInitials = (text: string) => {
    return text
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  return (
    <Avatar
      {...props}
      sx={{
        bgcolor: `${color}.main`,
        color: 'white',
        fontWeight: 600,
        ...sx
      }}
    >
      {icon || (text ? getInitials(text) : '?')}
    </Avatar>
  );
};

export default React.memo(IconAvatar);