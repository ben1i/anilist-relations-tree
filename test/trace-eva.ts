import { anilistApi } from '../src/services/anilistApi';

async function traceEva() {
  const franchise = await anilistApi.exploreFranchiseGraph(
    30,
    5,
    undefined,
    { mediaType: 'ANIME', includeCharacters: false }
  );

  console.log(`Total Anime fetched: ${franchise.nodes.size}`);

  for (const [id, media] of franchise.nodes.entries()) {
    console.log(`\n• [${id}] ${media.title.english || media.title.romaji} (${media.format})`);
    for (const edge of media.relations?.edges || []) {
      if (edge.node.type === 'ANIME') {
        console.log(`   └─ [${edge.relationType}] -> ${edge.node.title.english || edge.node.title.romaji} (ID: ${edge.node.id})`);
      }
    }
  }
}

traceEva();
