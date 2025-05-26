import React from 'react';
import EmptyStateComponent from './EmptyStateComponent';

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

const EmptyState: React.FC<EmptyStateProps> = (props) => {
  return <EmptyStateComponent {...props} />;
};

export default EmptyState;