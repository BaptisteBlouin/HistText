import { useMemo } from "react";
import config from "../../../../../config.json";

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

/**
 * Processes raw NER data into structured entities and computes statistics.
 * Memoized for performance optimization.
 *
 * @param nerData Raw NER data keyed by document ID.
 * @returns Object containing entities array and aggregated statistics.
 */
const processNERData = (nerData: Record<string, NerData>) => {
  const entities = [];
  const stats = {
    totalEntities: 0,
    byLabel: {} as Record<
      string,
      { count: number; originalLabel: string; color: string }
    >,
    byDocument: {} as Record<string, number>,
    avgConfidence: 0,
    confidenceDistribution: { high: 0, medium: 0, low: 0 },
  };
  type NerLabel = keyof typeof config.NERLABELS2FULL;

  for (const [docId, data] of Object.entries(nerData)) {
    if (!Array.isArray(data.t)) continue;

    const docEntityCount = data.t.length;
    stats.byDocument[docId] = docEntityCount;
    stats.totalEntities += docEntityCount;

    for (let idx = 0; idx < data.t.length; idx++) {
      const confidence = data.c[idx];
      const label = data.l[idx];
      const labelFull =
        label in config.NERLABELS2FULL
          ? config.NERLABELS2FULL[label as NerLabel]
          : label;
      const color =
        label in config.NER_LABELS_COLORS
          ? config.NER_LABELS_COLORS[label as NerLabel]
          : "#grey";

      entities.push({
        id: docId,
        text: data.t[idx],
        label,
        labelFull,
        start: data.s[idx],
        end: data.e[idx],
        confidence,
        color,
        textLower: data.t[idx].toLowerCase(),
        confidenceLevel:
          confidence > 0.8 ? "high" : confidence > 0.6 ? "medium" : "low",
      });

      if (!stats.byLabel[labelFull]) {
        stats.byLabel[labelFull] = { count: 0, originalLabel: label, color };
      }
      stats.byLabel[labelFull].count++;

      if (confidence > 0.8) stats.confidenceDistribution.high++;
      else if (confidence > 0.6) stats.confidenceDistribution.medium++;
      else stats.confidenceDistribution.low++;
    }
  }

  stats.avgConfidence =
    entities.length > 0
      ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
      : 0;

  return { entities, stats };
};

/**
 * Custom React hook to memoize NER data processing.
 *
 * @param nerData Raw NER data keyed by document ID.
 * @returns Processed entities and statistics.
 */
export const useNERData = (nerData: Record<string, NerData>) => {
  const processedData = useMemo(() => processNERData(nerData), [nerData]);

  return {
    entities: processedData.entities,
    stats: processedData.stats,
    processedData,
  };
};
