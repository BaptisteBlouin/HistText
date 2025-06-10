import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Collapse,
  Alert,
  TextField,
  Button,
  ButtonGroup,
  Divider,
  Grid,
} from "@mui/material";
import {
  AccountTree,
  Info,
  Settings,
  Fullscreen,
  FullscreenExit,
  Visibility,
  VisibilityOff,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  FilterAlt,
  Psychology,
  NetworkCheck,
} from "@mui/icons-material";
import * as d3 from "d3";

// Helper function to safely apply transitions
const safeTransition = (selection: any, duration: number = 200) => {
  // Check if transition method exists
  if (selection && typeof selection.transition === 'function') {
    try {
      return selection.transition().duration(duration);
    } catch (error) {
      console.warn('D3 transition failed, applying styles directly:', error);
      return selection;
    }
  } else {
    console.warn('D3 transition method not available, applying styles directly');
    return selection;
  }
};

interface DocumentNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  entityCount: number;
  uniqueEntities: Set<string>;
  sharedEntitiesCount: number;
  cluster?: number;
}

interface DocumentLink extends d3.SimulationLinkDatum<DocumentNode> {
  source: string | DocumentNode;
  target: string | DocumentNode;
  strength: number;
  sharedEntities: string[];
  similarity: number;
}

interface NetworkData {
  nodes: DocumentNode[];
  links: DocumentLink[];
}

interface DocumentSimilarityNetworkProps {
  /** Statistics data containing document stats and entities */
  stats: any;
  /** Callback when a document node is clicked */
  onDocumentClick: (documentId: string) => void;
}

/**
 * DocumentSimilarityNetwork component visualizes documents as nodes in a similarity network,
 * where edges represent shared entities with a similarity score above a threshold.
 * Supports different layouts, zoom/pan, cluster filtering, and interactive node/cluster selection.
 */
