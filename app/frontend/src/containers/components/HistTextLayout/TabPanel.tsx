import React from "react";
import { Box, Fade } from "@mui/material";

/**
 * Props for the TabPanel component.
 *
 * @property children - Content to render in the panel.
 * @property value - Currently active tab index.
 * @property index - The index of this panel.
 */
interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

/**
 * Renders a single tab panel, conditionally visible based on the active tab.
 * Provides a fade-in animation for the content when active.
 */
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    style={{ height: value === index ? "auto" : 0 }}
  >
    {value === index && (
      <Fade in={true} timeout={300}>
        <Box sx={{ height: "100%" }}>{children}</Box>
      </Fade>
    )}
  </div>
);

export default React.memo(TabPanel);
