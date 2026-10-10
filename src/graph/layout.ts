import dagre from '@dagrejs/dagre';
import type { GraphEdge, GraphNode } from '../types/anilist';

export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  bounds: LayoutBounds;
}

export function computeGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: {
    nodeSep?: number;
    rankSep?: number;
    rankDir?: 'LR' | 'TB';
  } = {}
): LayoutResult {
  const g = new dagre.graphlib.Graph({ multigraph: true, compound: false });

  const nodeSep = options.nodeSep ?? 45; // vertical distance between sibling boxes
  const rankSep = options.rankSep ?? 100; // horizontal distance between columns
  const rankDir = options.rankDir ?? 'LR'; // Left to Right

  g.setGraph({
    rankdir: rankDir,
    nodesep: nodeSep,
    ranksep: rankSep,
    edgesep: 30,
    marginx: 50,
    marginy: 50
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to Dagre
  for (const node of nodes) {
    g.setNode(node.id, {
      width: node.width,
      height: node.height
    });
  }

  // Add edges to Dagre
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target, {}, edge.id);
  }

  // Execute layout calculation
  dagre.layout(g);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Retrieve calculated node positions (Dagre gives center x, y)
  for (const node of nodes) {
    const layoutNode = g.node(node.id);
    if (layoutNode) {
      node.x = layoutNode.x;
      node.y = layoutNode.y;

      const halfW = node.width / 2;
      const halfH = node.height / 2;
      minX = Math.min(minX, node.x - halfW);
      minY = Math.min(minY, node.y - halfH);
      maxX = Math.max(maxX, node.x + halfW);
      maxY = Math.max(maxY, node.y + halfH);
    }
  }

  // Retrieve calculated edge points if any
  for (const edge of edges) {
    const layoutEdge = g.edge(edge.source, edge.target, edge.id);
    if (layoutEdge && layoutEdge.points) {
      edge.points = layoutEdge.points;
    }
  }

  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 600;
  }

  return {
    nodes,
    edges,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(maxX - minX, 100),
      height: Math.max(maxY - minY, 100)
    }
  };
}
