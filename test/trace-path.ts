import { anilistApi } from '../src/services/anilistApi';

async function tracePath() {
  // Find path from 30 to 80
  const queue: Array<{ id: number; path: Array<{ fromId: number; toId: number; rel: string; title: string }> }> = [{ id: 30, path: [] }];
  const visited = new Set<number>([30]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === 80) {
      console.log('FOUND PATH TO GUNDAM:');
      for (const step of current.path) {
        console.log(`  -> [${step.rel}] to "${step.title}" (ID: ${step.toId})`);
      }
      return;
    }

    const media = await anilistApi.getMedia(current.id);
    for (const edge of media.relations?.edges || []) {
      if (edge.node.type !== 'ANIME') continue;
      if (edge.relationType === 'CHARACTER') continue;
      if (!visited.has(edge.node.id)) {
        visited.add(edge.node.id);
        queue.push({
          id: edge.node.id,
          path: [
            ...current.path,
            {
              fromId: current.id,
              toId: edge.node.id,
              rel: edge.relationType,
              title: edge.node.title.english || edge.node.title.romaji
            }
          ]
        });
      }
    }
  }
}

tracePath();