const DocumentSimilarityNetwork: React.FC<DocumentSimilarityNetworkProps> = ({
  stats,
  onDocumentClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<
    DocumentNode,
    DocumentLink
  > | null>(null);

  const [similarityThreshold, setSimilarityThreshold] = useState(0.3);
  const [layoutType, setLayoutType] = useState<
    "force" | "cluster" | "circular"
  >("force");
  const [showLabels, setShowLabels] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Node count controls
  const [maxNodes, setMaxNodes] = useState(50);
  const [customMaxNodes, setCustomMaxNodes] = useState("50");
  const [minClusterSize, setMinClusterSize] = useState(2);

  // Maximum number of available documents
  const maxAvailableDocuments = useMemo(
    () => stats?.documentStats?.length || 100,
    [stats],
  );

  // Quick node count selection options
  const quickNodeOptions = [10, 20, 30, 50, 75, 100];
  const availableQuickOptions = quickNodeOptions.filter(
    (option) => option <= maxAvailableDocuments,
  );

  // Compute the network nodes and links based on entity similarity and filtering
  const networkData = useMemo((): NetworkData => {
    if (!stats?.documentStats) return { nodes: [], links: [] };

    console.time("Computing document similarity network");
    console.log(
      `Processing ${Math.min(maxNodes, maxAvailableDocuments)} out of ${maxAvailableDocuments} available documents`,
    );

    const docEntitiesMap = new Map<string, Set<string>>();
    stats.documentStats.forEach((doc: any) => {
      const entities = new Set<string>();
      if (doc.topEntities) {
        doc.topEntities.forEach((entity: any) => {
          entities.add(entity.text.toLowerCase().trim());
        });
      }
      docEntitiesMap.set(doc.documentId, entities);
    });

    const actualLimit = Math.min(maxNodes, maxAvailableDocuments);
    const allNodes: DocumentNode[] = stats.documentStats
      .slice(0, actualLimit)
      .map((doc: any) => ({
        id: doc.documentId,
        title: doc.documentId.substring(0, 25) + "...",
        entityCount: doc.entityCount,
        uniqueEntities: docEntitiesMap.get(doc.documentId) || new Set(),
        sharedEntitiesCount: 0,
      }));

    const links: DocumentLink[] = [];

    for (let i = 0; i < allNodes.length; i++) {
      for (let j = i + 1; j < allNodes.length; j++) {
        const nodeA = allNodes[i];
        const nodeB = allNodes[j];

        const entitiesA = docEntitiesMap.get(nodeA.id) || new Set();
        const entitiesB = docEntitiesMap.get(nodeB.id) || new Set();

        const sharedEntities = Array.from(entitiesA).filter((entity) =>
          entitiesB.has(entity),
        );

        if (sharedEntities.length > 0) {
          const union = new Set([...entitiesA, ...entitiesB]);
          const similarity = sharedEntities.length / union.size;

          if (similarity >= similarityThreshold) {
            links.push({
              source: nodeA.id,
              target: nodeB.id,
              strength: similarity,
              sharedEntities,
              similarity,
            });

            nodeA.sharedEntitiesCount += sharedEntities.length;
            nodeB.sharedEntitiesCount += sharedEntities.length;
          }
        }
      }
    }

    const clusters = new Map<number, DocumentNode[]>();
    let clusterId = 0;

    allNodes.forEach((node) => {
      if (node.cluster === undefined) {
        node.cluster = clusterId;
        const cluster = [node];

        const connectedNodes = new Set([node.id]);
        const queue = [node.id];

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          links.forEach((link) => {
            const sourceId =
              typeof link.source === "string" ? link.source : link.source.id;
            const targetId =
              typeof link.target === "string" ? link.target : link.target.id;

            if (sourceId === currentId && !connectedNodes.has(targetId)) {
              const targetNode = allNodes.find((n) => n.id === targetId);
              if (targetNode && targetNode.cluster === undefined) {
                targetNode.cluster = clusterId;
                cluster.push(targetNode);
                connectedNodes.add(targetId);
                queue.push(targetId);
              }
            } else if (
              targetId === currentId &&
              !connectedNodes.has(sourceId)
            ) {
              const sourceNode = allNodes.find((n) => n.id === sourceId);
              if (sourceNode && sourceNode.cluster === undefined) {
                sourceNode.cluster = clusterId;
                cluster.push(sourceNode);
                connectedNodes.add(sourceId);
                queue.push(sourceId);
              }
            }
          });
        }

        clusters.set(clusterId, cluster);
        clusterId++;
      }
    });

    const filteredNodes = allNodes.filter((node) => {
      const cluster = clusters.get(node.cluster || 0);
      return cluster && cluster.length >= minClusterSize;
    });

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = links.filter((link) => {
      const sourceId =
        typeof link.source === "string" ? link.source : link.source.id;
      const targetId =
        typeof link.target === "string" ? link.target : link.target.id;
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
    });

    console.timeEnd("Computing document similarity network");
    console.log(
      `Network created: ${filteredNodes.length} nodes (filtered from ${allNodes.length}), ${filteredLinks.length} links, min cluster size: ${minClusterSize}`,
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [
    stats,
    similarityThreshold,
    maxNodes,
    maxAvailableDocuments,
    minClusterSize,
  ]);

  // Group nodes by clusters with metadata for navigation and display
  const clusters = useMemo(() => {
    const clusterMap = new Map<number, DocumentNode[]>();
    networkData.nodes.forEach((node) => {
      const clusterId = node.cluster || 0;
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)!.push(node);
    });
    return Array.from(clusterMap.entries())
      .map(([id, nodes]) => ({
        id,
        nodes,
        size: nodes.length,
        representative: nodes.reduce((max, node) =>
          node.sharedEntitiesCount > max.sharedEntitiesCount ? node : max,
        ),
      }))
      .sort((a, b) => b.size - a.size);
  }, [networkData]);

  // D3 force simulation, zoom, pan, node/cluster highlighting and interaction
  useEffect(() => {
    if (!svgRef.current || networkData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const containerElement = svgRef.current.parentElement;
    if (!containerElement) return;

    const containerRect = containerElement.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    svg
      .attr("width", width)
      .attr("height", height)
      .style("background", "#fafafa")
      .style("border", "1px solid #e0e0e0");

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const zoomBehavior = {
      zoomIn: () => {
        safeTransition(svg, 300).call(zoom.scaleBy, 1.5);
      },
      zoomOut: () => {
        safeTransition(svg, 300).call(zoom.scaleBy, 1 / 1.5);
      },
      reset: () => {
        safeTransition(svg, 500).call(zoom.transform, d3.zoomIdentity);
      },
      zoomToCluster: (clusterId: number) => {
        const clusterNodes = networkData.nodes.filter(
          (n) => n.cluster === clusterId,
        );
        if (clusterNodes.length === 0) return;

        const xs = clusterNodes.map((n) => n.x || 0);
        const ys = clusterNodes.map((n) => n.y || 0);
        const minX = Math.min(...xs) - 100;
        const maxX = Math.max(...xs) + 100;
        const minY = Math.min(...ys) - 100;
        const maxY = Math.max(...ys) + 100;

        const clusterWidth = maxX - minX;
        const clusterHeight = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const scale = Math.min(width / clusterWidth, height / clusterHeight, 3);
        const translateX = width / 2 - centerX * scale;
        const translateY = height / 2 - centerY * scale;

        safeTransition(svg, 750)
          .call(
            zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale),
          );
      },
    };

    (svg.node() as any).__zoomBehavior = zoomBehavior;

    const colorScale = d3.scaleOrdinal(d3.schemeSet3);

    const clusterForce = (alpha: number) => {
      const clusterCenters = new Map<number, [number, number]>();
      const numClusters = clusters.length;

      clusters.forEach((cluster, index) => {
        const angle = (index / numClusters) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.25;
        clusterCenters.set(cluster.id, [
          width / 2 + Math.cos(angle) * radius,
          height / 2 + Math.sin(angle) * radius,
        ]);
      });

      networkData.nodes.forEach((node) => {
        if (node.cluster !== undefined) {
          const center = clusterCenters.get(node.cluster);
          if (center && node.x !== undefined && node.y !== undefined) {
            const k = alpha * 0.15;
            node.vx = (node.vx || 0) + (center[0] - node.x) * k;
            node.vy = (node.vy || 0) + (center[1] - node.y) * k;
          }
        }
      });
    };

    const forceStrength = Math.max(
      -150,
      -300 * (50 / networkData.nodes.length),
    );
    const linkStrength = Math.min(1.5, networkData.nodes.length / 20);
    const collisionRadius = Math.max(15, 30 - networkData.nodes.length / 10);

    const simulation = d3
      .forceSimulation<DocumentNode, DocumentLink>(networkData.nodes)
      .force(
        "link",
        d3
          .forceLink<DocumentNode, DocumentLink>(networkData.links)
          .id((d: any) => d.id)
          .strength((d: DocumentLink) => d.similarity * linkStrength),
      )
      .force("charge", d3.forceManyBody().strength(forceStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(collisionRadius))
      .alpha(0.3)
      .alphaDecay(0.01);
    simulationRef.current = simulation;

    if (layoutType === "cluster") {
      simulation.force("cluster", clusterForce);
    } else if (layoutType === "circular") {
      networkData.nodes.forEach((node, i) => {
        const angle = (i / networkData.nodes.length) * 2 * Math.PI;
        const radius = Math.min(width, height) / 4;
        node.fx = width / 2 + Math.cos(angle) * radius;
        node.fy = height / 2 + Math.sin(angle) * radius;
      });
    } else {
      networkData.nodes.forEach((node) => {
        node.fx = undefined;
        node.fy = undefined;
      });
    }

    const link = g
      .append("g")
      .selectAll("line")
      .data(networkData.links)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d) => Math.sqrt(d.similarity * 15) + 1);

    const baseRadius = Math.max(8, 20 - networkData.nodes.length / 8);
    const node = g
      .append("g")
      .selectAll("circle")
      .data(networkData.nodes)
      .enter()
      .append("circle")
      .attr("r", (d) => Math.sqrt(d.entityCount) * 0.6 + baseRadius)
      .attr("fill", (d) => colorScale(d.cluster?.toString() || "0"))
      .attr("stroke", (d) => (selectedCluster === d.cluster ? "#000" : "#fff"))
      .attr("stroke-width", (d) => (selectedCluster === d.cluster ? 3 : 2))
      .attr("opacity", (d) =>
        selectedCluster === null || selectedCluster === d.cluster ? 1 : 0.3,
      )
      .style("cursor", "pointer")
      .call(
        d3
          .drag<any, any>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            if (layoutType === "force") {
              d.fx = null;
              d.fy = null;
            }
          }),
      )
      .on("click", (event, d) => {
        setSelectedNode(d);
        onDocumentClick(d.id);
      })
      .on("mouseover", function (event, d) {
        const selection = d3.select(this);
        safeTransition(selection, 200)
          .attr("r", Math.sqrt(d.entityCount) * 0.6 + baseRadius + 5)
          .attr("stroke-width", 4);

        link.style("stroke-opacity", (l: any) =>
          l.source.id === d.id || l.target.id === d.id ? 0.8 : 0.1,
        );
      })
      .on("mouseout", function (event, d) {
        const selection = d3.select(this);
        safeTransition(selection, 200)
          .attr("r", Math.sqrt(d.entityCount) * 0.6 + baseRadius)
          .attr("stroke-width", selectedCluster === d.cluster ? 3 : 2);

        link.style("stroke-opacity", 0.4);
      });

    let labels: any;
    if (showLabels) {
      const fontSize = Math.max(9, 14 - networkData.nodes.length / 15);
      labels = g
        .append("g")
        .selectAll("text")
        .data(networkData.nodes)
        .enter()
        .append("text")
        .text((d) => d.title)
        .attr("font-size", fontSize)
        .attr("font-family", "Arial, sans-serif")
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .attr("opacity", (d) =>
          selectedCluster === null || selectedCluster === d.cluster ? 0.9 : 0.3,
        )
        .style("pointer-events", "none")
        .style("fill", "#333")
        .style("text-shadow", "1px 1px 2px rgba(255,255,255,0.8)");
    }

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);

      if (labels) {
        labels
          .attr("x", (d: any) => d.x)
          .attr("y", (d: any) => d.y - baseRadius - 5);
      }
    });

    node
      .attr("stroke", (d) => (selectedCluster === d.cluster ? "#000" : "#fff"))
      .attr("stroke-width", (d) => (selectedCluster === d.cluster ? 3 : 2))
      .attr("opacity", (d) =>
        selectedCluster === null || selectedCluster === d.cluster ? 1 : 0.3,
      );

    if (labels) {
      labels.attr("opacity", (d: DocumentNode) =>
        selectedCluster === null || selectedCluster === d.cluster ? 0.9 : 0.3,
      );
    }

    link.attr("opacity", (l) => {
      if (selectedCluster === null) return 0.4;
      const sourceCluster =
        typeof l.source === "object"
          ? l.source.cluster
          : networkData.nodes.find((n) => n.id === l.source)?.cluster;
      const targetCluster =
        typeof l.target === "object"
          ? l.target.cluster
          : networkData.nodes.find((n) => n.id === l.target)?.cluster;
      return sourceCluster === selectedCluster ||
        targetCluster === selectedCluster
        ? 0.6
        : 0.1;
    });

    return () => {
      simulation.stop();
    };
  }, [
    networkData,
    layoutType,
    showLabels,
    onDocumentClick,
    selectedCluster,
    isFullscreen,
  ]);

  const zoomIn = useCallback(() => {
    const svg = d3.select(svgRef.current);
    const zoomBehavior = (svg.node() as any)?.__zoomBehavior;
    if (zoomBehavior) {
      zoomBehavior.zoomIn();
    }
  }, []);

  const zoomOut = useCallback(() => {
    const svg = d3.select(svgRef.current);
    const zoomBehavior = (svg.node() as any)?.__zoomBehavior;
    if (zoomBehavior) {
      zoomBehavior.zoomOut();
    }
  }, []);

  const resetZoom = useCallback(() => {
    const svg = d3.select(svgRef.current);
    const zoomBehavior = (svg.node() as any)?.__zoomBehavior;
    if (zoomBehavior) {
      zoomBehavior.reset();
    }
  }, []);

  const zoomToCluster = useCallback((clusterId: number) => {
    const svg = d3.select(svgRef.current);
    const zoomBehavior = (svg.node() as any)?.__zoomBehavior;
    if (zoomBehavior) {
      setTimeout(() => {
        zoomBehavior.zoomToCluster(clusterId);
      }, 100);
    }
  }, []);

  const handleThresholdChange = useCallback(
    (event: Event, newValue: number | number[]) => {
      setSimilarityThreshold(newValue as number);
    },
    [],
  );

  const handleMaxNodesChange = useCallback(
    (event: Event, newValue: number | number[]) => {
      const value = newValue as number;
      setMaxNodes(value);
      setCustomMaxNodes(value.toString());
    },
    [],
  );

  const handleMinClusterSizeChange = useCallback(
    (event: Event, newValue: number | number[]) => {
      setMinClusterSize(newValue as number);
    },
    [],
  );

  const handleCustomMaxNodesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setCustomMaxNodes(value);

      const numValue = parseInt(value);
      if (
        !isNaN(numValue) &&
        numValue > 0 &&
        numValue <= maxAvailableDocuments
      ) {
        setMaxNodes(numValue);
      }
    },
    [maxAvailableDocuments],
  );

  const handleQuickNodeSelection = useCallback((value: number) => {
    setMaxNodes(value);
    setCustomMaxNodes(value.toString());
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  if (!stats?.documentStats || stats.documentStats.length < 2) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">Document Similarity Network</Typography>
          <Alert severity="info">
            Need at least 2 documents with entity data to display similarity
            network.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: isFullscreen ? "100vh" : "auto",
        position: isFullscreen ? "fixed" : "relative",
        top: isFullscreen ? 0 : "auto",
        left: isFullscreen ? 0 : "auto",
        zIndex: isFullscreen ? 9999 : "auto",
        bgcolor: isFullscreen ? "background.paper" : "transparent",
        p: isFullscreen ? 2 : 0,
      }}
    >
      <Card sx={{ height: "100%" }}>
        <CardContent
          sx={{ height: "100%", display: "flex", flexDirection: "column" }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
              flexWrap: "wrap",
            }}
          >
            <AccountTree color="primary" />
            <Typography variant="h6">Document Similarity Network</Typography>
            <Chip
              label={`${networkData.nodes.length}/${maxAvailableDocuments} docs, ${networkData.links.length} connections`}
              size="small"
              color="primary"
            />
            <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
              <IconButton size="small" onClick={() => setShowInfo(!showInfo)}>
                <Info />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings />
              </IconButton>
              <IconButton size="small" onClick={toggleFullscreen}>
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Box>
          </Box>

          <Collapse in={showInfo}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>How it's computed:</strong>
                <br />
                1. <strong>Document Selection:</strong> Uses first {maxNodes}{" "}
                documents (adjustable below)
                <br />
                2. <strong>Entity Extraction:</strong> Uses top entities from
                each document's analysis
                <br />
                3. <strong>Jaccard Similarity:</strong> Similarity = |Shared
                Entities| / |All Unique Entities|
                <br />
                4. <strong>Network Creation:</strong> Documents with similarity
                ≥ threshold get connected
                <br />
                5. <strong>Clustering:</strong> Connected components form
                document clusters
                <br />
                6. <strong>Cluster Filtering:</strong> Only shows clusters with
                ≥ {minClusterSize} documents
                <br />
                7. <strong>Visualization:</strong> Force-directed layout with
                cluster coloring
                <br />
                <br />
                <strong>Navigation:</strong> Use zoom controls, drag nodes,
                click clusters to focus, or use fullscreen mode
              </Typography>
            </Alert>
          </Collapse>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" gutterBottom>
                Similarity Threshold: {(similarityThreshold * 100).toFixed(0)}%
              </Typography>
              <Slider
                value={similarityThreshold}
                min={0.05}
                max={0.8}
                step={0.05}
                onChange={handleThresholdChange}
                size="small"
                marks={[
                  { value: 0.1, label: "10%" },
                  { value: 0.3, label: "30%" },
                  { value: 0.5, label: "50%" },
                  { value: 0.8, label: "80%" },
                ]}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" gutterBottom>
                Number of Documents: {maxNodes} / {maxAvailableDocuments}{" "}
                available
              </Typography>
              <Slider
                value={maxNodes}
                min={5}
                max={maxAvailableDocuments}
                step={5}
                onChange={handleMaxNodesChange}
                valueLabelDisplay="auto"
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" gutterBottom>
                Min Cluster Size: {minClusterSize} document
                {minClusterSize !== 2 ? "s" : ""}
              </Typography>
              <Slider
                value={minClusterSize}
                min={2}
                max={10}
                step={1}
                onChange={handleMinClusterSizeChange}
                valueLabelDisplay="auto"
                size="small"
                marks={[
                  { value: 2, label: "2" },
                  { value: 5, label: "5" },
                  { value: 10, label: "10" },
                ]}
              />
            </Grid>
          </Grid>

          <Collapse in={showSettings}>
            <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 1, mb: 2 }}>
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <Settings />
                Additional Settings
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Quick Document Selection:
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {availableQuickOptions.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      size="small"
                      clickable
                      color={maxNodes === option ? "primary" : "default"}
                      variant={maxNodes === option ? "filled" : "outlined"}
                      onClick={() => handleQuickNodeSelection(option)}
                    />
                  ))}
                  {maxAvailableDocuments >
                    Math.max(...availableQuickOptions) && (
                    <Chip
                      label="All"
                      size="small"
                      clickable
                      color={
                        maxNodes === maxAvailableDocuments
                          ? "primary"
                          : "default"
                      }
                      variant={
                        maxNodes === maxAvailableDocuments
                          ? "filled"
                          : "outlined"
                      }
                      onClick={() =>
                        handleQuickNodeSelection(maxAvailableDocuments)
                      }
                    />
                  )}
                </Box>
              </Box>

              <TextField
                label="Custom Document Count"
                size="small"
                type="number"
                value={customMaxNodes}
                onChange={handleCustomMaxNodesChange}
                inputProps={{
                  min: 1,
                  max: maxAvailableDocuments,
                  style: { width: "100px" },
                }}
                sx={{ width: 150, mb: 2 }}
              />

              {maxNodes > 50 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Performance Note:</strong> Networks with {maxNodes}{" "}
                    documents may take longer to compute and render. Consider
                    using fewer documents for better responsiveness.
                  </Typography>
                </Alert>
              )}

              {minClusterSize > 1 && (
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Cluster Filter:</strong> Hiding isolated documents
                    and clusters smaller than {minClusterSize} documents. This
                    removes{" "}
                    {stats.documentStats.length - networkData.nodes.length}{" "}
                    documents from the display.
                  </Typography>
                </Alert>
              )}
            </Box>
          </Collapse>

          <Box
            sx={{
              display: "flex",
              gap: 2,
              mb: 2,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Layout</InputLabel>
              <Select
                value={layoutType}
                onChange={(e) => setLayoutType(e.target.value as any)}
              >
                <MenuItem value="force">Force</MenuItem>
                <MenuItem value="cluster">Cluster</MenuItem>
                <MenuItem value="circular">Circular</MenuItem>
              </Select>
            </FormControl>

            <IconButton
              size="small"
              onClick={() => setShowLabels(!showLabels)}
              color={showLabels ? "primary" : "default"}
            >
              {showLabels ? <Visibility /> : <VisibilityOff />}
            </IconButton>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 1,
              mb: 2,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Typography variant="caption">Navigation:</Typography>
            <ButtonGroup size="small">
              <Button onClick={zoomIn} startIcon={<ZoomIn />}>
                Zoom In
              </Button>
              <Button onClick={zoomOut} startIcon={<ZoomOut />}>
                Zoom Out
              </Button>
              <Button onClick={resetZoom} startIcon={<CenterFocusStrong />}>
                Reset
              </Button>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            <Typography variant="caption">Clusters:</Typography>
            <Chip
              label="All"
              size="small"
              clickable
              color={selectedCluster === null ? "primary" : "default"}
              variant={selectedCluster === null ? "filled" : "outlined"}
              onClick={() => setSelectedCluster(null)}
            />
            {clusters.slice(0, 8).map((cluster) => (
              <Chip
                key={cluster.id}
                label={`C${cluster.id} (${cluster.size})`}
                size="small"
                clickable
                color={selectedCluster === cluster.id ? "primary" : "default"}
                variant={selectedCluster === cluster.id ? "filled" : "outlined"}
                onClick={() => {
                  setSelectedCluster(cluster.id);
                  zoomToCluster(cluster.id);
                }}
              />
            ))}
            {clusters.length > 8 && (
              <Typography variant="caption" color="text.secondary">
                +{clusters.length - 8} more
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              flexGrow: 1,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
              bgcolor: "background.paper",
              minHeight: isFullscreen ? "calc(100vh - 400px)" : "500px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              sx={{
                p: 1,
                bgcolor: "grey.100",
                borderBottom: 1,
                borderColor: "divider",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Drag to pan • Scroll to zoom • Drag nodes to reposition • Click
                to select
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip
                  size="small"
                  label={`${clusters.length} clusters`}
                  color="info"
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={
                    selectedCluster !== null
                      ? `Cluster ${selectedCluster} focused`
                      : "All visible"
                  }
                  color={selectedCluster !== null ? "primary" : "default"}
                />
                {minClusterSize > 1 && (
                  <Chip
                    size="small"
                    label={`Min size: ${minClusterSize}`}
                    color="secondary"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>

            <Box sx={{ flexGrow: 1, position: "relative" }}>
              <svg
                ref={svgRef}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                }}
              />
            </Box>
          </Box>

          {selectedNode && (
            <Box
              sx={{ mt: 2, p: 2, bgcolor: "primary.light", borderRadius: 1 }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Selected Document: {selectedNode.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Entities: {selectedNode.entityCount} • Shared connections:{" "}
                {selectedNode.sharedEntitiesCount} • Cluster:{" "}
                {selectedNode.cluster} • Unique entities in doc:{" "}
                {selectedNode.uniqueEntities.size}
              </Typography>
              <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => zoomToCluster(selectedNode.cluster || 0)}
                >
                  Focus Cluster
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onDocumentClick(selectedNode.id)}
                >
                  View Document
                </Button>
              </Box>
            </Box>
          )}

          {selectedCluster !== null && (
            <Box
              sx={{ mt: 2, p: 2, bgcolor: "success.light", borderRadius: 1 }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Cluster {selectedCluster} Details
              </Typography>
              {(() => {
                const cluster = clusters.find((c) => c.id === selectedCluster);
                if (!cluster) return null;

                return (
                  <>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {cluster.size} documents • Representative:{" "}
                      {cluster.representative.title}
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        mt: 1,
                      }}
                    >
                      {cluster.nodes.slice(0, 6).map((node, index) => (
                        <Chip
                          key={index}
                          label={node.title}
                          size="small"
                          clickable
                          onClick={() => {
                            setSelectedNode(node);
                            onDocumentClick(node.id);
                          }}
                        />
                      ))}
                      {cluster.nodes.length > 6 && (
                        <Typography variant="caption" color="text.secondary">
                          +{cluster.nodes.length - 6} more documents
                        </Typography>
                      )}
                    </Box>
                  </>
                );
              })()}
            </Box>
          )}

          <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Network Statistics
            </Typography>
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Documents:</strong> {networkData.nodes.length} /{" "}
                {maxAvailableDocuments} available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Connections:</strong> {networkData.links.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Clusters:</strong> {clusters.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Avg Similarity:</strong>{" "}
                {networkData.links.length > 0
                  ? (
                      (networkData.links.reduce(
                        (sum, link) => sum + link.similarity,
                        0,
                      ) /
                        networkData.links.length) *
                      100
                    ).toFixed(1) + "%"
                  : "N/A"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Density:</strong>{" "}
                {networkData.nodes.length > 1
                  ? (
                      ((networkData.links.length * 2) /
                        (networkData.nodes.length *
                          (networkData.nodes.length - 1))) *
                      100
                    ).toFixed(1) + "%"
                  : "N/A"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Largest Cluster:</strong>{" "}
                {clusters.length > 0 ? clusters[0].size : 0} documents
              </Typography>
              {minClusterSize > 1 && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Filtered Out:</strong>{" "}
                  {stats.documentStats.length - networkData.nodes.length}{" "}
                  documents (clusters &lt; {minClusterSize})
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default React.memo(DocumentSimilarityNetwork);
