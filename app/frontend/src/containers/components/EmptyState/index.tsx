import React from "react";
import EmptyStateComponent from "./EmptyStateComponent";

/**
 * Props for the EmptyState component.
 *
 * @property icon - The icon displayed in the empty state.
 * @property title - The main title text for the empty state.
 * @property description - Supporting description for the empty state.
 * @property action - Optional action button configuration.
 */
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  };
}

/**
 * Shorthand wrapper for EmptyStateComponent with simplified props.
 * Use this for quickly displaying an empty state with icon, title, description, and optional action.
 */
const EmptyState: React.FC<EmptyStateProps> = (props) => {
  return <EmptyStateComponent {...props} />;
};

export default EmptyState;
