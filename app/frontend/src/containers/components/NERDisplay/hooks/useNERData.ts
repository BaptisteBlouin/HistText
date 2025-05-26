import { useMemo } from 'react';
import config from '../../../../../config.json';

interface Annotation {
  t: string;
  l: string[];
  s: number;
  e: number;
  c: number;
}

interface NerData {
  id: string;
  t: string[];
  l: string[];
  s: number[];
  e: number[];
  c: number[];
}

// Memoized entity processing for better performance
const processNERData = (nerData: Record<string, NerData>) => {
  const entities = [];
  const stats = {
    totalEntities: 0,
    byLabel: {} as Record<string, { count: number; originalLabel: string; color: string }>,
    byDocument: {} as Record<string, number>,
    avgConfidence: 0,
    confidenceDistribution: { high: 0, medium: 0, low: 0 }
  };

  // Process all entities with optimized loop
  for (const [docId, data] of Object.entries(nerData)) {
    if (!Array.isArray(data.t)) continue;
    
    const docEntityCount = data.t.length;
    stats.byDocument[docId] = docEntityCount;
    stats.totalEntities += docEntityCount;

    for (let idx = 0; idx < data.t.length; idx++) {
      const label = data.l[idx];
      const confidence = data.c[idx];
      const labelFull = config.NERLABELS2FULL[label] || label;
      const color = config.NER_LABELS_COLORS[label] || '#grey';

      entities.push({
        id: docId,
        text: data.t[idx],
        label,
        labelFull,
        start: data.s[idx],
        end: data.e[idx],
        confidence,
        color,
        // Pre-calculate for sorting
        textLower: data.t[idx].toLowerCase(),
        confidenceLevel: confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low'
      });

      // Update stats
      if (!stats.byLabel[labelFull]) {
        stats.byLabel[labelFull] = { count: 0, originalLabel: label, color };
      }
      stats.byLabel[labelFull].count++;

      // Confidence distribution
      if (confidence > 0.8) stats.confidenceDistribution.high++;
      else if (confidence > 0.6) stats.confidenceDistribution.medium++;
      else stats.confidenceDistribution.low++;
    }
  }

  // Calculate average confidence
  stats.avgConfidence = entities.length > 0 
    ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length 
    : 0;

  return { entities, stats };
};

export const useNERData = (nerData: Record<string, NerData>) => {
  const processedData = useMemo(() => processNERData(nerData), [nerData]);
  
  return {
    entities: processedData.entities,
    stats: processedData.stats,
    processedData
  };
};