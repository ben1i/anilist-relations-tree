import { anilistApi } from '../src/services/anilistApi';

async function listEvaAnime() {
  const eva = await anilistApi.getMedia(30);
  console.log('--- REBUILD / MOVIES / SERIES OF EVANGELION ---');

  // Let's check Evangelion 1.0 Rebuild (ID 2759)
  const rebuild1 = await anilistApi.getMedia(2759);
  console.log(`Rebuild 1.0: ${rebuild1.title.english || rebuild1.title.romaji}`);
  for (const edge of rebuild1.relations?.edges || []) {
    if (edge.node.type === 'ANIME') {
      console.log(`  └─ [${edge.relationType}] -> ${edge.node.title.english || edge.node.title.romaji} (ID: ${edge.node.id})`);
    }
  }

  // How does Evangelion TV (30) connect to Rebuild 1.0 (2759)?
  console.log('\nDirect relations of Eva TV (30):');
  for (const edge of eva.relations?.edges || []) {
    if (edge.node.type === 'ANIME') {
      console.log(`  └─ [${edge.relationType}] -> ${edge.node.title.english || edge.node.title.romaji} (ID: ${edge.node.id})`);
    }
  }
}

listEvaAnime();
