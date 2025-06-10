import { useState, useCallback, useRef } from "react";
import {
  LightEntity,
  EntityGroup,
  ProcessingState,
  NERAdvancedStats,
} from "../types/ner-types";
import { EntityNormalizer } from "../utils/EntityNormalizer";
import { CooccurrenceAnalyzer } from "../utils/CooccurrenceAnalyzer";
import { PatternAnalyzer } from "../utils/PatternAnalyzer";
import { StatisticsComputer } from "../utils/StatisticsComputer";
import { ChunkedProcessor } from "../utils/ChunkedProcessor";
import config from "../../../../../config.json";

/**
 * Custom hook to manage advanced NER processing including statistics, relationships, and patterns.
 * Provides progress tracking, cancellation, and error handling.
 */
export const useNERProcessor = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    phase: "idle",
    progress: 0,
    currentTask: "",
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef<AbortController | null>(null);
  const lastProgressUpdate = useRef<number>(Date.now());

  /**
   * Update processing state with progress tracking and stuck detection timestamp.
   */
  const updateProcessingState = useCallback(
    (newState: Partial<ProcessingState>) => {
      setProcessingState((prev) => {
        const updated = { ...prev, ...newState };

        if (newState.progress && newState.progress !== prev.progress) {
          lastProgressUpdate.current = Date.now();
        }

        return {
          ...updated,
          lastProgress: prev.progress,
          lastUpdate: lastProgressUpdate.current,
        };
      });
    },
    [],
  );

  /**
   * Runs advanced NER analysis on entities and entity groups, including statistics, co-occurrence relationships,
   * pattern detection, and final aggregation. Supports cancellation and progress updates.
   *
   * @param entities Array of LightEntity objects representing all entities.
   * @param entityGroups Map of entity groups keyed by normalized entity text.
   * @param basicStats Basic statistics computed earlier to inform limits and initial data.
   * @returns Promise resolving to advanced stats with full analysis results.
   */
  const processAdvancedStats = useCallback(
    async (
      entities: LightEntity[],
      entityGroups: Map<string, EntityGroup>,
      basicStats: any,
    ): Promise<NERAdvancedStats> => {
      if (processingRef.current) {
        console.log("Cancelling existing processing...");
        processingRef.current.abort();
      }

      const controller = new AbortController();
      processingRef.current = controller;
      setIsProcessing(true);
      lastProgressUpdate.current = Date.now();

      try {
        const processingConfig = ChunkedProcessor.getConfig();
        const shouldDoFullAnalysis =
          entities.length <= processingConfig.MAX_ENTITIES_FOR_FULL_ANALYSIS;
        const shouldDoRelationships = entities.length <= 15000;
        const shouldDoPatterns = entities.length <= 20000;

        console.log("Starting advanced processing:", {
          entityCount: entities.length,
          shouldDoFullAnalysis,
          shouldDoRelationships,
          shouldDoPatterns,
          maxEntities: processingConfig.MAX_ENTITIES_FOR_FULL_ANALYSIS,
        });

        updateProcessingState({
          phase: "preprocessing",
          progress: 5,
          currentTask: "Initializing advanced analysis...",
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        if (controller.signal.aborted) throw new Error("Aborted");

        // Phase 1: Compute basic statistics and organize top entities by type
        updateProcessingState({
          phase: "basic_stats",
          progress: 15,
          currentTask: "Computing basic statistics...",
        });

        const topEntities = Array.from(entityGroups.values())
          .map((group) => ({
            text: group.displayText,
            count: group.totalCount,
            documents: group.documents.size,
            frequency: group.totalCount / entities.length,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50);

        const topEntitiesByType: Record<string, any[]> = {};
        entityGroups.forEach((group) => {
          if (!topEntitiesByType[group.labelFull]) {
            topEntitiesByType[group.labelFull] = [];
          }
          topEntitiesByType[group.labelFull].push({
            text: group.displayText,
            count: group.totalCount,
            documents: group.documents.size,
          });
        });

        Object.keys(topEntitiesByType).forEach((type) => {
          topEntitiesByType[type] = topEntitiesByType[type]
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        });

        updateProcessingState({
          phase: "basic_stats",
          progress: 25,
          currentTask: "Basic statistics computed successfully",
        });

        if (controller.signal.aborted) throw new Error("Aborted");

        // Initialize stats container for later updates
        const currentStats: NERAdvancedStats = {
          totalEntities: entities.length,
          totalDocuments: basicStats.totalDocuments,
          averageEntitiesPerDocument:
            entities.length / basicStats.totalDocuments,
          entityDensity: entities.length / basicStats.totalDocuments,
          uniqueEntitiesRatio: entityGroups.size / entities.length,
          topEntities,
          topEntitiesByType,
          entityCooccurrences: [],
          strongestPairs: [],
          bigramPatterns: [],
          trigramPatterns: [],
          quadrigramPatterns: [],
          centralityScores: [],
          anomalyScores: [],
          confidenceDistribution:
            StatisticsComputer.computeConfidenceDistribution(entities),
          entityLengthDistribution:
            StatisticsComputer.computeLengthDistribution(entityGroups),
          documentStats: StatisticsComputer.computeDocumentStats(entities),
          documentsWithMostEntities: [],
          documentsWithHighestDiversity: [],
          commonPatterns: [],
          communityGroups: [],
          clusterAnalysis: [],
          processingComplete: false,
          hasAdvancedFeatures: shouldDoFullAnalysis,
          isLimited: basicStats.isLimited,
          totalEntitiesBeforeLimit: basicStats.totalEntitiesBeforeLimit,
          processedEntities: entities.length,
        };

        if (currentStats.documentStats.length > 0) {
          currentStats.documentsWithMostEntities = currentStats.documentStats
            .slice()
            .sort((a, b) => b.entityCount - a.entityCount)
            .slice(0, 10);

          currentStats.documentsWithHighestDiversity =
            currentStats.documentStats
              .slice()
              .sort((a, b) => {
                const diversityA =
                  a.uniqueEntityCount / Math.max(a.entityCount, 1);
                const diversityB =
                  b.uniqueEntityCount / Math.max(b.entityCount, 1);
                return diversityB - diversityA;
              })
              .slice(0, 10);

          currentStats.anomalyScores = StatisticsComputer.computeAnomalyScores(
            currentStats.documentStats,
          );
        }

        updateProcessingState({
          phase: "basic_stats",
          progress: 35,
          currentTask: "Basic analysis completed",
        });

        if (controller.signal.aborted) throw new Error("Aborted");

        // Phase 2: Relationship analysis with timeout and error handling
        if (shouldDoRelationships && shouldDoFullAnalysis) {
          updateProcessingState({
            phase: "relationships",
            progress: 40,
            currentTask: `Analyzing entity relationships (${entities.length} entities)...`,
          });

          try {
            console.log("Starting relationship analysis...");
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => {
                console.log("Relationship analysis timeout after 45 seconds");
                reject(new Error("Relationship analysis timeout"));
              }, 45000),
            );

            const relationshipPromise =
              CooccurrenceAnalyzer.computeCooccurrences(
                entities,
                entityGroups,
                controller.signal,
                (progress) => {
                  const adjustedProgress = 40 + progress * 0.25;
                  updateProcessingState({
                    progress: adjustedProgress,
                    currentTask: `Analyzing relationships... ${progress.toFixed(0)}%`,
                  });
                },
              );

            const cooccurrences = await Promise.race([
              relationshipPromise,
              timeoutPromise,
            ]);

            if (controller.signal.aborted) throw new Error("Aborted");

            console.log(
              `Relationship analysis completed: ${cooccurrences.length} relationships found`,
            );

            currentStats.entityCooccurrences = cooccurrences.slice(0, 100);
            currentStats.strongestPairs = cooccurrences.slice(0, 20);
            currentStats.centralityScores =
              StatisticsComputer.computeCentralityScores(
                topEntities,
                cooccurrences,
              );

            updateProcessingState({
              phase: "relationships",
              progress: 65,
              currentTask: `Relationship analysis completed (${cooccurrences.length} pairs found)`,
            });
          } catch (error) {
            console.error("Relationship analysis failed:", error);

            if (controller.signal.aborted) throw error;

            console.log(
              "Continuing with empty relationship data due to error/timeout",
            );
            currentStats.entityCooccurrences = [];
            currentStats.strongestPairs = [];
            currentStats.centralityScores =
              StatisticsComputer.computeCentralityScores(topEntities, []);

            updateProcessingState({
              phase: "relationships",
              progress: 65,
              currentTask:
                "Relationship analysis skipped (dataset too complex)",
            });
          }
        } else {
          console.log(
            "Skipping relationship analysis - dataset too large or full analysis disabled",
          );
          updateProcessingState({
            phase: "relationships",
            progress: 65,
            currentTask: "Relationship analysis skipped (dataset too large)",
          });
        }

        if (controller.signal.aborted) throw new Error("Aborted");

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Phase 3: Pattern detection with timeout and error handling
        if (shouldDoPatterns && shouldDoFullAnalysis) {
          updateProcessingState({
            phase: "patterns",
            progress: 70,
            currentTask: `Detecting entity patterns (${entities.length} entities)...`,
          });

          try {
            console.log("Starting pattern analysis...");
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => {
                console.log("Pattern analysis timeout after 60 seconds");
                reject(new Error("Pattern analysis timeout"));
              }, 60000),
            );

            const patternPromise = PatternAnalyzer.computePatterns(
              entities,
              controller.signal,
              (progress) => {
                const adjustedProgress = 70 + progress * 0.2;
                updateProcessingState({
                  progress: adjustedProgress,
                  currentTask: `Detecting patterns... ${progress.toFixed(0)}%`,
                });
              },
            );

            const patterns = await Promise.race([
              patternPromise,
              timeoutPromise,
            ]);

            if (controller.signal.aborted) throw new Error("Aborted");

            console.log("Pattern analysis completed:", {
              bigrams: patterns.bigrams.length,
              trigrams: patterns.trigrams.length,
              quadrigrams: patterns.quadrigrams.length,
            });

            currentStats.bigramPatterns = patterns.bigrams;
            currentStats.trigramPatterns = patterns.trigrams;
            currentStats.quadrigramPatterns = patterns.quadrigrams;
            currentStats.commonPatterns = [
              ...patterns.bigrams.slice(0, 10),
              ...patterns.trigrams.slice(0, 10),
            ];

            updateProcessingState({
              phase: "patterns",
              progress: 90,
              currentTask: `Pattern analysis completed (${patterns.bigrams.length + patterns.trigrams.length + patterns.quadrigrams.length} patterns found)`,
            });
          } catch (error) {
            console.error("Pattern analysis failed:", error);

            if (controller.signal.aborted) throw error;

            console.log(
              "Continuing with empty pattern data due to error/timeout",
            );
            currentStats.bigramPatterns = [];
            currentStats.trigramPatterns = [];
            currentStats.quadrigramPatterns = [];
            currentStats.commonPatterns = [];

            updateProcessingState({
              phase: "patterns",
              progress: 90,
              currentTask: "Pattern analysis skipped (dataset too complex)",
            });
          }
        } else {
          console.log(
            "Skipping pattern analysis - dataset too large or full analysis disabled",
          );
          updateProcessingState({
            phase: "patterns",
            progress: 90,
            currentTask: "Pattern analysis skipped (dataset too large)",
          });
        }

        if (controller.signal.aborted) throw new Error("Aborted");

        // Phase 4: Finalization and marking complete
        updateProcessingState({
          phase: "complete",
          progress: 95,
          currentTask: "Finalizing analysis...",
        });

        currentStats.processingComplete = true;

        updateProcessingState({
          phase: "complete",
          progress: 100,
          currentTask: "Advanced analysis complete!",
        });

        console.log("Advanced processing completed successfully:", {
          totalEntities: currentStats.totalEntities,
          relationships: currentStats.strongestPairs.length,
          patterns:
            currentStats.bigramPatterns.length +
            currentStats.trigramPatterns.length +
            currentStats.quadrigramPatterns.length,
          processingTime: Date.now() - lastProgressUpdate.current,
        });

        return currentStats;
      } catch (error) {
        console.error("Error in advanced processing:", error);

        if (controller.signal.aborted) {
          console.log("Processing was cancelled by user or system");
          throw new Error("Processing cancelled");
        } else {
          console.error("Unexpected error during processing:", error);

          const fallbackStats: NERAdvancedStats = {
            totalEntities: entities.length,
            totalDocuments: basicStats.totalDocuments,
            averageEntitiesPerDocument:
              entities.length / basicStats.totalDocuments,
            entityDensity: entities.length / basicStats.totalDocuments,
            uniqueEntitiesRatio: entityGroups.size / entities.length,
            topEntities: [],
            topEntitiesByType: {},
            entityCooccurrences: [],
            strongestPairs: [],
            bigramPatterns: [],
            trigramPatterns: [],
            quadrigramPatterns: [],
            centralityScores: [],
            anomalyScores: [],
            confidenceDistribution: [],
            entityLengthDistribution: [],
            documentStats: [],
            documentsWithMostEntities: [],
            documentsWithHighestDiversity: [],
            commonPatterns: [],
            communityGroups: [],
            clusterAnalysis: [],
            processingComplete: false,
            hasAdvancedFeatures: false,
            isLimited: basicStats.isLimited,
            totalEntitiesBeforeLimit: basicStats.totalEntitiesBeforeLimit,
            processedEntities: entities.length,
          };

          return fallbackStats;
        }
      } finally {
        setIsProcessing(false);
        processingRef.current = null;

        setTimeout(() => {
          console.log("Clearing entity normalization cache...");
          EntityNormalizer.clearCache();
        }, 2000);
      }
    },
    [updateProcessingState],
  );

  /**
   * Cancel any ongoing processing and reset state.
   */
  const cancelProcessing = useCallback(() => {
    console.log("Cancelling processing...");
    if (processingRef.current) {
      processingRef.current.abort();
      processingRef.current = null;
    }
    setIsProcessing(false);
    updateProcessingState({
      phase: "idle",
      progress: 0,
      currentTask: "Processing cancelled",
    });
  }, [updateProcessingState]);

  /**
   * Check if the processing is stuck (no progress for more than 45 seconds).
   */
  const isProcessingStuck = useCallback(() => {
    if (!isProcessing) return false;
    const timeSinceLastUpdate = Date.now() - lastProgressUpdate.current;
    return timeSinceLastUpdate > 45000;
  }, [isProcessing]);

  return {
    processAdvancedStats,
    processingState: {
      ...processingState,
      isStuck: isProcessingStuck(),
    },
    isProcessing,
    cancelProcessing,
  };
};
