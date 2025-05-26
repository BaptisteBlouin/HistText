import React from 'react';
import CloudContainer from './CloudContainer';

interface CloudProps {
  wordFrequency: { text: string; value: number }[];
  isLoading?: boolean;
  progress?: number;
}

const Cloud: React.FC<CloudProps> = (props) => {
  return <CloudContainer {...props} />;
};

export default Cloud;