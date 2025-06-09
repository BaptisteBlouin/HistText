import {
  LightEntity,
  EntityGroup,
  DocumentStats,
  EntityCooccurrence,
} from "../types/ner-types";

/**
 * Class containing static methods for computing statistical distributions
 * and scores related to Named Entity Recognition data.
 */
export class StatisticsComputer {
  /**
   * Computes confidence distribution of entities in defined confidence ranges.
   *
   * @param entities - Array of entities to analyze
   * @returns Array of confidence range objects with counts and percentages
   */
  static computeConfidenceDistribution(entities: LightEntity[]) {
    const ranges = [
      { min: 0.9, max: 1.0, label: "90-100%" },
      { min: 0.8, max: 0.89, label: "80-89%" },
      { min: 0.7, max: 0.79, label: "70-79%" },
      { min: 0.6, max: 0.69, label: "60-69%" },
      { min: 0.5, max: 0.59, label: "50-59%" },
      { min: 0.0, max: 0.49, label: "0-49%" },
    ];

    return ranges.map((range) => {
      const count = entities.filter(
        (e) => e.confidence >= range.min && e.confidence <= range.max,
      ).length;
      return {
        range: range.label,
        count,
        percentage: (count / entities.length) * 100,
      };
    });
  }

  /**
   * Computes distribution of entity lengths within entity groups.
   *
   * @param entityGroups - Map of entity groups keyed by unique identifiers
   * @returns Array of length distribution objects sorted by length, limited to 30 entries
   */
  static computeLengthDistribution(entityGroups: Map<string, EntityGroup>) {
    const lengthCounts = new Map<number, number>();

    entityGroups.forEach((group) => {
      const length = group.displayText.length;
      lengthCounts.set(
        length,
        (lengthCounts.get(length) || 0) + group.totalCount,
      );
    });

    const total = Array.from(lengthCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    return Array.from(lengthCounts.entries())
      .map(([length, count]) => ({
        length,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => a.length - b.length)
      .slice(0, 30);
  }

  /**
   * Computes statistics for each document including entity counts, unique entities,
   * average confidence, entity types, and top entities by count.
   *
   * @param entities - Array of entities to analyze
   * @returns Array of document-level statistics
   */
  static computeDocumentStats(entities: LightEntity[]): DocumentStats[] {
    const docStats = new Map<
      string,
      {
        entityCount: number;
        uniqueEntities: Set<string>;
        confidenceSum: number;
        entityTypes: Map<string, number>;
        entityCounts: Map<string, number>;
      }
    >();

    entities.forEach((entity) => {
      if (!docStats.has(entity.documentId)) {
        docStats.set(entity.documentId, {
          entityCount: 0,
          uniqueEntities: new Set(),
          confidenceSum: 0,
          entityTypes: new Map(),
          entityCounts: new Map(),
        });
      }

      const stat = docStats.get(entity.documentId)!;
      stat.entityCount++;
      stat.confidenceSum += entity.confidence;
      stat.uniqueEntities.add(entity.normalizedText);

      const currentTypeCount = stat.entityTypes.get(entity.labelFull) || 0;
      stat.entityTypes.set(entity.labelFull, currentTypeCount + 1);

      const currentEntityCount = stat.entityCounts.get(entity.text) || 0;
      stat.entityCounts.set(entity.text, currentEntityCount + 1);
    });

    return Array.from(docStats.entries()).map(([docId, stat]) => {
      const topEntities = Array.from(stat.entityCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([text, count]) => ({ text, count }));

      const entityTypes = Object.fromEntries(stat.entityTypes.entries());

      return {
        documentId: docId,
        entityCount: stat.entityCount,
        uniqueEntityCount: stat.uniqueEntities.size,
        averageConfidence: stat.confidenceSum / stat.entityCount,
        entityTypes,
        topEntities,
      };
    });
  }

  /**
   * Computes centrality scores for top entities based on their co-occurrence connections.
   *
   * @param topEntities - Array of top entities with counts
   * @param cooccurrences - Array of co-occurrence data between entities
   * @returns Array of entities with centrality scores and connection counts
   */
  static computeCentralityScores(
    topEntities: Array<{
      text: string;
      count: number;
      documents: number;
      frequency: number;
    }>,
    cooccurrences: EntityCooccurrence[],
  ) {
    return topEntities
      .slice(0, 20)
      .map((entity) => {
        const connections = cooccurrences.filter(
          (cooc) =>
            cooc.entity1 === entity.text || cooc.entity2 === entity.text,
        ).length;

        return {
          entity: entity.text,
          score: connections / Math.max(topEntities.length - 1, 1),
          connections,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Computes anomaly scores for documents based on entity counts, diversity, and confidence.
   *
   * @param documentStats - Array of document statistics
   * @returns Array of documents flagged as anomalies with scores and reasons
   */
  static computeAnomalyScores(
    documentStats: DocumentStats[],
  ): Array<{ documentId: string; score: number; reason: string }> {
    if (documentStats.length === 0) return [];

    const avgEntitiesPerDoc =
      documentStats.reduce((sum, doc) => sum + doc.entityCount, 0) /
      documentStats.length;
    const avgUniqueEntitiesPerDoc =
      documentStats.reduce((sum, doc) => sum + doc.uniqueEntityCount, 0) /
      documentStats.length;

    return documentStats
      .map((doc) => {
        let score = 0;
        const reasons = [];

        if (doc.entityCount > avgEntitiesPerDoc * 3) {
          score += 0.3;
          reasons.push("high entity count");
        }

        if (doc.entityCount < avgEntitiesPerDoc * 0.1 && doc.entityCount > 0) {
          score += 0.2;
          reasons.push("low entity count");
        }

        if (doc.averageConfidence < 0.5) {
          score += 0.3;
          reasons.push("low confidence");
        }

        if (doc.uniqueEntityCount > avgUniqueEntitiesPerDoc * 2) {
          score += 0.2;
          reasons.push("high diversity");
        }

        return {
          documentId: doc.documentId,
          score,
          reason: reasons.join(", ") || "normal",
        };
      })
      .filter((doc) => doc.score > 0.3)
      .sort((a, b) => b.score - a.score);
  }
}
