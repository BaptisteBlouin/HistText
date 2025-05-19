import React from 'react';
import WordCloud from 'react-d3-cloud';
import { scaleLinear } from 'd3-scale';

interface CloudProps {
  wordFrequency: { text: string; value: number }[];
}

const Cloud: React.FC<CloudProps> = ({ wordFrequency }) => {
  const values = wordFrequency.map(w => Math.log2(w.value + 1));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  const scale = scaleLinear().domain([minVal, maxVal]).range([12, 60]);

  return (
    <div style={{ width: '100%', height: '70vh' }}>
      {wordFrequency.length > 0 ? (
        <WordCloud
          data={wordFrequency}
          fontSize={w => scale(Math.log2(w.value + 1))}
          padding={2}
          width={600}
          height={240}
        />
      ) : (
        <p>No data available to generate the word cloud.</p>
      )}
    </div>
  );
};

export default Cloud;
