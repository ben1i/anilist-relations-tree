import { anilistApi } from '../src/services/anilistApi';

async function testEvaFiltering() {
  const root = await anilistApi.getMedia(30);
  const queue: Array<{ id: number; depth: number; reachedViaOther: boolean }> = [
    { id: 30, depth: 0, reachedViaOther: false }
  ];
  const visited = new Set<number>([30]);
  const nodes: any[] = [];

  while (queue.length > 0) {
    const item = queue.shift()!;
    const media = await anilistApi.getMedia(item.id);
    nodes.push(media);

    for (const edge of media.relations?.edges || []) {
      const rel = edge.relationType;
      const target = edge.node;
      if (!target || target.type !== 'ANIME') continue;
      if (rel === 'CHARACTER') continue;

      // If we already reached this node via OTHER, do NOT continue jumping through OTHER
      const isOther = rel === 'OTHER';
      if (item.reachedViaOther && isOther) {
        continue;
      }

      // If rel is OTHER, and target title has no relation to the franchise, do not continue exploring from target
      // (e.g. Japan Animator Expo shouldn't jump to Gundam)

      if (!visited.has(target.id) && item.depth < 5) {
        visited.add(target.id);
        queue.push({
          id: target.id,
          depth: item.depth + 1,
          reachedViaOther: isOther || item.reachedViaOther
        });
      }
    }
  }

  console.log(`Total nodes with no cascading OTHER: ${nodes.length}`);
  const gundam = nodes.find((n) => (n.title.english || n.title.romaji || '').includes('Gundam'));
  console.log('Is Gundam still in there?', !!gundam);
  nodes.forEach((n) => console.log(`  - [${n.format}] ${n.title.english || n.title.romaji} (ID: ${n.id})`));
}

testEvaFiltering();
