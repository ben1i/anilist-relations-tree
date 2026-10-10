import type {
  AniListMedia,
  FilterState,
  FranchiseGraph,
  GraphEdge,
  GraphNode,
  MediaRelation
} from '../types/anilist';

interface RawEdgeRecord {
  sourceId: number;
  targetId: number;
  relation: MediaRelation;
  label: string;
  priority: number;
}

export function formatRelationLabel(rel: MediaRelation): string {
  switch (rel) {
    case 'SEQUEL':
      return 'SEQUEL';
    case 'PREQUEL':
      return 'PREQUEL';
    case 'SPIN_OFF':
      return 'SPIN OFF';
    case 'SIDE_STORY':
      return 'SIDE STORY';
    case 'ALTERNATIVE':
      return 'ALTERNATIVE';
    case 'OTHER':
      return 'OTHER';
    case 'SUMMARY':
    case 'COMPILATION':
      return 'SUMMARY';
    case 'ADAPTATION':
      return 'ADAPTATION';
    case 'CHARACTER':
      return 'CAMEO';
    case 'PARENT':
      return 'PARENT';
    case 'SOURCE':
      return 'SOURCE';
    case 'CONTAINS':
      return 'CONTAINS';
    default:
      return String(rel).replace('_', ' ');
  }
}

function getRelationPriority(rel: MediaRelation): number {
  switch (rel) {
    case 'SEQUEL':
    case 'PREQUEL':
      return 100;
    case 'SPIN_OFF':
    case 'SIDE_STORY':
      return 90;
    case 'ALTERNATIVE':
      return 80;
    case 'SUMMARY':
    case 'COMPILATION':
      return 70;
    case 'ADAPTATION':
      return 60;
    case 'PARENT':
      return 50;
    case 'OTHER':
      return 40;
    case 'CHARACTER':
      return 10;
    default:
      return 30;
  }
}

/**
 * Builds nodes and canonical directed edges for Dagre hierarchical layout
 */
