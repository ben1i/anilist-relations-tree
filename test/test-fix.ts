import { anilistApi } from '../src/services/anilistApi';

// Test new BFS logic with terminal OTHER
async function testFixedBFS() {
  const rootId = 30;
  const nodes = new Map<number, any>();
  const visited = new Set<number>([rootId]);
  const queue: Array<{ id: number; depth: number }> = [{ id: rootId, depth: 0 }];

  const rootMedia = await anilistApi.getMedia(rootId);
  nodes.set(rootId, rootMedia);

  while (queue.length > 0) {
    const item = queue.shift()!;
    const media = await anilistApi.getMedia(item.id);

    for (const edge of media.relations?.edges || []) {
      const target = edge.node;
      if (!target || target.type !== 'ANIME') continue;
      if (edge.relationType === 'CHARACTER') continue;

      if (!nodes.has(target.id)) {
        nodes.set(target.id, target);
      }

      // Do NOT queue if edge is OTHER: OTHER nodes are terminal leaves!
      if (edge.relationType === 'OTHER') {
        continue;
      }

      if (!visited.has(target.id) && item.depth < 5) {
        visited.add(target.id);
        queue.push({ id: target.id, depth: item.depth + 1 });
      }
    }
  }

  console.log(`Fetched Evangelion nodes with terminal OTHER: ${nodes.size}`);
  for (const [id, m] of nodes.entries()) {
    console.log(`  - [${m.format}] ${m.title.english || m.title.romaji} (ID: ${id})`);
  }
}

testFixedBFS();
