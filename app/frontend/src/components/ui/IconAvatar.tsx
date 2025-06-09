import React from "react";
import { Avatar, AvatarProps } from "@mui/material";

/**
 * Props for IconAvatar component.
 * - `icon`: Optional React node to render as avatar content.
 * - `text`: If provided and no icon, initials will be shown.
 * - `color`: MUI theme color for background (default: primary).
 * - All MUI AvatarProps supported.
 */
interface IconAvatarProps extends AvatarProps {
  icon?: React.ReactNode;
  text?: string;
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
}

/**
 * Displays an Avatar with an icon or initials, and colored background.
 * - Shows icon if provided, otherwise generates initials from text.
 * - Background color uses MUI theme palette by `color` prop.
 */
const IconAvatar: React.FC<IconAvatarProps> = ({
  icon,
  text,
  color = "primary",
  sx,
  ...props
}) => {
  /**
   * Generates up to two initials from a given text.
   */
  const getInitials = (text: string) => {
    return text
      .split(/[-_\s]/)
      .map((word) => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  };

  return (
    <Avatar
      {...props}
      sx={{
        bgcolor: `${color}.main`,
        color: "white",
        fontWeight: 600,
        ...sx,
      }}
    >
      {icon || (text ? getInitials(text) : "?")}
    </Avatar>
  );
};

export default React.memo(IconAvatar);
