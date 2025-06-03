import React from 'react';
import CloudContainer from './CloudContainer';

/**
 * Props for the main Cloud component.
 */
interface CloudProps {
  /** Word frequency data for the cloud */
  wordFrequency: { text: string; value: number }[];
  /** Optional: loading state flag */
  isLoading?: boolean;
  /** Optional: loading progress (0-100) */
  progress?: number;
}

/**
 * Main Cloud entry component.
 * Forwards props to CloudContainer for rendering.
 *
 * @param props - CloudProps
 * @returns The word cloud visualization.
 */
const Cloud: React.FC<CloudProps> = (props) => {
  return <CloudContainer {...props} />;
};

export default Cloud;