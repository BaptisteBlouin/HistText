import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material';
import { MoreVert } from '@mui/icons-material';

/**
 * Describes a single action within the ActionMenu.
 * - `id`: Unique key for the menu item.
 * - `label`: Visible text for the menu item.
 * - `icon`: Optional icon to display.
 * - `onClick`: Action to execute when selected.
 * - `disabled`: Optionally disables this menu item.
 * - `divider`: Optionally renders a divider after this item.
 */
interface ActionMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
}

/**
 * Props for ActionMenu component.
 * - `items`: Array of ActionMenuItem definitions.
 * - `tooltip`: Tooltip text for the trigger icon.
 * - `icon`: Custom icon for menu trigger (defaults to MoreVert).
 */
interface ActionMenuProps {
  items: ActionMenuItem[];
  tooltip?: string;
  icon?: React.ReactNode;
}

/**
 * Renders a menu triggered by an icon, displaying a list of actions.
 * Designed for contextual menus and item-level operations.
 */
const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  tooltip = "More actions",
  icon = <MoreVert />
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  /**
   * Opens the menu anchored to the icon.
   */
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * Closes the menu.
   */
  const handleClose = () => {
    setAnchorEl(null);
  };

  /**
   * Executes the menu item's action and closes the menu.
   */
  const handleMenuItemClick = (action: () => void) => {
    action();
    handleClose();
  };

  return (
    <>
      <Tooltip title={tooltip}>
        <IconButton onClick={handleClick}>
          {icon}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.id}
            onClick={() => handleMenuItemClick(item.onClick)}
            disabled={item.disabled}
            divider={item.divider}
          >
            {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default React.memo(ActionMenu);
