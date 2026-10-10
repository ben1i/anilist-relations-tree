import { anilistApi } from '../src/services/anilistApi';

async function testCleanAnimeGraph() {
  const visited = new Set<number>();
  const queue = [9756];
  visited.add(9756);
  const animeNodes: any[] = [];
  const edges: any[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const media = await anilistApi.getMedia(id);
    animeNodes.push(media);

    for (const edge of media.relations?.edges || []) {
      const relType = edge.relationType;
      const target = edge.node;
      if (!target) continue;

      // Ignore CHARACTER (caméos/crossovers)
      if (relType === 'CHARACTER') continue;

      // Only ANIME
      if (target.type !== 'ANIME') continue;

      edges.push({
        from: media.id,
        fromTitle: media.title.english || media.title.romaji,
        to: target.id,
        toTitle: target.title.english || target.title.romaji,
        rel: relType
      });

      if (!visited.has(target.id)) {
        visited.add(target.id);
        queue.push(target.id);
      }
    }
  }

  console.log(`Total Anime Nodes: ${animeNodes.length}`);
  animeNodes.forEach((n) => console.log(`- [${n.format}] ${n.title.english || n.title.romaji} (ID: ${n.id})`));
}

testCleanAnimeGraph();