export function buildGraphModel(
  franchise: FranchiseGraph,
  filters: FilterState
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { nodes: allMediaMap, rootId } = franchise;

  // 1. Calculate BFS depths from rootId
  const nodeDepths = new Map<number, number>();
  nodeDepths.set(rootId, 0);

  const depthQueue: Array<{ id: number; depth: number }> = [{ id: rootId, depth: 0 }];
  const visitedForDepth = new Set<number>([rootId]);

  while (depthQueue.length > 0) {
    const current = depthQueue.shift()!;
    const media = allMediaMap.get(current.id);
    if (!media || !media.relations?.edges) continue;

    for (const edge of media.relations.edges) {
      const neighborId = edge.node?.id;
      if (neighborId && !visitedForDepth.has(neighborId)) {
        visitedForDepth.add(neighborId);
        const nextDepth = current.depth + 1;
        nodeDepths.set(neighborId, nextDepth);
        depthQueue.push({ id: neighborId, depth: nextDepth });
      }
    }
  }

  // 2. Filter nodes based on criteria
  const activeMedia = new Map<number, AniListMedia>();

  for (const [id, media] of allMediaMap.entries()) {
    const depth = nodeDepths.get(id) ?? 99;

    // Depth filter
    if (depth > filters.maxDepth) continue;

    // Media type filter
    if (filters.mediaType === 'ANIME' && media.type !== 'ANIME') continue;
    if (filters.mediaType === 'MANGA' && media.type !== 'MANGA') continue;

    activeMedia.set(id, media);
  }

  // Always keep root node
  if (allMediaMap.has(rootId) && !activeMedia.has(rootId)) {
    activeMedia.set(rootId, allMediaMap.get(rootId)!);
  }

  // 3. Extract and normalize edges between active nodes
  const edgePairMap = new Map<string, RawEdgeRecord>();

  for (const [sourceId, media] of activeMedia.entries()) {
    if (!media.relations?.edges) continue;

    for (const relEdge of media.relations.edges) {
      const targetId = relEdge.node?.id;
      if (!targetId || !activeMedia.has(targetId)) continue;
      if (sourceId === targetId) continue;

      const rawRel = relEdge.relationType;

      // Determine canonical direction and relation type
      let u = sourceId;
      let v = targetId;
      let finalLabel = formatRelationLabel(rawRel);
      let canonicalRel = rawRel;

      if (rawRel === 'PREQUEL') {
        // Source has PREQUEL Target => Target came before Source => Target -> Source (SEQUEL)
        u = targetId;
        v = sourceId;
        finalLabel = 'SEQUEL';
        canonicalRel = 'SEQUEL';
      } else if (rawRel === 'PARENT') {
        // Source has PARENT Target => Target -> Source (SPIN OFF or SIDE STORY)
        u = targetId;
        v = sourceId;
        finalLabel = 'SPIN OFF';
        canonicalRel = 'SPIN_OFF';
      } else if (rawRel === 'ALTERNATIVE' || rawRel === 'OTHER') {
        // Orient from earlier year/id to later
        const sYear = media.startDate?.year || media.seasonYear || 9999;
        const targetMedia = activeMedia.get(targetId);
        const tYear = targetMedia?.startDate?.year || targetMedia?.seasonYear || 9999;

        if (sYear > tYear || (sYear === tYear && sourceId > targetId)) {
          u = targetId;
          v = sourceId;
        }
      }

      // Check if canonical relation is enabled in filters (e.g. if SPIN_OFF is disabled, both SPIN_OFF and PARENT are blocked)
      if (filters.enabledRelations) {
        if (filters.enabledRelations[canonicalRel] === false || filters.enabledRelations[rawRel] === false) {
          continue;
        }
      }

      const pairKey = u < v ? `${u}-${v}` : `${v}-${u}`;
      const priority = getRelationPriority(canonicalRel);

      const existing = edgePairMap.get(pairKey);
      if (!existing || priority > existing.priority) {
        edgePairMap.set(pairKey, {
          sourceId: u,
          targetId: v,
          relation: canonicalRel,
          label: finalLabel,
          priority
        });
      }
    }
  }

  // 4. Build undirected adjacency list for enabled edges
  const adj = new Map<string, string[]>();
  for (const record of edgePairMap.values()) {
    const sId = record.sourceId.toString();
    const tId = record.targetId.toString();
    if (!adj.has(sId)) adj.set(sId, []);
    if (!adj.has(tId)) adj.set(tId, []);
    adj.get(sId)!.push(tId);
    adj.get(tId)!.push(sId);
  }

  // 5. Reachability traversal from root: only keep nodes connected to root in the active graph
  const rootStr = rootId.toString();
  const reachableFromRoot = new Set<string>();
  reachableFromRoot.add(rootStr);
  const queue = [rootStr];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const neighbor of adj.get(curr) || []) {
      if (!reachableFromRoot.has(neighbor)) {
        reachableFromRoot.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // 6. Transform into GraphEdge collection (only keep edges between reachable nodes)
  const edges: GraphEdge[] = [];
  let edgeCounter = 1;

  for (const record of edgePairMap.values()) {
    const sId = record.sourceId.toString();
    const tId = record.targetId.toString();

    if (reachableFromRoot.has(sId) && reachableFromRoot.has(tId)) {
      edges.push({
        id: `edge-${edgeCounter++}`,
        source: sId,
        target: tId,
        rawRelation: record.relation,
        displayLabel: record.label
      });
    }
  }

  // 7. Transform only reachable nodes into GraphNode collection (prunes disconnected sub-graphs/branches)
  const nodes: GraphNode[] = [];
  const nodeWidth = 230;
  const nodeHeight = 76;

  for (const [id, media] of activeMedia.entries()) {
    const strId = id.toString();
    if (!reachableFromRoot.has(strId)) {
      continue; // Prune nodes that are not reachable from the root
    }

    const isCurrent = id === rootId;
    nodes.push({
      id: strId,
      mediaId: id,
      media,
      isCurrent,
      x: 0,
      y: 0,
      width: nodeWidth,
      height: nodeHeight,
      depth: nodeDepths.get(id) ?? 0
    });
  }

  return { nodes, edges };
}
